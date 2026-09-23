import { HttpError, json, readJson } from '../http.js';
import {
  assertModerator, moderationText, nowSeconds, writeModerationAudit,
} from './common.js';

function assertPrimaryAdmin(user) {
  if (!Number(user?.is_admin)) throw new HttpError(403, 'admin_required', '需要主管理员权限');
}

function userView(row) {
  return {
    id: Number(row.id),
    discord_id: row.discord_id,
    username: row.username,
    display_name: row.display_name,
    avatar: row.avatar || null,
    is_admin: Number(row.is_admin || 0),
    is_moderator: Number(row.is_moderator || 0),
    is_banned: Number(row.is_banned || 0),
    ban_reason: row.ban_reason || '',
    banned_at: Number(row.banned_at || 0),
    project_count: Number(row.project_count || 0),
    created_at: Number(row.created_at || 0),
    updated_at: Number(row.updated_at || 0),
  };
}

export async function listAdminUsers(request, env, user) {
  assertPrimaryAdmin(user);
  const url = new URL(request.url);
  const query = (url.searchParams.get('query') || '').trim().slice(0, 100);
  const bannedRaw = (url.searchParams.get('banned') || '').trim();
  if (bannedRaw && !['0', '1'].includes(bannedRaw)) {
    throw new HttpError(400, 'invalid_banned_filter', 'banned 只能是 0 或 1');
  }
  const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0);
  const like = `%${query}%`;

  const result = await env.DB.prepare(
    `SELECT u.id, u.discord_id, u.username, u.display_name, u.avatar, u.is_admin, u.is_moderator,
            u.is_banned, u.ban_reason, u.banned_at, u.created_at, u.updated_at,
            COUNT(p.id) AS project_count
       FROM users u
       LEFT JOIN projects p ON p.owner_user_id = u.id
      WHERE (? = '' OR u.display_name LIKE ? OR u.username LIKE ? OR u.discord_id LIKE ?)
        AND (? = '' OR u.is_banned = CAST(? AS INTEGER))
      GROUP BY u.id
      ORDER BY u.is_admin DESC, u.is_moderator DESC, u.is_banned DESC, u.updated_at DESC
      LIMIT ? OFFSET ?`,
  ).bind(query, like, like, like, bannedRaw, bannedRaw, limit + 1, offset).all();
  const rows = result.results || [];
  return json({ items: rows.slice(0, limit).map(userView), next_offset: rows.length > limit ? offset + limit : null });
}

export async function setUserModerator(request, env, user, targetUserId) {
  assertPrimaryAdmin(user);
  const targetId = Number(targetUserId);
  if (!Number.isInteger(targetId) || targetId < 1) throw new HttpError(400, 'invalid_user_id', '用户 ID 无效');
  const target = await env.DB.prepare(
    'SELECT id, is_admin, is_moderator, is_banned FROM users WHERE id = ?',
  ).bind(targetId).first();
  if (!target) throw new HttpError(404, 'user_not_found', '用户不存在');
  if (Number(target.is_admin)) throw new HttpError(409, 'cannot_change_admin_role', '主管理员权限由服务器配置管理');
  if (Number(target.is_banned)) throw new HttpError(409, 'banned_user_role_forbidden', '已封禁用户不能设为审核员');

  const body = await readJson(request);
  if (typeof body?.moderator !== 'boolean') throw new HttpError(400, 'invalid_moderator_state', 'moderator 必须是布尔值');
  const now = nowSeconds();
  await env.DB.prepare('UPDATE users SET is_moderator = ?, updated_at = ? WHERE id = ?')
    .bind(body.moderator ? 1 : 0, now, targetId).run();
  await writeModerationAudit(env, user, {
    action: body.moderator ? 'moderator_granted' : 'moderator_revoked',
    targetUserId: targetId,
  });
  const updated = await env.DB.prepare(
    `SELECT u.id, u.discord_id, u.username, u.display_name, u.avatar, u.is_admin, u.is_moderator,
            u.is_banned, u.ban_reason, u.banned_at, u.created_at, u.updated_at,
            (SELECT COUNT(*) FROM projects p WHERE p.owner_user_id = u.id) AS project_count
       FROM users u WHERE u.id = ?`,
  ).bind(targetId).first();
  return json({ user: userView(updated) });
}

export async function setUserBan(request, env, user, targetUserId) {
  assertPrimaryAdmin(user);
  const targetId = Number(targetUserId);
  if (!Number.isInteger(targetId) || targetId < 1) throw new HttpError(400, 'invalid_user_id', '用户 ID 无效');
  if (Number(user.id) === targetId) throw new HttpError(409, 'cannot_ban_self', '不能封禁自己的管理员账号');

  const target = await env.DB.prepare(
    `SELECT id, discord_id, username, display_name, avatar, is_admin, is_moderator, is_banned,
            ban_reason, banned_at, created_at, updated_at
       FROM users WHERE id = ?`,
  ).bind(targetId).first();
  if (!target) throw new HttpError(404, 'user_not_found', '用户不存在');

  const body = await readJson(request);
  if (typeof body?.banned !== 'boolean') throw new HttpError(400, 'invalid_ban_state', 'banned 必须是布尔值');
  if (body.banned && (Number(target.is_admin) || Number(target.is_moderator))) {
    throw new HttpError(409, 'cannot_ban_staff', '请先取消该用户的管理身份');
  }
  const reason = body.banned ? moderationText(body?.reason ?? '', 'reason', 1000, { required: true }) : '';
  const now = nowSeconds();
  await env.DB.prepare(
    'UPDATE users SET is_banned = ?, ban_reason = ?, banned_at = ?, updated_at = ? WHERE id = ?',
  ).bind(body.banned ? 1 : 0, reason, body.banned ? now : null, now, targetId).run();

  await writeModerationAudit(env, user, {
    action: body.banned ? 'user_banned' : 'user_unbanned',
    targetUserId: targetId,
    note: reason,
  });
  const updated = await env.DB.prepare(
    `SELECT u.id, u.discord_id, u.username, u.display_name, u.avatar, u.is_admin, u.is_moderator,
            u.is_banned, u.ban_reason, u.banned_at, u.created_at, u.updated_at,
            (SELECT COUNT(*) FROM projects p WHERE p.owner_user_id = u.id) AS project_count
       FROM users u WHERE u.id = ?`,
  ).bind(targetId).first();
  return json({ user: userView(updated) });
}
