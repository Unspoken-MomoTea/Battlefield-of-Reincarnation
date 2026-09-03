import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

// ==========================================
// 🛡️ 高阶防御性工具函数 (防止 AI 输出格式幻觉)
// ==========================================

const isPlainObject = v => !!v && 'object' === typeof v && !Array.isArray(v);

// 【核心修复】严格实体拦截器：拒绝 AI 拿 `{}` 敷衍了事
const strictItem = (schema) => z.preprocess(val => {
    // 如果 AI 敢传入空对象，直接将其转为 undefined，触发 Zod 的 required 报错拦截！
    if (isPlainObject(val) && Object.keys(val).length === 0) {
        return undefined; 
    }
    return val;
}, schema); // 坚决不在尾部加 .prefault({})，让 MVU 真正报错打回

const safeStr = (val = '') => z.preprocess(v => 'string' === typeof v ? v : val, z.string()).prefault(val);

const safeNum = (val = 0) => z.preprocess(v => {
    if ('number' === typeof v) return Number.isFinite(v) ? v : val;
    if ('string' === typeof v) {
        const trimmed = v.trim();
        if (!trimmed) return val;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : val;
    }
    return val;
}, z.number()).prefault(val);

const clampNum = (defaultVal, min, max) => safeNum(defaultVal).transform(v => _.clamp(v, min, max));

const boolPreprocess = (defaultVal = false) => z.preprocess(v => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
        const lower = v.trim().toLowerCase();
        return lower === 'true' || lower === '是' || lower === '1';
    }
    if (typeof v === 'number') return v > 0;
    return defaultVal;
}, z.boolean()).prefault(defaultVal);

const safeTags = (defaultVal = []) => z.preprocess(
    v => Array.isArray(v) ? v.filter(item => 'string' === typeof item) : defaultVal,
    z.array(z.string())
).prefault(defaultVal).transform(arr => _.uniq(arr));


// ==========================================
// 🎲 核心枚举与共用模块
// ==========================================

// 生命层级 Ⅰ~Ⅸ 与 品质 F~SSS 的双向映射（两序列各 9 档，一一对应）
//   Ⅰ↔F Ⅱ↔E Ⅲ↔D Ⅳ↔C Ⅴ↔B Ⅵ↔A Ⅶ↔S Ⅷ↔SS Ⅸ↔SSS
const RANK_ROMAN  = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
const RANK_QUALITY = ['F','E','D','C','B','A','S','SS','SSS'];
const ROMAN_TO_QUALITY = Object.assign({}, ...RANK_ROMAN.map((r, i) => ({ [r]: RANK_QUALITY[i] })));
const QUALITY_LETTER_LIST = RANK_QUALITY.slice();
/**
 * 把"AI 乱传的罗马数字品质"归正为品质字母：
 *   - 正常品质字母(F~SSS) 原样返回
 *   - 罗马数字(Ⅰ~Ⅸ) 按映射转成对应品质字母（AI 可能错把 品质:D 写成 品质:Ⅲ）
 *   - 其它非法/缺失值回落 F
 */
function normalizeQuality(v) {
    const s = String(v ?? '').trim();
    if (QUALITY_LETTER_LIST.includes(s)) return s;
    if (ROMAN_TO_QUALITY[s]) return ROMAN_TO_QUALITY[s];
    return 'F';
}
// 生命层级 Ⅰ~Ⅸ：非法/缺失值统一回落 Ⅰ，避免旧存档里数字/空串/品质字母触发 enum 校验失败
const E_rank = z.preprocess(v => {
    const s = String(v ?? '').trim();
    return RANK_ROMAN.includes(s) ? s : 'Ⅰ';
}, z.enum(['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ']));
const E_alienStatus = z.preprocess(v => {
    const s = String(v ?? '').trim();
    return s === '死亡' ? '死亡' : '活跃';
}, z.enum(['活跃', '死亡']));
// 品质 F~SSS：非法/缺失值回落 F；AI 若误传罗马数字则自动归正为对应品质字母
const E_quality = z.preprocess(v => normalizeQuality(v), z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']));
// 衍生项品质：可容纳品质字母(F~SSS, 含罗马数字归正) 或 0(无/未激活/nil)
//   - 先判 "0"(数字0/^0$/空串均视作0)，否则交给 normalizeQuality 归正为品质字母
//   - 统一输出字符串，避免 union 在该 zod 版本的 enum 误伤
const E_qualityOr0 = z.preprocess(v => {
    const s = String(v ?? '').trim();
    if (s === '0' || s === '') return '0'; // 0/缺失 → '0'(与五维的 F 兜底区分: F 仍指最低品质)
    return normalizeQuality(v);
}, z.string());
/**
 * 传闻可信度三档：酒话 / 可疑 / 或许可信
 * AI 常幻觉写"可信/属实/高/低"等非法值 → 按语义自动归正到最近似档位, 避免整条传闻被 enum 打回
 */
const CRED_ENUM = ['酒话', '可疑', '或许可信'];
function normalizeCredibility(v) {
    const s = String(v ?? '').trim();
    if (CRED_ENUM.includes(s)) return s;
    // 语义归正: 明确高可信 → 或许可信; 明确低可信 → 酒话; 其余含糊值 → 可疑
    if (/^(可信|属实|真实|确实|高|较高|很高|基本属实)$/.test(s)) return '或许可信';
    if (/^(不可信|虚假|谣言|低|较低|很低|纯属谣言)$/.test(s)) return '酒话';
    return '可疑';
}
const E_credibility = z.preprocess(v => normalizeCredibility(v), z.enum(CRED_ENUM)).prefault('酒话');

const E_attr5 = z.enum(['力量', '敏捷', '体质', '精神', '魅力']);
// 形态/状态/装备共用的衍生+五维键（仅允许这些键名）
const E_form_attr = z.enum([
    '力量', '敏捷', '体质', '精神', '魅力',
    'ATK', 'DEF', 'MATK', 'MDEF', 'AP'
]);
const form_attr_val = clampNum(0, -99999999, 99999999);
/**
 * 稀疏属性对象（装备/状态/形态共用意图：只保留「写了且有效」的项）
 * - 五维（力量/敏捷/体质/精神/魅力）：品质枚举 E_quality（F~SSS）
 * - 状态原始属性：永久/成长型用品质字母，临时型用数值
 * - z.record 本身不会按枚举补全缺失键；只校验已有键名是否在 E_form_attr 内
 * - 未生成/空对象 → {}
 *
 * ★ 装备 vs 状态 的属性语义差异（核心）：
 *   - 装备：原始属性【全部用品质字母】——五维走品质，衍生项(ATK/DEF/MATK/MDEF/AP)也走品质
 *           （与血统一致，全部对照《装备与形态基础数值表》反推数值）
 *   - 状态：原始属性五维【双修】、衍生项【仅数值】——
 *           · 五维：临时状态(DBUFF，如 力量:-5) 用【数值】，永久/成长状态(功法/心法，如 力量:'B') 用【品质字母】
 *           · 衍生项：状态一律用数值加减值（如 ATK:-15），不走品质
 *
 * 因此拆成两个 transform：
 *   - sparse_form_attr  → 装备/商城装备：所有项(五维+衍生)一律只留品质字母
 *   - status_form_attr  → 状态 buff_item：全部属性保留品质字母【或】非零数值
 */
const attr5_keys = ['力量', '敏捷', '体质', '精神', '魅力'];
// 品质字母判定集合（独立常量，避免依赖可能被 prefault 修饰而丢失 .options 的 E_quality）
const QUALITY_LETTERS = new Set(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']);
/**
 * 装备/商城装备用：五维 + 衍生项 一律只接受品质字母（废弃数值语义）
 * ★ 设计要点：
 *   - record 的键用枚举 E_form_attr，配合 .prefault({}) 会在缺省时把全部合法键补齐
 *     （这正是「强制带 E_form_attr 全列」的钩子；键不齐时由 MVU 兜底填充）
 *   - 值用宽松 z.any()，避免 union(form_attr_val | E_quality) 在该 zod 版本里
 *     出现"品质字母被按键枚举校验"的 invalid_enum_value 误伤
 *   - 真正的稀疏化由【尾部 .transform 二次清洗】完成：
 *     把 prefault 填出来的空值(undefined/空串/null/非品质字母)键清掉，
 *     最终只留下 AI 实际写了品质字母的那几项 → {MATK:"D",AP:"E"}
 *   - 品质判定用独立 QUALITY_LETTERS，不依赖 E_quality.options
 *     （E_quality 被 z.preprocess 包装后 .options 会丢，旧版调用会抛"undefined.includes"）
 */
const sparse_form_attr = z.record(E_form_attr, z.any()).prefault({}).transform(obj => {
    if (!obj || typeof obj !== 'object') return {};
    const out = {};
    for (const k of Object.keys(obj)) {
        // 仅保留品质字母(含罗马数字归正)：力量:Ⅱ → 力量:'D'；非法值跳过
        const raw = String(obj[k]).trim();
        if (!raw) continue;
        if (QUALITY_LETTERS.has(raw)) out[k] = raw;          // 正常品质字母
        else if (ROMAN_TO_QUALITY[raw]) out[k] = ROMAN_TO_QUALITY[raw]; // AI 错传罗马数字
    }
    return out;
});
/**
 * 状态用：基础/衍生属性均接受品质字母（永久/成长型）或非零数值（临时型）
 * ★ 同上设计：record 锚定 E_form_attr 由 prefault 兜底补全键；尾部 transform 做稀疏清洗
 *   - 五维：保品质字母(成长/功法型) 或 非零数值(临时/DBUFF型)
 *   - 衍生项：只保非零数值
 */
const status_form_attr = z.record(E_form_attr, z.any()).prefault({}).transform(obj => {
    if (!obj || typeof obj !== 'object') return {};
    const out = {};
    for (const k of Object.keys(obj)) {
        const raw = obj[k];
        const q = String(raw).trim();
        if (q && QUALITY_LETTERS.has(q)) { out[k] = q; continue; }
        if (q && ROMAN_TO_QUALITY[q]) { out[k] = ROMAN_TO_QUALITY[q]; continue; }
        const n = Number(raw);
        if (Number.isFinite(n) && n !== 0) out[k] = n;
    }
    return out;
});
// 血统五维：必须 5 项齐全（z.object 固定键）；缺项由 prefault 补 F，非法键丢弃
const blood_attr = z.object({
    力量: E_quality,
    敏捷: E_quality,
    体质: E_quality,
    精神: E_quality,
    魅力: E_quality
}).prefault({ 力量: 'F', 敏捷: 'F', 体质: 'F', 精神: 'F', 魅力: 'F' });

// 真属性：品质→数值转换后的真实数值，schema 仅做宽松持久化占位（不缓存快照，复用由辅助计算脚本通过 statDataBefore 对比实现）
const real_attr = z.record(z.string(), z.any()).prefault({});

// 所有 add 类实体全部套上 strictItem，杜绝白板生成
// 血统
const bloodline_item = strictItem(z.object({
    品质: E_quality.prefault('F'),
    标签: safeTags([]),
    原始属性: blood_attr, // 必须含五维，不能用 z.record（record 允许缺键）
    真属性: real_attr,    // 品质→数值转换后的缓存（含 __tier 快照）
    // 保持 ZodRecord 位于最外层：最新版 MVU 需要直接识别它，才允许在效果表新增命名词条。
    // 血统创建规则要求显式提供效果（可为 {}），因此不再用 prefault 包装该动态字典。
    效果: z.record(z.string(), z.string()),
    描述: safeStr('')
}));
// 技能
const skill_item = strictItem(z.object({
    品质: E_quality.prefault('F'),
    类型: clampNum(0, 0, 2), // 0-主动 1-被动 2-特殊
    标签: safeTags([]),
    效果: z.record(z.string(), z.string()),
    描述: safeStr(''),
    消耗: safeStr('')
}));
// 装备
const equip_item = strictItem(z.object({
    品质: E_quality.prefault('F'),
    类型: clampNum(0, 0, 8),
    标签: safeTags([]),
    // 稀疏：只保留非0项（例 只写 ATK:15 → {ATK:15}，不会补出力量:0...）
    原始属性: sparse_form_attr,
    真属性: real_attr,
    效果: z.record(z.string(), z.string()),
    描述: safeStr(''),
    消耗: safeStr(''),
    状态: clampNum(0, 0, 2) // 0-未装备 1-已装备 2-仓库
}));
// 道具
const backpack_item = strictItem(z.object({
    品质: E_quality.prefault('F'), // 【修复】收束品质
    类型: safeStr(''),
    数量: clampNum(1, 0, 99999999), 
    标签: safeTags([]), 
    效果: z.record(z.string(), z.string()),
    描述: safeStr(''),
    状态: clampNum(0, 0, 2) // 0-随身道具 1-战术栏 2-仓库
}));
// 状态
// 原始属性：键只能是 E_form_attr；允许 {} / 只写 1~2 项；显式 0 会被剥掉
// ★ 状态五维双修：临时状态(如中毒/破甲导致 力量:-5) 用【数值】，永久状态(如功法修炼 力量:'B') 用【品质字母】
//   故用 status_form_attr（五维字母或数值皆可），而非装备用 sparse_form_attr（仅品质字母）
const buff_item = strictItem(z.object({
    类型: z.enum(['增益', '减益', '特殊']).prefault('增益'),
    品质: E_quality.prefault('F'),
    持续: safeStr('1回合'), // 【修复】防无限持续
    来源: safeStr(''),
    原始属性: status_form_attr,
    真属性: real_attr,
    效果: safeStr('')
}));

// 【修复】剥离 HP/EP 彻底贯彻“同生共死法则”，并加上属性上限保护
// 形态用完整 11 键对象（缺省补 0）；状态用上面的 z.record 稀疏对象
const form_attr = z.object({
    力量: E_quality, 敏捷: E_quality, 体质: E_quality,
    精神: E_quality, 魅力: E_quality,
    ATK: E_qualityOr0, DEF: E_qualityOr0, MATK: E_qualityOr0, MDEF: E_qualityOr0, AP: E_qualityOr0
}).prefault({力量: 'F', 敏捷: 'F', 体质: 'F', 精神: 'F', 魅力: 'F', ATK: '0', DEF: '0', MATK: '0', MDEF: '0', AP: '0'})
// 【稀疏化】衍生项为 "0"(无/未激活) 的不写入数据库，只保留真实有效的品质字母
.transform(obj => {
    if (!obj || typeof obj !== 'object') return obj;
    const derived = ['ATK', 'DEF', 'MATK', 'MDEF', 'AP'];
    const out = {};
    for (const k of Object.keys(obj)) {
        if (derived.includes(k) && String(obj[k]).trim() === '0') continue; // 0 值衍生项剔除，不入库
        out[k] = obj[k];
    }
    return out;
});
// 形态
const form_item = strictItem(z.object({
    层级: E_rank.prefault('Ⅰ'),
    消耗: safeStr(''),
    冷却: safeStr('0回合'),   // 【新增】防无限爆甲流的冷却锁
    状态: safeStr('完好'),    // 【新增】叙事层面的损坏标记（完好/大破等）
    标签: safeTags([]),
    原始属性: form_attr,
    真属性: real_attr,
    效果: z.record(z.string(), z.string()),
    技能: z.record(z.string(), skill_item).prefault({}),
    描述: safeStr('')
}));

const current_form = z.object({
    激活: boolPreprocess(false),
    名称: safeStr('')
}).prefault({});

const char_attr = z.object({
    力量: clampNum(0, 0, 99999999), 敏捷: clampNum(0, 0, 99999999), 体质: clampNum(0, 0, 99999999),
    精神: clampNum(0, 0, 99999999), 魅力: clampNum(0, 0, 99999999),
    力量修正: clampNum(0, 0, 99999999), 敏捷修正: clampNum(0, 0, 99999999), 体质修正: clampNum(0, 0, 99999999),
    精神修正: clampNum(0, 0, 99999999), 魅力修正: clampNum(0, 0, 99999999),
    DEF: clampNum(0, 0, 99999999), MDEF: clampNum(0, 0, 99999999), AP: clampNum(0, 0, 99999999), 先攻DC: clampNum(0, 0, 99999999), 防御DC: clampNum(0, 0, 99999999),
    物理减伤率: clampNum(0, 0, 100), 魔法减伤率: clampNum(0, 0, 100),
    武器: z.record(z.string(), z.object({ ATK: clampNum(0, 0, 99999999), MATK: clampNum(0, 0, 99999999) }).prefault({})).prefault({})
}).prefault({});

// 职业类型枚举：战斗/生活/辅助，非法/缺失值回落「辅助」
const E_occupationType = z.preprocess(v => {
    const s = String(v ?? '').trim();
    return ['战斗', '生活', '辅助'].includes(s) ? s : '辅助';
}, z.enum(['战斗', '生活', '辅助']));
// 职业记录项（以「职业名」为键）：类型 / 特性 / 来源 —— 对应 MVU 变量更新规则中的 &occupation
const occupation_item = strictItem(z.object({
    类型: E_occupationType.prefault('辅助'),
    特性: safeTags([]),
    来源: safeStr('')
}));

const npc_schema = strictItem(z.object({
    在场: boolPreprocess(false),
    种族: safeStr('人类'),
    身份: safeTags([]),
    职业: z.record(z.string(), occupation_item).prefault({}),
    层级: E_rank.prefault('Ⅰ'),
    HP_MAX: clampNum(0, 0, 99999999),
    HP: clampNum(0, 0, 99999999),
    THP: clampNum(0, 0, 99999999),
    EP_MAX: clampNum(0, 0, 99999999),
    EP: clampNum(0, 0, 99999999),
    状态: z.record(z.string(), buff_item).prefault({}),
    最终属性: char_attr,
    血统: z.record(z.string(), bloodline_item).prefault({}),
    装备: z.record(z.string(), equip_item).prefault({}),
    技能: z.record(z.string(), skill_item).prefault({}),
    道具: z.record(z.string(), backpack_item).prefault({}),
    形态库: z.record(z.string(), form_item).prefault({}),
    当前形态: current_form,
    性格: safeStr(''),
    喜爱: safeStr(''),
    外貌: safeStr(''),
    着装: safeStr(''),
    是否队友: boolPreprocess(false),
    好感度: clampNum(0, -100, 100),
    态度: safeStr(''),
    背景故事: safeStr(''),
    数量: clampNum(1, 1, 99999999)
})).transform(char => {
    // 跨节点幽灵机甲清理
    if (char.当前形态?.激活 && char.当前形态?.名称) {
        if (!char.形态库 || !char.形态库[char.当前形态.名称]) {
            char.当前形态.激活 = false;
            char.当前形态.名称 = '';
        }
    }
    return char;
});


// ==========================================
// 🌍 主体 Schema 定义
// ==========================================

export const Schema = z.object({
    世界: z.object({
        时间: safeStr('待初始化'),
        地点: safeStr('待初始化'),
        名称: safeStr('待初始化'),
        位格: E_rank.prefault('Ⅸ'),
        难度: safeStr('F~SSS'),
        稳定: clampNum(100, 0, 120),
        法则: safeTags([]).transform(arr => {
            if (arr.length === 0) return []; // 允许无法则世界
            return _.take(arr, 10);
        }),
        货币: z.object({
            体系: safeStr(''),
            购买力基准: safeStr(''),
            经济波动: safeStr('')
        }).prefault({}),
        探索: z.record(z.string(), z.object({
            风险: E_quality.prefault('F'),
            探索度: clampNum(0, 0, 100),
            描述: safeStr(''),
            隐藏真相: safeStr('')
        }).prefault({})).prefault({}),
        势力: z.record(z.string(), z.object({
            实力: E_quality.prefault('F'),
            领地: safeStr(''),
            描述: safeStr(''),
            声望: clampNum(0, -5000, 10000)
        }).prefault({})).prefault({}),
        因果轨道: z.object({
            当前阶段: safeStr('待初始化'),
            故事线: safeStr('待初始化'),
            下一节点: safeStr('待初始化'),
            偏移记录: z.record(z.string(), strictItem(z.object({
                描述: safeStr(''),
                引发者: safeStr(''),
                影响程度: clampNum(0, -100, 120)
            }))).prefault({})
        }).prefault({}),
        异端雷达: z.object({
            当前模式: safeStr(''),
            名单: z.record(z.string(), strictItem(z.object({
                来源: safeStr(''),
                经历: safeStr(''),
                阵营: safeStr(''),
                职业: safeStr(''),
                层级: E_rank.prefault('Ⅰ'),
                状态: E_alienStatus.prefault('活跃')
            }))).prefault({})
        }).prefault({})
    }).prefault({}),

    任务: z.object({
        列表: z.record(z.string(), strictItem(z.object({
            委托方: safeStr(''),
            目标: safeStr(''),
            隐藏真相: safeStr(''),
            难度: safeStr(''),
            奖励: safeStr(''),
            交付: safeStr(''),
            状态: z.enum(['进行中', '可交付', '可结算', '失败']).prefault('进行中'), // 【修复】收束任务状态
            惩罚: safeStr('')
        }))).prefault({}),
        // 副本成就: 首次从未达成变为已达成时，由结算美化脚本发放奖励
        副本成就: z.record(z.string(), strictItem(z.object({
            说明: safeStr(''),
            难度: safeStr(''),
            奖励: safeStr(''),
            状态: z.enum(['未达成', '已达成']).prefault('未达成')
        }))).prefault({}),
        // 【已修复】固定击杀槽位
        击杀: z.object({
            Ⅰ: safeNum(0), Ⅱ: safeNum(0), Ⅲ: safeNum(0),
            Ⅳ: safeNum(0), Ⅴ: safeNum(0), Ⅵ: safeNum(0),
            Ⅶ: safeNum(0), Ⅷ: safeNum(0), Ⅸ: safeNum(0)
        }).prefault({}),
        贡献: z.record(z.string(), strictItem(z.object({
            剧情定性: safeStr('')
        }))).prefault({})
    }).prefault({}),

    主角: z.object({
        种族: safeStr('人类'),
        身份: safeTags([]),
        职业: z.record(z.string(), occupation_item).prefault({}),
        层级: E_rank.prefault('Ⅰ'),
        HP_MAX: clampNum(0, 0, 99999999),
        HP: clampNum(0, 0, 99999999),
        THP: clampNum(0, 0, 99999999),
        EP_MAX: clampNum(0, 0, 99999999),
        EP: clampNum(0, 0, 99999999),
        状态: z.record(z.string(), buff_item).prefault({}),
        最终属性: char_attr,
        血统: z.record(z.string(), bloodline_item).prefault({}),
        技能: z.record(z.string(), skill_item).prefault({}),
        装备: z.record(z.string(), equip_item).prefault({}),
        道具: z.record(z.string(), backpack_item).prefault({}),
        空间币: safeNum(0).transform(v => Math.max(0, v)),
        形态库: z.record(z.string(), form_item).prefault({}),
        当前形态: current_form
    }).prefault({}).transform(char => {
        // 主角跨节点幽灵机甲清理
        if (char.当前形态?.激活 && char.当前形态?.名称) {
            if (!char.形态库 || !char.形态库[char.当前形态.名称]) {
                char.当前形态.激活 = false;
                char.当前形态.名称 = '';
            }
        }
        return char;
    }),

    资产: z.record(z.string(), strictItem(z.object({
        类型: safeStr(''),
        主体规模: clampNum(1, 1, 10),
        完整度: clampNum(100, 0, 100),
        状态: safeStr(''),
        // 【已修复】可选节点，让固定地产无需生成此废料
        能源: z.object({
            类型: safeStr(''),
            当前: safeNum(0),
            上限: safeNum(0),
            描述: safeStr('')
        }).optional(),
        消耗单元: z.record(z.string(), z.object({
            余量: safeNum(0),
            上限: safeNum(0),
            加成: safeTags([])
        }).prefault({})).optional(),
        建设序列: z.record(z.string(), strictItem(z.object({
            阶段: z.enum(['基础', '进阶', '专业', '顶尖', '禁忌']).prefault('基础'),
            功能: safeStr(''),
            加成: safeTags([]),
            产出: safeStr(''),
            下次产出日期: safeStr(''),
            // 真实收菜驱动字段: 系统状态.游玩天数 轴上的下次产出天数(脚本自动维护)
            下次产出游天: safeNum(0)
        }))).prefault({}),
        驻扎人员: z.record(z.string(), safeStr('')).prefault({}),
        待办事件: safeTags([]) 
    }))).prefault({}),

    系统状态: z.object({
        是否战斗中: boolPreprocess(false),
        当前轮次: safeNum(0),
        是否可试炼: boolPreprocess(false),
        试炼已完成: boolPreprocess(false),
        是否在主神空间: boolPreprocess(false),
        待播报记录: safeStr(''),
        // 真实游玩天数: 世界.时间 的日期(年月日)每变动一次自动+1, 单调递增, 免疫副本时间跳跃(脚本自动维护)
        游玩天数: safeNum(0),
        // 日期变动检测锚点: 上次解析到的 世界.时间 日期(脚本自动维护)
        上次世界日期: safeStr('')
    }).prefault({}),

    关系列表: z.record(z.string(), npc_schema).prefault({}),

    传闻: z.object({
        街头巷议: z.record(z.string(), strictItem(z.object({
            来源: safeStr(''),
            内容: safeStr(''),
            // 可信度：AI 常幻觉写"可信"等非法值, 按 E_rank 归正哲学自动映射到合法三档
            可信度: E_credibility
        }))).prefault({}),
        情报交易: z.record(z.string(), strictItem(z.object({
            卖家: safeStr(''),
            情报评级: z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', '日常', '战略']).prefault('日常'),
            摘要: safeStr(''),
            要价: safeStr(''),
            真实内幕: safeStr('')
        }))).prefault({}),
        布告与檄文: z.record(z.string(), strictItem(z.object({
            发布者: safeStr(''),
            内容: safeStr(''),
            张贴位置: safeStr('')
        }))).transform(data => {
            const entries = _(data).entries().takeRight(3).value();
            return _.fromPairs(entries);
        }).prefault({})
    }).prefault({}),

    商城: z.object({
        血统列表: z.array(strictItem(z.object({
            名称: safeStr('未命名'),
            品质: E_quality.prefault('F'),
            标签: safeTags([]),
            原始属性: blood_attr, // 与 bloodline_item 一致：五维齐全
            效果: z.record(z.string(), z.string()),
            描述: safeStr(''),
            价格: safeNum(0)
        }))).prefault([]),
        技能列表: z.array(strictItem(z.object({
            名称: safeStr('未命名'),
            品质: E_quality.prefault('F'),
            类型: clampNum(0, 0, 2), // 0-主动 1-被动 2-特殊
            标签: safeTags([]),
            效果: z.record(z.string(), z.string()),
            描述: safeStr(''),
            消耗: safeStr(''),
            价格: safeNum(0)
        }))).prefault([]),
        装备列表: z.array(strictItem(z.object({
            名称: safeStr('未命名'),
            品质: E_quality.prefault('F'),
            类型: clampNum(0, 0, 8), // 0武器 1手套 2头部 3胸部 4腿部 5鞋子 6披风 7饰品 8特殊
            标签: safeTags([]),
            // 与 equip_item 一致：稀疏非0属性
            原始属性: sparse_form_attr,
            效果: z.record(z.string(), z.string()),
            描述: safeStr(''),
            价格: safeNum(0)
        }))).prefault([]),
        道具列表: z.array(strictItem(z.object({
            名称: safeStr('未命名'),
            品质: E_quality.prefault('F'), // 【修复】收束品质
            类型: safeStr(''),
            数量: clampNum(1, 0, 99999999),
            标签: safeTags([]),
            效果: z.record(z.string(), z.string()),
            描述: safeStr(''),
            价格: safeNum(0)
        }))).prefault([]),
        // ★ 升级服务列表(扁平数组): 商城刷新后写入, 经 writeBackMvu 持久化; AI 输出含升级时需保留
        升级列表: z.array(strictItem(z.object({
            名称: safeStr('未命名'),
            品质: E_quality.prefault('F'),
            类型: clampNum(0, 0, 8),
            标签: safeTags([]),
            原始属性: sparse_form_attr,
            效果: z.record(z.string(), z.string()),
            描述: safeStr(''),
            消耗: safeStr(''),
            价格: safeNum(0),
            替换目标: safeStr(''),
            所属大类: safeStr('')
        }))).prefault([]),
        // ★ 多角色商城: 各角色专属商品库 成员商库.<角色名> = { 5个列表 }
        //   值用 z.any() 宽松保留, 避免与大列表 schema 重复冗余; 列表内容由 UI 经 writeBackMvu 写入
        成员商库: z.record(z.string(), z.any()).prefault({})
    }).prefault({})

}).prefault({});

// 注册完全体 Schema
$(() => {
    registerMvuSchema(Schema);
});
