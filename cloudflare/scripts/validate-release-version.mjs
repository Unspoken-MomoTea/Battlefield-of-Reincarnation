import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { validateWorkshopRelease } from './release-policy.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const sourcePath = path.join(root, 'src/CreativeWorkshop/app/workshop-app.js');
const requestedVersion = String(process.argv[2] || '').trim();

if (!requestedVersion) {
  console.error('请提供正式版本号，例如：node scripts/validate-release-version.mjs 1.12.1');
  process.exit(2);
}

try {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const release = validateWorkshopRelease(source, requestedVersion);
  const lines = [
    `version=${release.version}`,
    `tag=${release.tag}`,
  ];

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  }

  console.log(`正式版本校验通过：${release.version} → ${release.tag}`);
} catch (error) {
  console.error(`正式版本校验失败：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
