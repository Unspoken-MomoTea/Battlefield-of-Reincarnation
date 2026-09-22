export const RELEASE_TARGETS = Object.freeze({
  staging: { ref: 'main', channel: 'testing', label: '测试服' },
  production: { ref: 'workshop-stable', channel: 'stable', label: '正式服' },
});

export function releasePlan(target) {
  if (target === 'both') return ['staging', 'production'];
  if (Object.hasOwn(RELEASE_TARGETS, target)) return [target];
  throw new Error('请选择 staging、production 或 both');
}

export function validateReleaseConfig(config, target) {
  const expected = RELEASE_TARGETS[target];
  if (!expected) throw new Error('未知环境');
  const env = config.env?.[target];
  if (!env) throw new Error(`缺少 env.${target}`);
  if (/REPLACE_ME|00000000-0000-0000-0000-000000000000|00000000000000000000000000000000/u.test(JSON.stringify(env))) {
    throw new Error(`${expected.label}仍有占位配置，请先配置 D1 / KV / Discord Client ID`);
  }
  for (const [key, value] of Object.entries({ DB: env.d1_databases, SESSION_KV: env.kv_namespaces, PROJECTS: env.r2_buckets })) {
    const binding = value?.find(item => item.binding === key);
    const id = binding?.database_id ?? binding?.id ?? binding?.bucket_name;
    if (!id) throw new Error(`${expected.label}缺少 ${key} 资源`);
    const other = config.env?.[target === 'staging' ? 'production' : 'staging'];
    const resources = [...(other?.d1_databases ?? []), ...(other?.kv_namespaces ?? []), ...(other?.r2_buckets ?? [])];
    if (resources.some(item => (item.database_id ?? item.id ?? item.bucket_name) === id)) {
      throw new Error(`${key} 被测试服和正式服共用，拒绝更新`);
    }
  }
  if (!env.vars?.DISCORD_CLIENT_ID || !env.vars?.PUBLIC_BASE_URL) throw new Error('缺少 Discord / API 配置');
  if (env.vars.CLIENT_UPDATE_REF !== expected.ref || env.vars.CLIENT_UPDATE_CHANNEL !== expected.channel) {
    throw new Error(`${expected.label}更新通道必须是 ${expected.channel} / ${expected.ref}`);
  }
  const url = new URL(env.vars.PUBLIC_BASE_URL);
  if (url.protocol !== 'https:') throw new Error('远程 API 必须使用 HTTPS');
  const otherEnv = config.env?.[target === 'staging' ? 'production' : 'staging'];
  if (!env.name || env.name === otherEnv?.name || env.vars.PUBLIC_BASE_URL === otherEnv?.vars?.PUBLIC_BASE_URL) {
    throw new Error('测试服与正式服必须使用不同的 Worker 名称和 API 地址');
  }
  return env;
}
