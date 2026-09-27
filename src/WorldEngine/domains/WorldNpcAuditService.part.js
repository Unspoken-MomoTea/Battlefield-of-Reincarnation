    let NPC_BUILD_AUDIT_FEATURE_ENABLED=false;

    class WorldNpcAuditService {
        projectComponentMap(value,{equipment=false}={}) {
            if(!plain(value))return {};
            const out={};
            for(const [name,item] of Object.entries(value)){
                if(!plain(item))continue;
                if(equipment&&Number(item.状态)===2)continue;
                const clean=copy(item);
                for(const key of ['最终属性','强化','真属性'])delete clean[key];
                if(plain(clean.技能)){
                    clean.技能=Object.fromEntries(Object.entries(clean.技能).filter(([,skill])=>plain(skill)).map(([skillName,skill])=>{
                        const projected=copy(skill);
                        for(const key of ['最终属性','强化','真属性'])delete projected[key];
                        return [skillName,projected];
                    }));
                }
                out[name]=clean;
            }
            return out;
        }

        projectCharacter(value) {
            const source=plain(value)?value:{},out={};
            for(const key of ['在场','种族','身份','职业','层级','HP_MAX','HP','THP','EP_MAX','EP','性格','喜爱','外貌','着装','是否队友','好感度','态度','背景故事']){
                if(Object.hasOwn(source,key))out[key]=copy(source[key]);
            }
            const 状态=this.projectComponentMap(source.状态),血统=this.projectComponentMap(source.血统),技能=this.projectComponentMap(source.技能);
            const 装备=this.projectComponentMap(source.装备,{equipment:true}),形态库=this.projectComponentMap(source.形态库);
            if(Object.keys(状态).length)out.状态=状态;
            if(Object.keys(血统).length)out.血统=血统;
            if(Object.keys(技能).length)out.技能=技能;
            if(Object.keys(装备).length)out.装备=装备;
            if(Object.keys(形态库).length)out.形态库=形态库;
            if(plain(source.当前形态))out.当前形态=copy(source.当前形态);
            return out;
        }

        buildText(value) {
            try{return JSON.stringify(value||{});}catch(_){return String(value||'');}
        }

        inferNarrativeLevel(npc) {
            const profileText=[...(Array.isArray(npc?.身份)?npc.身份:[]),...Object.keys(npc?.职业||{}),npc?.背景故事,npc?.态度].filter(Boolean).join(' ');
            if(/(?:boss|首领|领主|头目|魔王|王者|宗主|掌门|教皇|最终敌人|最终对手)/i.test(profileText))return '首领/Boss级';
            return /(?:精英|精锐|王牌|核心战力|强敌)/i.test(profileText)?'精英级':'杂兵级';
        }

        narrativeLevel(stat,name,npc) {
            const people=stat?.世界?.[PATH]?.人物||{},backendName=stableNameIn(people,name),person=backendName?people[backendName]:null;
            const explicit=String(person?.审计级别||'').trim();
            if(NPC_AUDIT_LEVELS.includes(explicit))return explicit;
            const roster=(stat?.设置||{}).单一世界?{}:(stat?.世界?.异端雷达?.名单||{});
            const alienName=stableNameIn(roster,name),alien=alienName?roster[alienName]:null;
            if(alien&&alien.状态!=='死亡')return '首领/Boss级';
            return this.inferNarrativeLevel(npc);
        }

        assessment(stat,name,npc) {
            if(!plain(npc)||Number(npc.HP)<=0||npc.是否队友===true)return null;
            const level=this.narrativeLevel(stat,name,npc);
            const minimum=level==='首领/Boss级'?{血统:1,装备:6,技能:4}:level==='精英级'?{血统:1,装备:4,技能:2}:{血统:1,装备:2,技能:1};
            const counts={
                血统:Object.keys(npc.血统||{}).length,
                装备:Object.values(npc.装备||{}).filter(item=>plain(item)&&Number(item.状态)===1).length,
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
            const combatText=this.buildText({职业:npc.职业,血统:npc.血统,装备:npc.装备,技能:npc.技能,状态:npc.状态,形态库:npc.形态库});
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
            return {名称:name,审计级别:level,层级:String(npc.层级||'Ⅰ'),当前组件:counts,缺口:gaps,建议字段:Array.from(suggest),当前构筑:this.projectCharacter(npc)};
        }

        audit(stat,limit=NPC_BUILD_AUDIT_LIMIT) {
            if(!NPC_BUILD_AUDIT_FEATURE_ENABLED)return [];
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
                const assessment=this.assessment(stat,name,npc);if(!assessment||!assessment.缺口.length)continue;
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

        normalizeNewEquipment(stat,result) {
            for(const relation of result?.关系||[]){
                if(!plain(relation?.装备))continue;
                const target=stableNameIn(stat?.关系列表||{},relation.名称);
                const npc=target?stat.关系列表[target]:null;
                if(!plain(npc))continue;
                for(const [equipName,equip] of Object.entries(relation.装备)){
                    if(!plain(equip))continue;
                    if(!stableNameIn(npc.装备||{},equipName))equip.状态=1;
                }
            }
            return result;
        }

        ensureProgress(next,required=[],acceptedResult) {
            if(!(required||[]).length)return;
            const proposals=Array.isArray(acceptedResult?.关系)?acceptedResult.关系:[],details=[];
            for(const before of required||[]){
                const target=stableNameIn(next?.关系列表||{},before.名称);
                if(!target)continue;
                const after=this.assessment(next,target,next.关系列表[target]);
                if(!after)continue;
                const proposal=proposals.find(item=>nameKey(item?.名称)===nameKey(before.名称));
                const touched=proposal&&(before.建议字段||[]).some(field=>Object.hasOwn(proposal,field));
                if(touched&&after.缺口.length<before.缺口.length)continue;
                const submitted=proposal?Object.keys(proposal).filter(field=>!['名称','操作'].includes(field)):[];
                const unresolved=(after.缺口||[]).length?after.缺口:before.缺口||[];
                const suggested=(after.建议字段||before.建议字段||[]).filter(Boolean);
                details.push(
                    before.名称+'：未解决缺口：'+(unresolved.length?unresolved.join('、'):'未识别')
                    +'；建议修复字段：'+(suggested.length?suggested.join('、'):'无')
                    +'；本轮实际提交：'+(submitted.length?submitted.join('、'):'无')
                );
            }
            if(details.length)throw new Error('NPC构筑审计未推进：\n'+details.map(item=>' - '+item).join('\n')+'\n修复要求：每个列出的审计对象本轮至少补齐一个真实缺口；禁止只改好感、HP或无关字段。');
        }
    }

    const DEFAULT_WORLD_NPC_AUDIT_SERVICE=new WorldNpcAuditService();
    let ACTIVE_WORLD_NPC_AUDIT_SERVICE=DEFAULT_WORLD_NPC_AUDIT_SERVICE;
    function projectAuditComponentMap(value,options={}){return ACTIVE_WORLD_NPC_AUDIT_SERVICE.projectComponentMap(value,options);}
    function projectCharacterForAudit(value){return ACTIVE_WORLD_NPC_AUDIT_SERVICE.projectCharacter(value);}
    function npcBuildText(value){return ACTIVE_WORLD_NPC_AUDIT_SERVICE.buildText(value);}
    function npcBuildAssessment(stat,name,npc){return ACTIVE_WORLD_NPC_AUDIT_SERVICE.assessment(stat,name,npc);}
    function npcBuildAudit(stat,limit=NPC_BUILD_AUDIT_LIMIT){return ACTIVE_WORLD_NPC_AUDIT_SERVICE.audit(stat,limit);}
    function ensureNpcBuildAuditProgress(next,required=[],acceptedResult){return ACTIVE_WORLD_NPC_AUDIT_SERVICE.ensureProgress(next,required,acceptedResult);}
