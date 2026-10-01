    function shopPick(obj) {
        for (var i = 1; i < arguments.length; i++) {
            var k = arguments[i];
            var v = obj[k];
            if (v !== undefined && v !== null && v !== '') return v;
        }
        return undefined;
    }
    function shopPickNum(obj) {
        var v = shopPick.apply(null, arguments);
        if (v === undefined) return undefined;
        var n = parseInt(String(v).replace(/[^0-9\-]/g, ''), 10);
        return isNaN(n) ? undefined : n;
    }
    // 装备类型(数字0-8)→槽位label, 复用 EQUIP_SLOTS 映射表
    function shopEquipTypeLabel(typeNum) {
        var n = parseInt(typeNum, 10);
        if (isNaN(n)) return '装备';
        for (var i = 0; i < EQUIP_SLOTS.length; i++) {
            if (EQUIP_SLOTS[i].type === n) return EQUIP_SLOTS[i].label;
        }
        return '装备';
    }
    // 技能类型(数字0-2)→中文label: 0-主动 1-被动 2-特殊
    function shopSkillTypeLabel(typeNum) {
        var n = parseInt(typeNum, 10);
        if (n === 1) return '被动';
        if (n === 2) return '特殊';
        return '主动';
    }
    function shopNormalizeTags() {
        var tags = [];
        var add = function(value) {
            if (!value) return;
            if (Array.isArray(value)) { value.forEach(add); return; }
            String(value).split(/[;；,，、|]/).forEach(function(s) {
                var t = s.trim();
                if (t && tags.indexOf(t) < 0) tags.push(t);
            });
        };
        for (var i = 0; i < arguments.length; i++) add(arguments[i]);
        return tags;
    }
    // 兜底: 商城商品若标签中无来源关键词(主神/系统/手工), 强制注入"主神空间"标签
    // 原因: 商城在主神空间运行, 售出商品天然为合法资产; AI偶尔漏写来源标签时兜底, 保证享受免除自适应压缩
    var SHOP_SOURCE_KEYWORDS = ['主神', '系统', '手工'];
    function shopEnsureSourceTag(rawTags) {
        var arr = shopNormalizeTags(rawTags);
        var hasSource = arr.some(function(t) {
            return SHOP_SOURCE_KEYWORDS.some(function(kw) { return String(t).indexOf(kw) >= 0; });
        });
        if (!hasSource) arr.push('主神空间');
        return arr;
    }
    function shopNormalizeDamageAttr(value) {
        var text = String(value || '').trim();
        if (!text) return undefined;
        if (text === '物理' || text === '法术' || text === '真实') return text;
        if (/真|穿透|无视/.test(text)) return '真实';
        if (/物理|斩|刺|钝|枪|弹|箭|刀|剑/.test(text)) return '物理';
        return '法术';
    }
    function shopNormalizeSlotType(value) {
        var text = String(value || '').trim();
        if (text === '法器' || text === '法术武器') return '武器';
        return text || undefined;
    }
    // passive_stats 统一解析成 { hp_bonus, atk_bonus, ... }(支持结构化对象与字符串两种格式)
    function shopNormalizePassiveStats(raw) {
        var out = {};
        if (!raw) return out;
        if (typeof raw === 'object' && !Array.isArray(raw)) {
            var keyMap = {
                hp_bonus:           ['hp_bonus','HP上限','HP加成','生命上限','HP','hp'],
                mp_bonus:           ['mp_bonus','MP上限','MP加成','法力上限','MP','mp'],
                atk_bonus:          ['atk_bonus','ATK加成','ATK','攻击','力量加成'],
                def_bonus:          ['def_bonus','DEF加成','DEF','防御','防御加成'],
                spell_atk_bonus:    ['spell_atk_bonus','法术ATK加成','法术ATK','法攻','法术攻击'],
                spell_power_bonus:  ['spell_power_bonus','法术强度加成','法术强度','法强'],
                mdef_bonus:          ['mdef_bonus','MDEF加成','魔法防御加成','MDEF','魔防'],
                saving_throw_bonus: ['saving_throw_bonus','豁免','豁免加成']
            };
            for (var std in keyMap) {
                if (!keyMap.hasOwnProperty(std)) continue;
                var v = shopPick.apply(null, [raw].concat(keyMap[std]));
                if (v !== undefined) out[std] = parseInt(v, 10) || 0;
            }
            return out;
        }
        if (typeof raw === 'string') {
            var attrMap = {
                hp_bonus:           /HP上限|HP加成|hp_bonus|生命上限|HP/i,
                mp_bonus:           /MP上限|MP加成|mp_bonus|法力上限|MP/i,
                atk_bonus:          /atk_bonus|攻击加成|ATK加成|ATK(?!加成)/i,
                def_bonus:          /def_bonus|防御加成|DEF加成|DEF/i,
                spell_atk_bonus:    /spell_atk_bonus|法术ATK加成|法术ATK|法攻/i,
                spell_power_bonus:  /spell_power_bonus|法术强度加成|法术强度|法强/i,
                mdef_bonus:          /mdef_bonus|MDEF加成|魔法防御加成|MDEF|魔防/i,
                saving_throw_bonus: /saving_throw_bonus|豁免加成|豁免/i
            };
            for (var s2 in attrMap) {
                if (!attrMap.hasOwnProperty(s2)) continue;
                var m = raw.match(new RegExp(attrMap[s2].source + '[\\s]*[\\+＋]([\\d]+)', 'i'));
                if (m) out[s2] = parseInt(m[1], 10);
            }
        }
        return out;
    }
    function shopNormalizeSkill(raw) {
        var rawCat = shopPick(raw, '类型','category');
        // 保留原始数字(匹配角色侧 skill_item.类型: clampNum(0,0,2))
        var catNum = (typeof rawCat === 'number') ? rawCat
            : (typeof rawCat === 'string' && /^\d+$/.test(String(rawCat))) ? parseInt(String(rawCat), 10)
            : 0;
        var category = shopSkillTypeLabel(catNum);
        var item = {
            name:        shopPick(raw, 'name','名称','技能名','技能名称') || '未命名',
            level:       shopPickNum(raw, 'level','等级','数值等级'),
            rating:      shopPick(raw, 'rating','品级','品质','评级'),
            price:       parseInt(String(shopPick(raw, 'price','价格','售价','价钱') || '0').replace(/[^0-9]/g,''), 10) || 0,
            category_num: catNum,
            category:    category,                          // 类型label(主动/被动/特殊)
            cost:        shopPick(raw, '消耗','mp_cost','MP消耗','法力消耗','mp','MP'),  // 新结构: 字符串如 '8MP'
            effects:     shopPick(raw, '效果','effect','技能效果'),  // 新结构: 对象 {主动:'对单体造成3d6火焰伤害'}
            description: shopPick(raw, 'description','描述','技能描述','说明'),
            tags:        shopEnsureSourceTag(shopPick(raw, 'tags','标签'))
        };
        return item;
    }
    function shopNormalizeBloodline(raw) {
        var rawAttrs = shopPick(raw, '原始属性','基础属性','属性');  // 新结构: 对象 {力量:4, 体质:4}
        var rawEffects = shopPick(raw, '效果','特殊效果','特效');    // 新结构: 对象 {被动:'每回合回复5%HP'}
        var item = {
            name:       shopPick(raw, 'name','名称','血统名','血统名称') || '未命名',
            level:      shopPickNum(raw, 'level','等级','数值等级'),
            rating:     shopPick(raw, 'rating','品级','品质','评级'),
            price:      parseInt(String(shopPick(raw, 'price','价格','售价','价钱') || '0').replace(/[^0-9]/g,''), 10) || 0,
            raw_attrs:  rawAttrs,
            effects:    rawEffects,
            description: shopPick(raw, 'description','描述','血统描述','说明','效果'),
            tags:        shopEnsureSourceTag(shopPick(raw, 'tags','标签'))
        };
        return item;
    }
    // 形态列表归一化: 对齐角色侧 形态库 条目结构 {层级, 消耗, 状态, 标签, 原始属性, 效果, 技能, 描述}
    //   技能子列表规范化为与角色侧 skill_item 一致: {品质, 类型(0-2), 标签, 效果, 描述, 消耗}
    function shopNormalizeFormSkill(raw) {
        var rawType = shopPick(raw, '类型','type');
        var catNum = (typeof rawType === 'number') ? rawType
            : (typeof rawType === 'string' && /^\d+$/.test(String(rawType))) ? parseInt(String(rawType), 10) : 0;
        return {
            name:    shopPick(raw, 'name','名称','技能名','技能名称') || '',
            品质:    shopPick(raw, 'rating','品质','品级','评级') || '',
            类型:    catNum,
            标签:    shopEnsureSourceTag(shopPick(raw, 'tags','标签')),
            效果:    shopPick(raw, '效果','effect','技能效果') || {},
            描述:    shopPick(raw, 'description','描述','技能描述','说明') || '',
            消耗:    shopPick(raw, '消耗','mp_cost','MP消耗','法力消耗','mp','MP') || '无'
        };
    }
    function shopNormalizeForm(raw) {
        var rawSkills = shopPick(raw, '技能','skills');
        var skills = [];
        if (Array.isArray(rawSkills)) {
            for (var i = 0; i < rawSkills.length; i++) {
                if (rawSkills[i] && typeof rawSkills[i] === 'object') skills.push(shopNormalizeFormSkill(rawSkills[i]));
            }
        }
        // 层级字段已取代"品质"; 兼容AI仍输出 品质 字段兜底
        var tier = shopPick(raw, '层级','level','tier');
        if (tier == null || tier === '') tier = shopPick(raw, 'rating','品质','品级','评级') || '';
        // 归正为罗马数字(Ⅰ~Ⅸ); AI 可能输出品质字母(F~SSS) → 转对应罗马数字, 不入库原始字母
        if (tier !== '') tier = tierRomanOf(tier);
        return {
            name:          shopPick(raw, 'name','名称','形态名','形态名称') || '未命名',
            price:         parseInt(String(shopPick(raw, 'price','价格','售价','价钱') || '0').replace(/[^0-9]/g,''), 10) || 0,
            tier:          String(tier),
            cost:          shopPick(raw, '消耗','mp_cost','MP消耗','法力消耗','mp','MP') || '',
            status:        shopPick(raw, 'status','状态') || '完好',
            raw_attrs:     shopPick(raw, '原始属性','基础属性','属性') || {},
            effects:       shopPick(raw, '效果','特效','特殊效果') || {},
            skills:        skills,
            description:   shopPick(raw, 'description','描述','说明') || '',
            tags:          shopEnsureSourceTag(shopPick(raw, 'tags','标签'))
        };
    }
    // 升级列表归一化: 按所属大类(血统/技能/装备/形态)保留原始结构 + 替换目标
    function shopNormalizeUpgrade(raw) {
        var rawType = shopPick(raw, '类型','type');
        var typeNum = (typeof rawType === 'number') ? rawType
            : (typeof rawType === 'string' && /^\d+$/.test(String(rawType))) ? parseInt(String(rawType), 10) : 0;
        var rawCat = shopPick(raw, '所属大类','category') || '';
        // 形态升级: 层级(罗马数字) 取代 品质 字母, 用于卡片右上角与入库
        var formTier = (rawCat === '形态') ? tierRomanOf(shopPick(raw, '层级','level','tier','rating','品质','品级','评级') || 'Ⅰ') : '';
        // 形态升级: 归一化 技能 子数组 + 状态 字段(供 shopBuildUpgradeCard 渲染技能块, shopToFormVar 入库)
        var formSkills = [], formStatus = '完好';
        if (rawCat === '形态') {
            formStatus = shopPick(raw, 'status','状态') || '完好';
            var rawSkills = shopPick(raw, '技能','skills');
            if (Array.isArray(rawSkills)) {
                for (var si = 0; si < rawSkills.length; si++) {
                    if (rawSkills[si] && typeof rawSkills[si] === 'object') formSkills.push(shopNormalizeFormSkill(rawSkills[si]));
                }
            }
        }
        return {
            name:           shopPick(raw, 'name','名称') || '未命名',
            level:          shopPickNum(raw, 'level','等级','数值等级'),
            rating:         shopPick(raw, 'rating','品级','品质','评级'),
            tier:           formTier,
            category:       rawCat,
            price:          parseInt(String(shopPick(raw, 'price','价格','售价','价钱') || '0').replace(/[^0-9]/g,''), 10) || 0,
            replace_target: shopPick(raw, 'replace_target','替换目标') || '',
            category_num:   typeNum,
            slot_type:      shopEquipTypeLabel(typeNum),
            slot_type_num:  typeNum,
            cost:           shopPick(raw, '消耗','mp_cost','MP消耗','法力消耗','mp','MP') || '',
            raw_attrs:      shopPick(raw, '原始属性','基础属性','属性'),
            effects:        shopPick(raw, '效果','特效','特殊效果'),
            description:    shopPick(raw, 'description','描述','说明'),
            '描述':         shopPick(raw, 'description','描述','说明'),
            tags:           shopEnsureSourceTag(shopPick(raw, 'tags','标签')),
            skills:         formSkills,
            status:         formStatus
        };
    }
    function shopNormalizeEquip(raw) {
        var rawType = shopPick(raw, '类型','type','槽位','部位','slot_type');
        // 保留原始数字(匹配角色侧 equip_item.类型: clampNum(0,0,8))
        var typeNum = (typeof rawType === 'number') ? rawType
            : (typeof rawType === 'string' && /^\d+$/.test(String(rawType))) ? parseInt(String(rawType), 10)
            : 0;
        var slotType = shopEquipTypeLabel(typeNum);
        var item = {
            name:      shopPick(raw, 'name','名称','装备名','装备名称') || '未命名',
            level:     shopPickNum(raw, 'level','等级','数值等级'),
            rating:    shopPick(raw, 'rating','品级','品质','评级'),
            price:     parseInt(String(shopPick(raw, 'price','价格','售价','价钱') || '0').replace(/[^0-9]/g,''), 10) || 0,
            slot_type: slotType,
            slot_type_num: typeNum,
            raw_attrs: shopPick(raw, '原始属性','基础属性','属性'),  // 新结构: 对象 {力量:1, 体质:2}
            effects:   shopPick(raw, '效果','特效','special_effect','特殊效果','特性'),  // 新结构: 对象 {被动:'物理防御+3'}
            cost:      shopPick(raw, '消耗','mp_cost','MP消耗','法力消耗','mp','MP') || '',
            '描述':    shopPick(raw, '描述','description','说明'),
            tags:      shopEnsureSourceTag(shopPick(raw, 'tags','标签'))
        };
        return item;
    }
    function shopNormalizeConsume(raw) {
        return {
            name:            shopPick(raw, 'name','名称','道具名','物品名') || '未命名',
            level:           shopPickNum(raw, 'level','等级','数值等级'),
            rating:          shopPick(raw, 'rating','品级','品质','评级'),
            price:           parseInt(String(shopPick(raw, 'price','价格','售价','价钱') || '0').replace(/[^0-9]/g,''), 10) || 0,
            consumable_type: shopPick(raw, 'consumable_type','类型','道具类型','分类') || '道具',
            charges:         shopPickNum(raw, 'charges','数量','次数','使用次数'),
            effects:         shopPick(raw, '效果','usage','使用效果'),  // 新结构: 对象 {使用:'恢复2d4+2HP'}
            description:     shopPick(raw, 'description','描述','说明'),
            tags:            shopEnsureSourceTag(shopPick(raw, 'tags','标签'))
        };
    }
    // 标准化整个商城数据: 产出 { 装备区:{typeLabel:[...]}, 技能区:{typeLabel:[...]}, 道具区:{typeLabel:[...]}, 血统区:[] }
    // 新结构: 商城.装备列表/技能列表/血统列表/道具列表 均为扁平数组
    // 装备/技能/道具按「类型」分组到子对象, 供左nav按类型切换; 血统为纯数组
    function shopNormalizeMarketData(raw) {
        var out = { 装备区:{}, 道具区:{}, 技能区:{}, 血统区:[], 升级区:[], 形态区:[] };
        if (!raw || typeof raw !== 'object') return out;
        // 装备列表(扁平数组) → 按 类型(数字0-8) 分组到 {槽位label: [...]}
        var equips = raw['装备列表'];
        if (Array.isArray(equips)) {
            for (var i = 0; i < equips.length; i++) {
                if (!equips[i] || typeof equips[i] !== 'object') continue;
                var e = shopNormalizeEquip(equips[i]);
                var sl = e.slot_type || '装备';
                if (!out.装备区[sl]) out.装备区[sl] = [];
                out.装备区[sl].push(e);
            }
        }
        // 技能列表(扁平数组) → 按 类型(数字0-2) 分组到 {类型label: [...]}
        var skills = raw['技能列表'];
        if (Array.isArray(skills)) {
            for (var j = 0; j < skills.length; j++) {
                if (!skills[j] || typeof skills[j] !== 'object') continue;
                var s = shopNormalizeSkill(skills[j]);
                var sc = s.category || '主动';
                if (!out.技能区[sc]) out.技能区[sc] = [];
                out.技能区[sc].push(s);
            }
        }
        // 道具列表(扁平数组) → 按 类型(字符串, 如恢复/战术/特殊) 分组到 {类型label: [...]}
        var consumables = raw['道具列表'];
        if (Array.isArray(consumables)) {
            for (var ci = 0; ci < consumables.length; ci++) {
                if (!consumables[ci] || typeof consumables[ci] !== 'object') continue;
                var c = shopNormalizeConsume(consumables[ci]);
                var ct = c.consumable_type || '道具';
                if (!out.道具区[ct]) out.道具区[ct] = [];
                out.道具区[ct].push(c);
            }
        }
        // 血统列表(扁平数组)
        var bloods = raw['血统列表'];
        if (Array.isArray(bloods)) {
            for (var bi = 0; bi < bloods.length; bi++) {
                if (bloods[bi] && typeof bloods[bi] === 'object') out.血统区.push(shopNormalizeBloodline(bloods[bi]));
            }
        }
        // 升级列表(扁平数组, 无子分组)
        var upgrades = raw['升级列表'];
        if (Array.isArray(upgrades)) {
            for (var ui = 0; ui < upgrades.length; ui++) {
                if (upgrades[ui] && typeof upgrades[ui] === 'object') out.升级区.push(shopNormalizeUpgrade(upgrades[ui]));
            }
        }
        // 形态列表(扁平数组, 无子分组)
        var forms = raw['形态列表'];
        if (Array.isArray(forms)) {
            for (var fi = 0; fi < forms.length; fi++) {
                if (forms[fi] && typeof forms[fi] === 'object') out.形态区.push(shopNormalizeForm(forms[fi]));
            }
        }
        return out;
    }
    // ---- 变量转换层: 标准化条目 → MVU变量格式 ----
    function shopParsePercent(value) {
        if (value === undefined || value === null) return 0;
        if (typeof value === 'number') return value;
        var text = String(value);
        return parseFloat(text) || 0;
    }
    // 转换归一化商品 → 角色侧变量(技能: 类型输出数字0-2匹配skill_item)
    function shopToSkillVar(item) {
        var out = {
            等级: item.level,
            品质: item.rating,
            类型: item.category_num != null ? item.category_num : 0,
            消耗: item.cost || '',
            效果: item.effects || {},
            描述: item.description || ''
        };
        if (item.tags && item.tags.length) out.标签 = item.tags;
        return out;
    }
    // 转换归一化商品 → 角色侧变量(血统: 原始属性/效果均为对象)
    function shopToBloodlineVar(item) {
        var out = {
            等级: item.level,
            品质: item.rating,
            原始属性: item.raw_attrs || {},
            效果: item.effects || {},
            描述: item.description || ''
        };
        if (item.tags && item.tags.length) out.标签 = item.tags;
        return out;
    }
    // 转换归一化商品 → 角色侧变量(装备: 类型输出数字0-8匹配equip_item, 状态默认未装备=0)
    function shopToEquipVar(item, slot) {
        var out = {
            类型: item.slot_type_num != null ? item.slot_type_num : 0,
            状态: 0,
            品质: item.rating,
            标签: (item.tags && item.tags.length) ? item.tags : [],
            原始属性: item.raw_attrs || {},
            效果: item.effects || {},
            描述: item['描述'] || '',
            消耗: item.cost || ''
        };
        return out;
    }
    // 转换归一化商品 → 角色侧变量(道具: 类型字符串, 数量合并, 效果对象)
    function shopToConsumeVar(item, qty) {
        var out = {
            品质: item.rating,
            类型: item.consumable_type || '道具',
            数量: qty,
            标签: (item.tags && item.tags.length) ? item.tags : [],
            效果: item.effects || {},
            描述: item.description || '',
            状态: 0
        };
        return out;
    }
    // 转换归一化商品 → 角色侧变量(形态: 对齐 形态库 条目结构, 键为形态名)
    //   结构 {层级, 消耗, 状态, 标签, 原始属性, 效果, 技能, 描述}; 冷却缺省由系统按1回合兜底
    function shopToFormVar(item, formName) {
        // 技能子列表按 skill_item 结构规整 {品质, 类型, 标签, 效果, 描述, 消耗}
        var skillsOut = {};
        var srcSkills = Array.isArray(item.skills) ? item.skills : [];
        for (var i = 0; i < srcSkills.length; i++) {
            var sk = srcSkills[i] || {};
            var skName = shopPick(sk, 'name','名称') || ('技能' + (i + 1));
            skillsOut[skName] = {
                品质: sk.品质 || '',
                类型: (sk.类型 != null) ? sk.类型 : 0,
                标签: (sk.标签 && sk.标签.length) ? sk.标签 : [],
                效果: sk.效果 || {},
                描述: sk.描述 || '',
                消耗: sk.消耗 || '无'
            };
        }
        return {
            层级:     (item.tier != null && item.tier !== '') ? tierRomanOf(item.tier) : '',
            消耗:     item.cost || '',
            状态:     item.status || '完好',
            标签:     (item.tags && item.tags.length) ? item.tags : [],
            原始属性: item.raw_attrs || {},
            效果:     item.effects || {},
            技能:     skillsOut,
            描述:     item.description || ''
        };
    }
    // 重算衍生属性(体力/精神 + 血统被动 + 已装备DEF/MDEF)
    function shopRecalcDerived(character) {
        if (!character) return;
        var base = character.基础属性 || {};
        var old = character.衍生属性 || {};
        var oldHpMax = Math.max(Number(old.HP上限 || old.HP || 1), 1);
        var oldMpMax = Math.max(Number(old.MP上限 || old.MP || 1), 1);
        var hpRatio = Math.min(1, Math.max(0, Number(old.HP || 0) / oldHpMax));
        var mpRatio = Math.min(1, Math.max(0, Number(old.MP || 0) / oldMpMax));
        var bonus = { HP加成:0, MP加成:0, ATK加成:0, DEF加成:0, 法术ATK加成:0, 法术强度加成:0, MDEF加成:0, 豁免加成:0 };
        var bloods = character.血统 || {};
        for (var bn in bloods) {
            if (!bloods.hasOwnProperty(bn)) continue;
            var ps = bloods[bn] ? bloods[bn].被动属性 : null;
            if (!ps) continue;
            for (var bk in bonus) {
                if (!bonus.hasOwnProperty(bk)) continue;
                var val = (bk === '法术强度加成') ? shopParsePercent(ps[bk]) : Number(ps[bk] || 0);
                bonus[bk] += Number.isFinite(val) ? val : 0;
            }
        }
        var equipDef = 0, equipMdef = 0;
        var eqs = character.装备 || {};
        for (var en in eqs) {
            if (!eqs.hasOwnProperty(en)) continue;
            var eq = eqs[en];
            if (!eq || eq.状态 !== '已装备') continue;
            equipDef  += Number(eq.DEF || 0);
            equipMdef += Number(eq.MDEF || 0);
        }
        var hpMax = Math.max(1, Number(base.体力 || 0) * 5 + bonus.HP加成);
        var mpMax = Math.max(0, Number(base.精神 || 0) * 5 + bonus.MP加成);
        var derived = {};
        for (var ok in old) { if (old.hasOwnProperty(ok)) derived[ok] = old[ok]; }
        derived.HP上限 = hpMax;
        derived.HP = Math.max(1, Math.min(hpMax, Math.round(hpMax * hpRatio)));
        derived.MP上限 = mpMax;
        derived.MP = Math.max(0, Math.min(mpMax, Math.round(mpMax * mpRatio)));
        derived.ATK = Math.floor(Number(base.力量 || 0) / 5) + bonus.ATK加成;
        derived.DEF = equipDef + bonus.DEF加成;
        derived.MDEF = equipMdef + bonus.MDEF加成;
        derived.法术ATK = Math.floor(Number(base.智力 || 0) / 5) + bonus.法术ATK加成;
        derived.法术强度 = shopParsePercent(bonus.法术强度加成) / 100;
        if (bonus.豁免加成) derived.豁免加成 = bonus.豁免加成;
        character.衍生属性 = derived;
    }
    // ---- 商城状态(模块级, 切聊天/重渲染时持久) ----
    var shopMarketData = null;     // 归一化后的市场数据(4区)
    var shopActiveTab = '';        // 当前区域: 装备|道具|技能|血统
    var shopActiveSlot = '';       // 当前装备区槽位
    var shopBloodCount = 0;        // 当前玩家已拥有血统数(用于商城血统区上限判定)
    var shopBloodLimit = 3;        // 血统数量上限(取自 共同.血统限制数)
    var shopCart = [];             // 购物车(角色单人, 每项 {item副本, _cat, _slot, quantity})
    var shopRefreshing = false;    // 刷新商品进行中(模块级标志, 切聊天/重渲染时持久, 避免按钮状态丢失)
    var shopRefreshEpoch = 0;      // 刷新回合计数: 每次 handleShopRefresh +1, 旧 Promise 回调回合不匹配时丢弃结果(支持"停止刷新"打断卡死请求)
    var shopReqText = '';          // 需求输入框内容(模块级, 跨刷新保留: 刷新后 renderAll 重建DOM, 用 value 属性回填使其不丢; 不满意可基于原需求继续刷)
    // ★ 多角色商城: 当前选中的购买对象。'角色' 为角色自身, 否则为 关系列表 中的 NPC 名字
    var shopCurrentActor = '角色';
    // 角色独有商城商品库的存储名称: 商城.成员商库 = { '<角色名键>': { 血统列表:[...], 技能列表:[...], 装备列表:[...], 道具列表:[...], 升级列表:[...] } }
    // '角色'键 对应角色自己的商城商品(与旧的 stat_data.商城 顶层结构兼容); NPC 键 对应该 NPC 的商城商品
    var SHOP_ACTOR_LIB_KEY = '成员商库';  // 商城下存放多角色商品库的子键名
    var SHOP_ACTOR_REINCARNATOR = '角色';          // 角色键名常量
    // ===== ★ 多角色商城: 角色切换与商品库隔离辅助 =====
    // 获取可选角色下拉项: 角色自己 + 关系列表中 在场=true 且 是否队友=true 的 NPC
    // 返回 [{name, label}], name='角色' 或 NPC名; label 用于下拉显示
    function shopBuildActorOptions(sd) {
        var list = [{ name: SHOP_ACTOR_REINCARNATOR, label: '角色(自身)' }];
        var relations = (sd && sd.关系列表) ? sd.关系列表 : null;
        if (relations && typeof relations === 'object') {
            var allNpc = Object.keys(relations);
            allNpc.sort();
            for (var i = 0; i < allNpc.length; i++) {
                var nm = allNpc[i];
                var npc = relations[nm];
                if (!npc || typeof npc !== 'object') continue;
                if (npc.在场 !== true) continue;
                if (npc.是否队友 !== true) continue;
                list.push({ name: nm, label: nm });
            }
        }
        return list;
    }
    // 解析当前角色对象 {character, path, isReincarnator, name}
    function shopResolveCharacter(sd, actorName) {
        actorName = actorName || shopCurrentActor || SHOP_ACTOR_REINCARNATOR;
        if (actorName === SHOP_ACTOR_REINCARNATOR) {
            return { character: (sd && sd.角色) || {}, path: '角色', isReincarnator: true, name: SHOP_ACTOR_REINCARNATOR };
        }
        var npc = (sd && sd.关系列表 && sd.关系列表[actorName]) ? sd.关系列表[actorName] : null;
        return { character: npc || {}, path: '关系列表.' + actorName, isReincarnator: false, name: actorName };
    }
// SHOP_PERMISSION_GUARD_START
var SHOP_PERMISSION_QUALITY_ORDER = ['F','E','D','C','B','A','S','SS','SSS'];
var SHOP_PERMISSION_TIER_ORDER = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
var SHOP_CREDENTIAL_SPEND_MIN_RANK = 3; // C级起才执行越阶购买/升级凭证消耗
function shopPermissionRank(value) {
    var raw = String(value == null ? '' : value).trim().toUpperCase().replace(/\s+/g, '').replace(/级$/, '');
    var qualityIndex = SHOP_PERMISSION_QUALITY_ORDER.indexOf(raw);
    if (qualityIndex >= 0) return qualityIndex;
    var tierIndex = SHOP_PERMISSION_TIER_ORDER.indexOf(raw);
    if (tierIndex >= 0) return tierIndex;
    if (/^[1-9]$/.test(raw)) return Number(raw) - 1;
    return -1;
}
function shopPermissionGrade(rank) {
    rank = Number(rank);
    if (!Number.isFinite(rank)) return '?';
    rank = Math.max(0, Math.min(SHOP_PERMISSION_QUALITY_ORDER.length - 1, Math.floor(rank)));
    return SHOP_PERMISSION_QUALITY_ORDER[rank];
}
function shopPermissionCredentialRank(credentials) {
    var best = -1;
    var ledger = credentials && typeof credentials === 'object' ? credentials : {};
    for (var i = 0; i < SHOP_PERMISSION_QUALITY_ORDER.length; i++) {
        var grade = SHOP_PERMISSION_QUALITY_ORDER[i];
        if (Number(ledger[grade] || 0) > 0) best = i;
    }
    return best;
}
function shopPermissionCapRank(character, credentials) {
    var tierRank = shopPermissionRank(character && character.层级);
    if (tierRank < 0) tierRank = 0;
    var baseRank = Math.min(SHOP_PERMISSION_QUALITY_ORDER.length - 1, tierRank + 1);
    var credentialRank = shopPermissionCredentialRank(credentials || {});
    return Math.max(baseRank, credentialRank);
}
function shopPermissionItemRank(item) {
    if (!item || typeof item !== 'object') return -1;
    var tierRank = shopPermissionRank(item.tier);
    if (tierRank >= 0) return tierRank;
    return shopPermissionRank(item.rating);
}
function shopPermissionDecision(character, item, credentials) {
    var capRank = shopPermissionCapRank(character || {}, credentials || {});
    var requiredRank = shopPermissionItemRank(item);
    return {
        allowed: requiredRank >= 0 && requiredRank <= capRank,
        capRank: capRank,
        requiredRank: requiredRank,
        capGrade: shopPermissionGrade(capRank),
        requiredGrade: requiredRank >= 0 ? shopPermissionGrade(requiredRank) : '?'
    };
}
function shopPermissionMessage(decision, item) {
    var name = item && item.name ? item.name : '该商品';
    if (!decision || decision.requiredRank < 0) return '商城权限校验失败: ' + name + ' 的品质/层级无效';
    return '权限不足: 当前商城上限为' + decision.capGrade + '级，' + name + '为' + decision.requiredGrade + '级';
}
/*
 * 商城凭证消耗：只负责“实际购买/升级”的资源成本，不改变既有商城可见权限。
 * - F~D级：永不因本规则消耗凭证。
 * - C级及以上：目标品质高于购买对象当前生命层级对应品质时，消耗目标品质凭证×1。
 * - 跨多级也只看最终目标品质；血统融合结果本身不经过此函数。
 */
function shopCredentialRequirement(character, item) {
    var actorRank = shopPermissionRank(character && character.层级);
    if (actorRank < 0) actorRank = 0;
    var targetRank = shopPermissionItemRank(item);
    var required = targetRank >= SHOP_CREDENTIAL_SPEND_MIN_RANK && targetRank > actorRank;
    return {
        required: required,
        actorRank: actorRank,
        targetRank: targetRank,
        grade: required ? shopPermissionGrade(targetRank) : '',
        quantity: required ? 1 : 0
    };
}
function shopCredentialQty(credentials, grade) {
    var ledger = credentials && typeof credentials === 'object' ? credentials : {};
    return Math.max(0, Math.floor(Number(ledger[grade] || 0) || 0));
}
function shopCredentialUnits(item) {
    if (!item || item._cat !== '道具区') return 1;
    return Math.max(1, Math.floor(Number(item.quantity || 1) || 1));
}
function shopCredentialCartRequirements(character, cart) {
    var result = {};
    var list = Array.isArray(cart) ? cart : [];
    for (var i = 0; i < list.length; i++) {
        var item = list[i] || {};
        var req = shopCredentialRequirement(character || {}, item);
        if (!req.required) continue;
        var units = shopCredentialUnits(item);
        result[req.grade] = (result[req.grade] || 0) + units;
    }
    return result;
}
function shopCredentialShortages(credentials, requirements) {
    var missing = [];
    var reqs = requirements && typeof requirements === 'object' ? requirements : {};
    for (var i = 0; i < SHOP_PERMISSION_QUALITY_ORDER.length; i++) {
        var grade = SHOP_PERMISSION_QUALITY_ORDER[i];
        var need = Math.max(0, Math.floor(Number(reqs[grade] || 0) || 0));
        if (!need) continue;
        var have = shopCredentialQty(credentials, grade);
        if (have < need) missing.push({ grade: grade, need: need, have: have });
    }
    return missing;
}
function shopCredentialRequirementText(requirements) {
    var parts = [];
    var reqs = requirements && typeof requirements === 'object' ? requirements : {};
    for (var i = 0; i < SHOP_PERMISSION_QUALITY_ORDER.length; i++) {
        var grade = SHOP_PERMISSION_QUALITY_ORDER[i];
        var need = Math.max(0, Math.floor(Number(reqs[grade] || 0) || 0));
        if (need > 0) parts.push(grade + '×' + need);
    }
    return parts.join(' / ');
}
function shopCredentialShortageText(shortages) {
    var list = Array.isArray(shortages) ? shortages : [];
    return list.map(function(x) { return x.grade + '级×' + x.need + '（持有' + x.have + '）'; }).join(' / ');
}
function shopCredentialConsume(credentials, requirements) {
    if (!credentials || typeof credentials !== 'object') return Object.keys(requirements || {}).length === 0;
    if (shopCredentialShortages(credentials, requirements).length) return false;
    var reqs = requirements && typeof requirements === 'object' ? requirements : {};
    for (var i = 0; i < SHOP_PERMISSION_QUALITY_ORDER.length; i++) {
        var grade = SHOP_PERMISSION_QUALITY_ORDER[i];
        var need = Math.max(0, Math.floor(Number(reqs[grade] || 0) || 0));
        if (need > 0) credentials[grade] = shopCredentialQty(credentials, grade) - need;
    }
    return true;
}
function shopCredentialRefund(credentials, requirements) {
    if (!credentials || typeof credentials !== 'object') return;
    var reqs = requirements && typeof requirements === 'object' ? requirements : {};
    for (var i = 0; i < SHOP_PERMISSION_QUALITY_ORDER.length; i++) {
        var grade = SHOP_PERMISSION_QUALITY_ORDER[i];
        var qty = Math.max(0, Math.floor(Number(reqs[grade] || 0) || 0));
        if (qty > 0) credentials[grade] = shopCredentialQty(credentials, grade) + qty;
    }
}
// SHOP_PERMISSION_GUARD_END
    // 校正 shopCurrentActor: 若当前选中的NPC不在候选列表里(已离场/非队友), 退回角色
    function shopEnsureActorValid(sd) {
        if (shopCurrentActor === SHOP_ACTOR_REINCARNATOR) return;
        var opts = shopBuildActorOptions(sd);
        var found = false;
        for (var i = 0; i < opts.length; i++) { if (opts[i].name === shopCurrentActor) { found = true; break; } }
        if (!found) shopCurrentActor = SHOP_ACTOR_REINCARNATOR;
    }
    // 取得当前角色对应的商品库对象(读写时直接深拷贝该对象的引用; 不存在则创建空结构)
    //★ 兼容升级: 角色读取商库时, 若 成员商库 不存在, 则沿用旧的 stat_data.商城 顶层结构(向后兼容)
    function shopGetActorLibRaw(rawMarket, actorName) {
        actorName = actorName || shopCurrentActor || SHOP_ACTOR_REINCARNATOR;
        if (!rawMarket) return null;
        var libMap = rawMarket[SHOP_ACTOR_LIB_KEY];
        if (libMap && typeof libMap === 'object' && libMap[actorName]) {
            return libMap[actorName];
        }
        if (actorName === SHOP_ACTOR_REINCARNATOR) {
            // 兼容旧数据: 顶层有 血统列表/技能列表... 则作为角色商库
            if (Array.isArray(rawMarket.血统列表) || Array.isArray(rawMarket.技能列表)
                || Array.isArray(rawMarket.装备列表) || Array.isArray(rawMarket.道具列表) || Array.isArray(rawMarket.升级列表) || Array.isArray(rawMarket.形态列表)) {
                return rawMarket;
            }
        }
        return null;
    }
    // 保存并恢复 .sam-shop-list 滚动位置(参考持有面板 renderAll 的 scrollTop 保持模式)
    // 原因: renderAll 重建面板后, 内部 .sam-shop-list(max-height:340px; overflow-y:auto)
    // 的 scrollTop 会归零, 导致点+/-按钮或选卡片时商品列表跳回顶部
