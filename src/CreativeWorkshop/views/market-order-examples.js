// Testing-channel only: illustrative proposals, NEVER inserted into D1 and
// deliberately not accepted by any trading endpoint.
const buyExamples = [
  { id: 'demo:buy:healer', asset_kind: 'teammate', asset_name: '希望招募擅长治疗的伙伴（不限姓名）',
    quality: '', remaining_quantity: 1, unit_price: 2800, buyer: {display_name:'示例轮回者 · 青棠'},
    note: '可以是医生、炼金术士或治疗系魔法师。请提供实际角色资料，再由求购者确认。' },
  { id: 'demo:buy:skill', asset_kind: 'skill', asset_name: '寻找可抵挡精神侵蚀的能力',
    quality: '', remaining_quantity: 1, unit_price: 1300, buyer: {display_name:'示例轮回者 · 夜巡'},
    note: '接受技能、祝福或其他符合用途的方案；具体效果由买家看过资产后决定。' },
  { id: 'demo:buy:tool', asset_kind: 'item', asset_name: '需要能打开封印结界的道具',
    quality: '', remaining_quantity: 2, unit_price: 450, buyer: {display_name:'示例轮回者 · 灯塔'},
    note: '不限定道具名称。一次可提议交付一件或多件，但须由发布者认可。' },
];
const swapExamples = [
  { id: 'demo:swap:bloodline', offered: {kind:'bloodline',name:'星屑血统',quantity:1, data:{品质:'D',原始属性:{感知:'D',敏捷:'E'}}},
    wanted: {kind:'equipment',name:'希望获得适合敏捷角色的护具',quantity:1},
    owner:{display_name:'示例轮回者 · 薄暮'},
    note:'提供者可提出具体护甲；拥有血统的一方查看实际属性后决定是否交换。' },
  { id:'demo:swap:role', offered: {kind:'equipment',name:'游隼双刃',quantity:1,data:{品质:'C',原始属性:{力量:'D',敏捷:'C'}}},
    wanted:{kind:'teammate',name:'希望招募一名会侦察的伙伴',quantity:1},
    owner:{display_name:'示例轮回者 · 漫游者'},
    note:'以一件装备交换一位伙伴，要求由双方自己判断；不能靠匹配角色名字决定。' },
  { id:'demo:swap:mixed', offered:{kind:'item',name:'时序晶核',quantity:2,data:{品质:'B',类型:'材料'}},
    wanted:{kind:'skill',name:'需要一项短距离位移技能',quantity:1},
    owner:{display_name:'示例轮回者 · 灰鸦'},
    note:'晶核×2 换技能×1。双方可以对资产效果、品质和价值自行判断。' },
];

export function marketOrderPreviewExamples(kind, now = Date.now()) {
  const samples = kind === 'swap' ? swapExamples : buyExamples;
  return samples.map((entry, index) => ({
    ...entry,
    demo: true,
    expires_at: now + (48 - index * 12) * 60 * 60 * 1000,
  }));
}
