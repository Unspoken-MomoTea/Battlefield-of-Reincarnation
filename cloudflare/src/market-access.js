import { HttpError } from './http.js';

async function first(env, sql, args = []) {
  return env.DB.prepare(sql).bind(...args).first();
}

export async function assertMarketUserAllowed(env, user) {
  const row = await first(
    env,
    'SELECT reason FROM market_user_blocks WHERE user_id = ? LIMIT 1',
    [user?.id],
  );
  if (row) {
    throw new HttpError(
      403,
      'market_user_blocked',
      row.reason ? '空间集市交易权限已冻结：' + row.reason : '空间集市交易权限已被冻结',
    );
  }
}

export async function isMarketUserBlocked(env, userId) {
  return Boolean(await first(
    env,
    'SELECT user_id FROM market_user_blocks WHERE user_id = ? LIMIT 1',
    [userId],
  ));
}
