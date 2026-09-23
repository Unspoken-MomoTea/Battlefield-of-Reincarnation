const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../Regular/开局.html'),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());
assert.ok(scripts.length>0,'opening page should contain scripts');
for(const [index,source] of scripts.entries()){
  try{ new Function(source); }
  catch(error){ throw new Error('opening inline script #'+(index+1)+' failed to compile: '+error.message); }
}
for(const id of ['character-mode-custom','character-mode-library','opening-character-library','partner-mode-library','partner-mode-custom','opening-partner-library']){
  assert.match(html,new RegExp('id=["\\\']'+id+'["\\\']'),'opening UI contains '+id);
}
assert.match(html,/indexedDB\.open\('reincarnation-workshop', 4\)/,'opening uses shared workshop database');
assert.match(html,/openingCharacterBuild/,'opening consumes installed character build');
assert.match(html,/partnerIsCompleteAsset/,'opening distinguishes complete installed partner');
console.log('PASS opening page compile and integration seams');
