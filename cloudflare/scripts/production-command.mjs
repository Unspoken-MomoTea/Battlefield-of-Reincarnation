import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (!['deploy', 'migrate'].includes(mode)) {
  console.error('Usage: node scripts/production-command.mjs <deploy|migrate>');
  process.exit(2);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cloudflareDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(cloudflareDir, '..');
const configPath = path.join(cloudflareDir, 'wrangler.jsonc');
const configText = fs.readFileSync(configPath, 'utf8');

const productionBlock = configText.match(/"production"\s*:\s*\{[\s\S]*?\n\s*\}\n\s*\}/u)?.[0] || '';
const placeholders = [
  'REPLACE_ME',
  '00000000-0000-0000-0000-000000000000',
  '00000000000000000000000000000000',
].filter(value => productionBlock.includes(value));

if (placeholders.length) {
  console.error(
    '拒绝执行正式环境操作：wrangler.jsonc 的 env.production 仍包含占位资源。\n' +
    '请先配置正式 D1 / KV / Discord Client ID，再执行正式发布。',
  );
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
    shell: false,
  });
  if (result.error) throw result.error;
  return result;
}

const git = process.platform === 'win32' ? 'git.exe' : 'git';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const fetchResult = run(git, ['fetch', 'origin', 'workshop-stable']);
if (fetchResult.status !== 0) {
  console.error(fetchResult.stderr || '无法读取远端 workshop-stable');
  process.exit(fetchResult.status || 1);
}

const head = run(git, ['rev-parse', 'HEAD']);
const stable = run(git, ['rev-parse', 'origin/workshop-stable']);
if (head.status !== 0 || stable.status !== 0) {
  console.error(head.stderr || stable.stderr || '无法确认 Git 提交');
  process.exit(1);
}

const headSha = head.stdout.trim();
const stableSha = stable.stdout.trim();
if (headSha !== stableSha) {
  console.error(
    '拒绝执行正式环境操作：当前工作区不是已发布的 workshop-stable。\n' +
    `当前 HEAD:       ${headSha}\n` +
    `workshop-stable: ${stableSha}\n\n` +
    '请先切换/检出 workshop-stable 对应提交。测试中的 main 不能部署到正式环境。',
  );
  process.exit(1);
}

if (!process.stdin.isTTY) {
  console.error('拒绝执行正式环境操作：必须在交互终端中确认。');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(
  mode === 'deploy'
    ? '即将部署正式 Worker。输入 PRODUCTION 继续：'
    : '即将在正式 D1 执行 migration。输入 PRODUCTION 继续：',
);
rl.close();

if (answer.trim() !== 'PRODUCTION') {
  console.log('已取消。');
  process.exit(0);
}

const args = mode === 'deploy'
  ? ['wrangler', 'deploy', '--env', 'production']
  : ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--env', 'production', '--remote'];

const result = spawnSync(npx, args, {
  cwd: cloudflareDir,
  stdio: 'inherit',
  shell: false,
});
process.exit(result.status ?? 1);
