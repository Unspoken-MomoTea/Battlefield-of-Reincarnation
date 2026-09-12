const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const file = path.join(__dirname, '../Regular/开局.html');
const html = fs.readFileSync(file, 'utf8');
const start = html.indexOf('const DB = {') + 'const DB = '.length;
const end = html.indexOf('// 阵营说明', start);
const catalog = vm.runInNewContext('(' + html.slice(start, end) + '})');
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (match[1].trim()) new vm.Script(match[1], {filename:'开局.html inline script'});
}
const groups = ['equipments','items','skills'];
const all = groups.flatMap(key=>catalog[key]);
assert.equal(all.length,95);
assert.equal(new Set(all.map(x=>x.id)).size,95);
const ranks = 'F E D C B A S SS SSS'.split(' ');
const limits = {F:1,E:1,D:2,C:2,B:2,A:3,S:3,SS:3,SSS:4};
const attributes = new Set(['力量','敏捷','体质','精神','魅力','ATK','MATK','DEF','MDEF','AP']);
const functions = new Set(['伤害','治疗','控制','增益','减益','防御','辅助','召唤']);
const byId = Object.fromEntries(all.map(x=>[x.id,x]));
for (const item of all) {
    assert.equal(item.source,'主神空间',item.id+' official opening redemption source');
    assert.ok(ranks.includes(item.tier),item.id);
    assert.ok(Number.isInteger(item.cost)&&item.cost>=0,item.id);
    assert.ok(item.tags.some(tag=>functions.has(tag)),item.id+' functional tag');
    assert.equal(new Set(item.tags).size,item.tags.length,item.id+' duplicate tag');
    assert.ok(Object.keys(item.effects).length<=limits[item.tier],item.id+' effect count');
    assert.ok(item.consume,item.id+' explicit cost');
    for (const value of Object.values(item.effects)) {
        assert.ok(/^[FEDSABC]+级/.test(value),item.id+' explicit effect grade');
        assert.ok(/\d/.test(value),item.id+' quantified settlement');
        assert.ok(!/微量|微升|小幅|极小概率|小概率|可能引起|极易|额外抗性|强制保留1|完全抵挡一次致命|内部时间停止/.test(value),item.id+' vague or unbounded effect');
        const grade = value.match(/^([FEDSABC]+)级/)[1];
        assert.ok(ranks.indexOf(grade)<=ranks.indexOf(item.tier),item.id+' effect exceeds product grade');
    }
}
for (const gear of catalog.equipments) {
    assert.ok(gear.type>=0&&gear.type<=16,gear.id+' redeemable ordinary equipment must not export as world relic');
    for (const [key,value] of Object.entries(gear.attrs)) {
        assert.ok(attributes.has(key),gear.id+' allowed attribute');
        assert.ok(ranks.includes(value),gear.id+' raw attribute is a rank, not a calculated stat');
    }
    const text=Object.values(gear.effects).join(' ');
    assert.ok(!/检定(?:修正|加值)[+＋]\d|(?:恢复|增加)\s*\d+\s*(?:HP|EP)|(?:ATK|MATK|DEF|MDEF|AP)[：:+＋]/.test(text),gear.id+' equipment cannot duplicate stats, restore HP/EP or grant check bonuses');
}
for (const skill of catalog.skills) {
    assert.ok(!skill.attrs,skill.id+' skills do not own raw attributes');
    assert.ok(skill.tags.some(x=>['力量','敏捷','体质','精神','魅力'].includes(x)),skill.id+' linked attribute');
    assert.ok(skill.tags.some(x=>['单体','自身','环境'].includes(x)||x.startsWith('范围:')),skill.id+' target tag');
    if(skill.type===1) assert.equal(skill.consume,'无',skill.id+' passive cost');
}
for (const item of catalog.items) assert.ok(!item.attrs,item.id+' consumables do not own raw attributes');
assert.equal(byId.s1_4.tags.includes('真实伤害'),false);
assert.equal(byId.s2_3.name,'呼吸控制专精');
assert.equal(byId.s3_3.type,1);
assert.equal(byId.s3_4.type,1);
assert.equal(byId.e17_1.type,16);
assert.equal(byId.e17_2.type,16);
assert.equal(byId.e17_3.type,0);
assert.match(byId.i2_5.effects.狂血强化,/原始属性为\{ATK:50\}/);
assert.match(byId.i3_1.effects.电磁供弹,/数量50/);
assert.match(byId.i3_2.effects.脉冲供能,/数量30/);
assert.match(byId.i3_6.effects.网枪补给,/数量5/);
assert.match(html,/设计 1 个符合【\$\{tier\}级】强度限制的本体特性效果/);
console.log('PASS opening catalog: '+groups.map(k=>k+'='+catalog[k].length).join(', ')+', script syntax, tags, attribute ownership, effect limits and consumption');

if(process.argv.includes('--browser')) (async()=>{
    const {chromium}=require('C:/Users/MLT/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    const browser=await chromium.launch({channel:'msedge',headless:true});
    try {
        const page=await browser.newPage({viewport:{width:1440,height:1000}});
        const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        await page.route('**/*',route=>route.abort());
        await page.setContent(html.replace(/^```html\s*/,'').replace(/```\s*$/,'').replace(/<script\b[^>]*src=[^>]*><\/script>/gi,''),{waitUntil:'domcontentloaded'});
        const rendered=await page.evaluate(()=>{
            const catalogItems=[...DB.equipments,...DB.items,...DB.skills];
            const holder=document.createElement('div');
            for(const item of catalogItems){
                holder.innerHTML=renderItemCard(item);
                if(!holder.querySelector('.item-name')?.textContent.includes(item.name))throw new Error('商品未显示：'+item.id);
                for(const value of Object.values(item.effects))if(!holder.textContent.includes(value))throw new Error('效果显示不完整：'+item.id);
            }
            switchItemTab('equipment'); switchSubCategory('16');
            const existing=currentCoins;
            document.querySelector('.item-card[onclick*="e17_1"]').click();
            const selected=selectedItems.has('e17_1')&&currentCoins===existing-900;
            document.querySelector('.item-card[onclick*="e17_1"]').click();
            return {count:catalogItems.length,selected,refunded:currentCoins===existing};
        });
        assert.equal(rendered.count,95);assert.ok(rendered.selected);assert.ok(rendered.refunded);
        const exported=await page.evaluate(async()=>{
            let saved;
            window.Mvu={getMvuData:()=>({stat_data:{角色:{},世界:{},系统状态:{},设置:{}}}),replaceMvuData:async data=>{saved=structuredClone(data);}};
            window._={set:(obj,key,value)=>{const keys=key.split('.');let target=obj;for(const segment of keys.slice(0,-1))target=target[segment]??=( {} );target[keys.at(-1)]=value;}};
            const all=[...DB.equipments,...DB.items,...DB.skills];
            selectedItems=new Set(all.map(x=>x.id));
            await executeJourney();
            const role=saved?.stat_data?.角色;
            if(!role)throw new Error('未写入角色数据');
            for(const [sourceKey,targetKey] of [['equipments','装备'],['items','道具'],['skills','技能']]){
                for(const item of DB[sourceKey]){
                    const stored=role[targetKey][item.name];
                    if(JSON.stringify(stored.效果)!==JSON.stringify(item.effects))throw new Error('效果导出不一致：'+item.id);
                    if(sourceKey==='equipments'&&JSON.stringify(stored.原始属性)!==JSON.stringify(item.attrs))throw new Error('属性导出不一致：'+item.id);
                    if(stored.标签.filter(x=>x==='主神空间').length!==1)throw new Error('来源标签不唯一：'+item.id);
                }
            }
            return {equipment:Object.keys(role.装备).length,items:Object.keys(role.道具).length,skills:Object.keys(role.技能).length,forcefield:role.装备['微型力场发生器·β型'].类型,bag:role.装备['初级乾坤袋·残次品'].类型,counter:role.装备['老旧盖革计数器·纪念版'].类型};
        });
        assert.deepEqual(exported,{equipment:56,items:20,skills:19,forcefield:7,bag:7,counter:0});
        assert.deepEqual(errors,[]);
        const dir=path.join(__dirname,'artifacts');fs.mkdirSync(dir,{recursive:true});
        await page.evaluate(()=>{
            selectedItems.clear();renderSelectedPanel();currentStep=2;applyStepUI();
            switchItemTab('skill');switchSubCategory('0');
            document.querySelectorAll('.toast').forEach(el=>el.remove());
        });
        const overflow=await page.locator('#item-grid .info-value').evaluateAll(nodes=>nodes.filter(node=>node.scrollWidth>node.clientWidth+1).length);
        assert.equal(overflow,0,'quantified effect text must fit inside item cards');
        await page.screenshot({path:path.join(dir,'opening-catalog-redesign.png'),fullPage:true});
        console.log('PASS browser: all 95 item cards, full effect text, equipment selection/refund and MVU export');
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
