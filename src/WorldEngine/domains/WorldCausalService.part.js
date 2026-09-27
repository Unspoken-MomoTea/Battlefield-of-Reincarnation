    const WORLD_CAUSAL_CHAIN_HINT=/(?:余波|后续|进一步|继续|继而|因此|由此|连锁|衍生|扩散|扩大|反应|吸引力|同一(?:契约|事件|行为|根因))/;
    const WORLD_CAUSAL_SPECULATION_HINT=/(?:可能|或许|预计|预期|将会|或将|未来(?:会|可能|将)|潜在|恐怕|有望|计划|打算|准备)/;
    const WORLD_CAUSAL_NO_EFFECT_HINT=/(?:尚未|还未|并未|未曾|没有|仅仅|只是).{0,18}(?:发生|执行|实施|使用|启动|造成|导致|改变|影响|生效)|(?:尚未|还未|并未|未曾|没有).{0,18}(?:结果|变化|后果)/;
    const WORLD_CAUSAL_REALIZED_HINT=/(?:已经|已然|已被|已使|已让|导致|造成|致使|使得|迫使|结果|改写|改变|破坏|摧毁|死亡|失去|退出|完成|失败|成功|被捕|被杀|被夺|被毁|封锁|崩溃|断裂|清除|修复)/;
    const WORLD_CAUSAL_RESPONSE_HINT=/(?:稳定值(?:持续)?下降|世界排异(?:反应|升级|增强)?|排异强度)/;
    const WORLD_CAUSAL_SCALE_HINTS=[
        /(?:关键人物|核心人物|重要人物|关键角色|核心角色).{0,28}(?:命运|死亡|阵亡|被杀|永久|不可逆|退场|失去|背叛|被捕|失踪|改写|改变|修复)/,
        /(?:死亡|阵亡|被杀|永久|不可逆|退场|被捕|失踪|改写|改变|修复).{0,28}(?:关键人物|核心人物|重要人物|关键角色|核心角色)/,
        /(?:重大|关键|宏观|主线).{0,8}(?:事件|节点|战役|战争|仪式|计划|灾难).{0,32}(?:改变|改写|失败|成功|取消|终止|提前|延后|崩溃|完成|毁灭|修复|失效)/,
        /(?:势力|阵营|政权|国家|帝国|王国|组织|军团|城市|地区).{0,32}(?:格局|覆灭|崩溃|瓦解|分裂|易主|政变|失守|沦陷|吞并|解体|重组|修复)/,
        /(?:主线|故事线|世界格局|下一节点|原定(?:走向|结局)).{0,32}(?:改变|改写|断裂|失效|无法|偏离|重构|修复|恢复)/,
        /(?:异常污染|跨世界污染|污染|世界裂隙|跨世界异常|异常侵蚀|世界侵蚀).{0,32}(?:扩大|扩散|蔓延|加剧|持续|清除|消除|修复|收束|封闭)/,
        /(?:异端|入侵者).{0,28}(?:全部|彻底|主要|核心).{0,16}(?:清除|消灭|死亡|覆灭).{0,36}(?:跨世界干涉|异常污染|世界裂隙|世界结构|主线|世界格局).{0,24}(?:消失|解除|恢复|修复|收束|封闭)/,
        /(?:跨世界干涉|异常污染|世界裂隙|世界结构|主线|世界格局).{0,24}(?:因|由于).{0,20}(?:异端|入侵者).{0,24}(?:清除|消灭|死亡|覆灭).{0,20}(?:消失|解除|恢复|修复|收束|封闭)/,
        /(?:不可逆|永久).{0,20}(?:命运|主线|重大事件|关键事件|势力格局|世界格局)/
    ];
    const WORLD_CAUSAL_CLEAR_LOCAL_HINT=/(?:位置(?:暴露|泄露|被发现|被感知)|被(?:敌人|异端|对手).{0,16}(?:发现|察觉|感知|盯上|追踪|锁定)|异端.{0,16}(?:知道|获知|发现|察觉|感知).{0,16}(?:玩家|轮回者|位置|行踪|能力|身份)|提前感知|引起警觉|提高.{0,10}难度|增加.{0,10}难度|生存难度|行动难度|追杀压力|短期.{0,8}(?:困难|不利)|局部战斗|普通战斗|受伤|轻伤|逃脱|脱险|暂时受阻|临时受阻)/;

    class WorldCausalService {
        constructor(engine=null,patchPolicy=DEFAULT_WORLD_PATCH_POLICY){this.engine=engine;this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;}
        clampImpact(value) {
            const impact=Number(value);
            if(!Number.isFinite(impact))return null;
            if(impact===0)return 0;
            return impact<0?Math.max(-12,impact):Math.min(15,impact);
        }
        offsetText(item) {
            return [item?.名称,item?.描述].filter(Boolean).join(' ');
        }
        softNormalizeOffsets(stat,result) {
            const items=Array.isArray(result?.因果?.偏移记录)?result.因果.偏移记录:null;
            if(!items||!items.length)return [];
            const existing=stat?.世界?.因果轨道?.偏移记录||{},prepared=[];
            for(const raw of items){
                if(!plain(raw))continue;
                const item=copy(raw);
                if(item.操作==='撤销本轮'){prepared.push(item);continue;}
                const existingName=stableNameIn(existing,item.名称),isNew=!existingName;
                if(Object.hasOwn(item,'影响程度')){
                    const impact=this.clampImpact(item.影响程度);
                    if(impact===null){
                        if(isNew)continue;
                        delete item.影响程度;
                    }else if(isNew&&impact===0)continue;
                    else item.影响程度=impact;
                }else if(isNew)continue;
                const text=this.offsetText(item);
                if(isNew&&WORLD_CAUSAL_NO_EFFECT_HINT.test(text))continue;
                if(isNew&&WORLD_CAUSAL_SPECULATION_HINT.test(text)&&!WORLD_CAUSAL_REALIZED_HINT.test(text))continue;
                if(isNew&&Number(item.影响程度)<0&&WORLD_CAUSAL_RESPONSE_HINT.test(text))continue;
                prepared.push(item);
            }

            const removed=new Set(),groups=new Map();
            for(let i=0;i<prepared.length;i++){
                const item=prepared[i];
                if(!plain(item)||item.操作==='撤销本轮'||!Object.hasOwn(item,'影响程度'))continue;
                const actor=String(item.引发者||'').trim().toLowerCase();
                const impact=Number(item.影响程度);
                if(!actor||!Number.isFinite(impact)||impact===0)continue;
                const key=actor+'|'+(impact<0?'negative':'positive'),group=groups.get(key)||[];
                group.push({index:i,item,text:this.offsetText(item),impact});groups.set(key,group);
            }
            for(const group of groups.values()){
                const chained=group.filter(entry=>WORLD_CAUSAL_CHAIN_HINT.test(entry.text));
                if(chained.length<2)continue;
                let winner=chained[0];
                for(const entry of chained.slice(1))if(Math.abs(entry.impact)>Math.abs(winner.impact))winner=entry;
                for(const entry of chained)if(entry.index!==winner.index)removed.add(entry.index);
            }
            let normalized=prepared.filter((_,index)=>!removed.has(index));
            const budgets=new Map();
            normalized=normalized.filter(item=>{
                if(!plain(item)||item.操作==='撤销本轮'||!Object.hasOwn(item,'影响程度'))return true;
                const actor=String(item.引发者||'').trim().toLowerCase(),impact=Number(item.影响程度);
                if(!actor||!Number.isFinite(impact)||impact===0)return true;
                const sign=impact<0?'negative':'positive',key=actor+'|'+sign;
                let remaining=budgets.has(key)?budgets.get(key):(impact<0?12:15);
                const magnitude=Math.min(Math.abs(impact),remaining);
                remaining=Math.max(0,remaining-magnitude);budgets.set(key,remaining);
                if(magnitude<=0)return false;
                item.影响程度=impact<0?-magnitude:magnitude;
                return true;
            });
            result.因果.偏移记录=normalized;
            return normalized;
        }
        hasWorldScaleEvidence(item) {
            const text=this.offsetText(item);
            return !!text&&WORLD_CAUSAL_SCALE_HINTS.some(rule=>rule.test(text));
        }
        filterNewOffsetsByWorldScale(stat,result) {
            const items=result?.因果?.偏移记录;
            if(!Array.isArray(items)||!items.length)return [];
            const existing=stat?.世界?.因果轨道?.偏移记录||{},dropped=[];
            result.因果.偏移记录=items.filter(item=>{
                if(!plain(item)||item.操作==='撤销本轮')return true;
                if(stableNameIn(existing,item.名称))return true;
                if(this.hasWorldScaleEvidence(item))return true;
                dropped.push(item.名称);
                return false;
            });
            return dropped;
        }
        prepareResult(stat,result) {
            const dropped=this.filterNewOffsetsByWorldScale(stat,result);
            this.softNormalizeOffsets(stat,result);
            return dropped;
        }
        staleLocalOffsetRepairs(stat,result) {
            const bucket=stat?.世界?.因果轨道?.偏移记录||{},protectedNames=new Set();
            for(const item of result?.因果?.偏移记录||[]){
                if(plain(item)&&this.hasWorldScaleEvidence(item))protectedNames.add(nameKey(item.名称));
            }
            const patches=[],names=[];
            for(const [name,record] of Object.entries(bucket)){
                const impact=Number(record?.影响程度)||0;
                if(!impact||protectedNames.has(nameKey(name)))continue;
                const text=this.offsetText(Object.assign({名称:name},record));
                if(!WORLD_CAUSAL_CLEAR_LOCAL_HINT.test(text)||WORLD_CAUSAL_SCALE_HINTS.some(rule=>rule.test(text)))continue;
                patches.push({op:'remove',path:this.patchPolicy.pointer(['世界','因果轨道','偏移记录',name])});
                names.push(name);
            }
            return {patches,names};
        }
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
