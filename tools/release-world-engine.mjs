import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = process.platform === 'win32' ? 'git.exe' : 'git';
const python = process.platform === 'win32' ? 'python.exe' : 'python';

function run(command, args, cwd = root, capture = false) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', shell: false, stdio: capture ? 'pipe' : 'inherit',
    env: { ...process.env, CI: 'true' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} ${args[0] || ''} 失败（${result.status}）` +
      (capture && result.stderr ? `\n${result.stderr}` : ''));
  }
  return String(result.stdout || '').trim();
}
function tryRun(command, args, cwd = root) {
  return spawnSync(command, args, {
    cwd, encoding: 'utf8', shell: false, stdio: 'pipe', env: { ...process.env, CI: 'true' },
  });
}
function versionFromSource(source) {
  const match = String(source).match(/WORLD_ENGINE_VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/u);
  if (!match) throw new Error('找不到 WORLD_ENGINE_VERSION X.Y.Z');
  return match[1];
}
async function question(prompt) {
  if (!process.stdin.isTTY) throw new Error('请从交互终端运行世界推进发布工具');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(prompt)).trim(); } finally { rl.close(); }
}
async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('需要 Node.js 22 或更高版本');
  run(git, ['fetch', '--tags', 'origin', 'main']);
  const targetSha = run(git, ['rev-parse', 'origin/main^{commit}'], root, true);
  const source = run(git, ['show', `${targetSha}:src/WorldEngine/core/WorldEngineFoundation.part.js`], root, true);
  const version = versionFromSource(source);
  const tag = `world-engine-v${version}`;
  const remote = tryRun(git, ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`]);
  if (remote.status === 0) throw new Error(`正式 Tag ${tag} 已存在；请先提升 WORLD_ENGINE_VERSION`);
  if (remote.status !== 2) throw new Error(`无法确认远端 Tag：${remote.stderr || remote.stdout}`);
  console.log(`\n世界推进正式发布\n版本：v${version}\nTag： ${tag}\nSHA： ${targetSha}\n`);
  const confirm = await question(`输入 RELEASE ${version} 确认：`);
  if (confirm !== `RELEASE ${version}`) { console.log('已取消。'); return; }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rw-world-engine-release-'));
  const checkout = path.join(tempRoot, 'release');
  let worktreeAdded = false;
  let tagCreated = false;
  try {
    run(git, ['worktree', 'add', '--detach', checkout, targetSha]);
    worktreeAdded = true;
    run(python, ['tools/build-world-engine.py', '--check'], checkout);
    run(process.execPath, ['--check', 'script/世界推进系统.js'], checkout);
    run(process.execPath, ['tests/run-world-engine-suite.cjs'], checkout);
    run(git, ['fetch', '--tags', 'origin', 'main']);
    const latestMain = run(git, ['rev-parse', 'origin/main^{commit}'], root, true);
    if (latestMain !== targetSha) throw new Error('测试期间 main 又有新提交，请重新发布');
    run(git, [
      '-c', 'user.name=Reincarnation World Engine Release',
      '-c', 'user.email=world-engine-release@local.invalid',
      'tag', '-a', tag, targetSha, '-m', `World Engine v${version}`,
    ]);
    tagCreated = true;
    run(git, ['push', 'origin', `refs/tags/${tag}:refs/tags/${tag}`]);
    console.log(`\n发布成功：${tag} -> ${targetSha}`);
  } catch (error) {
    if (tagCreated) { try { run(git, ['tag', '-d', tag]); } catch {} }
    throw error;
  } finally {
    if (worktreeAdded) { try { run(git, ['worktree', 'remove', checkout]); } catch {} }
    try { fs.rmdirSync(tempRoot); } catch {}
  }
}
main().catch(error => {
  console.error(`\n世界推进正式发布失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
