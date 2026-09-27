    const RUMOR_LIVELINESS_TOPICS=['悬赏线索','商路动向','势力情报','遗迹坐标','人物行踪','黑市消息','宝物传闻','怪物异动','深渊异变','种族摩擦','物价波动'];
    const RUMOR_LIVELINESS_RULES=`【传闻与传播 · 常驻活跃层】
1. 街头巷议、情报交易、布告与檄文各自展示最近3条；某类为空时本轮补2条。单条约60字，除非影响重大，不围绕<user>。
   可直接追加新名称，程序会在合并后自动滚动淘汰最旧条目，不需要为容量主动提交「操作:移除」。沿用原名称视为刷新该条传闻，并优先保留；仅在传闻本身已失效、撤销或需要明确删除时使用「操作:移除」。
2. 街头巷议随当前地区、说书人/目击者和局势替换1~2条；情报交易有卖家时更新1~2条，购买、付款与消费性删除由MVU按正文结果处理；布告与檄文随当前地区与发布势力替换。
3. 后台传播是人物知情与公开传闻的因果链。新可传播事实建立或推进传播；关联事件变化、传播陈旧或到期时复核范围、受众、内容与引发行动，结束/过期传播不复活。
4. 优先话题：${RUMOR_LIVELINESS_TOPICS.join(' / ')}。`;
    const RUMOR_THROTTLE_RULES=`【传闻刷新节流 · 取代前述“每轮替换”要求】
1. 公开传闻默认保持不变。只有“传闻维护.本轮公开传闻动作”要求更新时才写传闻；禁止为了制造活跃感、凑数量或普通小事每轮改写。
2. 触发只包括：某分类为空需补1条；已有传播链因关联事件新进展、到期或超过72小时而需复核；本轮刚建立/更新且尚未建立传播链、具有公开征兆/可见影响的新事件。旧事件不会因为仍然存在而反复触发。普通行动、普通战斗、轻微状态或数值变化不触发刷新。
3. 单次触发每个分类最多更新1条。优先刷新与本次事实直接相关的同名传闻；否则追加1条，由程序自动滚动淘汰最旧条目。没有触发时三类传闻都保持原样，不提交无变化更新。
4. 传闻与传播属于软维护。单个传闻/传播片段格式错误或本轮未维护完成时，丢弃该片段并保留其它已验收结果；不得仅为传闻/传播重新调用整轮世界推进。
5. 情报交易的购买、付款、消费性删除仍由MVU/变量AI处理；世界引擎只维护其世界侧信息来源。`;
    const RUMOR_WORLD_SOURCE_RULES=`【信息传播 · 世界侧事实】
1. 传闻与传播描述世界里正在流通的信息；正文只用于确认事实与时间，不是直接传播源。禁止把正文中的个人行动、战斗细节、私密对话、能力或收益直接改写成传闻。
2. 直接取材仅限“传闻维护.世界侧可传播事实”、已有传播链与既有公开传闻。私密事实只有形成目击、公开后果、调查发现、公告或主动泄露等现实渠道后才能传播。
3. 公开内容不得超过来源与受众当时可知范围；后台真相不进入公开内容。传播必须有时间与空间路径，不能无因瞬间扩散到全世界。
4. 公开传闻默认保持不变；仅在空分类、传播链需复核或出现新的世界侧公开事实时按需更新，每个触发每类最多1条。
5. 普通行动、普通战斗、轻微状态或数值变化本身不触发传闻；只有其公开后果已经进入世界侧事实池时才可传播。
6. 传闻/传播属于软维护，单个片段失败不得让整轮世界推进重跑。情报交易的购买、付款与消费性删除由MVU按正文结果处理；世界引擎只维护世界侧信息来源。`;
    const RUMOR_PRESET_STEP_OLD='Step 6 · 更新传播：只维护本轮真实变化的传播、货币与历法；结束/过期传播不复活。';
    const RUMOR_PRESET_STEP_NEW='Step 6 · 信息传播：传闻是常驻活跃层；三类公开传闻为空时补2条，并随地区、卖家、发布势力与局势替换。新可传播事实建立或推进传播链，关联事件变化、陈旧或到期时复核。';
    const RUMOR_THROTTLE_PRESET_STEP='Step 6 · 信息传播：公开传闻默认保持不变；仅在空分类、传播链需复核或出现新的公开可传播事实时按需更新，每个触发每类最多1条。传闻/传播属于软维护，失败不重跑整轮。';
    const RUMOR_PUBLIC_CATEGORIES=['街头巷议','情报交易','布告与檄文'];
    const RUMOR_VISIBLE_LIMIT=3;
    const RUMOR_STALE_HOURS=72;
    class WorldRumorService {
        constructor(engine){this.engine=engine;}
        upgradePreset(value){
            let source=String(value||'');
            if(source.includes(RUMOR_PRESET_STEP_OLD))source=source.replace(RUMOR_PRESET_STEP_OLD,RUMOR_PRESET_STEP_NEW);
            if(!source.includes(RUMOR_THROTTLE_PRESET_STEP)&&source.includes(RUMOR_PRESET_STEP_NEW))source=source.replace(RUMOR_PRESET_STEP_NEW,RUMOR_THROTTLE_PRESET_STEP);
            return source;
        }
        requirements(stat=this.engine?.snapshot().stat||{}){
            const required=this.baseRequirements(stat),facts=this.publicFacts(stat),fresh=facts.filter(item=>item.新近).slice(-6);
            // Preserve the old throttle candidate window as well as the final world-side facts view.
            required.可传播候选事件=required.可传播候选事件.filter(item=>String(item.更新时间||'').trim()===required.世界时间.trim()).slice(-2);
            const empty=RUMOR_PUBLIC_CATEGORIES.filter(category=>Number(required.公开传闻[category].当前数量)===0),review=required.本轮必须复核的传播链,reasons=[];
            if(empty.length)reasons.push('空分类：'+empty.join('、'));
            if(review.length)reasons.push('传播复核：'+review.map(item=>item.名称).join('、'));
            if(fresh.length)reasons.push('新世界公开事实：'+fresh.map(item=>item.名称).join('、'));
            required.世界侧可传播事实=facts;
            required.本轮新公开事实=fresh;
            required.刷新原因=reasons;
            required.本轮公开传闻动作=reasons.length?'按需更新；每个触发每类最多1条':'保持不变';
            delete required.当前地点;
            return required;
        }
        classifyFailures(rejected){
            const hard=[],soft=[];
            for(const item of rejected||[])(/^(?:传闻\/|传播\/)/.test(String(item?.片段||''))?soft:hard).push(item);
            return soft.length?{rejected:hard,softRejected:soft}:{rejected:hard};
        }
        validatePublicState(stat){
            // Capacity is a rolling window. Validate the same visible tail as the former shadow-state wrapper.
            const items=Object.values(stat?.传闻?.街头巷议||{}).slice(-RUMOR_VISIBLE_LIMIT);
            if(items.some(item=>!['酒话','可疑','或许可信'].includes(item.可信度)))throw new Error('传闻可信度无效');
        }
        finishPatches(stat,patches){
            this.refreshTouchedOrder(stat,patches);
            this.trimCapacity(stat);
            return stat;
        }
        trimCapacity(stat) {
            const removed=[];
            for(const category of RUMOR_PUBLIC_CATEGORIES){
                const bucket=stat?.传闻?.[category];
                if(!plain(bucket))continue;
                const overflow=Math.max(0,Object.keys(bucket).length-RUMOR_VISIBLE_LIMIT);
                for(const name of Object.keys(bucket).slice(0,overflow)){
                    delete bucket[name];
                    removed.push(category+'/'+name);
                }
            }
            return removed;
        }
        refreshTouchedOrder(stat,patches=[]) {
            for(const patch of patches||[]){
                if(!plain(patch)||patch.op==='remove')continue;
                const parts=tokens(patch.path);
                if(parts.length!==3||parts[0]!=='传闻'||!RUMOR_PUBLIC_CATEGORIES.includes(parts[1]))continue;
                const bucket=stat?.传闻?.[parts[1]];
                if(!plain(bucket))continue;
                const name=stableNameIn(bucket,parts[2])||parts[2];
                if(!Object.hasOwn(bucket,name))continue;
                const value=bucket[name];
                delete bucket[name];
                bucket[name]=value;
            }
        }
        eventTouchedKey(event) {
            return worldDateKey(event?.更新时间||event?.预计结束||event?.开始时间||event?.时间);
        }
        baseRequirements(stat) {
            const backend=stat?.世界?.[PATH]||{},rumors=stat?.传闻||{},events=backend.事件||{},propagation=backend.传播||{};
            const worldTime=String(stat?.世界?.时间||''),now=worldDateKey(worldTime);
            const publicState={};
            for(const category of RUMOR_PUBLIC_CATEGORIES){
                const bucket=plain(rumors?.[category])?rumors[category]:{};
                const count=Object.keys(bucket).length;
                publicState[category]={当前数量:count,为空补足:count===0?1:0};
            }
            const review=[];
            for(const [名称,record] of Object.entries(propagation)){
                if(!plain(record)||!/^传播中$/.test(String(record.状态||'').trim()))continue;
                const reasons=[],updatedText=String(record.更新时间||'').trim(),touched=worldDateKey(updatedText||record.时间),expiry=worldDateKey(record.到期时间);
                let semantic=false;
                if(!updatedText)reasons.push('缺少更新时间');
                if(expiry!==null&&now!==null&&expiry<=now){reasons.push('已到期');semantic=true;}
                if(touched!==null&&now!==null&&now-touched>=RUMOR_STALE_HOURS){reasons.push('超过72小时未复核');semantic=true;}
                const changedEvents=[];
                for(const eventName of Array.isArray(record.关联事件)?record.关联事件:[]){
                    const event=events[eventName];if(!plain(event))continue;
                    const eventTouched=this.eventTouchedKey(event);
                    if((eventTouched!==null&&(touched===null||eventTouched>touched))||['已完成','已取消'].includes(event.状态))changedEvents.push(eventName);
                }
                if(changedEvents.length){reasons.push('关联事件已有新进展：'+changedEvents.join('、'));semantic=true;}
                if(!reasons.length)continue;
                review.push({
                    名称,原因:reasons,需语义变化:semantic,
                    当前:{来源:String(record.来源||''),范围:String(record.范围||''),时间:String(record.时间||''),更新时间:updatedText,到期时间:String(record.到期时间||''),内容:String(record.内容||''),状态:String(record.状态||''),受众:copy(record.受众||[]),引发行动:copy(record.引发行动||[]),关联事件:copy(record.关联事件||[])}
                });
            }
            const linked=new Set(Object.values(propagation).flatMap(record=>Array.isArray(record?.关联事件)?record.关联事件:[]));
            const candidates=Object.entries(events).filter(([name,event])=>{
                if(!plain(event)||!['进行中','已完成'].includes(event.状态)||linked.has(name))return false;
                const visible=String(event.公开征兆||'').trim()||(Array.isArray(event.可见影响)&&event.可见影响.length);
                return !!visible;
            }).slice(-6).map(([名称,event])=>({名称,状态:event.状态,地点:String(event.地点||''),公开征兆:String(event.公开征兆||''),更新时间:String(event.更新时间||event.时间||'')}));
            return {
                世界:String(stat?.世界?.名称||''),世界时间:worldTime,当前地点:String(stat?.世界?.地点||''),
                话题:copy(RUMOR_LIVELINESS_TOPICS),公开传闻:publicState,
                本轮必须复核的传播链:review,可传播候选事件:candidates
            };
        }
        maintenanceNeeded(stat) {
            const required=this.requirements(stat);
            return Object.values(required.公开传闻).some(item=>item.当前数量===0)||required.本轮必须复核的传播链.length>0;
        }
        sameTime(value,current){
            const a=String(value||'').trim(),b=String(current||'').trim();
            return !!a&&!!b&&(typeof sameWorldTimeAnchor==='function'?sameWorldTimeAnchor(a,b):a===b);
        }
        publicFacts(stat=this.engine?.snapshot().stat||{}){
            const backend=stat?.世界?.[PATH]||{},now=String(stat?.世界?.时间||'').trim(),facts=[];
            const add=item=>{if(plain(item)&&String(item.公开内容||'').trim())facts.push(item);};
            for(const [名称,event] of Object.entries(backend.事件||{})){
                if(!plain(event)||!['进行中','已完成'].includes(String(event.状态||'')))continue;
                const visible=[String(event.公开征兆||'').trim(),...(Array.isArray(event.可见影响)?event.可见影响.map(x=>String(x?.影响||'').trim()):[])].filter(Boolean);
                if(!visible.length)continue;
                const time=String(event.更新时间||event.时间||'').trim();
                add({类型:'公开事件',名称,地点:String(event.地点||''),时间:time,公开内容:visible.join('；'),关联事件:[名称],新近:this.sameTime(time,now)});
            }
            for(const [名称,person] of Object.entries(backend.人物||{})){
                const text=String(person?.公开动态||'').trim();if(!text)continue;
                const time=String(person?.更新时间||'').trim();
                add({类型:'人物公开动态',名称,时间:time,公开内容:text,关联事件:copy(Array.isArray(person?.关联事件)?person.关联事件:[]),新近:this.sameTime(time,now)});
            }
            for(const [名称,area] of Object.entries(backend.势力地区||{})){
                const text=String(area?.公开动态||'').trim();if(!text)continue;
                const time=String(area?.更新时间||'').trim();
                add({类型:'地区公开动态',名称,时间:time,公开内容:text,新近:this.sameTime(time,now)});
            }
            for(const [名称,faction] of Object.entries(stat?.世界?.势力||{})){
                const text=[faction?.领地,faction?.描述].map(x=>String(x||'').trim()).filter(Boolean).join('；');
                add({类型:'势力公开背景',名称,公开内容:text,新近:false});
            }
            for(const [名称,place] of Object.entries(stat?.世界?.探索||{}))add({类型:'探索公开背景',名称,风险:String(place?.风险||''),公开内容:String(place?.描述||''),新近:false});
            const economy=String(stat?.世界?.货币?.经济波动||'').trim();
            if(economy)add({类型:'经济公开背景',名称:'经济波动',公开内容:economy,新近:false});
            return facts.slice(-24);
        }

        maintenanceIssues(next,required) {
            const result={公开传闻:[],传播链:[]};
            if(!plain(required)||String(next?.世界?.名称||'')!==String(required.世界||'')||String(next?.世界?.时间||'')!==String(required.世界时间||''))return result;
            for(const category of RUMOR_PUBLIC_CATEGORIES){
                const count=Object.keys(plain(next?.传闻?.[category])?next.传闻[category]:{}).length;
                const initial=Number(required?.公开传闻?.[category]?.当前数量)||0;
                if(initial===0&&count===0)result.公开传闻.push(category);
            }
            for(const item of required.本轮必须复核的传播链||[]){
                const record=next?.世界?.[PATH]?.传播?.[item.名称];
                if(!record||propagationEnded(record,worldDateKey(required.世界时间)))continue;
                const updated=String(record.更新时间||'').trim()===String(required.世界时间||'').trim();
                const before=item.当前||{};
                const semantic=['范围','内容','受众','引发行动','状态','到期时间'].some(key=>!same(record?.[key],before?.[key]));
                if(!updated||(item.需语义变化&&!semantic))result.传播链.push(item.名称);
            }
            return result;
        }

    }
    const DEFAULT_WORLD_RUMOR_SERVICE=new WorldRumorService();
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings))BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=DEFAULT_WORLD_RUMOR_SERVICE.upgradePreset(BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset);
    // Compatibility entry points are stateless; production code uses the container-owned service.
    function rumorMaintenanceRequirements(stat){return DEFAULT_WORLD_RUMOR_SERVICE.requirements(stat);}
    function rumorMaintenanceNeeded(stat){return DEFAULT_WORLD_RUMOR_SERVICE.maintenanceNeeded(stat);}
    function worldPublicRumorFacts(stat){return DEFAULT_WORLD_RUMOR_SERVICE.publicFacts(stat);}
    function rumorWorldSameTime(value,current){return DEFAULT_WORLD_RUMOR_SERVICE.sameTime(value,current);}
    function trimRumorCapacity(stat){return DEFAULT_WORLD_RUMOR_SERVICE.trimCapacity(stat);}
    function refreshTouchedRumorOrder(stat,patches){return DEFAULT_WORLD_RUMOR_SERVICE.refreshTouchedOrder(stat,patches);}
    function softRumorMaintenanceIssues(next,required){return DEFAULT_WORLD_RUMOR_SERVICE.maintenanceIssues(next,required);}
    function ensureRumorLiveliness(next,required){return DEFAULT_WORLD_RUMOR_SERVICE.maintenanceIssues(next,required);}
