import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(here, '../wrangler.jsonc');

function readConfig() {
  const raw = fs.readFileSync(configPath, 'utf8');
  const json = raw
    .split(/\r?\n/u)
    .filter(line => !line.trimStart().startsWith('//'))
    .join('\n');
  return JSON.parse(json);
}

function resourceId(env, binding) {
  const sources = [
    ...(env.d1_databases || []),
    ...(env.kv_namespaces || []),
    ...(env.r2_buckets || []),
  ];
  const item = sources.find(value => value.binding === binding);
  return item?.database_id ?? item?.id ?? item?.bucket_name ?? null;
}

test('staging and production share one Cloudflare data set but keep separate code channels', () => {
  const config = readConfig();
  const staging = config.env.staging;
  const production = config.env.production;

  assert.equal(resourceId(staging, 'DB'), resourceId(production, 'DB'));
  assert.equal(resourceId(staging, 'SESSION_KV'), resourceId(production, 'SESSION_KV'));
  assert.equal(resourceId(staging, 'PROJECTS'), resourceId(production, 'PROJECTS'));

  assert.notEqual(staging.name, production.name);
  assert.notEqual(staging.vars.PUBLIC_BASE_URL, production.vars.PUBLIC_BASE_URL);
  assert.equal(staging.vars.CLIENT_UPDATE_CHANNEL, 'testing');
  assert.equal(staging.vars.CLIENT_UPDATE_REF, 'main');
  assert.equal(production.vars.CLIENT_UPDATE_CHANNEL, 'stable');
  assert.equal(production.vars.CLIENT_UPDATE_REF, 'workshop-stable');
  assert.equal(staging.vars.DISCORD_CLIENT_ID, production.vars.DISCORD_CLIENT_ID);
  assert.equal(staging.vars.ADMIN_DISCORD_IDS, production.vars.ADMIN_DISCORD_IDS);
});
