function positiveTtl(value, fallback = 600) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function d1Put(env, key, value, ttl) {
  if (!env.DB?.prepare) return false;
  const now = nowSeconds();
  const expiresAt = now + positiveTtl(ttl);
  try {
    await env.DB.prepare('DELETE FROM auth_store WHERE expires_at <= ?').bind(now).run();
  } catch {}
  await env.DB.prepare(
    `INSERT INTO auth_store (key, value, expires_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`,
  ).bind(String(key), String(value), expiresAt, now).run();
  return true;
}

async function d1Get(env, key) {
  if (!env.DB?.prepare) return null;
  const row = await env.DB.prepare(
    'SELECT value, expires_at FROM auth_store WHERE key = ? LIMIT 1',
  ).bind(String(key)).first();
  if (!row) return null;
  if (Number(row.expires_at || 0) <= nowSeconds()) {
    try {
      await env.DB.prepare('DELETE FROM auth_store WHERE key = ?').bind(String(key)).run();
    } catch {}
    return null;
  }
  return String(row.value ?? '');
}

async function d1Delete(env, key) {
  if (!env.DB?.prepare) return false;
  await env.DB.prepare('DELETE FROM auth_store WHERE key = ?').bind(String(key)).run();
  return true;
}

export async function authStorePut(env, key, value, { expirationTtl = 600 } = {}) {
  try {
    if (await d1Put(env, key, value, expirationTtl)) return 'd1';
  } catch (error) {
    console.warn('[workshop-auth] D1 auth store write failed; falling back to KV', error instanceof Error ? error.message : String(error));
  }

  await env.SESSION_KV.put(
    String(key),
    String(value),
    { expirationTtl: positiveTtl(expirationTtl) },
  );
  return 'kv';
}

export async function authStoreGet(env, key) {
  try {
    const stored = await d1Get(env, key);
    if (stored !== null) return stored;
  } catch (error) {
    console.warn('[workshop-auth] D1 auth store read failed; trying legacy KV', error instanceof Error ? error.message : String(error));
  }

  try {
    return await env.SESSION_KV?.get?.(String(key)) ?? null;
  } catch (error) {
    console.warn('[workshop-auth] legacy KV read failed', error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function authStoreDelete(env, key) {
  let removed = false;
  try {
    removed = await d1Delete(env, key) || removed;
  } catch (error) {
    console.warn('[workshop-auth] D1 auth store delete failed', error instanceof Error ? error.message : String(error));
  }
  try {
    if (env.SESSION_KV?.delete) {
      await env.SESSION_KV.delete(String(key));
      removed = true;
    }
  } catch (error) {
    console.warn('[workshop-auth] legacy KV delete failed', error instanceof Error ? error.message : String(error));
  }
  return removed;
}
