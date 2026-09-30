import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  validateWorkshopRelease,
  validateWorldEngineRelease,
  workshopVersionFromSource,
  worldEngineVersionFromSource,
} from './release-policy.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const component = String(process.argv[2] || 'workshop').trim();
const requestedInput = String(process.argv[3] || '').trim();

let source;
let requestedVersion;
let release;

try {
  if (component === 'workshop') {
    source = fs.readFileSync(path.join(root, 'src/CreativeWorkshop/app/workshop-app.js'), 'utf8');
    requestedVersion = requestedInput || workshopVersionFromSource(source);
    release = validateWorkshopRelease(source, requestedVersion);
  } else if (component === 'world-engine') {
    source = fs.readFileSync(path.join(root, 'src/WorldEngine/core/WorldEngineFoundation.part.js'), 'utf8');
    const generated = fs.readFileSync(path.join(root, 'script/世界推进系统.js'), 'utf8');
    requestedVersion = requestedInput || worldEngineVersionFromSource(source);
    release = validateWorldEngineRelease(source, requestedVersion);
    const generatedVersion = worldEngineVersionFromSource(generated);
    if (generatedVersion !== release.version) {
      throw new Error(`生成交付 WORLD_ENGINE_VERSION ${generatedVersion} 与源码 ${release.version} 不一致`);
    }
  } else {
    throw new Error('发布组件必须是 workshop 或 world-engine');
  }

  const lines = [
    `component=${release.component}`,
    `version=${release.version}`,
    `tag=${release.tag}`,
  ];
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  console.log(`${component} 正式版本校验通过：${release.version} → ${release.tag}`);
} catch (error) {
  console.error(`${component} 正式版本校验失败：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
