import { HttpError } from '../http.js';

export async function upsertDiscordUser(env, discordUser) {
  const now = Math.floor(Date.now() / 1000);
  const displayName = discordUser.global_name || discordUser.username;
  const adminIds = new Set(
    String(env.ADMIN_DISCORD_IDS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
  );
  const isAdmin = adminIds.has(String(discordUser.id)) ? 1 : 0;

  await env.DB.prepare(
    `INSERT INTO users (discord_id, username, display_name, avatar, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(discord_id) DO UPDATE SET
       username = excluded.username,
       display_name = excluded.display_name,
       avatar = excluded.avatar,
       is_admin = excluded.is_admin,
       updated_at = excluded.updated_at`,
  )
    .bind(
      String(discordUser.id),
      String(discordUser.username),
      String(displayName),
      discordUser.avatar ? String(discordUser.avatar) : null,
      isAdmin,
      now,
      now,
    )
    .run();

  const user = await env.DB.prepare(
    'SELECT id, discord_id, username, display_name, avatar, is_admin, is_banned, ban_reason, banned_at, created_at, updated_at FROM users WHERE discord_id = ?',
  )
    .bind(String(discordUser.id))
    .first();
  if (!user) throw new HttpError(500, 'user_upsert_failed', '用户资料保存失败');
  return user;
}

export async function getUserById(env, userId) {
  return env.DB.prepare(
    'SELECT id, discord_id, username, display_name, avatar, is_admin, is_banned, ban_reason, banned_at, created_at, updated_at FROM users WHERE id = ?',
  )
    .bind(userId)
    .first();
}
