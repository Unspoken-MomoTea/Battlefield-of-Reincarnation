    const ALIEN_ACTIVITY_STALE_HOURS=24;

    class WorldPersonActivityService {
        constructor(engine=null){this.engine=engine;}

        deriveContext(stat,personName,playerName='') {
            const backend=stat?.世界?.[PATH]||{},people=backend.人物||{},areas=backend.势力地区||{};
            const key=value=>String(value||'').toLowerCase().replace(/[\/／·・._\-\s]+/g,'');
            const normalizedName=key(personName);
            const pair=Object.entries(people).find(([name])=>key(name)===normalizedName);
            const person=pair?.[1]||{},location=String(person.地点||'').trim();
            const related=(a,b)=>{
                const x=key(a),y=key(b);if(!x||!y)return false;
                return x===y||x.includes(y)||y.includes(x);
            };
            const areaPair=Object.entries(areas)
                .filter(([,area])=>plain(area)&&area.类型!=='势力'&&related(location,area?.名称||''))
                .sort((a,b)=>String(b[0]).length-String(a[0]).length)[0]
                ||Object.entries(areas)
                    .filter(([name,area])=>plain(area)&&area.类型!=='势力'&&related(location,name))
                    .sort((a,b)=>String(b[0]).length-String(a[0]).length)[0];
            const areaName=String(areaPair?.[0]||''),area=areaPair?.[1]||{};
            const relationByKey=new Map(Object.entries(stat?.关系列表||{}).map(([name,record])=>[key(name),{名称:name,记录:record}]));
            const alienByKey=new Map(Object.entries(stat?.世界?.异端雷达?.名单||{}).map(([name,record])=>[key(name),record]));
            const playerKeys=new Set([playerName,'{{user}}','<user>','玩家'].filter(Boolean).map(key));
            const nearby=Object.entries(people)
                .filter(([name,other])=>{
                    const otherKey=key(name);if(!plain(other)||otherKey===normalizedName||playerKeys.has(otherKey))return false;
                    if(alienByKey.get(otherKey)?.状态==='死亡')return false;
                    const otherLocation=String(other.地点||'').trim();if(!otherLocation)return false;
                    return areaName?related(otherLocation,areaName):related(otherLocation,location);
                })
                .map(([name,other])=>{
                    const profile=relationByKey.get(key(name));
                    const relation=profile?.记录||{};
                    const identity=Array.isArray(relation.身份)?relation.身份[0]:String(relation.身份||'');
                    return {
                        名称:String(name),
                        关系:key(other.地点)===key(location)?'贴身':'同地区',
                        身份:identity,
                        行动:String(other.行动||other.公开动态||relation.态度||''),
                        可查看档案:!!profile,
                        档案名称:String(profile?.名称||''),
                        档案类型:profile?'正式档案':'现场标签'
                    };
                })
                .slice(0,8);
            const objectList=(value,limit=8)=>Array.isArray(value)?value.filter(plain).slice(0,limit).map(copy):[];
            return {
                地区:areaName,
                地区动态:String(area.公开动态||area.进展||''),
                控制方:String(area.控制方||''),
                争夺方:Array.isArray(area.争夺方)?area.争夺方.filter(Boolean).slice(0,6):[],
                环境状态:Array.isArray(area.环境状态)?area.环境状态.filter(Boolean).slice(0,6):[],
                背景关联:objectList(person.背景关联,8),
                关联事件:Array.isArray(person.关联事件)?person.关联事件.filter(Boolean).slice(0,8):[],
                身边人物:nearby,
                现场群体:objectList(area.现场群体,8)
            };
        }

        projectHot(stat,limit=HOT_PERSON_TARGET) {
            const people=stat?.世界?.[PATH]?.人物||{},rows=[];
            for(const [name,person] of Object.entries(people)){
                if(!plain(person))continue;
                const meta=personActivityMeta(stat,name,person);
                if(meta.deadAlien)continue;
                const hot=meta.activeAlien||(!meta.terminal&&(meta.linked||meta.participant||meta.here||meta.dueSoon||meta.recent));
                if(!hot)continue;
                const score=(meta.activeAlien?1000:0)+(meta.linked||meta.participant?600:0)+(meta.here?450:0)+(meta.dueSoon?320:0)+(meta.recent?220:0)+(meta.formalName?20:0);
                rows.push({name,person,meta,score});
            }
            rows.sort((a,b)=>b.score-a.score||String(a.name).localeCompare(String(b.name),'zh-CN'));
            const aliens=rows.filter(row=>row.meta.activeAlien),ordinary=rows.filter(row=>!row.meta.activeAlien).slice(0,Math.max(0,Number(limit)||0));
            return Object.fromEntries([...aliens,...ordinary].map(row=>[row.name,copy(row.person)]));
        }

        alienRosterMatch(stat,name) {
            const roster=stat?.世界?.异端雷达?.名单||{},matched=stableNameIn(roster,name);
            return matched?{名称:matched,记录:roster[matched]}:null;
        }

        alienActivityReviewReasons(stat,item) {
            const people=stat?.世界?.[PATH]?.人物||{};
            const personName=stableNameIn(people,item?.名称)||stableNameIn(people,item?.雷达名称),person=personName?people[personName]:null;
            const reasons=[];
            const factsComplete=!!(person&&String(person.地点||'').trim()&&String(person.目标||'').trim()&&String(person.行动||'').trim());
            if(!factsComplete)reasons.push('活动档案缺失');

            const now=worldDateKey(stat?.世界?.时间),updated=worldDateKey(person?.更新时间),nextCheck=worldDateKey(person?.下次检查);
            if(now!==null&&nextCheck!==null&&nextCheck<=now)reasons.push('下次检查到期');
            if(factsComplete&&now!==null&&updated!==null&&now-updated>=ALIEN_ACTIVITY_STALE_HOURS)reasons.push('活动已超过24小时未复核');

            const linkedEvents=new Set(Array.isArray(person?.关联事件)?person.关联事件.filter(Boolean):[]);
            const location=String(person?.地点||'').trim();
            for(const change of stat?.世界?.[PATH]?.最近变化||[]){
                if(!plain(change))continue;
                const category=String(change.类别||change.类型||'').trim(),name=String(change.名称||'').trim();
                if(name&&/事件/.test(category)&&linkedEvents.has(name))reasons.push('关联事件变化');
                if(name&&/(?:势力地区|地区)/.test(category)&&location&&worldLocationRelated(location,name))reasons.push('所在地区变化');
            }
            return Array.from(new Set(reasons));
        }

        activeAlienRequirements(stat) {
            if((stat?.设置||{}).单一世界)return [];
            const roster=stat?.世界?.异端雷达?.名单||{},people=stat?.世界?.[PATH]?.人物||{},required=[];
            for(const [alienName,alien] of Object.entries(roster)){
                if(!alien||alien.状态==='死亡')continue;
                const personName=stableNameIn(people,alienName)||alienName,person=people[personName]||{};
                const item={
                    名称:personName,雷达名称:alienName,来源:String(alien.来源||''),经历:String(alien.经历||''),阵营:String(alien.阵营||''),职业:String(alien.职业||''),层级:String(alien.层级||''),
                    当前活动:{地点:String(person.地点||''),目标:String(person.目标||''),行动:String(person.行动||''),更新时间:String(person.更新时间||'')}
                };
                const reasons=this.alienActivityReviewReasons(stat,item);
                if(!reasons.length)continue;
                item.触发原因=reasons;
                item.要求='仅因本轮触发复核才需要在 WorldResult.人物 中提交该活跃异端的新活动；至少给出非空地点、目标、行动。人物更新时间无需抄写，由程序使用本轮最终世界时间统一记录。未获得新情报时沿用既有目标/行动，不得因为模型看见<user>行为就自动追踪或改策；若因<user>行为改变目标/行动，必须已有认知或同轮写入可追溯的认知/认知来源。若本轮已确认死亡，则只把异端状态更新为死亡。';
                required.push(item);
            }
            return required;
        }

        seedMissingAlienPeople(stat,required) {
            const state=stat?.世界?.[PATH],patches=[];if(!state)return patches;
            const people=state.人物||(state.人物={});
            for(const item of required||[]){
                if(stableNameIn(people,item.名称))continue;
                const relationName=stableNameIn(stat.关系列表||{},item.雷达名称),relation=relationName?(stat.关系列表||{})[relationName]:null;
                const seed=normalizeBackendRecord('人物',{所属世界:stat.世界?.名称||'',地点:String(relation?.地点||''),目标:'',行动:'',公开动态:''});
                people[item.名称]=seed;
                patches.push({op:'add',path:pointer(['世界',PATH,'人物',item.名称]),value:copy(seed)});
            }
            return patches;
        }

        ensureActiveAlienActivity(next,required,acceptedResult,worldTime) {
            const roster=next?.世界?.异端雷达?.名单||{},people=next?.世界?.[PATH]?.人物||{},proposals=acceptedResult?.人物||[],missing=[];
            const canonicalTime=String(next?.世界?.时间||worldTime||'').trim();
            for(const item of required||[]){
                const rosterName=stableNameIn(roster,item.雷达名称||item.名称),alien=rosterName?roster[rosterName]:null;
                if(!alien||alien.状态==='死亡')continue;
                const personName=stableNameIn(people,item.名称)||stableNameIn(people,rosterName),person=personName?people[personName]:null;
                const proposal=proposals.find(p=>nameKey(p.名称)===nameKey(item.名称)||nameKey(p.名称)===nameKey(rosterName));
                const submitted=proposal&&String(proposal.地点||'').trim()&&String(proposal.目标||'').trim()&&String(proposal.行动||'').trim();
                const factsComplete=person&&String(person.地点||'').trim()&&String(person.目标||'').trim()&&String(person.行动||'').trim();
                const timeComplete=!canonicalTime||sameWorldTimeAnchor(person?.更新时间,canonicalTime);
                if(!submitted||!factsComplete||!timeComplete)missing.push(rosterName||item.名称);
            }
            if(missing.length)throw new Error('异端活动未复核：'+missing.join('、')+'；仅本轮触发复核的活跃异端需要提交地点、目标、行动，人物更新时间由程序使用世界时间统一记录。未触发者沿用既有活动，不得为了刷新而凭空改策；若已死亡则更新异端状态为死亡');
        }

        normalizeAlienActivityTimestamps(stat,value) {
            const result=normalizeWorldResult(value);
            const roster=(stat?.设置||{}).单一世界?{}:(stat?.世界?.异端雷达?.名单||{});
            const plannedDead=new Set((result.异端||[])
                .filter(item=>item?.操作!=='撤销本轮'&&item?.状态==='死亡')
                .map(item=>nameKey(item.名称)));
            const proposedTime=typeof resolveWorldTimeProposal==='function'?resolveWorldTimeProposal(stat,result):'';
            const worldTime=String(proposedTime||stat?.世界?.时间||'').trim();
            if(Array.isArray(result.人物)){
                for(const item of result.人物){
                    if(!plain(item)||item.操作==='撤销本轮')continue;
                    const rosterName=stableNameIn(roster,item.名称),alien=rosterName?roster[rosterName]:null;
                    if(!alien||alien.状态==='死亡'||plannedDead.has(nameKey(rosterName||item.名称)))continue;
                    const submitted=String(item.地点||'').trim()&&String(item.目标||'').trim()&&String(item.行动||'').trim();
                    if(!submitted)continue;
                    if(worldTime)item.更新时间=worldTime;
                    else delete item.更新时间;
                }
            }
            return result;
        }

        get(name){
            if(!this.engine)return null;
            const people=this.engine.snapshot().stat?.世界?.[PATH]?.人物||{};
            const stable=stableNameIn(people,String(name||'').trim());
            return stable&&plain(people[stable])?{name:stable,record:people[stable]}:null;
        }

        async save(name,record){
            if(!this.engine)throw new Error('人物活动服务未绑定引擎');
            name=String(name||'').trim();if(!name)throw new Error('人物名称不能为空');
            return this.engine.services.mutations.commit(stat=>{
                const backend=worldEditorBackend(stat),people=backend.人物||{},stable=stableNameIn(people,name);
                if(!stable||!plain(people[stable]))throw new Error('世界活动记录不存在：'+name);
                const current=people[stable];
                const next=normalizeBackendRecord('人物',record,current);
                next.认知=worldEditorTextList(next.认知);
                next.关联事件=worldEditorTextList(next.关联事件);
                next.行程=worldEditorJsonList(next.行程,'行程');
                next.认知来源=worldEditorJsonList(next.认知来源,'认知来源');
                next.背景关联=worldEditorJsonList(next.背景关联,'背景关联');
                worldPersonValidateRecord(stat,stable,next);
                people[stable]=next;
                return {name:stable};
            },'已修正世界活动记录：'+name);
        }

        async remove(name){
            if(!this.engine)return false;
            name=String(name||'').trim();if(!name)return false;
            return this.engine.services.mutations.commit(stat=>{
                const backend=worldEditorBackend(stat),people=backend.人物||{},stable=stableNameIn(people,name);
                if(!stable||!plain(people[stable]))return null;
                delete people[stable];
                return {deleted:stable};
            },'已删除世界活动记录：'+name);
        }
    }

    const DEFAULT_WORLD_PERSON_ACTIVITY_SERVICE=new WorldPersonActivityService();
    let ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE=DEFAULT_WORLD_PERSON_ACTIVITY_SERVICE;
    function derivePersonWorldContext(stat,personName,playerName=''){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.deriveContext(stat,personName,playerName);}
    function projectHotWorldPeople(stat,limit=HOT_PERSON_TARGET){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.projectHot(stat,limit);}
    function alienRosterMatch(stat,name){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.alienRosterMatch(stat,name);}
    function alienActivityReviewReasons(stat,item){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.alienActivityReviewReasons(stat,item);}
    function activeAlienActivityRequirements(stat){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.activeAlienRequirements(stat);}
    function seedMissingAlienPeople(stat,required){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.seedMissingAlienPeople(stat,required);}
    function ensureActiveAlienActivity(next,required,acceptedResult,worldTime){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.ensureActiveAlienActivity(next,required,acceptedResult,worldTime);}
