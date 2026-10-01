import { OPENING_VERSION } from '../version.js';

export const OPENING_COMPONENT = Object.freeze({
  id: 'opening',
  label: '开局系统',
  version: OPENING_VERSION,
  entryPath: '/src/opening/entry.html',
  sourcePath: 'src/opening/entry.html',
  tagPrefixes: ['opening-v'],
});

const UPDATE_CHANNELS = new Set(['stable', 'testing']);

export function getOpeningUpdateChannel(env = {}) {
  const configured = String(env.OPENING_UPDATE_CHANNEL || '').trim().toLowerCase();
  return UPDATE_CHANNELS.has(configured) ? configured : 'testing';
}

export function getOpeningUpdateRef(env = {}) {
  const configured = String(env.OPENING_UPDATE_REF || '').trim();
  if (configured) return configured;
  return getOpeningUpdateChannel(env) === 'testing' ? 'main' : 'opening-v*';
}

export function openingCdnUrl({
  repository,
  sha,
  entryPath = OPENING_COMPONENT.entryPath,
}) {
  const safeRepository = String(repository || '').trim();
  const safeSha = String(sha || '').trim();
  if (!safeRepository) throw new Error('缺少 Opening 仓库');
  if (!/^[0-9a-f]{40}$/iu.test(safeSha)) throw new Error('Opening SHA 无效');

  const encodedPath = String(entryPath || '')
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');

  return `https://cdn.jsdelivr.net/gh/${safeRepository}@${safeSha}/${encodedPath}?v=${safeSha.slice(0, 12)}`;
}
