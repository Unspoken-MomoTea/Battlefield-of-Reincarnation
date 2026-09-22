import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RELEASE_TARGETS, releasePlan, validateReleaseConfig } from './release-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const git = process.platform === 'win32' ? 'git.exe' : 'git';
const argv = process.argv.slice(2);
const preview = argv.includes('--dry-run');
const args = argv.filter(arg => arg !== '--dry-run');

function run(command, args, cwd = root, capture = false, unattended = false) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', shell: false,
    stdio: capture ? 'pipe' : unattended ? ['ignore', 'inherit', 'inherit'] : 'inherit',
    env: { ...process.env, ...(unattended ? { CI: 'true' } : {}) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} ${args[0]} 失败（${result.status}）${capture ? `\n${result.stderr}` : ''}`);
  return String(result.stdout ?? '').trim();
}
function node(args, cwd, unattended = false) { return run(process.execPath, args, cwd, false, unattended); }
function configAt(directory) { return JSON.parse(fs.readFileSync(path.join(directory, 'cloudflare/wrangler.jsonc'), 'utf8')); }
function files(directory, suffix) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? files(filename, suffix) : suffix.some(ext => filename.endsWith(ext)) ? [filename] : [];
  });
}
async function question(prompt) {
  if (!process.stdin.isTTY) throw new Error('请从交互终端或双击更新工具运行');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(prompt)).trim(); }
  finally { rl.close(); }
}
function npmCli() {
  const candidates = [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
  const result = candidates.find(value => value && fs.existsSync(value));
  if (!result) throw new Error('找不到 npm-cli.js，请安装包含 npm 的 Node.js 22 或通过 npm run update 启动');
  return result;
}

async function main() {
  if (args.includes('--help')) {
    console.log('node cloudflare/scripts/update-servers.mjs [staging|production|both] [--dry-run]\n不传环境时打开选择菜单。仅更新已推送的提交，不自动发布本地修改或推进 stable。');
    return;
  }
  if (args.length > 1 || argv.some(arg => arg.startsWith('--') && arg !== '--dry-run')) throw new Error('参数无效，请使用 --help');
  let target = args[0];
  if (!target) {
    console.log('\n创意工坊一键更新\n1. 更新测试服（main）\n2. 更新正式服（workshop-stable）\n3. 依次更新两服（分别使用各自通道）\n0. 退出\n');
    const choice = await question('请选择：');
    if (choice === '0') return;
    target = ({ 1: 'staging', 2: 'production', 3: 'both' })[choice];
  }
  const targets = releasePlan(target);
  console.log('流程：读取远端固定提交 → 临时检出 → 安装依赖 → 测试 → 数据库迁移 → 部署 → 健康检查');
  console.log('工作区分支和未提交修改保留。正式版仅使用已发布的 workshop-stable。');
  if (preview) {
    for (const environment of targets) {
      console.log(`\n[预演] ${RELEASE_TARGETS[environment].label}: origin/${RELEASE_TARGETS[environment].ref}`);
      try { validateReleaseConfig(configAt(root), environment); console.log('当前本地配置检查通过；实际运行仍会检查目标提交配置。'); }
      catch (error) { console.log(`配置待处理：${error.message}`); }
    }
    console.log('\n预演结束：没有联网、检出、迁移或部署。');
    return;
  }
  // Fail before networking if this machine still has placeholder production setup.
  for (const environment of targets) validateReleaseConfig(configAt(root), environment);
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('需要 Node.js 22 或更高版本');
  const npm = npmCli();
  if (targets.includes('production')) {
    if (await question('将更新正式数据库和 Worker，输入 PRODUCTION 继续：') !== 'PRODUCTION') {
      console.log('已取消'); return;
    }
  }
  run(git, ['fetch', 'origin', ...targets.map(env => `+refs/heads/${RELEASE_TARGETS[env].ref}:refs/remotes/origin/${RELEASE_TARGETS[env].ref}`)]);
  const releases = targets.map(environment => ({ environment, sha: run(git, ['rev-parse', `origin/${RELEASE_TARGETS[environment].ref}^{commit}`], root, true) }));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rw-server-update-'));
  const checkouts = [];
  const completed = [];
  try {
    // Validate and test every selected target before changing either remote environment.
    for (const release of releases) {
      const checkout = path.join(temp, release.environment);
      run(git, ['worktree', 'add', '--detach', checkout, release.sha]);
      checkouts.push(checkout);
      release.checkout = checkout;
      release.env = validateReleaseConfig(configAt(checkout), release.environment);
      console.log(`\n检查 ${RELEASE_TARGETS[release.environment].label} ${release.sha}`);
      node([npm, 'ci', '--no-audit', '--no-fund'], path.join(checkout, 'cloudflare'));
      node(['--test', ...files(path.join(checkout, 'cloudflare/tests'), ['.test.mjs'])], checkout);
      node(['--test', ...files(path.join(checkout, 'src/CreativeWorkshop/tests'), ['.test.mjs'])], checkout);
      for (const dir of ['cloudflare/src', 'cloudflare/scripts', 'src/CreativeWorkshop']) {
        for (const filename of files(path.join(checkout, dir), ['.js', '.mjs'])) node(['--check', filename], checkout);
      }
      release.wrangler = path.join(checkout, 'cloudflare/node_modules/wrangler/bin/wrangler.js');
      node([release.wrangler, 'deploy', '--env', release.environment, '--dry-run'], path.join(checkout, 'cloudflare'), true);
    }
    for (const release of releases) {
      const { environment, checkout, wrangler } = release;
      const cwd = path.join(checkout, 'cloudflare');
      console.log(`\n开始更新 ${RELEASE_TARGETS[environment].label} ${release.sha}`);
      node([wrangler, 'd1', 'migrations', 'apply', 'DB', '--env', environment, '--remote'], cwd, true);
      node([wrangler, 'deploy', '--env', environment], cwd, true);
      const response = await fetch(new URL('/api/health', release.env.vars.PUBLIC_BASE_URL), { signal: AbortSignal.timeout(20000) });
      const health = await response.json();
      if (!response.ok || health.ok !== true || health.update_channel !== RELEASE_TARGETS[environment].channel || health.update_ref !== RELEASE_TARGETS[environment].ref) {
        throw new Error(`${environment} 已执行部署，但健康或更新通道检查失败，请检查 Cloudflare 日志`);
      }
      completed.push(environment);
      console.log(`更新成功：${environment} / ${release.sha} / ${release.env.vars.PUBLIC_BASE_URL}`);
    }
  } catch (error) {
    console.error(`\n流程已停止。已完成环境：${completed.join(', ') || '无'}。已执行的数据库迁移和部署不会自动回退。`);
    throw error;
  } finally {
    for (const checkout of checkouts.reverse()) {
      // No force: leave a checkout intact if tracked files unexpectedly changed.
      try { run(git, ['worktree', 'remove', checkout]); }
      catch { console.error(`临时检出保留供排查：${checkout}`); }
    }
    try { fs.rmdirSync(temp); } catch { /* Preserve diagnostics rather than recursive deletion. */ }
  }
}
main().catch(error => { console.error(`\n更新失败：${error.message}`); process.exitCode = 1; });
