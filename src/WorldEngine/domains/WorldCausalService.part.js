    class WorldCausalService {
        constructor(engine=null){this.engine=engine;}
        repairProjection(stat) {
            const orbit=stat.世界.因果轨道||(stat.世界.因果轨道={当前阶段:'',故事线:'',下一节点:'',偏移记录:{}});
            const existing=storyStages(orbit.故事线);
            const macroEntries=Object.entries(stat.世界[PATH]?.事件||{})
                .filter(([,e])=>e.分类==='宏观节点'&&e.状态!=='已取消')
                .map((item,index)=>({item,index,key:worldDateKey(item[1].时间||item[1].开始时间)}))
                .sort((a,b)=>(a.key??Infinity)-(b.key??Infinity)||a.index-b.index)
                .map(x=>x.item);
            const macroNames=new Set(macroEntries.map(([name])=>name));
            const patches=[];
            let line=[];
            const existingValid=existing.length>=3&&existing.length<=5&&existing.every(name=>macroNames.has(name));
            if(existingValid)line=existing.slice(0,5);
            else {
                // 因果轨道只能由宏观事件投影；事实不足时等待模型补齐，不拿近期事件凑骨架。
                if(macroEntries.length<3)return patches;
                const chosen=[],seen=new Set();
                const take=name=>{if(name&&macroNames.has(name)&&!seen.has(name)){seen.add(name);chosen.push(name);}};
                take(orbit.当前阶段);
                for(const [name] of macroEntries)take(name);
                if(chosen.length<3)return patches;
                line=chosen.slice(0,5);
                const story=line.join(' -> ');
                if(orbit.故事线!==story){orbit.故事线=story;patches.push({op:'replace',path:'/世界/因果轨道/故事线',value:story});}
            }
            const nextName=line.find(name=>(stat.世界[PATH].事件[name]||{}).状态==='待发生')||'';
            if(orbit.下一节点!==nextName){orbit.下一节点=nextName;patches.push({op:'replace',path:'/世界/因果轨道/下一节点',value:nextName});}
            const current=line.find(name=>(stat.世界[PATH].事件[name]||{}).状态==='进行中');
            if(current&&(!orbit.当前阶段||orbit.当前阶段==='待初始化')){
                orbit.当前阶段=current;
                patches.push({op:'replace',path:'/世界/因果轨道/当前阶段',value:current});
            }
            return patches;
        }
        get(name){return this.engine?.snapshot?.().stat?.世界?.因果轨道?.偏移记录?.[String(name||'').trim()]||null;}
        async commit(mutator,status){
            const engine=this.engine,snapshot=engine.snapshot(),next=copy(snapshot.raw),stat=next.stat_data;
            if(!plain(stat?.世界?.因果轨道))stat.世界.因果轨道={};
            if(!plain(stat.世界.因果轨道.偏移记录))stat.世界.因果轨道.偏移记录={};
            const outcome=mutator(stat.世界.因果轨道.偏移记录);
            if(!outcome)return false;
            const stable=causalOffsetRecalculateStability(stat);
            causalOffsetSyncReplay(next,snapshot.fingerprint,outcome.oldName,outcome.newName,outcome.record,outcome.deleted,stable);
            const target=engine.host,had=!!target&&Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target?.__samsaraUIMutation;
            if(target)target.__samsaraUIMutation=true;
            try{
                await snapshot.mvu.replaceMvuData(next,{type:'message',message_id:snapshot.id});
            }finally{
                if(target){
                    if(had)target.__samsaraUIMutation=previous;
                    else delete target.__samsaraUIMutation;
                }
            }
            engine.status=status||'因果偏移已更新';
            engine.render(true);
            return true;
        }
        async save(oldName,newName,record){
            oldName=String(oldName||'').trim();newName=String(newName||'').trim();
            if(!oldName||!newName||!plain(record))throw new Error('偏移名称和记录不能为空');
            const impact=Number(record.影响程度);
            if(!Number.isFinite(impact)||impact===0||impact<-12||impact>15)throw new Error('影响程度必须为 -12~-1 或 +1~+15');
            return this.commit(bucket=>{
                if(!Object.hasOwn(bucket,oldName))throw new Error('偏移记录不存在：'+oldName);
                if(newName!==oldName&&Object.hasOwn(bucket,newName))throw new Error('偏移名称已存在：'+newName);
                const next={描述:String(record.描述||'').trim(),引发者:String(record.引发者||'').trim(),影响程度:impact};
                if(newName!==oldName)delete bucket[oldName];
                bucket[newName]=next;
                return {oldName,newName,record:next,deleted:false};
            },'已编辑因果偏移 · 稳定值已重算');
        }
        async remove(name){
            name=String(name||'').trim();if(!name)return false;
            return this.commit(bucket=>{
                if(!Object.hasOwn(bucket,name))return null;
                delete bucket[name];
                return {oldName:name,newName:name,record:null,deleted:true};
            },'已删除因果偏移 · 稳定值已重算');
        }
    }
    const DEFAULT_WORLD_CAUSAL_SERVICE=new WorldCausalService();
    let ACTIVE_WORLD_CAUSAL_SERVICE=DEFAULT_WORLD_CAUSAL_SERVICE;
    function repairCausalProjection(stat){return ACTIVE_WORLD_CAUSAL_SERVICE.repairProjection(stat);}
