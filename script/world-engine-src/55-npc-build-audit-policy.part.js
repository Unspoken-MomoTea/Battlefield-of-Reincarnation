    // NPC构筑审计：剧情份量与生命层级解耦。
    // AI需在身份/职业/背景/态度中明确精英或Boss定位；层级只表示生命强度，不再自动决定审计级别。
    const NPC_BUILD_AUDIT_RULES_STORY_WEIGHT=`【角色管理 · NPC构筑审计】
只处理“角色管理.NPC构筑审计”列出的既有 NPC；目标是按既有剧情身份补真实缺口，不是提难度或重做角色。
1. 不改人物层级、HP_MAX/EP_MAX；剧情份量与生命层级独立，Ⅰ阶也可以是精英/Boss，高层级也不自动升级份量。
2. 份量按身份、职业名称、背景故事或态度中的明确剧情定位识别：出现Boss/首领等定位按Boss，出现“精英”按精英，否则按杂兵。需要隐藏Boss时可在后台真实身份中明确定位，不得因此向正文剧透。
3. 最低构筑：杂兵=血统1/装备2/技能1；精英=血统1/装备4/技能2；Boss=血统1/装备6/技能4。血统默认1项；装备和技能是最低起步数量，可按设定继续增加，禁止拆分、复制或堆无意义条目凑数。
4. 精英需有杀伤、生存、机动/控制；Boss另有阶段、形态、状态切换或技能机制。
5. 能力只归一个主要组件：血统=本体条件，装备=实体，技能=执行方式，状态=当前结果，形态=独立战斗模式。
6. 只用 WorldResult.关系 更新既有 NPC；只提交新增/修正项。不得输出真属性、最终属性或强化缓存；血统/形态五维必须齐全，技能不写基础/衍生属性。
7. 效果必须可结算，不写随机概率词条；每个审计对象至少修复一个与现有身份、职业、层级和已演出能力一致的缺口，资料不足时做最小补全。`;

    npcBuildAssessment=function(stat,name,npc) {
        if(!plain(npc)||Number(npc.HP)<=0)return null;
        const profileText=[...(Array.isArray(npc.身份)?npc.身份:[]),...Object.keys(npc.职业||{}),npc.背景故事,npc.态度].filter(Boolean).join(' ');
        const bossHint=/(?:boss|首领|领主|头目|魔王|王者|宗主|掌门|教皇|最终敌人|最终对手)/i.test(profileText);
        const eliteHint=/(?:精英)/i.test(profileText);
        const level=bossHint?'首领/Boss级':eliteHint?'精英级':'杂兵级';
        const minimum=level==='首领/Boss级'?{血统:1,装备:6,技能:4}:level==='精英级'?{血统:1,装备:4,技能:2}:{血统:1,装备:2,技能:1};
        const counts={
            血统:Object.keys(npc.血统||{}).length,
            装备:Object.values(npc.装备||{}).filter(item=>plain(item)&&Number(item.状态)!==2).length,
            技能:Object.keys(npc.技能||{}).length,
            状态:Object.keys(npc.状态||{}).length,
            形态:Object.keys(npc.形态库||{}).length
        };
        const gaps=[],suggest=new Set();
        for(const field of ['种族','身份','职业','外貌','着装','性格','喜爱','背景故事','态度']){
            const value=npc[field],missing=Array.isArray(value)?!value.length:plain(value)?!Object.keys(value).length:!String(value||'').trim();
            if(missing){gaps.push('资料缺失/'+field);suggest.add(field);}
        }
        for(const field of ['血统','装备','技能']){
            if(counts[field]<minimum[field]){gaps.push(field+'不足 '+counts[field]+'/'+minimum[field]);suggest.add(field);}
        }
        const combatText=npcBuildText({职业:npc.职业,血统:npc.血统,装备:npc.装备,技能:npc.技能,状态:npc.状态,形态库:npc.形态库});
        if(level!=='杂兵级'){
            const offense=/(?:伤害|攻击|斩|刺|射击|爆破|火力|ATK|MATK|杀伤|输出|毒|灼烧|雷击|炮击)/i.test(combatText);
            const survival=/(?:防御|护盾|减伤|恢复|治疗|格挡|护甲|屏障|再生|吸收|DEF|MDEF|生存)/i.test(combatText);
            const control=/(?:控制|位移|突进|冲刺|束缚|眩晕|减速|沉默|击退|牵引|冻结|召唤|机动|封锁|禁锢)/i.test(combatText);
            if(!offense){gaps.push('缺主要杀伤手段');suggest.add('技能');suggest.add('装备');}
            if(!survival){gaps.push('缺防御/生存手段');suggest.add('技能');suggest.add('装备');suggest.add('状态');}
            if(!control){gaps.push('缺机动/控制手段');suggest.add('技能');suggest.add('形态库');}
        }
        if(level==='首领/Boss级'){
            const stage=counts.形态>0||/(?:阶段|二阶段|变身|形态|解放|觉醒|狂暴|转阶段|状态切换)/i.test(combatText);
            if(!stage){gaps.push('缺Boss阶段/形态/状态变化机制');suggest.add('形态库');suggest.add('状态');suggest.add('技能');}
        }
        return {名称:name,审计级别:level,层级:String(npc.层级||'Ⅰ'),当前组件:counts,缺口:gaps,建议字段:Array.from(suggest),当前构筑:projectCharacterForAudit(npc)};
    };

    const SamsaraWorldEngineBeforeNpcBuildAuditPolicy=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeNpcBuildAuditPolicy {
        constructor(host,env) {
            super(host,env);
            // 仅替换内置旧默认；用户自己编辑过的NPC审计提示词保持原样。
            if(this.config.npcAuditPrompt===NPC_BUILD_AUDIT_RULES)this.config.npcAuditPrompt=NPC_BUILD_AUDIT_RULES_STORY_WEIGHT;
        }
    };
