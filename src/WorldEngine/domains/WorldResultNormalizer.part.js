    class WorldResultNormalizer {
        normalizeRumorCredibility(value) {
            const raw=String(value??'').trim();
            if(RUMOR_CREDIBILITY.includes(raw))return raw;
            if(/^(?:可信|属实|真实|确实|高|较高|很高|基本属实)$/.test(raw))return '或许可信';
            if(/^(?:不可信|虚假|谣言|低|较低|很低|纯属谣言)$/.test(raw))return '酒话';
            return '可疑';
        }
        sampleForWorldResultList(key) {
            if(key==='事件')return {...RECORDS.事件,...MODEL_DETAILS.事件};
            if(key==='人物')return {...RECORDS.人物,...MODEL_DETAILS.人物};
            if(key==='势力地区')return {...RECORDS.势力地区,...MODEL_DETAILS.势力地区};
            if(key==='历史')return RECORDS.历史;
            if(key==='传播')return {...RECORDS.传播,...MODEL_DETAILS.传播};
            if(key==='势力')return EXISTING.势力;
            if(key==='探索')return EXISTING.探索;
            if(key==='异端')return EXISTING.名单;
            return {};
        }
        detailTextField(sample) {
            for(const key of ['名称','事实','行动','影响','内容','说明','问题','对象','地点']){
                if(Object.hasOwn(sample||{},key)&&typeof sample[key]==='string')return key;
            }
            return Object.keys(sample||{}).find(key=>typeof sample[key]==='string')||'';
        }
        normalizeStructuredDetail(value,sample) {
            const out=copy(sample||{});
            if(plain(value)){
                for(const key of Object.keys(sample||{})){
                    if(Object.hasOwn(value,key))out[key]=this.normalizeResultField(value[key],sample[key]);
                }
                return out;
            }
            if(value!==undefined&&value!==null&&value!==''){
                const key=this.detailTextField(sample);
                if(key)out[key]=this.normalizeResultField(value,sample[key]);
            }
            return out;
        }
        normalizeResultField(value,sample) {
            if(Array.isArray(sample)){
                const list=Array.isArray(value)?value:(value===undefined||value===null||value===''?[]:[value]);
                if(sample.length&&plain(sample[0]))return list.filter(item=>item!==undefined&&item!==null&&item!=='').map(item=>this.normalizeStructuredDetail(item,sample[0]));
                return list.map(copy);
            }
            if(plain(sample)){
                if(!plain(value))return copy(sample);
                const out=copy(sample);
                for(const key of Object.keys(sample))if(Object.hasOwn(value,key))out[key]=this.normalizeResultField(value[key],sample[key]);
                return out;
            }
            if(typeof sample==='number'){
                const number=Number(value);
                return Number.isFinite(number)?number:value;
            }
            if(typeof sample==='boolean')return typeof value==='boolean'?value:!!value;
            if(typeof sample==='string'&&value!==undefined&&value!==null)return String(value);
            return copy(value);
        }
        normalizeNamedResultList(value,sample,allowedOps=['更新','撤销本轮']) {
            const sampleKeys=Object.keys(sample||{}),singleField=sampleKeys.length===1?sampleKeys[0]:'';
            const list=Array.isArray(value)?value:plain(value)?Object.entries(value).map(([name,item])=>{
                if(plain(item))return Object.assign({名称:name},copy(item));
                if(singleField&&item!==undefined&&item!==null)return {名称:name,[singleField]:copy(item)};
                return null;
            }).filter(Boolean):[];
            const fields=new Set(sampleKeys),map=new Map();
            const aliases={
                所在世界:'所属世界',
                已知信息:'认知',
                下次检查条件:'下次检查',
                事实:'内容'
            };
            for(const source of list){
                if(!plain(source))continue;
                const raw=copy(source);
                for(const [from,to] of Object.entries(aliases)){
                    if(fields.has(to)&&Object.hasOwn(raw,from)&&!Object.hasOwn(raw,to))raw[to]=raw[from];
                }
                if(fields.has('可信度')&&!Object.hasOwn(raw,'可信度')){
                    const rumorClass=String(raw.分类||'').trim();
                    raw.可信度=({'事实':'或许可信','猜测':'可疑','谣言':'酒话','酒话':'酒话','可疑':'可疑','或许可信':'或许可信'})[rumorClass]||'可疑';
                }
                const name=String(raw.名称??raw.name??'').trim();
                if(!name)continue;
                const item={名称:name};
                const operation=String(raw.操作||'更新');
                item.操作=allowedOps.includes(operation)?operation:'更新';
                for(const key of fields)if(Object.hasOwn(raw,key))item[key]=this.normalizeResultField(raw[key],sample[key]);
                const id=nameKey(name),prev=map.get(id);
                if(item.操作==='撤销本轮'){map.delete(id);continue;}
                map.set(id,prev?Object.assign(prev,item):item);
            }
            return Array.from(map.values());
        }
        normalizeAssetResultList(value) {
            const sourceList=Array.isArray(value)?value:plain(value)?Object.entries(value).map(([name,item])=>plain(item)?Object.assign({名称:name},copy(item)):{名称:name,操作:item==='移除'?'移除':'更新'}):[];
            const map=new Map(),stringFields=['类型','状态'],numberFields=['主体规模','完整度'];
            const normalizeOwners=value=>{
                const source=Array.isArray(value)?value:(value===undefined?[]:[value]),out=[];
                for(const raw of source){const owner=String(raw??'').trim();if(!owner||owner==='无主'||out.includes(owner))continue;out.push(owner);}
                return out.slice(0,12);
            };
            const normalizeMap=(value,kind)=>{
                if(!plain(value))return {};
                const out={};
                for(const [name,raw] of Object.entries(value)){
                    if(forbidden.has(name))continue;
                    if(raw===null){out[name]=null;continue;}
                    if(kind==='person'){
                        if(typeof raw==='string')out[name]=raw;
                        continue;
                    }
                    if(!plain(raw))continue;
                    const item={};
                    if(kind==='unit'){
                        for(const key of ['余量','上限'])if(Object.hasOwn(raw,key)){const n=Number(raw[key]);if(Number.isFinite(n))item[key]=n;}
                        if(Array.isArray(raw.加成))item.加成=raw.加成.filter(x=>typeof x==='string');
                    }else{
                        if(Object.hasOwn(raw,'阶段'))item.阶段=String(raw.阶段||'');
                        for(const key of ['功能','产出'])if(Object.hasOwn(raw,key))item[key]=String(raw[key]??'');
                        if(Array.isArray(raw.加成))item.加成=raw.加成.filter(x=>typeof x==='string');
                    }
                    out[name]=item;
                }
                return out;
            };
            const mergeItem=(previous,item)=>{
                if(!previous)return item;
                const merged=Object.assign({},previous,item);
                for(const field of ['消耗单元','建设序列','驻扎人员']){
                    if(plain(previous[field])&&plain(item[field]))merged[field]=Object.assign({},previous[field],item[field]);
                }
                if(plain(previous.能源)&&plain(item.能源))merged.能源=Object.assign({},previous.能源,item.能源);
                return merged;
            };
            for(const source of sourceList){
                if(!plain(source))continue;
                const name=String(source.名称??source.name??'').trim();if(!name||forbidden.has(name))continue;
                const operation=['更新','移除','撤销本轮'].includes(source.操作)?source.操作:'更新';
                const id=nameKey(name);
                if(operation==='撤销本轮'){map.delete(id);continue;}
                const item={名称:name,操作:operation};
                if(Object.hasOwn(source,'所属对象'))item.所属对象=normalizeOwners(source.所属对象);
                for(const field of stringFields)if(Object.hasOwn(source,field))item[field]=String(source[field]??'');
                for(const field of numberFields)if(Object.hasOwn(source,field)){const n=Number(source[field]);item[field]=Number.isFinite(n)?n:source[field];}
                if(Object.hasOwn(source,'能源')){
                    if(source.能源===null)item.能源=null;
                    else if(plain(source.能源)){
                        item.能源={};
                        for(const field of ['类型','描述'])if(Object.hasOwn(source.能源,field))item.能源[field]=String(source.能源[field]??'');
                        for(const field of ['当前','上限'])if(Object.hasOwn(source.能源,field)){const n=Number(source.能源[field]);if(Number.isFinite(n))item.能源[field]=n;}
                    }
                }
                if(Object.hasOwn(source,'消耗单元'))item.消耗单元=normalizeMap(source.消耗单元,'unit');
                if(Object.hasOwn(source,'建设序列'))item.建设序列=normalizeMap(source.建设序列,'build');
                if(Object.hasOwn(source,'驻扎人员'))item.驻扎人员=normalizeMap(source.驻扎人员,'person');
                if(Object.hasOwn(source,'待办事件'))item.待办事件=Array.isArray(source.待办事件)?source.待办事件.filter(x=>typeof x==='string'):[];
                map.set(id,mergeItem(map.get(id),item));
            }
            return Array.from(map.values());
        }
        normalizeRelationResultList(value) {
            const list=Array.isArray(value)?value:[],map=new Map();
            for(const source of list){
                if(!plain(source))continue;
                const name=String(source.名称??source.name??'').trim();if(!name)continue;
                const item={名称:name,操作:source.操作==='撤销本轮'?'撤销本轮':'更新'};
                for(const key of RELATION_SYNC_KEYS){
                    if(!Object.hasOwn(source,key))continue;
                    const raw=source[key];
                    if(['在场','是否队友'].includes(key))item[key]=typeof raw==='boolean'?raw:!!raw;
                    else if(['HP','THP','EP','好感度'].includes(key)){const n=Number(raw);item[key]=Number.isFinite(n)?n:raw;}
                    else if(key==='身份')item[key]=Array.isArray(raw)?raw.filter(x=>typeof x==='string'):raw;
                    else if(RELATION_COMPONENT_FIELDS.has(key)||key==='当前形态')item[key]=copy(raw);
                    else item[key]=raw==null?'':String(raw);
                }
                const id=nameKey(name),prev=map.get(id);
                if(item.操作==='撤销本轮'){map.delete(id);continue;}
                map.set(id,prev?Object.assign(prev,item):item);
            }
            return Array.from(map.values());
        }
        normalizeWorldResult(value) {
            if(!plain(value))throw new Error('WorldResult 必须是 JSON 对象');
            const result={摘要:String(value.摘要??value.summary??'世界继续推进')};
            const legacyStage=(Object.hasOwn(value,'公开摘要')||Object.hasOwn(value,'public_summary'))?String(value.公开摘要??value.public_summary??'').trim():'';
            result.货币={};
            if(plain(value.货币)){
                for(const key of Object.keys(CURRENCY_FIELDS))if(Object.hasOwn(value.货币,key))result.货币[key]=String(value.货币[key]??'');
            }
            result.历法={};
            if(plain(value.历法)){
                if(Object.hasOwn(value.历法,'名称'))result.历法.名称=String(value.历法.名称??'');
                if(Array.isArray(value.历法.月份天数))result.历法.月份天数=value.历法.月份天数.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=99).slice(0,24);
                if(Object.hasOwn(value.历法,'闰年规则'))result.历法.闰年规则=String(value.历法.闰年规则??'');
            }
            for(const key of ['事件','人物','势力地区','历史','传播','势力','探索']){
                const operations=(key==='传播')?['更新','移除','撤销本轮']:['更新','撤销本轮'];
                result[key]=this.normalizeNamedResultList(value[key],this.sampleForWorldResultList(key),operations);
            }
            result.资产=this.normalizeAssetResultList(value.资产);
            result.异端=(Array.isArray(value.异端)?value.异端:[]).filter(plain).map(item=>({
                名称:String(item.名称||'').trim(),
                操作:item.操作==='撤销本轮'?'撤销本轮':'更新',
                状态:['活跃','死亡'].includes(item.状态)?item.状态:''
            })).filter(item=>item.名称&&item.状态);
            result.因果={};
            const causal=plain(value.因果)?value.因果:{};
            if(Object.hasOwn(causal,'当前阶段'))result.因果.当前阶段=String(causal.当前阶段||'');
            else if(legacyStage)result.因果.当前阶段=legacyStage;
            if(Array.isArray(causal.宏观顺序))result.因果.宏观顺序=causal.宏观顺序.map(x=>String(x||'').trim()).filter(Boolean).slice(0,5);
            result.因果.偏移记录=this.normalizeNamedResultList(causal.偏移记录,EXISTING.偏移记录,['更新','撤销本轮']);
            result.传闻={};
            const rumors=plain(value.传闻)?value.传闻:{};
            for(const key of WORLD_RESULT_RUMORS){
                let list=this.normalizeNamedResultList(rumors[key],EXISTING[key],['更新','移除','撤销本轮']);
                if(key==='街头巷议'){
                    for(const item of list)if(Object.hasOwn(item,'可信度'))item.可信度=this.normalizeRumorCredibility(item.可信度);
                    const seen=new Set(),deduped=[];
                    for(const item of list){
                        const signature=String(item.内容||'').replace(/\s+/g,' ').trim();
                        if(item.操作==='更新'&&signature&&seen.has(signature))continue;
                        if(item.操作==='更新'&&signature)seen.add(signature);
                        deduped.push(item);
                    }
                    list=deduped;
                }
                result.传闻[key]=list;
            }
            const relationSource=plain(value.关系)&&!Array.isArray(value.关系)
                ?Object.entries(value.关系).map(([name,item])=>plain(item)?Object.assign({名称:name},copy(item)):{名称:name,好感度:item})
                :value.关系;
            result.关系=this.normalizeRelationResultList(relationSource);
            return result;
        }
        mergeNamedResultLists(base,incoming) {
            const map=new Map();
            for(const item of base||[])map.set(nameKey(item.名称),copy(item));
            for(const item of incoming||[]){
                const id=nameKey(item.名称);
                if(item.操作==='撤销本轮'){map.delete(id);continue;}
                map.set(id,Object.assign(map.get(id)||{},copy(item)));
            }
            return Array.from(map.values());
        }
        mergeWorldResults(base,incoming) {
            const a=base?this.normalizeWorldResult(base):this.normalizeWorldResult({摘要:''});
            const b=this.normalizeWorldResult(incoming);
            const result={摘要:[a.摘要,b.摘要].filter(Boolean).filter((x,i,list)=>list.indexOf(x)===i).join('；')};
            result.货币=Object.assign({},a.货币||{},b.货币||{});
            result.历法=Object.assign({},a.历法||{},b.历法||{});
            for(const key of ['事件','人物','势力地区','历史','传播','势力','探索','资产','异端','关系'])result[key]=this.mergeNamedResultLists(a[key],b[key]);
            result.因果={
                偏移记录:this.mergeNamedResultLists(a.因果?.偏移记录,b.因果?.偏移记录)
            };
            if(Object.hasOwn(b.因果||{},'当前阶段'))result.因果.当前阶段=b.因果.当前阶段;
            else if(Object.hasOwn(a.因果||{},'当前阶段'))result.因果.当前阶段=a.因果.当前阶段;
            if(Array.isArray(b.因果?.宏观顺序)&&b.因果.宏观顺序.length)result.因果.宏观顺序=copy(b.因果.宏观顺序);
            else if(Array.isArray(a.因果?.宏观顺序))result.因果.宏观顺序=copy(a.因果.宏观顺序);
            result.传闻={};
            for(const key of WORLD_RESULT_RUMORS)result.传闻[key]=this.mergeNamedResultLists(a.传闻?.[key],b.传闻?.[key]);
            return result;
        }
    }
    const DEFAULT_WORLD_RESULT_NORMALIZER=new WorldResultNormalizer();
    function normalizeWorldResult(value){return DEFAULT_WORLD_RESULT_NORMALIZER.normalizeWorldResult(value);}
    function mergeWorldResults(base,incoming){return DEFAULT_WORLD_RESULT_NORMALIZER.mergeWorldResults(base,incoming);}
