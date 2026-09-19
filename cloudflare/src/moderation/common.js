import { HttpError } from '../http.js';

export function assertModerator(user) {
  if (!Number(user?.is_admin)) throw new HttpError(403, 'admin_required', '需要管理员权限');
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function moderationText(value, name, max, { required = false } = {}) {
  if (typeof value !== 'string') throw new HttpError(400, 'invalid_input', `${name} 必须是字符串`);
  const text = value.trim();
  if (required && !text) throw new HttpError(400, 'invalid_input', `${name} 不能为空`);
  if (text.length > max) throw new HttpError(400, 'invalid_input', `${name} 不能超过 ${max} 个字符`);
  return text;
}

export async function writeModerationAudit(
  env,
  user,
  { action, projectId = null, projectVersion = null, targetUserId = null, note = '' },
) {
  await env.DB.prepare(
    `INSERT INTO admin_audit_logs
      (actor_user_id, project_id, project_version, target_user_id, action, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(user.id, projectId, projectVersion, targetUserId, action, note, nowSeconds())
    .run();
}
