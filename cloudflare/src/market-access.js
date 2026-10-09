import { HttpError } from './http.js';

export async function assertMarketActive(env, user) {
  if (!user?.id) throw new HttpError(401, 'auth_required', '需要登录');
  const row = await env.DB.prepare(
    'SELECT is_suspended, note FROM market_user_controls WHERE user_id = ? LIMIT 1',
  ).bind(user.id).first();
  if (Number(row?.is_suspended)) {
    throw new HttpError(
      403,
      'market_suspended',
      row.note ? '空间集市交易权限已冻结：' + row.note : '空间集市交易权限已冻结',
    );
  }
}

export async function marketControlFor(env, userId) {
  const row = await env.DB.prepare(
    'SELECT is_suspended, note, updated_at FROM market_user_controls WHERE user_id = ? LIMIT 1',
  ).bind(userId).first();
  return {
    is_suspended: Number(row?.is_suspended || 0),
    note: String(row?.note || ''),
    updated_at: Number(row?.updated_at || 0),
  };
}
