import test from 'node:test';
import assert from 'node:assert/strict';
import { projectScenarioCatalog } from '../scenarios/installed.js';

test('仅已应用的工坊副本进入开局，不把同名副本当作同一个作品',()=>{
  const asProject=(id,applied)=>({id,name:'魔兽世界',applied,bundle:{
    artifacts:[{kind:'data',content:{schema_version:1,kind:'scenario',world:'艾泽拉斯',time:'第三次战争',
      story:'瘟疫 → 斯坦索姆 → 北伐',next:'斯坦索姆',mode:'single'}}]
  }});
  const rows=projectScenarioCatalog([asProject('a',true),asProject('b',true),asProject('c',false)]);
  assert.equal(rows.length,2);
  assert.notEqual(rows[0].id,rows[1].id);
  assert.deepEqual(rows.map(s=>s.mode),['single','single']);
  assert.equal(rows[0].sourceProjectId,'a');
});
