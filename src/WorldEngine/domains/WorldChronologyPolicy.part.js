    class WorldChronologyPolicy {
        constructor(){this.guard=null;}

        setGuard(worldTime,books=[]){
            this.guard={worldTime:String(worldTime||''),books:Array.isArray(books)?books.map(String):[]};
            return this.guard;
        }

        clearGuard(){this.guard=null;}

        compactName(value) {
            return String(value||'').toLowerCase().replace(/[《》【】\[\]()（）“”‘’'"·・:：,，。.!！?？\s_\-\/\\]+/g,'');
        }

        evidenceForEvent(eventName,texts) {
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

        shiftDeclared(stat,result,eventName) {
            const target=this.compactName(eventName);if(!target)return false;
            const records=[];
            for(const [name,item] of Object.entries(stat?.世界?.因果轨道?.偏移记录||{}))records.push({名称:name,...(plain(item)?item:{})});
            for(const item of result?.因果?.偏移记录||[])if(plain(item))records.push(item);
            return records.some(item=>{
                if(Number(item?.影响程度)===0)return false;
                const marker=this.compactName(item?.名称),desc=String(item?.描述||'');
                const directlyRelated=(marker&&(marker.includes(target)||target.includes(marker)))||desc.includes(String(eventName||''));
                return directlyRelated&&/(提前|提早|延后|推迟|改期|时序|时间线|日期|进程|节点)/.test(String(item?.名称||'')+desc);
            });
        }

        validate(stat,result) {
            const guard=this.guard;if(!guard?.books?.length)return result;
            const events=stat?.世界?.[PATH]?.事件||{};
            for(const event of result?.事件||[]){
                if(!plain(event)||event.操作==='撤销本轮')continue;
                const storedName=stableNameIn(events,String(event.名称||'')),stored=storedName?events[storedName]:null;
                const category=String(event.分类||stored?.分类||'');
                const status=String(event.状态||stored?.状态||'待发生');
                if(category!=='宏观节点'||status!=='待发生')continue;
                if(!Object.hasOwn(event,'时间')&&!Object.hasOwn(event,'开始时间'))continue;
                const evidence=this.evidenceForEvent(event.名称,guard.books);if(!evidence)continue;
                if(this.shiftDeclared(stat,result,event.名称))continue;
                const proposedRaw=String(event.时间||event.开始时间||'').trim(),proposed=worldDateKey(proposedRaw);
                if(proposed===null)throw new Error('宏观节点日期未服从原著/数据库时间锚点：'+event.名称+'；资料明确为 '+evidence.raw+'，不得改成模糊或不可比较时间。若已确认因果偏移导致改期，必须同轮提交明确关联该节点的因果.偏移记录。');
                if(Math.floor(proposed/24)!==Math.floor(evidence.key/24))throw new Error('宏观节点日期与原著/数据库时间锚点冲突：'+event.名称+' 提交 '+proposedRaw+'，资料明确为 '+evidence.raw+'；不得为了推进剧情提前或压缩原著时间。若已确认因果偏移导致改期，必须同轮提交明确关联该节点的因果.偏移记录。');
            }
            return result;
        }

        retryGuidance(error,rejected=[]) {
            const messages=[String(error?.message||error||''),...(rejected||[]).map(item=>String(item?.原因||''))].join('\n');
            if(!/宏观节点日期(?:未服从|与).*原著\/数据库时间锚点/.test(messages))return '';
            return DEFAULT_WORLD_RETRY_GUIDANCE_SERVICE.format('retryGuideChronology');
        }
    }

    const DEFAULT_WORLD_CHRONOLOGY_POLICY=new WorldChronologyPolicy();
