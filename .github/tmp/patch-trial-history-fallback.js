const fs = require('fs');

const file = 'Regular/结算任务美化.html';
let source = fs.readFileSync(file, 'utf8');

function replaceBlock(regex, replacement, label) {
  if (!regex.test(source)) throw new Error('Missing block: ' + label);
  source = source.replace(regex, replacement);
}

replaceBlock(
  /          function readTrialTasks\(\) \{[\s\S]*?\n          \}\n\n          let achievementBaselineData/,
`          function extractTrialTasks(data) {
            const stat = data && (data.stat_data || data);
            const list = stat && stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            return Object.keys(list).filter(function(key) {
              const task = list[key];
              return task && String(task.委托方 || '').trim() === '晋升试炼';
            }).map(function(key) {
              const task = list[key] || {};
              return {
                key: key,
                name: String(task.名称 || task.任务名 || task.标题 || key),
                status: String(task.状态 || '').trim()
              };
            });
          }

          function readTrialTasks() {
            const ctx = getMvuContext();
            const win = ctx && ctx.win;
            const mvu = win && win.Mvu;
            const currentId = getPanelMessageId(win);

            if (mvu && typeof mvu.getMvuData === 'function' && currentId !== null) {
              let currentTasks = [];
              try {
                currentTasks = extractTrialTasks(mvu.getMvuData({ type: 'message', message_id: currentId }));
              } catch (e) {}

              let previousHit = null;
              for (let step = 1; step <= 3; step++) {
                const id = currentId - step;
                if (id < 0) break;
                try {
                  const data = mvu.getMvuData({ type: 'message', message_id: id });
                  const tasks = extractTrialTasks(data);
                  if (tasks.length) {
                    previousHit = tasks;
                    break;
                  }
                } catch (e) {}
              }

              if (currentTasks.length) return currentTasks;
              if (previousHit) return previousHit;
            }

            return extractTrialTasks(ctx && ctx.data);
          }

          let achievementBaselineData`,
  'readTrialTasks'
);

replaceBlock(
  /          function inferTrialTasksFromSettlement\(text\) \{[\s\S]*?\n          \}\n\n          function renderTrialPanel\(\) \{/,
`          function renderTrialPanel() {`,
  'inferTrialTasksFromSettlement'
);

const oldRenderHead = `            const live = trialTasks.length > 0;\n            const displayTasks = live ? trialTasks : inferTrialTasksFromSettlement(rawText);\n            if (!displayTasks.length) return '';`;
const newRenderHead = `            const displayTasks = trialTasks;\n            if (!displayTasks.length) return '';`;
if (!source.includes(oldRenderHead)) throw new Error('Missing renderTrialPanel head');
source = source.replace(oldRenderHead, newRenderHead);
source = source.replace("            const passed = live && isTrialPassed(trialTasks);\n", '');

const oldGate = "(trialTasks.length || /晋升试炼[·\\.]/.test(rawText))";
const gateCount = source.split(oldGate).length - 1;
if (gateCount !== 2) throw new Error('Expected 2 legacy trial gates, found ' + gateCount);
source = source.split(oldGate).join('trialTasks.length');

if (!source.includes('function extractTrialTasks(data)')) throw new Error('extractTrialTasks missing');
if (!source.includes("String(task.委托方 || '').trim() === '晋升试炼'")) throw new Error('trial identity check missing');
if (!source.includes('for (let step = 1; step <= 3; step++)')) throw new Error('history fallback missing');
if (source.includes('inferTrialTasksFromSettlement')) throw new Error('legacy text inference still present');
if (source.includes('晋升试炼[·\\.]')) throw new Error('legacy numbered regex still present');
if (source.includes("'晋升试炼·'")) throw new Error('legacy synthetic numbered name still present');

fs.writeFileSync(file, source, 'utf8');
