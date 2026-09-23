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
const all = groups.flatMap(key => catalog[key]);
const byId = Object.fromEntries(all.map(item => [item.id,item]));
const ranks = 'F E D C B A S SS SSS'.split(' ');
const attributes = new Set(['力量','敏捷','体质','精神','魅力','ATK','MATK','DEF','MDEF','AP']);

assert.equal(all.length,95,'opening catalog item count');
assert.equal(new Set(all.map(item=>item.id)).size,95,'opening catalog ids unique');
assert.equal(catalog.equipments.length,56);
assert.equal(catalog.items.length,20);
assert.equal(catalog.skills.length,19);

for (const item of all) {
    assert.ok(ranks.includes(item.tier),item.id+' valid quality');
    assert.ok(Number.isInteger(item.cost)&&item.cost>=0,item.id+' valid price');
    assert.equal(typeof item.effects,'object',item.id+' effects object');
    assert.ok(Object.keys(item.effects).length>0,item.id+' must have a useful effect');
    for (const value of Object.values(item.effects)) {
        assert.equal(typeof value,'string',item.id+' effect text');
        assert.ok(value.trim(),item.id+' non-empty effect');
        assert.ok(!/^[FEDSABC]+级(?:机制|伤害|持续伤害|控制|恢复|净化|增益|减益|被动|主动|辅助|防护|弹药包|材料)/.test(value),item.id+' quality must stay in metadata');
        assert.ok(value.length<=150,item.id+' effect should stay concise');
        assert.ok(!/原始属性为空|同名(?:刷新)?不叠加|规则免疫|不提供检定加值|不额外生成|汗液的可嗅距离|触觉刻痕|排出积水|破伤风|容易感染/.test(value),item.id+' no settlement boilerplate or joke effect');
    }
}

for (const gear of catalog.equipments) {
    for (const [key,value] of Object.entries(gear.attrs||{})) {
        assert.ok(attributes.has(key),gear.id+' allowed raw attribute');
        assert.ok(ranks.includes(value),gear.id+' raw attribute uses rank');
    }
}

// Regression samples: low tier remains useful; high tier stays quantified without turning into a disclaimer.
assert.match(byId.e0_3.effects.缺口狠劈,/50%/);
assert.match(byId.e5_3.effects.临时格挡,/8%/);
assert.match(byId.e14_3.effects.草履抓地,/\+5/);
assert.match(byId.e16_4.effects.幸运,/D100.*\+5/);
assert.equal(byId.e6_1.effects.嗜血,'造成近战物理伤害时，将伤害值的10%转化为自身THP。');
assert.match(byId.i1_1.effects.破片爆炸,/20米.*5米.*180点/);
assert.match(byId.i5_3.effects.折叠收纳,/1立方米.*100千克.*不计入随身负重/);
assert.match(byId.s1_1.effects.念力冲击,/15米.*150\+MATK/);
assert.match(byId.s1_7.effects.烈焰爆破,/20米.*半径2米.*90\+MATK/);

console.log('PASS opening catalog: 95 useful products, quantified core effects, concise mechanics, no grade-prefix boilerplate');
