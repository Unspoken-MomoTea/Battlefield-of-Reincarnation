    function activation(entry, scan, force) {
        if(!String(entry.content||'').trim())return {read:false,reason:'内容为空'};
        if(force)return {read:true,reason:'强制读取'};
        if(!entry.enabled)return {read:false,reason:'条目禁用'};
        if(entry.mode==='constant')return {read:true,reason:'蓝灯常驻'};
        if(entry.mode!=='selective')return {read:false,reason:'不支持的激活方式，需显式强制读取'};
        const list=v=>Array.isArray(v)?v:typeof v==='string'?v.split(',').map(x=>x.trim()).filter(Boolean):[];
        const match=k=>{
            if(k instanceof RegExp){k.lastIndex=0;return k.test(scan);}
            if(plain(k)){try{return new RegExp(k.pattern||k.source||k.regex,k.flags||'').test(scan);}catch(_){return false;}}
            return !!String(k||'')&&scan.includes(String(k));
        };
        if(!list(entry.keys).some(match))return {read:false,reason:'绿灯未命中关键词'};
        const second=entry.secondary||{},keys=list(second.keys||second),hits=keys.map(match);
        const ok=!keys.length||(second.logic==='and_all'?hits.every(Boolean):second.logic==='not_all'?!hits.every(Boolean):second.logic==='not_any'?!hits.some(Boolean):hits.some(Boolean));
        return {read:ok,reason:ok?'绿灯已命中':'绿灯次要条件未满足'};
    }
    function omitKeys(value,keys=[]) {
        if(!plain(value))return copy(value);
        const out=copy(value);
        for(const key of keys)delete out[key];
        return out;
    }
    function projectAbilityMap(value) {
        if(!plain(value))return {};
        const out={};
        for(const [name,item] of Object.entries(value)){
            if(!plain(item))continue;
            out[name]=omitKeys(item,['原始属性','最终属性','强化','真属性']);
        }
        return out;
    }
    function projectEquipped(value) {
        if(!plain(value))return {};
        const out={};
        for(const [name,item] of Object.entries(value)){
            if(!plain(item)||Number(item.状态)!==1)continue;
            out[name]=omitKeys(item,['原始属性','最终属性','强化','真属性']);
        }
        return out;
    }
    function projectCarriedItems(value) {
        if(!plain(value))return {};
        const out={};
        for(const [name,item] of Object.entries(value)){
            if(!plain(item)||Number(item.状态)===2)continue;
            out[name]=omitKeys(item,['原始属性','最终属性','强化','真属性']);
        }
        return out;
    }
    function projectForms(value) {
        if(!plain(value))return {};
        const out={};
        for(const [name,item] of Object.entries(value)){
            if(!plain(item))continue;
            out[name]=omitKeys(item,['原始属性','最终属性','强化','真属性']);
        }
        return out;
    }
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

    function projectCharacterForWorld(value) {
        const source=plain(value)?value:{},out={};
        for(const key of ['在场','种族','身份','职业','层级','HP_MAX','HP','THP','EP_MAX','EP','性格','喜爱','外貌','着装','是否队友','好感度','态度','背景故事','数量']){
            if(Object.hasOwn(source,key))out[key]=copy(source[key]);
        }
        const 状态=projectAbilityMap(source.状态),血统=projectAbilityMap(source.血统),技能=projectAbilityMap(source.技能);
        const 装备=projectEquipped(source.装备),道具=projectCarriedItems(source.道具),形态库=projectForms(source.形态库);
        if(Object.keys(状态).length)out.状态=状态;
        if(Object.keys(血统).length)out.血统=血统;
        if(Object.keys(技能).length)out.技能=技能;
        if(Object.keys(装备).length)out.装备=装备;
        if(Object.keys(道具).length)out.道具=道具;
        if(Object.keys(形态库).length)out.形态库=形态库;
        if(plain(source.当前形态))out.当前形态=copy(source.当前形态);
        return out;
    }
    function projectAssetsForWorld(value) {
        if(!plain(value))return {};
        const out={};
        for(const [name,asset] of Object.entries(value)){
            if(!plain(asset))continue;
            const item=copy(asset);
            if(plain(item.建设序列)){
                for(const seq of Object.values(item.建设序列||{})){
                    if(!plain(seq))continue;
                    delete seq.下次产出日期;
                    delete seq.下次产出游天;
                }
            }
            out[name]=item;
        }
        return out;
    }
    function tailRecord(value,limit) {
        if(!plain(value))return {};
        return Object.fromEntries(Object.entries(value).slice(-Math.max(0,Number(limit)||0)).map(([key,item])=>[key,copy(item)]));
    }
    function projectCausalOrbitForWorld(value,currentStability) {
        const orbit=plain(value)?value:{},entries=Object.entries(orbit.偏移记录||{});
        const recent=entries.slice(-HOT_OFFSET_TARGET);
        const total=entries.reduce((sum,[,item])=>sum+(Number(item?.影响程度)||0),0);
        return {
            当前阶段:orbit.当前阶段,
            故事线:orbit.故事线,
            下一节点:orbit.下一节点,
            偏移记录:Object.fromEntries(recent.map(([name,item])=>[name,copy(item)])),
            偏移摘要:{
                记录总数:entries.length,
                隐藏旧记录数:Math.max(0,entries.length-recent.length),
                累计影响:total,
                当前稳定:currentStability
            }
        };
    }
    function projectWorldContext(stat) {
        const src=plain(stat)?stat:{},world=plain(src.世界)?src.世界:{},backend=plain(world[PATH])?world[PATH]:{};
        const projectedBackend={
            版本:backend.版本,
            已处理时间:backend.已处理时间,
            事件:copy(backend.事件||{}),
            人物:projectHotWorldPeople(src),
            势力地区:copy(backend.势力地区||{}),
            历史:tailRecord(backend.历史,HOT_HISTORY_TARGET),
            传播:tailRecord(backend.传播,HOT_PROPAGATION_TARGET)
        };
        // 早期世界引擎曾误加地区“资源点”。保留旧存档兼容，但不再发送给模型；资产只读取现有顶层资产账簿。
        for(const area of Object.values(projectedBackend.势力地区||{}))if(plain(area))delete area.资源点;
        const out={
            世界:{
                时间:world.时间,
                地点:world.地点,
                名称:world.名称,
                位格:world.位格,
                难度:world.难度,
                稳定:world.稳定,
                法则:copy(world.法则||[]),
                货币:copy(world.货币||{}),
                历法:copy(world.历法||{}),
                探索:copy(world.探索||{}),
                势力:copy(world.势力||{}),
                因果轨道:projectCausalOrbitForWorld(world.因果轨道,world.稳定),
                异端雷达:copy(world.异端雷达||{}),
                [PATH]:projectedBackend
            },
            角色:projectCharacterForWorld(src.角色),
            关系列表:{},
            资产:projectAssetsForWorld(src.资产),
            资产删除保护:Object.keys(backend.资产墓碑||{}).filter(name=>!stableNameIn(src.资产||{},name)).slice(-50),
            传闻:copy(src.传闻||{}),
            系统状态:{
                是否战斗中:!!src.系统状态?.是否战斗中,
                是否在主神空间:!!src.系统状态?.是否在主神空间
            },
            世界模式:{
                单一世界:!!src.设置?.单一世界,
                世界超稳:!!src.设置?.世界超稳
            }
        };
        for(const [name,person] of Object.entries(src.关系列表||{}))out.关系列表[name]=projectCharacterForWorld(person);
        if(!Object.keys(out.角色||{}).length)delete out.角色;
        if(!Object.keys(out.关系列表).length)delete out.关系列表;
        if(!Object.keys(out.资产).length)delete out.资产;
        if(!out.资产删除保护.length)delete out.资产删除保护;
        if(!Object.keys(out.传闻).length)delete out.传闻;
        return out;
    }
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