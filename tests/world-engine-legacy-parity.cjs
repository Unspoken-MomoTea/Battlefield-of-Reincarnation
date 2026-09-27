const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const legacyPath=path.join(root,'dist/V20260917/世界推进系统.js');
const currentPath=path.join(root,'script/世界推进系统.js');
assert.ok(fs.existsSync(legacyPath),'V20260917 world engine snapshot must remain available for compatibility checks');
assert.ok(fs.existsSync(currentPath),'current generated world engine delivery must exist');
const legacy=fs.readFileSync(legacyPath,'utf8');
const current=fs.readFileSync(currentPath,'utf8');

const unique=values=>[...new Set(values)];
const matches=(source,regex,group=1)=>{
  const out=[];
  regex.lastIndex=0;
  let match;
  while((match=regex.exec(source)))out.push(match[group]);
  return out;
};
const actions=source=>unique([
  ...matches(source,/data-action\s*=\s*["']([^"']+)["']/g),
  ...matches(source,/dataset\.action\s*={2,3}\s*["']([^"']+)["']/g),
  ...matches(source,/setAttribute\(\s*["']data-action["']\s*,\s*["']([^"']+)["']\s*\)/g),
]).sort();
const configKeys=source=>unique([
  ...matches(source,/\b(?:this|engine|e)\.config\.([A-Za-z_$][\w$]*)/g),
  ...matches(source,/\bconfig\.([A-Za-z_$][\w$]*)/g),
  ...matches(source,/Object\.hasOwn\([^,]+\.config,\s*["']([^"']+)["']/g),
]).sort();
const navTabs=source=>{
  const block=source.match(/const\s+tabs\s*=\s*\[([\s\S]*?)\];/);
  return block?[...block[1].matchAll(/\[\s*["']([^"']+)["']/g)].map(match=>match[1]):[];
};
const namedCatalogKeys=(source,name)=>{
  const marker=`const ${name}`;
  const start=source.indexOf(marker);
  assert.notEqual(start,-1,`${name} must exist`);
  const open=source.indexOf('{',start);
  assert.notEqual(open,-1,`${name} must be an object literal`);
  let depth=0,state='code',quote='';
  for(let index=open;index<source.length;index++){
    const char=source[index],next=source[index+1];
    if(state==='line'){if(char==='\n')state='code';continue;}
    if(state==='block'){if(char==='*'&&next==='/'){state='code';index++;}continue;}
    if(state==='string'){if(char==='\\'){index++;continue;}if(char===quote)state='code';continue;}
    if(state==='template'){if(char==='\\'){index++;continue;}if(char==='\`')state='code';continue;}
    if(char==='/'&&next==='/'){state='line';index++;continue;}
    if(char==='/'&&next==='*'){state='block';index++;continue;}
    if(char==='"'||char==="'"){state='string';quote=char;continue;}
    if(char==='\`'){state='template';continue;}
    if(char==='{')depth++;
    else if(char==='}'&&--depth===0){
      const block=source.slice(open+1,index);
      const keys=[];
      let nested=0,last=0;
      for(let cursor=0;cursor<=block.length;cursor++){
        const token=block[cursor];
        if(token==='{')nested++;
        else if(token==='}')nested--;
        if((token===','&&nested===0)||cursor===block.length){
          const entry=block.slice(last,cursor).trim();
          const key=entry.match(/^([A-Za-z_$][\w$]*)\s*:/)?.[1];
          if(key)keys.push(key);
          last=cursor+1;
        }
      }
      return unique(keys);
    }
  }
  throw new Error(`${name} object literal did not close`);
};
const assertLegacySubset=(label,legacyValues,currentValues)=>{
  const currentSet=new Set(currentValues);
  const missing=legacyValues.filter(value=>!currentSet.has(value));
  assert.deepEqual(missing,[],`${label} removed from current world engine: ${missing.join(', ')}`);
};

const legacyActions=actions(legacy);
const currentActions=actions(current);
assert.ok(legacyActions.length>=40,'legacy action extraction must cover the V20260917 interactive surface');
assertLegacySubset('legacy data-action',legacyActions,currentActions);

const legacyConfig=configKeys(legacy);
const currentConfig=configKeys(current);
assert.ok(legacyConfig.length>=25,'legacy config extraction must cover the V20260917 persisted settings surface');
assertLegacySubset('legacy config key',legacyConfig,currentConfig);

const legacyTabs=navTabs(legacy);
const currentTabs=navTabs(current);
assert.deepEqual(currentTabs.slice(0,legacyTabs.length),legacyTabs,'current navigation must preserve the V20260917 player-facing tab order');

assertLegacySubset('legacy UI theme',namedCatalogKeys(legacy,'WORLD_UI_THEMES'),namedCatalogKeys(current,'WORLD_UI_THEMES'));
assertLegacySubset('legacy font scale',namedCatalogKeys(legacy,'WORLD_FONT_SCALES'),namedCatalogKeys(current,'WORLD_FONT_SCALES'));

assert.match(legacy,/data-module-prompt/,'legacy snapshot must expose the old module-prompt editor seam');
assert.match(current,/data-prompt-registry/,'current delivery must expose the registry-backed prompt editor seam');
assert.doesNotMatch(current,/data-module-prompt\s*=/,'current delivery must not regress to the legacy module-prompt UI seam');

console.log(`PASS legacy parity keeps ${legacyActions.length} actions, ${legacyTabs.length} tabs, ${legacyConfig.length} config keys, themes and font scales while migrating prompts to the registry`);
