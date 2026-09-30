import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  validateWorldEngineRelease,
  worldEngineVersionFromSource,
} from './release-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const git = process.platform === 'win32' ? 'git.exe' : 'git';
const argv = process.argv.slice(2);
const preview = argv.includes('--dry-run');
const extraArgs = argv.filter(arg => arg !== '--dry-run');

function run(command, args, cwd = root, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    stdio: capture ? 'pipe' : 'inherit',
    env: { ...process.env, CI: 'true' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${path.basename(command)} ${args[0] || ''} 失败（${result.status}）` +
      (capture && result.stderr ? `\n${result.stderr}` : ''),
    );
  }
  return String(result.stdout || '').trim();
}

function tryRun(command, args, cwd = root) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
    env: { ...process.env, CI: 'true' },
  });
}

function npmCli() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
  ];
  const result = candidates.find(value => value && fs.existsSync(value));
  if (!result) throw new Error('找不到 npm-cli.js，请安装包含 npm 的 Node.js 22 或更高版本');
  return result;
}

async function question(prompt) {
  if (!process.stdin.isTTY) throw new Error('请从交互终端或双击 BAT 发布工具运行');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
}

function remoteTagExists(tag) {
  const result = tryRun(git, ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`]);
  if (result.status === 0) return true;
  if (result.status === 2) return false;
  throw new Error(`无法确认远端 Tag ${tag} 是否存在：${result.stderr || result.stdout}`);
}

function localTagExists(tag) {
  return tryRun(git, ['show-ref', '--verify', '--quiet', `refs/tags/${tag}`]).status === 0;
}

function pythonCommand() {
  for (const candidate of process.platform === 'win32' ? ['py', 'python'] : ['python3', 'python']) {
    const result = tryRun(candidate, ['--version']);
    if (result.status === 0) return candidate;
  }
  throw new Error('找不到 Python，无法校验世界推进生成交付');
}

async function main() {
  if (extraArgs.length) throw new Error('参数无效；仅支持 --dry-run');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('需要 Node.js 22 或更高版本');

  console.log('\n读取世界推进正式发布目标…');
  run(git, ['fetch', '--tags', 'origin', 'main']);
  const targetSha = run(git, ['rev-parse', 'origin/main^{commit}'], root, true);

  const source = run(
    git,
    ['show', `${targetSha}:src/WorldEngine/core/WorldEngineFoundation.part.js`],
    root,
    true,
  );
  const generated = run(
    git,
    ['show', `${targetSha}:script/世界推进系统.js`],
    root,
    true,
  );
  const version = worldEngineVersionFromSource(source);
  const release = validateWorldEngineRelease(source, version);
  const generatedVersion = worldEngineVersionFromSource(generated);
  if (generatedVersion !== release.version) {
    throw new Error(`生成交付 WORLD_ENGINE_VERSION ${generatedVersion} 与源码 ${release.version} 不一致`);
  }

  if (remoteTagExists(release.tag)) {
    throw new Error(`世界推进正式 Tag ${release.tag} 已存在。请先提升 WORLD_ENGINE_VERSION。`);
  }
  if (localTagExists(release.tag)) {
    throw new Error(`本地 Tag ${release.tag} 已存在但远端不存在，请先人工确认。`);
  }

  console.log('\n============================================================');
  console.log('              轮回战场 · 世界推进正式发布');
  console.log('============================================================');
  console.log(`发布目标：    ${targetSha.slice(0, 12)}（origin/main）`);
  console.log(`世界推进版本：v${release.version}`);
  console.log(`世界推进 Tag：${release.tag}`);
  console.log('创意工坊版本和 workshop-stable 不会被本流程修改。');
  console.log('============================================================');

  if (preview) {
    console.log('\n[预演] 将校验生成交付并运行世界推进完整回归，然后仅创建世界推进 Tag。');
    console.log('[预演] 不会创建 Tag 或 push。');
    return;
  }

  const confirm = await question(`\n输入 WORLD-ENGINE ${release.version} 确认发布世界推进：`);
  if (confirm !== `WORLD-ENGINE ${release.version}`) {
    console.log('已取消世界推进正式发布。');
    return;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rw-world-engine-release-'));
  const checkout = path.join(tempRoot, 'release');
  let worktreeAdded = false;
  let tagCreated = false;
  let published = false;

  try {
    console.log('\n建立临时发布检出…');
    run(git, ['worktree', 'add', '--detach', checkout, targetSha]);
    worktreeAdded = true;

    const npm = npmCli();
    console.log('\n安装世界推进 UI 回归依赖…');
    run(process.execPath, [npm, 'install', '--no-save', '--no-package-lock', 'playwright@1.63.0'], checkout);
    run(process.execPath, [path.join(checkout, 'node_modules/playwright/cli.js'), 'install', 'chromium'], checkout);

    const python = pythonCommand();
    console.log('\n校验世界推进生成交付同步…');
    run(python, ['tools/build-world-engine.py', '--check'], checkout);

    console.log('\n检查世界推进生成脚本语法…');
    run(process.execPath, ['--check', path.join(checkout, 'script/世界推进系统.js')], checkout);

    console.log('\n运行世界推进完整回归…');
    run(process.execPath, ['tests/run-world-engine-suite.cjs'], checkout);

    console.log('\n重新确认远端状态…');
    run(git, ['fetch', '--tags', 'origin', 'main']);
    const latestMain = run(git, ['rev-parse', 'origin/main^{commit}'], root, true);
    if (latestMain !== targetSha) throw new Error('测试期间 origin/main 又有新提交，请重新运行发布工具。');
    if (remoteTagExists(release.tag)) throw new Error(`测试期间 Tag ${release.tag} 已创建，请重新检查。`);

    console.log('\n创建世界推进不可变 Tag…');
    run(git, [
      '-c', 'user.name=Reincarnation World Engine Release',
      '-c', 'user.email=world-engine-release@local.invalid',
      'tag', '-a', release.tag, targetSha,
      '-m', `Reincarnation World Engine v${release.version}`,
    ]);
    tagCreated = true;

    console.log('\n推送世界推进 Tag…');
    run(git, ['push', 'origin', `refs/tags/${release.tag}:refs/tags/${release.tag}`]);
    published = true;

    console.log('\n============================================================');
    console.log('世界推进正式版本发布成功');
    console.log(`版本：v${release.version}`);
    console.log(`Tag： ${release.tag}`);
    console.log(`SHA： ${targetSha}`);
    console.log('创意工坊正式版本与 workshop-stable 保持不变。');
    console.log('============================================================');
  } catch (error) {
    if (tagCreated && !published) {
      try { run(git, ['tag', '-d', release.tag]); } catch {}
    }
    throw error;
  } finally {
    if (worktreeAdded) {
      try { run(git, ['worktree', 'remove', checkout]); }
      catch { console.error(`临时检出保留供排查：${checkout}`); }
    }
    try { fs.rmdirSync(tempRoot); } catch {}
  }
}

main().catch(error => {
  console.error(`\n世界推进正式发布失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
