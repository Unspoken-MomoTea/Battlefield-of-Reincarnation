import { record } from './utils.js';

export function provenance(entry) {
  return record(entry?.extra)?.reincarnationWorkshop;
}

export function isProjectWorldbookEntry(entry, projectId) {
  return record(provenance(entry))?.sourceId === projectId;
}

export function regexPrefix(projectId) {
  return `rw:${projectId}:`;
}


export function scriptPrefix(projectId) {
  return `rw:${projectId}:script:`;
}

export function isProjectScriptTree(tree, projectId) {
  return String(tree?.id || '').startsWith(scriptPrefix(projectId));
}
