    let ACTIVE_WORLD_STATE_PROJECTOR=null;
    function requireWorldStateProjector(){
        if(!ACTIVE_WORLD_STATE_PROJECTOR)throw new Error('WorldStateProjector 尚未初始化');
        return ACTIVE_WORLD_STATE_PROJECTOR;
    }
    function omitKeys(value,keys=[]){return requireWorldStateProjector().omitKeys(value,keys);}
    function projectAbilityMap(value){return requireWorldStateProjector().abilityMap(value);}
    function projectEquipped(value){return requireWorldStateProjector().equipped(value);}
    function projectCarriedItems(value){return requireWorldStateProjector().carriedItems(value);}
    function projectForms(value){return requireWorldStateProjector().forms(value);}

    function sameWorldTimeAnchor(a,b) {
        const x=String(a||'').trim(),y=String(b||'').trim();if(!x||!y)return false;
        if(x===y)return true;
        const shorter=x.length<=y.length?x:y,longer=x.length<=y.length?y:x;
        return shorter.length>=8&&longer.includes(shorter);
    }
    function projectCharacterForWorld(value){return requireWorldStateProjector().character(value);}
    function projectAssetsForWorld(value){return requireWorldStateProjector().assets(value);}
    function projectCausalOrbitForWorld(value,currentStability){return requireWorldStateProjector().causalOrbit(value,currentStability);}
    // Base seam is intentionally defined before task/history decorators; they wrap this name later.
    function projectWorldContext(stat){return requireWorldStateProjector().baseWorld(stat);}

    function protocol() {
        const schemaText=JSON.stringify(WORLD_RESULT_SCHEMA,null,2);
        return `只输出一个 WorldResult JSON 对象；不要输出 Markdown、解释、思考过程、<thinking> 或 JSON Pointer。
省略业务字段表示无变化；已有实体只写本轮变化字段，新增实体写足以建立该实体的确定事实；实体用“名称”关联。
“操作”默认“更新”；“移除”只用于 Schema 允许删除的记录；“撤销本轮”只用于纠错重试。
字段语义遵循【世界引擎核心约束】；字段结构和值域只以以下 Schema 为准。WorldResult 之外的任务、世界时间、玩家属性/货币/击杀等不要输出。
关系只更新已存在的关系列表对象；不得为玩家建立后台人物记录。

【Canonical WorldResult JSON Schema】
${schemaText}`;
    }
    const NPC_BUILD_AUDIT_RULES=`【角色管理 · NPC构筑审计】
只处理“角色管理.NPC构筑审计”列出的既有 NPC；目标是补真实缺口，不是提难度或重做角色。
1. 不改人物层级、HP_MAX/EP_MAX；不覆盖已完整组件，不用改名制造重复能力。
2. 最低构筑：杂兵=血统1/装备1/技能可0；精英=血统1/装备2/技能1；Boss=血统1/装备3/技能2；上限为血统2/装备6/技能4。精英需有杀伤、生存、机动/控制，Boss另有阶段或形态机制。
3. 能力只归一个主要组件：血统=本体条件，装备=实体，技能=执行方式，状态=当前结果，形态=独立战斗模式。
4. 只用 WorldResult.关系 更新既有 NPC；只提交新增/修正项。不得输出真属性、最终属性或强化缓存；血统/形态五维必须齐全，技能不写基础/衍生属性。
5. 效果必须可结算，不写随机概率词条；每个审计对象至少修复一个与现有身份、职业、层级和已演出能力一致的缺口，资料不足时做最小补全。`;