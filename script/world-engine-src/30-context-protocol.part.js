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

    function projectAuditComponentMap(value,{equipment=false}={}) {
        if(!plain(value))return {};
        const out={};
        for(const [name,item] of Object.entries(value)){
            if(!plain(item))continue;
            if(equipment&&Number(item.状态)===2)continue;
            const clean=omitKeys(item,['最终属性','强化','真属性']);
            if(plain(clean.技能)){
                clean.技能=Object.fromEntries(Object.entries(clean.技能).filter(([,skill])=>plain(skill)).map(([skillName,skill])=>[skillName,omitKeys(skill,['最终属性','强化','真属性'])]));
            }
            out[name]=clean;
        }
        return out;
    }
    function projectCharacterForAudit(value) {
        const source=plain(value)?value:{},out={};
        for(const key of ['在场','种族','身份','职业','层级','HP_MAX','HP','THP','EP_MAX','EP','性格','喜爱','外貌','着装','是否队友','好感度','态度','背景故事']){
            if(Object.hasOwn(source,key))out[key]=copy(source[key]);
        }
        const 状态=projectAuditComponentMap(source.状态),血统=projectAuditComponentMap(source.血统),技能=projectAuditComponentMap(source.技能);
        const 装备=projectAuditComponentMap(source.装备,{equipment:true}),形态库=projectAuditComponentMap(source.形态库);
        if(Object.keys(状态).length)out.状态=状态;
        if(Object.keys(血统).length)out.血统=血统;
        if(Object.keys(技能).length)out.技能=技能;
        if(Object.keys(装备).length)out.装备=装备;
        if(Object.keys(形态库).length)out.形态库=形态库;
        if(plain(source.当前形态))out.当前形态=copy(source.当前形态);
        return out;
    }
    function sameWorldTimeAnchor(a,b) {
        const x=String(a||'').trim(),y=String(b||'').trim();if(!x||!y)return false;
        if(x===y)return true;
        const shorter=x.length<=y.length?x:y,longer=x.length<=y.length?y:x;
        return shorter.length>=8&&longer.includes(shorter);
    }
    function npcBuildText(value) {
        try{return JSON.stringify(value||{});}catch(_){return String(value||'');}
    }
    function npcBuildAssessment(stat,name,npc) {
        if(!plain(npc)||Number(npc.HP)<=0)return null;
        const rank=Math.max(0,RELATION_RANKS.indexOf(String(npc.层级||'Ⅰ')));
        const profileText=[...(Array.isArray(npc.身份)?npc.身份:[]),...Object.keys(npc.职业||{}),npc.背景故事,npc.态度].filter(Boolean).join(' ');
        const bossHint=/(?:boss|首领|领主|头目|魔王|王者|宗主|掌门|教皇|最终敌人|最终对手)/i.test(profileText);
        const level=(bossHint||rank>=5)?'首领/Boss级':rank>=2?'精英级':'杂兵级';
        const minimum=level==='首领/Boss级'?{血统:1,装备:3,技能:2}:level==='精英级'?{血统:1,装备:2,技能:1}:{血统:1,装备:1,技能:0};
        const counts={血统:Object.keys(npc.血统||{}).length,装备:Object.values(npc.装备||{}).filter(item=>plain(item)&&Number(item.状态)!==2).length,技能:Object.keys(npc.技能||{}).length,状态:Object.keys(npc.状态||{}).length,形态:Object.keys(npc.形态库||{}).length};
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
    }
    function npcBuildAudit(stat,limit=NPC_BUILD_AUDIT_LIMIT) {
        const relations=stat?.关系列表||{},backend=stat?.世界?.[PATH]||{},people=backend.人物||{},events=backend.事件||{},roster=(stat?.设置||{}).单一世界?{}:(stat?.世界?.异端雷达?.名单||{});
        const currentLocation=String(stat?.世界?.地点||''),worldTime=String(stat?.世界?.时间||'');
        const activeEventNames=new Set(Object.entries(events).filter(([,e])=>e&&['待发生','进行中'].includes(e.状态)&&['当前事件','近期节点'].includes(e.分类)).map(([eventName])=>eventName));
        const currentParticipants=new Set();
        for(const [eventName,event] of Object.entries(events)){
            if(!activeEventNames.has(eventName))continue;
            for(const p of event?.参与者||[])currentParticipants.add(nameKey(p));
        }
        const rows=[];
        for(const [name,npc] of Object.entries(relations)){
            const assessment=npcBuildAssessment(stat,name,npc);if(!assessment||!assessment.缺口.length)continue;
            const backendName=stableNameIn(people,name),person=backendName?people[backendName]:null;
            const alienName=stableNameIn(roster,name),alien=alienName?roster[alienName]:null;
            const activeAlien=!!(alien&&alien.状态!=='死亡');
            const linked=!!(person&&(person.关联事件||[]).some(eventName=>activeEventNames.has(eventName)))||currentParticipants.has(nameKey(name));
            const here=!!npc.在场||!!(person&&currentLocation&&String(person.地点||'')&&(String(person.地点).includes(currentLocation)||currentLocation.includes(String(person.地点))));
            const updated=!!(person&&sameWorldTimeAnchor(person.更新时间,worldTime));
            if(!activeAlien&&!linked&&!here&&!updated)continue;
            const reasons=[];
            if(activeAlien)reasons.push('活跃异端');
            if(linked)reasons.push('当前/近期事件参与者');
            if(here)reasons.push(npc.在场?'当前在场':'当前地点相关');
            if(updated)reasons.push('本轮人物动态已更新');
            const levelWeight=assessment.审计级别==='首领/Boss级'?40:assessment.审计级别==='精英级'?20:0;
            const priority=(activeAlien?80:0)+(linked?60:0)+(here?40:0)+(updated?20:0)+levelWeight+assessment.缺口.length;
            rows.push({...assessment,触发依据:reasons,__priority:priority});
        }
        return rows.sort((a,b)=>b.__priority-a.__priority||a.名称.localeCompare(b.名称,'zh-CN')).slice(0,Math.max(0,Number(limit)||0)).map(item=>{const out={...item};delete out.__priority;return out;});
    }
    function ensureNpcBuildAuditProgress(next,required=[],acceptedResult) {
        if(!(required||[]).length)return;
        const proposals=acceptedResult?.关系||[],failed=[];
        for(const before of required){
            const target=stableNameIn(next?.关系列表||{},before.名称);
            if(!target)continue;
            const after=npcBuildAssessment(next,target,next.关系列表[target]);
            if(!after)continue;
            const proposal=proposals.find(item=>nameKey(item.名称)===nameKey(before.名称));
            const touched=proposal&&before.建议字段.some(field=>Object.hasOwn(proposal,field));
            if(!touched||after.缺口.length>=before.缺口.length)failed.push(before.名称);
        }
        if(failed.length)throw new Error('NPC构筑审计未推进：'+failed.join('、')+'；每个列出的审计对象本轮至少补齐一个真实缺口，禁止只改好感、HP或无关字段');
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