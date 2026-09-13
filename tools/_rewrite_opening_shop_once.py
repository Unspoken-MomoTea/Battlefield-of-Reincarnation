from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OPENING = ROOT / 'Regular' / '开局.html'
ENTITY_RULE = ROOT / 'World Book' / '⚙️实体生成规则.txt'
QUALITY_RULE = ROOT / 'World Book' / '⚙️品质效果数值规则.txt'
TEST = ROOT / 'tests' / 'opening-catalog.cjs'

EFFECTS = {
    # 装备：低品质也必须有实际玩法价值；品质只控制强度，不生产废词条。
    'e0_1': {'高频破甲': '命中时忽略目标15%的物理减伤率。'},
    'e0_2': {'百炼锋刃': '对无甲或轻甲目标造成的物理伤害提高8%。'},
    'e0_3': {'缺口狠劈': '对HP低于上限50%的目标造成的物理伤害提高5%。'},
    'e1_1': {'等离子灼烧': '命中造成HP损失后，附加灼烧2回合，每回合受到25点能量火焰伤害；体质对抗成功可避免灼烧。'},
    'e1_2': {'冲锋突刺': '本回合直线移动至少3米后突刺，命中伤害提高10%。'},
    'e1_3': {'长柄突刺': '普通近战攻击距离提升至2米。'},
    'e2_1': {'镇魂': '可直接攻击非实体灵体；对灵体造成的伤害转为精神伤害并提高10%。'},
    'e2_2': {'重击震退': '命中后可进行力量对抗，胜出将目标击退2米。'},
    'e2_3': {'飞砖': '可投掷攻击8米内目标，命中伤害提高10%；投出后需回收。'},
    'e3_1': {'电磁贯穿': '射程80米；可穿透累计5毫米普通钢板，穿透后的攻击保留80%伤害。'},
    'e3_2': {'快速拔枪': '射程40米；每场战斗首次从枪套拔出时可立即衔接一次原有攻击，不额外消耗动作。'},
    'e3_3': {'双管齐射': '射程10米；消耗2份铁砂装药齐射，命中伤害提高25%。'},
    'e3_4': {'三脉冲模式': '射程100米；消耗3发脉冲能量进行三脉冲攻击，命中伤害提高20%。'},
    'e4_1': {'双矢齐发': '射程50米；一次攻击消耗2支精钢弩箭，命中伤害提高20%。'},
    'e4_2': {'寻灵箭': '可消耗12EP凝聚灵矢代替箭矢；灵矢可命中灵体，并将该次伤害转为能量伤害。'},
    'e4_3': {'稳弓': '若本回合未移动，本次射击的敏捷检定修正+5。'},
    'e5_1': {'能量偏导': '举盾时，来自正面的能量伤害减少20%。'},
    'e5_2': {'防暴架势': '举盾时，来自正面的物理伤害减少12%。'},
    'e5_3': {'临时格挡': '每场战斗首次受到正面物理攻击时，该次伤害减少8%。'},
    'e6_1': {'嗜血': '造成近战物理伤害时，将伤害值的10%转化为自身THP。'},
    'e6_2': {'剔骨流血': '命中造成HP损失后，附加流血2回合，每回合受到10点物理伤害。'},
    'e6_3': {'暗藏利刃': '从收纳或隐藏状态首次拔刀攻击时，本次敏捷检定修正+5。'},
    'e7_1': {'引雷': '雷电类技能造成的伤害提高15%。'},
    'e7_2': {'导魔': '施放E级及以下、具有固定EP消耗的法术时，EP消耗减少2点。'},
    'e7_3': {'残卷咒力': '诅咒与精神类技能造成的伤害提高5%。'},
    'e8_1': {'蛊惑启示': '进行魅惑、威慑或精神控制相关检定时，精神或魅力检定修正+15。'},
    'e8_2': {'清音': '抵抗幻觉、催眠与精神干扰时，精神检定修正+10。'},
    'e8_3': {'简易祝祷': '抵抗恐惧时，精神检定修正+5。'},
    'e9_1': {'电磁拘束': '射程15米；命中后以敏捷对抗目标力量，胜出使目标定身1回合。'},
    'e9_2': {'缚魂': '可直接攻击非实体灵体；对灵体造成的伤害转为精神伤害。'},
    'e9_3': {'捕兽夹': '布置后触发者进行DC30敏捷检定，失败受到15点物理伤害并定身1回合。'},
    'e10_1': {'动力重击': '徒手攻击视为重型武器打击，造成的物理伤害提高15%。'},
    'e10_2': {'灵巧编织': '进行开锁、拆装、偷取等精细手部操作时，敏捷检定修正+10。'},
    'e10_3': {'缠手': '徒手攻击造成的物理伤害提高5%。'},
    'e11_1': {'热成像': '开启后消耗1EP/分钟，可看见30米内热源轮廓；在黑暗或烟雾中寻找热源时，感知检定修正+15。'},
    'e11_2': {'清明': '抵抗恐惧、幻觉与催眠时，精神检定修正+10。'},
    'e11_3': {'头部缓冲': '受到直接命中头部的钝击时，该次物理伤害减少8%。'},
    'e12_1': {'护心': '每场战斗首次受到躯干物理伤害时，该次伤害减少25%。'},
    'e12_2': {'防弹': '受到枪弹类物理伤害时，伤害减少12%。'},
    'e12_3': {'厚皮保暖': '抵抗寒冷、风雪造成的不利状态时，体质检定修正+5。'},
    'e13_1': {'消音步行': '常规移动时脚步与衣料噪音降低75%；进行潜行检定时修正+15。'},
    'e13_2': {'液压助力': '水平跳跃距离增加3米，垂直跳跃高度增加1米。'},
    'e13_3': {'护膝': '抵抗跌倒、绊倒或腿部冲击时，敏捷检定修正+5。'},
    'e14_1': {'踏风步': '消耗25EP，额外移动8米，并可直接越过常规沟壑与低矮障碍。'},
    'e14_2': {'稳步': '在湿滑、碎石或倾斜地形移动时，敏捷检定修正+10。'},
    'e14_3': {'草履抓地': '在泥地、湿地或碎石地面移动时，敏捷检定修正+5。'},
    'e15_1': {'隐匿': '低光环境下进行潜行检定时修正+15；保持静止时自身轮廓更难被肉眼辨认。'},
    'e15_2': {'避尘': '抵抗粉尘、烟尘、毒雾等吸入性环境影响时，体质检定修正+10。'},
    'e15_3': {'防雨': '在雨雪环境中抵抗寒冷与潮湿影响时，体质检定修正+5。'},
    'e16_1': {'生命反馈': 'HP首次降至30%以下时自动激活，获得80THP；每场战斗触发1次。'},
    'e16_2': {'聚灵': '施放D级及以下、具有固定EP消耗的法术时，EP消耗减少5点。'},
    'e16_3': {'狂化': 'HP低于50%时，近战物理伤害提高10%。'},
    'e16_4': {'幸运': '每场战斗1次，可在一次D100检定结算前获得+5修正。'},
    'e17_1': {'应急力场': '消耗30EP，为自身获得120THP，持续3回合。'},
    'e17_2': {'乾坤收纳': '可收纳总体积0.5立方米、总质量50千克的非生命物体；收纳物不计入随身负重。'},
    'e17_3': {'辐射预警': '开启后可探测30米内显著电离辐射，并显示大致方向与强度。'},

    # 道具：保留必要数值，去掉“协议判例式”长串免责声明。
    'i1_1': {'破片爆炸': '投掷距离20米；本回合结束时爆炸，对半径5米内目标造成180点物理伤害，完整实体掩体可阻挡。'},
    'i1_2': {'强光致盲': '投掷距离15米；半径5米内可见强光的目标进行DC45体质抵抗，失败致盲1回合。'},
    'i1_3': {'附着燃烧': '投掷距离10米；命中后进行敏捷对抗，胜出点燃目标3回合，每回合受到6点能量火焰伤害；扑灭或浸水可解除。'},
    'i2_1': {'草丹疗伤': '服用后立即恢复300HP。', '清厄': '同次服用可移除1个D级及以下的中毒或流血状态。'},
    'i2_2': {'针剂急救': '注射后立即恢复120HP。'},
    'i2_3': {'压迫包扎': '包扎后持续3回合，每回合恢复10HP；再次受到HP伤害时恢复中止。'},
    'i2_4': {'理智镇静': '注射后移除1个D级及以下的恐惧或混乱状态。'},
    'i2_5': {'狂血强化': '服用时消耗30HP，获得「狂血」3回合：原始属性为{ATK:50}。'},
    'i3_1': {'电磁供弹': '拆包获得50发标准电磁弹。'},
    'i3_2': {'脉冲供能': '拆包获得30发脉冲能量。'},
    'i3_3': {'9mm供弹': '拆包获得15发9mm手枪子弹。'},
    'i3_4': {'破甲弩箭': '拆盒获得20支精钢破甲弩箭；使用该弩箭攻击时额外忽略目标5%的物理减伤率。'},
    'i3_5': {'木箭补给': '拆束获得30支粗糙木箭。'},
    'i3_6': {'网枪补给': '拆包获得5张带电拘束网。'},
    'i4_1': {'锻造辅材': '用于D级及以下金属装备生产时消耗1锭，本次锻造检定修正+15。'},
    'i4_2': {'器具供能': '为兼容的科技照明、探测或工具类设备补充10小时额定运行能源。'},
    'i4_3': {'铁砂装药': '拆包获得10份铁砂装药。'},
    'i5_1': {'替伤': '受到伤害时可主动触发，由草人代为承担最多180点伤害，超出部分由本人承受；触发后消耗1个。'},
    'i5_2': {'定点信标': '放置后持续24小时；持有兼容接收器者可在5千米内读取信标方向与距离。'},
    'i5_3': {'折叠收纳': '可反复存取总体积1立方米、总质量100千克的非生命物体；收纳物不计入随身负重。'},

    # 技能：核心动作、范围、公式、对抗、持续、消耗保留；删除重复免责声明。
    's1_1': {'念力冲击': '攻击15米内目标，命中造成(150+MATK)点精神伤害。', '念力推离': '命中后以精神对抗目标体质，胜出将目标推离3米。'},
    's1_2': {'拔刀一闪': '持鞘中刀剑攻击2米内目标，命中造成(180+ATK)点物理伤害；再次使用前需先收刀。'},
    's1_3': {'电磁冲击': '以自身为中心半径5米，对范围内目标造成(120+MATK)点能量雷电伤害。', '机械干扰': '被命中的机械目标以体质对抗施法者精神，失败则停机1回合。'},
    's1_4': {'怨杀咒印': '消耗目标毛发或血液1份，攻击10米内目标，命中造成(160+MATK)点精神伤害。'},
    's1_5': {'御剑刺击': '操纵一把刀剑攻击15米内目标，命中造成(80+MATK)点物理伤害，攻击后飞剑返回。'},
    's1_6': {'微光治疗': '选择5米内1名目标，恢复150HP。'},
    's1_7': {'烈焰爆破': '攻击20米内落点，对半径2米内目标造成(90+MATK)点能量火焰伤害。'},
    's1_8': {'奋力打击': '以近战武器或徒手攻击目标，命中造成(30+ATK)点物理伤害。'},
    's2_1': {'枪械专精': '使用动能枪械进行攻击检定时，敏捷检定修正+15。'},
    's2_2': {'近战专精': '使用刀剑、枪矛或棍棒进行近战攻击检定时，力量检定修正+15。'},
    's2_3': {'呼吸耐受': '进行闭气、长跑、烟尘呛咳等体质检定时修正+15。'},
    's2_4': {'弱点观测': '观察30米内目标1次后，对该目标的下一次远程攻击检定修正+10。'},
    's2_5': {'精神抗压': '抵抗恐惧或魅惑时，精神检定修正+10。'},
    's2_6': {'闪避步法': '针对可见攻击进行敏捷闪避检定时修正+10。'},
    's2_7': {'生存耐受': '抵抗疲劳、脱水或疾病侵袭时，体质检定修正+5。'},
    's3_1': {'灵性观察': '感知灵体或幻象时，精神检定修正+15。', '开启灵视': '消耗30EP开启灵视3回合，可直接感知10米内灵体与魔法隐形目标。'},
    's3_2': {'急救知识': '使用医疗器具处理创伤时，专业检定修正+15。', '战地处置': '消耗24EP与止血粗绷带1卷，为接触目标恢复120HP。'},
    's3_3': {'电子破解': '使用实际接入的计算机破解电子锁或安保系统时，专业检定修正+15。'},
    's3_4': {'伏击警觉': '对10米内具有声音或运动线索的伏击进行感知检定时修正+10。'},
}


def js_object(value: dict[str, str]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def replace_effects(text: str, item_id: str, effects: dict[str, str]) -> str:
    pattern = re.compile(
        r"(\{\s*id:'" + re.escape(item_id) + r"'.*?\beffects:)\{.*?\}(?=,\s*desc:)",
        re.S,
    )
    text, count = pattern.subn(lambda m: m.group(1) + js_object(effects), text, count=1)
    if count != 1:
        raise RuntimeError(f'cannot patch effects for {item_id}: matches={count}')
    return text


def patch_opening() -> None:
    text = OPENING.read_text(encoding='utf-8')
    for item_id, effects in EFFECTS.items():
        text = replace_effects(text, item_id, effects)

    text = text.replace(
        '// ⚔️ 开局装备库：按品质效果数值规则与实体生成规则量化',
        '// ⚔️ 开局装备库：数值明确、机制有效；品质控制强度，不生成废词条',
    )
    text = text.replace(
        '// 🎒 战术道具库 (手雷/药剂/材料/弹药补给 大全)',
        '// 🎒 战术道具库：保留必要量化，删除协议判例式冗余限制',
    )
    text = text.replace(
        '// 🔮 技能库：效果独立定档，原始属性归装备，功法不混入技能',
        '// 🔮 技能库：核心公式与机制量化，品质由字段承载',
    )

    OPENING.write_text(text, encoding='utf-8', newline='')


def patch_entity_rule() -> None:
    text = ENTITY_RULE.read_text(encoding='utf-8')
    old = '''  通用规则:\n    - 数值效果写固定值/公式；机制写明确条件、目标、范围、持续、对抗/免疫、解除、代价与结果，遵循《品质效果数值规则》。\n    - 不确定性由《行为判定》D100处理；不生成暴击率、命中率、闪避率或自动概率触发。概率效果改为确定条件触发或一次对应抵抗检定。\n    - 不直接扣固定DEF/MDEF；不重复同类效果，词条数量遵循品质上限。\n    - 状态的字段、持续与结算遵循《状态协议》。'''
    new = '''  通用规则:\n    - 数值是重点：伤害、恢复、消耗、距离、持续、次数、检定修正等凡可量化且会影响结算的部分，优先写明确值/公式，遵循《品质效果数值规则》。\n    - 机制也是重点：机制只写真正存在的触发、目标、范围、对抗、解除与代价；禁止为“显得严谨”补造没有设定依据的限制。\n    - 品质由【品质】字段记录，效果文本禁止重复“F级机制”“D级伤害”“E级被动”等档位前缀。\n    - 低品质只代表数值较低或机制较弱，不代表废物。禁止用“容易感染、排水更快、能摸出正反、汗味更明显”等无玩法价值内容充当商品效果。\n    - 不确定性统一交由《行为判定》D100或对应战斗协议处理；不另造固定暴击率、命中率、闪避率。\n    - 不直接扣固定DEF/MDEF；不重复同类效果，词条数量遵循品质上限。\n    - 状态的字段、持续与结算遵循《状态协议》。'''
    if old not in text:
        raise RuntimeError('entity rule header changed unexpectedly')
    text = text.replace(old, new)
    text = text.replace(
        '''    装备:\n      允许: [衍生属性, 基础属性]\n      禁止: [检定加值, 当前HP/EP]''',
        '''    装备:\n      允许: [衍生属性, 基础属性, 与装备用途直接相关的情境检定修正]\n      禁止: [当前HP/EP]''',
    )
    old_effect = '''  效果规则:\n    - 每行1条："效果名: 效果"\n    - 允许动态扩展效果名\n    - 同类效果禁止重复\n    - 数值型效果必须写明公式与数值，禁止“微弱、大量、显著、大幅”等模糊程度词\n    - 机制型效果必须写明效果档次、目标、范围、持续、触发、对抗/免疫、解除、代价与结果\n    - 缺少必要结算条件的效果不得生成；所有数值与档次必须符合<品质效果数值规则>'''
    new_effect = '''  效果规则:\n    - 每行1条："效果名: 效果"；允许动态扩展效果名，同类效果禁止重复。\n    - 数值型效果必须写可直接结算的核心数字/公式，禁止用“微弱、大量、显著、大幅”等词替代应有数值。\n    - 机制型效果写清核心玩法与真正必要的条件；机制本身无需数值时，不强行塞数字。\n    - 商品效果必须让玩家一眼看懂“为什么值得买”；普通物理常识、生活便利与纯缺陷不算特殊效果。\n    - 禁止堆叠“同名不叠加、规则免疫、不提供、不额外、不能……”等免责条款；只有会改变实际结算的关键边界才写。\n    - 品质差、目标抗性与边界冲突交由《行为判定》《战斗协议》按场景裁定，不在每个商品里枚举所有例外。'''
    if old_effect not in text:
        raise RuntimeError('entity effect rules changed unexpectedly')
    text = text.replace(old_effect, new_effect)
    ENTITY_RULE.write_text(text, encoding='utf-8', newline='')


def patch_quality_rule() -> None:
    text = QUALITY_RULE.read_text(encoding='utf-8')
    marker = '技能与道具量化表 (效果档位: 技能基础伤害 | 检定修正 | HP恢复 | EP消耗 | 状态预算):'
    block = '''商品与机制量化原则:\n  - 量化是强度锚点：伤害、恢复、消耗、距离、持续、次数、检定修正等可结算内容必须给出明确值或公式。\n  - 机制是玩法价值：纯机制不要求为了“有数字”硬塞数字，但必须有真实用途，能够改变行动、判定、资源、攻防、信息或空间等实际玩法。\n  - 品质只写在【品质】字段；效果文本禁止重复“F级机制 / D级伤害 / E级被动”等档位前缀。\n  - F/E/D等低阶商品也必须值得购买：低阶通过较小数值、较短距离/持续或较弱机制体现，不得用感染、排水、气味、触觉记号等无玩法价值内容充数。\n  - 限制只保留真实必要项。禁止为了防滥用给每个效果机械附加重量、角度、同名不叠加、同级解除、规则免疫、各种“不提供/不额外”说明。\n  - 目标存在特殊抗性或边界冲突时，由《行为判定》《战斗协议》结合品质差与场景处理。\n\n'''
    if marker not in text:
        raise RuntimeError('quality table marker missing')
    if '商品与机制量化原则:' not in text:
        text = text.replace(marker, block + marker)

    old = '  - 先把每项效果写成协议可直接读取的数值或条件，包括伤害、恢复、检定修正、状态品质、目标、范围、持续、触发、对抗/免疫、解除、消耗与结果；缺少必要结算项的效果不得生成'
    new = '  - 需要直接进入协议结算的数值项写明公式、范围、持续与消耗；机制项只写真实存在的必要条件与结果，禁止为凑“完整字段”补造限制。'
    if old in text:
        text = text.replace(old, new)

    quality_marker = '    - 各组件独立定档；原著组件只采用当前版本与阶段的稳定表现'
    quality_add = quality_marker + '\n    - 品质负责约束强度，不负责生成文案；低档效果可以简单，但不能无用或自带笑话式负面。'
    if quality_marker in text and '品质负责约束强度' not in text:
        text = text.replace(quality_marker, quality_add)

    QUALITY_RULE.write_text(text, encoding='utf-8', newline='')


def patch_test() -> None:
    TEST.write_text(r'''const assert = require('node:assert/strict');
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
''', encoding='utf-8', newline='')


def main() -> None:
    patch_opening()
    patch_entity_rule()
    patch_quality_rule()
    patch_test()
    print(f'patched {len(EFFECTS)} catalog entries')


if __name__ == '__main__':
    main()
