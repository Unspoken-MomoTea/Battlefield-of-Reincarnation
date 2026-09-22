import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  validateWorkshopRelease,
  workshopVersionFromSource,
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

function node(args, cwd) {
  return run(process.execPath, args, cwd, false);
}

function files(directory, suffixes) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory()
      ? files(filename, suffixes)
      : suffixes.some(ext => filename.endsWith(ext))
        ? [filename]
        : [];
  });
}

function npmCli() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
  ];
  const result = candidates.find(value => value && fs.existsSync(value));
  if (!result) {
    throw new Error('找不到 npm-cli.js，请安装包含 npm 的 Node.js 22 或更高版本');
  }
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

function assertAncestor(ancestor, descendant, message) {
  const result = tryRun(git, ['merge-base', '--is-ancestor', ancestor, descendant]);
  if (result.status !== 0) throw new Error(message);
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

async function main() {
  if (extraArgs.length) {
    throw new Error('参数无效；仅支持 --dry-run');
  }
  if (Number(process.versions.node.split('.')[0]) < 22) {
    throw new Error('需要 Node.js 22 或更高版本');
  }

  console.log('\n读取正式发布目标…');
  run(git, ['fetch', '--tags', 'origin', 'main', 'workshop-stable']);

  const targetSha = run(git, ['rev-parse', 'origin/main^{commit}'], root, true);
  const stableSha = run(git, ['rev-parse', 'origin/workshop-stable^{commit}'], root, true);
  assertAncestor(
    stableSha,
    targetSha,
    '当前 origin/main 不能从 workshop-stable fast-forward，拒绝正式发布',
  );

  const source = run(
    git,
    ['show', `${targetSha}:src/CreativeWorkshop/app/workshop-app.js`],
    root,
    true,
  );
  const version = workshopVersionFromSource(source);
  const release = validateWorkshopRelease(source, version);

  if (remoteTagExists(release.tag)) {
    throw new Error(`正式 Tag ${release.tag} 已存在。正式版本不可覆盖，请先提升 WORKSHOP_VERSION。`);
  }
  if (localTagExists(release.tag)) {
    throw new Error(`本地 Tag ${release.tag} 已存在，但远端不存在。请先人工确认该本地 Tag 后再发布。`);
  }

  console.log('\n============================================================');
  console.log('              创意工坊 · 正式客户端发布');
  console.log('============================================================');
  console.log(`当前 stable：${stableSha.slice(0, 12)}`);
  console.log(`发布目标：    ${targetSha.slice(0, 12)}（origin/main）`);
  console.log(`正式版本：    v${release.version}`);
  console.log(`正式 Tag：    ${release.tag}`);
  console.log('============================================================');

  if (targetSha === stableSha) {
    throw new Error('origin/main 与 workshop-stable 已经是同一个提交，没有新的正式客户端可发布');
  }

  if (preview) {
    console.log('\n[预演] 将运行完整测试，并原子推进 workshop-stable + 正式 Tag。');
    console.log('[预演] 当前没有执行测试、创建 Tag 或 push。');
    return;
  }

  const confirm = await question(
    `\n输入 RELEASE ${release.version} 确认发布正式客户端：`,
  );
  if (confirm !== `RELEASE ${release.version}`) {
    console.log('已取消正式发布。');
    return;
  }

  const npm = npmCli();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rw-stable-release-'));
  const checkout = path.join(tempRoot, 'release');
  let worktreeAdded = false;
  let tagCreated = false;
  let published = false;

  try {
    console.log('\n建立临时正式发布检出…');
    run(git, ['worktree', 'add', '--detach', checkout, targetSha]);
    worktreeAdded = true;

    console.log('\n安装 Worker 测试依赖…');
    node([npm, 'ci', '--no-audit', '--no-fund'], path.join(checkout, 'cloudflare'));

    console.log('\n运行 Worker contract tests…');
    node(
      ['--test', ...files(path.join(checkout, 'cloudflare/tests'), ['.test.mjs'])],
      checkout,
    );

    console.log('\n运行 Client contract tests…');
    node(
      ['--test', ...files(path.join(checkout, 'src/CreativeWorkshop/tests'), ['.test.mjs'])],
      checkout,
    );

    console.log('\n检查 JS / MJS 语法…');
    for (const dir of ['cloudflare/src', 'cloudflare/scripts', 'src/CreativeWorkshop']) {
      for (const filename of files(path.join(checkout, dir), ['.js', '.mjs'])) {
        node(['--check', filename], checkout);
      }
    }

    console.log('\n重新确认远端状态…');
    run(git, ['fetch', '--tags', 'origin', 'main', 'workshop-stable']);
    const latestMain = run(git, ['rev-parse', 'origin/main^{commit}'], root, true);
    const latestStable = run(git, ['rev-parse', 'origin/workshop-stable^{commit}'], root, true);
    if (latestMain !== targetSha) {
      throw new Error('测试期间 origin/main 又有新提交。为避免发布错版本，请重新运行发布工具。');
    }
    if (latestStable !== stableSha) {
      throw new Error('测试期间 workshop-stable 已被其他发布推进。请重新运行发布工具。');
    }
    if (remoteTagExists(release.tag)) {
      throw new Error(`测试期间正式 Tag ${release.tag} 已被创建。请重新检查发布状态。`);
    }

    console.log('\n创建不可变正式 Tag…');
    run(git, [
      '-c', 'user.name=Reincarnation Workshop Release',
      '-c', 'user.email=workshop-release@local.invalid',
      'tag', '-a', release.tag, targetSha,
      '-m', `Creative Workshop v${release.version}`,
    ]);
    tagCreated = true;

    console.log('\n原子推进 workshop-stable + 正式 Tag…');
    run(git, [
      'push', '--atomic', 'origin',
      'refs/remotes/origin/main:refs/heads/workshop-stable',
      `refs/tags/${release.tag}:refs/tags/${release.tag}`,
    ]);

    published = true;

    console.log('\n============================================================');
    console.log('正式客户端发布成功');
    console.log(`版本：v${release.version}`);
    console.log(`Tag： ${release.tag}`);
    console.log(`SHA： ${targetSha}`);
    console.log('下一步如需更新正式 Worker / D1，请回到 BAT 主菜单选择“更新正式服”。');
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
  console.error(`\n正式发布失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
