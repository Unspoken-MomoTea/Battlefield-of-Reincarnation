import { OPENING_COMPONENT } from './component.js';

export function inspectOpeningInstallation(files = []) {
  const existing = new Set(files.map(file => String(file)));
  const required = OPENING_COMPONENT.repair.requiredFiles;
  const missing = required.filter(file => !existing.has(file));

  return {
    id: OPENING_COMPONENT.id,
    label: OPENING_COMPONENT.label,
    version: OPENING_COMPONENT.version,
    healthy: missing.length === 0,
    repairable: true,
    missing,
    loader: OPENING_COMPONENT.repair.loader,
    requiredFiles: [...required],
  };
}
