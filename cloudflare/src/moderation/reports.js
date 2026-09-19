import { HttpError, json, readJson } from '../http.js';
import {
  assertModerator, moderationText, nowSeconds, writeModerationAudit,
} from './common.js';

const REASONS = new Set(['malicious', 'broken', 'inappropriate', 'stolen', 'other']);
const STATUSES = new Set(['open', 'resolved', 'dismissed']);

function reportView(row) {
  return {
    id: Number(row.id),
    project_id: row.project_id,
    project_version: Number(row.project_version),
    project_name: row.project_name || '',
    project_status: row.project_status || '',
    owner_name: row.owner_name || '',
    reporter_name: row.reporter_name || '',
    reporter_discord_id: row.reporter_discord_id || '',
    reason: row.reason,
    details: row.details || '',
    status: row.status,
    resolution_note: row.resolution_note || '',
    resolver_name: row.resolver_name || '',
    created_at: Number(row.created_at || 0),
    resolved_at: Number(row.resolved_at || 0),
  };
}

async function getReport(env, reportId) {
  return env.DB.prepare(
    `SELECT r.id, r.project_id, r.project_version, r.reason, r.details, r.status,
            r.resolution_note, r.created_at, r.resolved_at,
            pv.name AS project_name, p.status AS project_status,
            owner.display_name AS owner_name,
            reporter.display_name AS reporter_name, reporter.discord_id AS reporter_discord_id,
            resolver.display_name AS resolver_name
       FROM project_reports r
       JOIN projects p ON p.id = r.project_id
       JOIN project_versions pv ON pv.project_id = r.project_id AND pv.version = r.project_version
       JOIN users owner ON owner.id = p.owner_user_id
       JOIN users reporter ON reporter.id = r.reporter_user_id
       LEFT JOIN users resolver ON resolver.id = r.resolved_by_user_id
      WHERE r.id = ?`,
  ).bind(reportId).first();
}

export async function createProjectReport(request, env, user, projectId) {
  const project = await env.DB.prepare(
    'SELECT id, owner_user_id, published_version, status FROM projects WHERE id = ?',
  ).bind(projectId).first();
  if (!project || Number(project.published_version) < 1 || project.status === 'archived') {
    throw new HttpError(404, 'project_not_found', '已发布作品不存在');
  }
  if (Number(project.owner_user_id) === Number(user.id)) {
    throw new HttpError(409, 'cannot_report_own_project', '不能举报自己的作品');
  }

  const body = await readJson(request);
  const reason = String(body?.reason || '').trim();
  if (!REASONS.has(reason)) {
    throw new HttpError(400, 'invalid_report_reason', '举报原因无效');
  }
  const details = moderationText(body?.details ?? '', 'details', 1000);
  const existing = await env.DB.prepare(
    "SELECT id FROM project_reports WHERE project_id = ? AND reporter_user_id = ? AND status = 'open'",
  ).bind(projectId, user.id).first();
  if (existing) throw new HttpError(409, 'report_exists', '你已经提交过尚未处理的举报');

  const now = nowSeconds();
  const result = await env.DB.prepare(
    `INSERT INTO project_reports
      (project_id, project_version, reporter_user_id, reason, details, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`,
  ).bind(projectId, project.published_version, user.id, reason, details, now).run();

  const report = await getReport(env, Number(result.meta?.last_row_id || 0));
  return json({ report: reportView(report) }, 201);
}

export async function listAdminReports(request, env, user) {
  assertModerator(user);
  const url = new URL(request.url);
  const status = (url.searchParams.get('status') || '').trim();
  if (status && !STATUSES.has(status)) {
    throw new HttpError(400, 'invalid_report_status', '举报状态无效');
  }
  const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0);
  const result = await env.DB.prepare(
    `SELECT r.id, r.project_id, r.project_version, r.reason, r.details, r.status,
            r.resolution_note, r.created_at, r.resolved_at,
            pv.name AS project_name, p.status AS project_status,
            owner.display_name AS owner_name,
            reporter.display_name AS reporter_name, reporter.discord_id AS reporter_discord_id,
            resolver.display_name AS resolver_name
       FROM project_reports r
       JOIN projects p ON p.id = r.project_id
       JOIN project_versions pv ON pv.project_id = r.project_id AND pv.version = r.project_version
       JOIN users owner ON owner.id = p.owner_user_id
       JOIN users reporter ON reporter.id = r.reporter_user_id
       LEFT JOIN users resolver ON resolver.id = r.resolved_by_user_id
      WHERE (? = '' OR r.status = ?)
      ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END, r.created_at DESC
      LIMIT ? OFFSET ?`,
  ).bind(status, status, limit + 1, offset).all();
  const rows = result.results || [];
  return json({
    items: rows.slice(0, limit).map(reportView),
    next_offset: rows.length > limit ? offset + limit : null,
  });
}

export async function resolveProjectReport(request, env, user, reportId) {
  assertModerator(user);
  const id = Number(reportId);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'invalid_report_id', '举报 ID 无效');

  const current = await getReport(env, id);
  if (!current) throw new HttpError(404, 'report_not_found', '举报不存在');
  if (current.status !== 'open') throw new HttpError(409, 'report_closed', '举报已经处理');

  const body = await readJson(request);
  const status = String(body?.status || '').trim();
  if (!['resolved', 'dismissed'].includes(status)) {
    throw new HttpError(400, 'invalid_report_status', '处理结果必须是 resolved 或 dismissed');
  }
  const note = moderationText(body?.note ?? '', 'note', 1000);
  const now = nowSeconds();
  await env.DB.prepare(
    `UPDATE project_reports
        SET status = ?, resolution_note = ?, resolved_by_user_id = ?, resolved_at = ?
      WHERE id = ?`,
  ).bind(status, note, user.id, now, id).run();

  await writeModerationAudit(env, user, {
    action: status === 'resolved' ? 'report_resolved' : 'report_dismissed',
    projectId: current.project_id,
    projectVersion: Number(current.project_version),
    note,
  });

  return json({ report: reportView(await getReport(env, id)) });
}
