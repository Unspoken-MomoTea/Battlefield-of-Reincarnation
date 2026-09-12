    // 原著/数据库时间轴保护层：宏观节点先服从权威时间资料，再展开区间细节。
    const CHRONOLOGY_GUARD_RULES=`【原著/数据库时间轴硬约束】
1. 宏观节点的日期与跨度必须先服从当前已确认事实和明确世界书/数据库中的原著时间资料，再使用模型已有原著知识补足；不得为了推动剧情、制造冲突、维持紧张感或让<user>尽快参与而主动提前关键事件。
2. 世界书/数据库已给出某宏观事件的明确日期时，必须沿用该日期/时段；只有已确认剧情造成足以改线的因果偏移，且同轮因果.偏移记录明确关联该节点并说明提前/延后原因时，才允许改期。
3. 原著只给事件顺序或大致间隔时，按原著节奏保守估计；不确定跨度就使用可理解的相对/因果时间并只推进一步，禁止把数日、数周或更长的原著发展压成“今天准备、明天决战”。
4. 先确定“当前世界时间 → 下一宏观节点”的合理时间边界，再在该区间内生成当前事件与近期节点；不能先决定下一章要发生什么，再倒推一个过近日期。`;
    const CHRONOLOGY_PRESET_STEP_OLD='Step 2 · 定边界：确认当前阶段与下一宏观节点；只有篇章、地区、战争、势力或关键人物命运发生阶段变化时才调整宏观骨架。';
    const CHRONOLOGY_PRESET_STEP_NEW='Step 2 · 定边界与日期：以当前世界时间为起点，先按明确世界书/数据库时间资料与原著节奏确定下一宏观节点及合理跨度；只有已确认因果偏移才能改期，再决定是否调整宏观骨架。';
    const upgradeChronologyPreset=value=>String(value||'').includes(CHRONOLOGY_PRESET_STEP_OLD)?String(value).replace(CHRONOLOGY_PRESET_STEP_OLD,CHRONOLOGY_PRESET_STEP_NEW):String(value||'');
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings))BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=upgradeChronologyPreset(BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset);

    let ACTIVE_CHRONOLOGY_GUARD=null;

    function chronologyCompactName(value) {
        return String(value||'').toLowerCase().replace(/[《》【】\[\]()（）“”‘’'"·・:：,，。.!！?？\s_\-\/\\]+/g,'');
    }
    function chronologyEvidenceForEvent(eventName,texts) {
        const name=String(eventName||'').trim();if(!name)return null;
        const datePattern=/(\d{1,4}\s*年\s*-?\s*\d{1,2}\s*月\s*-?\s*\d{1,2}\s*日|\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/g;
        let best=null;
        for(const rawText of texts||[]){
            const text=String(rawText||'');if(!text)continue;
            let at=text.indexOf(name),fromIndex=0;
            while(at>=0){
                const left=Math.max(0,at-180),right=Math.min(text.length,at+name.length+180),window=text.slice(left,right),center=at-left+name.length/2;
                datePattern.lastIndex=0;let match;
                while((match=datePattern.exec(window))){
                    const key=worldDateKey(match[0]);if(key===null)continue;
                    const distance=Math.abs((match.index+match[0].length/2)-center);
                    if(!best||distance<best.distance)best={raw:match[0],key,distance};
                }
                fromIndex=at+Math.max(1,name.length);at=text.indexOf(name,fromIndex);
            }
        }
        return best;
    }
    function chronologyShiftDeclared(stat,result,eventName) {
        const target=chronologyCompactName(eventName);if(!target)return false;
        const records=[];
        for(const [name,item] of Object.entries(stat?.世界?.因果轨道?.偏移记录||{}))records.push({名称:name,...(plain(item)?item:{})});
        for(const item of result?.因果?.偏移记录||[])if(plain(item))records.push(item);
        return records.some(item=>{
            if(Number(item?.影响程度)===0)return false;
            const marker=chronologyCompactName(item?.名称),desc=String(item?.描述||'');
            const directlyRelated=(marker&&(marker.includes(target)||target.includes(marker)))||desc.includes(String(eventName||''));
            return directlyRelated&&/(提前|提早|延后|推迟|改期|时序|时间线|日期|进程|节点)/.test(String(item?.名称||'')+desc);
        });
    }
    function validateChronologyResult(stat,result) {
        const guard=ACTIVE_CHRONOLOGY_GUARD;if(!guard?.books?.length)return;
        const events=stat?.世界?.[PATH]?.事件||{};
        for(const event of result?.事件||[]){
            if(!plain(event)||event.操作==='撤销本轮')continue;
            const storedName=stableNameIn(events,String(event.名称||'')),stored=storedName?events[storedName]:null;
            const category=String(event.分类||stored?.分类||'');
            const status=String(event.状态||stored?.状态||'待发生');
            if(category!=='宏观节点'||status!=='待发生')continue;
            if(!Object.hasOwn(event,'时间')&&!Object.hasOwn(event,'开始时间'))continue;
            const evidence=chronologyEvidenceForEvent(event.名称,guard.books);if(!evidence)continue;
            if(chronologyShiftDeclared(stat,result,event.名称))continue;
            const proposedRaw=String(event.时间||event.开始时间||'').trim(),proposed=worldDateKey(proposedRaw);
            if(proposed===null)throw new Error('宏观节点日期未服从原著/数据库时间锚点：'+event.名称+'；资料明确为 '+evidence.raw+'，不得改成模糊或不可比较时间。若已确认因果偏移导致改期，必须同轮提交明确关联该节点的因果.偏移记录。');
            if(Math.floor(proposed/24)!==Math.floor(evidence.key/24))throw new Error('宏观节点日期与原著/数据库时间锚点冲突：'+event.名称+' 提交 '+proposedRaw+'，资料明确为 '+evidence.raw+'；不得为了推进剧情提前或压缩原著时间。若已确认因果偏移导致改期，必须同轮提交明确关联该节点的因果.偏移记录。');
        }
    }

    const compileWorldResultBeforeChronologyGuard=compileWorldResult;
    compileWorldResult=function(stat,value) {
        const result=normalizeWorldResult(value);
        validateChronologyResult(stat,result);
        return compileWorldResultBeforeChronologyGuard(stat,result);
    };

    const retryPlanBeforeChronologyGuard=retryPlanForFailure;
    retryPlanForFailure=function(error,rejected=[]) {
        const plan=retryPlanBeforeChronologyGuard(error,rejected).map(String);
        const messages=[String(error?.message||error||''),...(rejected||[]).map(item=>String(item?.原因||''))].join('\n');
        if(/宏观节点日期(?:未服从|与).*原著\/数据库时间锚点/.test(messages))plan.unshift('宏观时间轴：重新读取已提供的原著/数据库时间资料；明确日期必须原样服从。只有已确认剧情确实改变该节点时，才可改期，并在同轮因果.偏移记录中明确关联该节点与提前/延后原因。');
        return Array.from(new Set(plan));
    };

    const SamsaraWorldEngineBeforeChronologyGuard=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeChronologyGuard {
        constructor(host,env) {
            super(host,env);
            if(!this.config.activePromptDocumentId||this.config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id){
                const upgraded=upgradeChronologyPreset(this.config.preset);
                if(upgraded!==this.config.preset){this.config.preset=upgraded;this.saveConfig();}
            }
        }
        async buildRequest(base) {
            const request=await super.buildRequest(base),payload=JSON.parse(request.input),state=base?.stat||{};
            const chronologyScan=[state?.世界?.名称,'原著','时间线','时间轴','年表','校历','大事记','大事件','剧情大纲','剧情章节','章节','未来','后续'].filter(Boolean).join(' ');
            const chronologyBooks=await this.worldbook(chronologyScan,{timelineBackbone:true});
            const chronologyOnly=(chronologyBooks||[]).filter(book=>isTimelineBackboneEntry(book?.名称));
            const existing=Array.isArray(payload.世界书)?payload.世界书.map(String):[],merged=existing.slice(),seen=new Set(existing);
            for(const book of chronologyOnly){const text=String(book?.内容||'');if(text&&!seen.has(text)){seen.add(text);merged.push(text);}}
            payload.世界书=merged;
            ACTIVE_CHRONOLOGY_GUARD={worldTime:String(state?.世界?.时间||''),books:merged.slice()};
            const next=payload?.时间线调度?.下一宏观节点||null;
            payload.时间线基准={
                当前世界时间:String(state?.世界?.时间||''),
                下一宏观节点:next?{名称:String(next.名称||''),当前排期:String(next.时间||'')}:null,
                原著时间资料:chronologyOnly.length?'已读取 '+chronologyOnly.length+' 条明确时间线/年表资料':'未命中明确时间线条目；使用模型已有原著知识保守估计，不得为推进剧情压缩跨度',
                要求:'宏观节点先定原著/数据库日期与合理跨度，再展开当前→下一节点区间。明确日期必须服从；只有已确认因果偏移并记录原因时才允许提前或延后。'
            };
            request.input=JSON.stringify(payload,null,2);
            request.system=String(request.system||'')+'\n\n'+CHRONOLOGY_GUARD_RULES;
            const manifest=request.manifest||(request.manifest={});
            const rows=Array.isArray(manifest.世界书条目)?manifest.世界书条目:[];
            const rowKeys=new Set(rows.map(row=>String(row?.世界书||'')+'\u0000'+String(row?.条目ID||'')));
            for(const book of chronologyOnly){
                const key=String(book?.世界书||'')+'\u0000'+String(book?.条目ID||'');
                if(rowKeys.has(key))continue;rowKeys.add(key);
                rows.push({世界书:book?.世界书,条目ID:book?.条目ID,名称:book?.名称,估算Tokens:estimateTokens(book?.内容)});
            }
            manifest.世界书条目=rows;
            if(plain(manifest.世界书读取))manifest.世界书读取.实际读取=merged.length;
            manifest.原著时间轴={强制校准:true,当前世界时间:String(state?.世界?.时间||''),时间线资料:chronologyOnly.map(book=>String(book?.名称||'')).filter(Boolean),下一宏观节点:next?String(next.名称||''):''};
            manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema);
            if(request.system.length+request.input.length>240000)throw new Error('请求超过内部安全上限（'+formatTokenCount(estimateTokens(request.system)+estimateTokens(request.input),true)+'），请减少所选条目或正文层数');
            return request;
        }
    };
