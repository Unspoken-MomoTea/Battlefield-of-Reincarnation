    // NPC 构筑份量与生命层级解耦：份量由人物资料中的剧情定位决定，层级只描述本体强度。
    const NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT=`【角色管理 · NPC构筑审计】
只处理“角色管理.NPC构筑审计”列出的既有 NPC；目标是补真实缺口，不是提难度、改层级或重做角色。
1. 审计级别与人物层级独立，是世界推进私有信息，只允许保存在“世界.后台.人物.审计级别”，禁止写入关系列表/NPC公开面板。新建的非队友NPC首次进入后台人物时，由你按剧情身份、叙事地位、已演出能力与遭遇需求填写杂兵级/精英级/首领/Boss级；活跃异端首次建档默认首领/Boss级；队友不定级、不参与NPC构筑审计。
2. 已有合法私有审计级别时优先沿用。只有角色获得/失去关键力量、战斗职责或剧情地位发生实质变化时，才通过 WorldResult.人物 更新审计级别；普通受伤、单次胜负、临时状态或单纯层级高低不得改级。旧档或漏填时由程序按异端身份及既有身份/职业/背景故事/态度兜底推断。
3. 最低构筑：杂兵=血统1/装备2/技能1；精英=血统1/装备4/技能2；Boss=血统1/装备6/技能4。血统默认1项；只有明确多重血统设定才增加。装备与技能可按真实设定超过最低数，但不得拆分、复制或堆同义能力凑数。最低装备数只统计状态=1的已装备项；状态0/2不计入构筑数量。
4. 审计新增装备统一写状态=1并视为已装备；状态0仅用于剧情明确的随身未装备物，状态2仅用于仓库物，不得用0/2凑最低装备数。
5. 精英需有杀伤、生存、机动/控制手段；Boss另有阶段、形态、状态切换或等价战斗机制。
6. 能力只归一个主要组件：血统=本体条件，装备=实体，技能=执行方式，状态=当前结果，形态=独立战斗模式。
7. 构筑补全只用 WorldResult.关系 更新既有 NPC；审计级别只用 WorldResult.人物 写入世界后台。只提交新增/修正项，不得输出真属性、最终属性或强化缓存；血统/形态五维必须齐全，技能不写基础/衍生属性。
8. 效果必须可结算，不写随机概率词条；每个审计对象至少修复一个与现有身份、职业、剧情定位、层级和已演出能力一致的缺口，资料不足时做最小补全。`;

    function inferNpcNarrativeAuditLevel(npc) {
        const profileText=[...(Array.isArray(npc?.身份)?npc.身份:[]),...Object.keys(npc?.职业||{}),npc?.背景故事,npc?.态度].filter(Boolean).join(' ');
        const bossHint=/(?:boss|首领|领主|头目|魔王|王者|宗主|掌门|教皇|最终敌人|最终对手)/i.test(profileText);
        if(bossHint)return '首领/Boss级';
        const eliteHint=/(?:精英|精锐|王牌|核心战力|强敌)/i.test(profileText);
        return eliteHint?'精英级':'杂兵级';
    }

    function npcNarrativeAuditLevel(stat,name,npc) {
        const backend=stat?.世界?.[PATH]||{},people=backend.人物||{};
        const backendName=stableNameIn(people,name),person=backendName?people[backendName]:null;
        const explicit=String(person?.审计级别||'').trim();
        if(NPC_AUDIT_LEVELS.includes(explicit))return explicit;
        const roster=(stat?.设置||{}).单一世界?{}:(stat?.世界?.异端雷达?.名单||{});
        const alienName=stableNameIn(roster,name),alien=alienName?roster[alienName]:null;
        if(alien&&alien.状态!=='死亡')return '首领/Boss级';
        return inferNpcNarrativeAuditLevel(npc);
    }

    npcBuildAssessment=function(stat,name,npc) {
        if(!plain(npc)||Number(npc.HP)<=0||npc.是否队友===true)return null;
        const level=npcNarrativeAuditLevel(stat,name,npc);
        const minimum=level==='首领/Boss级'?{血统:1,装备:6,技能:4}:level==='精英级'?{血统:1,装备:4,技能:2}:{血统:1,装备:2,技能:1};
        const counts={血统:Object.keys(npc.血统||{}).length,装备:Object.values(npc.装备||{}).filter(item=>plain(item)&&Number(item.状态)===1).length,技能:Object.keys(npc.技能||{}).length,状态:Object.keys(npc.状态||{}).length,形态:Object.keys(npc.形态库||{}).length};
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

    // 世界推进审计新补出的装备默认直接装备，避免状态0导致辅助计算脚本忽略其属性。
    const compileWorldResultBeforeNpcEquipmentDefault=compileWorldResult;
    compileWorldResult=function(stat,value) {
        const result=normalizeWorldResult(value);
        for(const relation of result.关系||[]){
            if(!plain(relation?.装备))continue;
            const target=stableNameIn(stat?.关系列表||{},relation.名称);
            const npc=target?stat.关系列表[target]:null;
            if(!plain(npc))continue;
            for(const [equipName,equip] of Object.entries(relation.装备)){
                if(!plain(equip))continue;
                if(!stableNameIn(npc.装备||{},equipName))equip.状态=1;
            }
        }
        return compileWorldResultBeforeNpcEquipmentDefault(stat,result);
    };

    // 默认审计提示词迁移由 WorldNpcAuditPromptFeature.initialize() 负责。\n