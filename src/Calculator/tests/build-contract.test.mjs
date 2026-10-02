import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('calculator delivery is generated from explicit source parts and exposes managed runtime', () => {
  const foundation = read('src/Calculator/core/CalculatorFoundation.part.js');
  const logic = read('src/Calculator/core/CalculatorLogic.part.js');
  const bootstrap = read('src/Calculator/core/CalculatorBootstrap.part.js');
  const generated = read('script/辅助计算脚本.js');

  assert.match(foundation, /CALCULATOR_VERSION\s*=\s*'1\.0\.0'/u);
  assert.match(foundation, /class CalculatorRuntimeLifecycle/u);
  assert.match(foundation, /SamsaraCalculatorRuntime/u);
  assert.match(foundation, /Samsara\.CalculatorInfo/u);
  assert.match(logic, /function onUpdateData/u);
  assert.match(logic, /function recalcAllCharacters/u);
  assert.match(logic, /function processCombatAndCooldowns/u);
  assert.match(bootstrap, /trackCalculatorSubscription\(subscription\)/u);
  assert.match(bootstrap, /__辅助计算脚本_loaded__/u);
  assert.equal(generated, foundation + logic + bootstrap);
});

test('calculator lifecycle cleanup avoids blocked unload listeners', () => {
  const bootstrap = read('src/Calculator/core/CalculatorBootstrap.part.js');
  assert.doesNotMatch(bootstrap, /unload\.samsaraCalculator/u);
  assert.match(bootstrap, /addEventListener\('pagehide'/u);
  assert.match(bootstrap, /removeEventListener\('pagehide'/u);
});

test('calculator managed runtime can stop a previous MVU subscription before hot reload', () => {
  const foundation = read('src/Calculator/core/CalculatorFoundation.part.js');
  assert.match(foundation, /previous\.stopSubscriptions/u);
  assert.match(foundation, /calculatorPreClean\(\)/u);
  assert.match(foundation, /stopSubscriptions\(\)/u);
});
