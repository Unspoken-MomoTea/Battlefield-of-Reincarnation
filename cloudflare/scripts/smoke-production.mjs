import { createHash } from 'node:crypto';

const base = String(process.env.WORKSHOP_PRODUCTION_BASE_URL || 'https://workshop.6661816.xyz')
  .replace(/\/+$/u, '');
const shaPattern = /^[0-9a-f]{40}$/iu;
const skipClientLatest = process.argv.includes('--skip-client-latest');

// Formal release readiness includes the Bazaar: a healthy Worker that silently
// disables market routes must never pass production smoke tests again.

async function retry(label, fn, attempts = 8) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      console.log(`${label} attempt ${attempt}/${attempts} failed: ${error instanceof Error ? error.message : String(error)}`);
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  throw last;
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init.headers || {}) },
    signal: init.signal || AbortSignal.timeout(10000),
  });
  const body = await response.json();
  return { response, body };
}

await retry('health', async () => {
  const { response, body } = await fetchJson(`${base}/api/health`);
  if (
    !response.ok
    || body.ok !== true
    || body.update_channel !== 'stable'
    || body.update_ref !== 'workshop-stable'
  ) {
    throw new Error(`unexpected health response: ${response.status} ${JSON.stringify(body)}`);
  }
  console.log('Production health passed:', body);
});

if (!skipClientLatest) {
  const clientLatest = await retry('client latest', async () => {
    const { response, body } = await fetchJson(`${base}/api/client/latest`);
    if (
      !response.ok
      || !shaPattern.test(String(body.sha || ''))
      || body.channel !== 'stable'
      || body.ref !== 'workshop-stable'
      || !['tag', 'legacy-ref'].includes(String(body.release_source || ''))
    ) {
      throw new Error(`unexpected client latest response: ${response.status} ${JSON.stringify(body)}`);
    }
    return body;
  });
  console.log('Production client latest passed:', clientLatest);
  
} else {
  console.log('Production client latest skipped before stable promotion to avoid warming the previous release.');
}

await retry('stable Bazaar catalog', async () => {
  const {response,body} = await fetchJson(`${base}/api/market/catalog?limit=3`);
  if (!response.ok || !Array.isArray(body.items) || !('next_offset' in body)) {
    throw new Error(`production Bazaar catalog not available: ${response.status} ${JSON.stringify(body)}`);
  }
  console.log('Production Bazaar catalog passed:',body.items.length,'items');
});

await retry('stable Bazaar free orders', async () => {
  const {response,body} = await fetchJson(`${base}/api/market/deals?limit=3`);
  if (!response.ok || !Array.isArray(body.items) || !('next_offset' in body)) {
    throw new Error(`production Bazaar orders not available: ${response.status} ${JSON.stringify(body)}`);
  }
  console.log('Production Bazaar orders passed:',body.items.length,'items');
});

const openingComponent = await retry('opening component', async () => {
  const { response, body } = await fetchJson(`${base}/api/components/latest?component=opening`);
  if (
    !response.ok
    || body.component !== 'opening'
    || body.channel !== 'testing'
    || body.ref !== 'main'
    || !shaPattern.test(String(body.sha || ''))
    || body.entry_path !== '/dist/opening/entry.html'
  ) {
    throw new Error(`unexpected opening component response: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
});
console.log('Production opening metadata passed:', openingComponent);

const opening = await retry('opening latest', async () => {
  const response = await fetch(`${base}/opening/latest`, {
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  const location = response.headers.get('location') || '';
  if (response.status !== 302) throw new Error(`unexpected opening status: ${response.status}`);
  if (response.headers.get('x-opening-channel') !== 'testing') {
    throw new Error(`unexpected opening channel: ${response.headers.get('x-opening-channel')}`);
  }
  if (response.headers.get('x-opening-ref') !== 'main') {
    throw new Error(`unexpected opening ref: ${response.headers.get('x-opening-ref')}`);
  }
  if (response.headers.get('x-opening-sha') !== openingComponent.sha) {
    throw new Error(
      `opening sha mismatch: redirect=${response.headers.get('x-opening-sha')} metadata=${openingComponent.sha}`,
    );
  }
  if (!/@[0-9a-f]{40}\/dist\/opening\/entry\.html\?v=/iu.test(location)) {
    throw new Error(`unexpected opening location: ${location}`);
  }
  return location;
});

const openingHtml = await retry('opening html', async () => {
  const response = await fetch(opening, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  if (
    !response.ok
    || !text.startsWith('<!DOCTYPE html>')
    || !text.includes('class="wizard-layout"')
    || !text.includes('executeJourney')
  ) {
    throw new Error(`unexpected opening HTML: ${response.status}, length=${text.length}`);
  }
  return text;
});
console.log('Production opening delivery passed:', opening, 'bytes=', openingHtml.length);

const runSeed = String(process.env.GITHUB_RUN_ID || Date.now());
const loginId = createHash('sha256').update(`workshop-production-smoke:${runSeed}`).digest('hex');
await retry('discord start', async () => {
  const response = await fetch(
    `${base}/api/auth/discord/start?login_id=${loginId}`,
    { redirect: 'manual', signal: AbortSignal.timeout(10000) },
  );
  const location = response.headers.get('location') || '';
  if (response.status !== 302 || !location.startsWith('https://discord.com/oauth2/authorize')) {
    throw new Error(`unexpected Discord start response: ${response.status} ${location}`);
  }
  const redirectUri = new URL(location).searchParams.get('redirect_uri');
  if (redirectUri !== `${base}/api/auth/discord/callback`) {
    throw new Error(`unexpected Discord callback: ${redirectUri}`);
  }
});

const origin = 'https://client-smoke.invalid';
const exchange = await fetch(`${base}/api/auth/exchange`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify({ login_id: loginId }),
  signal: AbortSignal.timeout(10000),
});
if (exchange.status !== 409 || exchange.headers.get('access-control-allow-origin') !== origin) {
  throw new Error(`production auth polling/CORS failed: ${exchange.status}`);
}
console.log('Production Discord auth/CORS passed.');
