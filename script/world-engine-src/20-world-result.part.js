    const CURRENCY_FIELDS={体系:'',购买力基准:'',经济波动:''};
    const CALENDAR_FIELDS={名称:'',月份天数:[],闰年规则:''};
    const QUALITY_RANKS=['F','E','D','C','B','A','S','SS','SSS'];
    const RUMOR_CREDIBILITY=['酒话','可疑','或许可信'];
    const INTEL_RATINGS=[...QUALITY_RANKS,'日常','战略'];
    function normalizeRumorCredibility(value) {
        const raw=String(value??'').trim();
        if(RUMOR_CREDIBILITY.includes(raw))return raw;
        if(/^(?:可信|属实|真实|确实|高|较高|很高|基本属实)$/.test(raw))return '或许可信';
        if(/^(?:不可信|虚假|谣言|低|较低|很低|纯属谣言)$/.test(raw))return '酒话';
        return '可疑';
    }
    const EXISTING = {
        势力: {实力:'F',领地:'',描述:'',声望:0}, 探索:{风险:'F',探索度:0,描述:'',隐藏真相:''},
        偏移记录:{描述:'',引发者:'',影响程度:0},
        街头巷议:{来源:'',内容:'',可信度:''}, 情报交易:{卖家:'',情报评级:'',摘要:'',要价:'',真实内幕:''},
        布告与檄文:{发布者:'',内容:'',张贴位置:''},
        名单:{来源:'',经历:'',阵营:'',职业:'',层级:'',状态:''}
    };
    const RELATION_RANKS=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
    const RELATION_QUALITIES=['F','E','D','C','B','A','S','SS','SSS'];
    const RELATION_SYNC_FIELDS={
        在场:false,种族:'',身份:[],职业:{},层级:'Ⅰ',HP:0,THP:0,EP:0,
        状态:{},血统:{},装备:{},技能:{},形态库:{},当前形态:{},
        性格:'',喜爱:'',外貌:'',着装:'',是否队友:false,好感度:0,态度:'',背景故事:''
    };
    const RELATION_SYNC_KEYS=new Set(Object.keys(RELATION_SYNC_FIELDS));
    const RELATION_COMPONENT_FIELDS=new Set(['职业','状态','血统','装备','技能','形态库']);
    // 只有会永久改变角色战斗构筑的字段要求进入审计名单；状态/当前形态及档案文字仍可因真实剧情变化正常同步。
    const RELATION_AUDIT_ONLY_FIELDS=new Set(['职业','血统','装备','技能','形态库']);
    const RELATION_ATTR_KEYS=['力量','敏捷','体质','精神','魅力','ATK','DEF','MATK','MDEF','AP'];
    const RELATION_ATTR5=['力量','敏捷','体质','精神','魅力'];
    const NPC_BUILD_AUDIT_LIMIT=4;
    const WORLD_RESULT_LISTS=['事件','人物','势力地区','历史','传播','势力','探索','资产','异端','关系'];
    const WORLD_RESULT_RUMORS=['街头巷议','情报交易','布告与檄文'];
    const RESULT_OPERATIONS=new Set(['更新','移除','撤销本轮']);
    function schemaFromSample(sample) {
        if(Array.isArray(sample))return {type:'array',items:sample.length?schemaFromSample(sample[0]):{type:'string'}};
        if(plain(sample)){
            const properties=Object.fromEntries(Object.entries(sample).map(([key,value])=>[key,schemaFromSample(value)]));
            return {type:'object',properties,additionalProperties:false};
        }
        if(typeof sample==='number')return {type:'number'};
        if(typeof sample==='boolean')return {type:'boolean'};
        return {type:'string'};
    }
    function namedEntitySchema(sample,operations=['更新','撤销本轮'],requiredFields=[]) {
        const properties={名称:{type:'string',minLength:1},操作:{type:'string',enum:operations}};
        for(const [key,value] of Object.entries(sample||{}))properties[key]=schemaFromSample(value);
        return {type:'object',properties,required:['名称',...requiredFields],additionalProperties:false};
    }
    const FACTION_RESULT_SCHEMA=namedEntitySchema(EXISTING.势力);
    FACTION_RESULT_SCHEMA.properties.实力={type:'string',enum:copy(QUALITY_RANKS)};
    FACTION_RESULT_SCHEMA.properties.声望={type:'number',minimum:-5000,maximum:10000};
    const EXPLORATION_RESULT_SCHEMA=namedEntitySchema(EXISTING.探索);
    EXPLORATION_RESULT_SCHEMA.properties.风险={type:'string',enum:copy(QUALITY_RANKS)};
    EXPLORATION_RESULT_SCHEMA.properties.探索度={type:'number',minimum:0,maximum:100};
    const EVENT_RESULT_SCHEMA=namedEntitySchema({...RECORDS.事件,...MODEL_DETAILS.事件});
    EVENT_RESULT_SCHEMA.properties.状态={type:'string',enum:['待发生','进行中','已完成','已取消']};
    EVENT_RESULT_SCHEMA.properties.分类={type:'string',enum:Array.from(EVENT_CATEGORIES)};
    const OFFSET_RESULT_SCHEMA=namedEntitySchema(EXISTING.偏移记录);
    OFFSET_RESULT_SCHEMA.properties.影响程度={type:'number',minimum:-100,maximum:120};
    const STREET_RUMOR_RESULT_SCHEMA=namedEntitySchema(EXISTING.街头巷议,['更新','移除','撤销本轮'],['来源','内容','可信度']);
    STREET_RUMOR_RESULT_SCHEMA.properties.可信度={type:'string',enum:copy(RUMOR_CREDIBILITY)};
    const INTEL_TRADE_RESULT_SCHEMA=namedEntitySchema(EXISTING.情报交易,['更新','移除','撤销本轮'],['卖家','情报评级','摘要','要价','真实内幕']);
    INTEL_TRADE_RESULT_SCHEMA.properties.情报评级={type:'string',enum:copy(INTEL_RATINGS)};
    const relationQualitySchema=()=>({type:'string',enum:copy(RELATION_QUALITIES)});
    const relationTagsSchema=()=>({type:'array',maxItems:24,items:{type:'string'}});
    const relationStringMapSchema=()=>({type:'object',additionalProperties:{type:'string'}});
    const relationRawAttrSchema=(requireFive=false,allowNumbers=false)=>{
        const properties={};
        for(const key of RELATION_ATTR_KEYS)properties[key]=allowNumbers?{anyOf:[relationQualitySchema(),{type:'number'}]}:relationQualitySchema();
        return {type:'object',additionalProperties:false,properties,required:requireFive?copy(RELATION_ATTR5):undefined};
    };
    const RELATION_SKILL_SCHEMA={type:'object',additionalProperties:false,required:['品质','类型','标签','效果','描述','消耗'],properties:{
        品质:relationQualitySchema(),类型:{type:'integer',minimum:0,maximum:2},标签:relationTagsSchema(),
        效果:relationStringMapSchema(),描述:{type:'string'},消耗:{type:'string'}
    }};
    const RELATION_OCCUPATION_SCHEMA={type:'object',additionalProperties:false,required:['类型','特性','来源'],properties:{
        类型:{type:'string',enum:['战斗','生活','辅助']},特性:relationTagsSchema(),来源:{type:'string'}
    }};
    const RELATION_BLOODLINE_SCHEMA={type:'object',additionalProperties:false,required:['品质','标签','原始属性','效果','描述'],properties:{
        品质:relationQualitySchema(),标签:relationTagsSchema(),原始属性:relationRawAttrSchema(true,false),
        效果:relationStringMapSchema(),描述:{type:'string'}
    }};
    const RELATION_EQUIP_SCHEMA={type:'object',additionalProperties:false,required:['品质','类型','标签','原始属性','效果','描述','消耗','状态'],properties:{
        品质:relationQualitySchema(),类型:{type:'integer',minimum:0,maximum:8},标签:relationTagsSchema(),
        原始属性:relationRawAttrSchema(false,false),效果:relationStringMapSchema(),描述:{type:'string'},消耗:{type:'string'},
        状态:{type:'integer',minimum:0,maximum:2}
    }};
    const RELATION_STATUS_SCHEMA={type:'object',additionalProperties:false,required:['类型','品质','持续','来源','原始属性','效果'],properties:{
        类型:{type:'string',enum:['增益','减益','特殊']},品质:relationQualitySchema(),持续:{type:'string'},来源:{type:'string'},
        原始属性:relationRawAttrSchema(false,true),效果:{type:'string'}
    }};
    const RELATION_FORM_SCHEMA={type:'object',additionalProperties:false,required:['层级','消耗','冷却','状态','标签','原始属性','效果','技能','描述'],properties:{
        层级:{type:'string',enum:copy(RELATION_RANKS)},消耗:{type:'string'},冷却:{type:'string'},状态:{type:'string'},标签:relationTagsSchema(),
        原始属性:relationRawAttrSchema(true,false),效果:relationStringMapSchema(),
        技能:{type:'object',additionalProperties:copy(RELATION_SKILL_SCHEMA),maxProperties:8},描述:{type:'string'}
    }};
    const RELATION_CURRENT_FORM_SCHEMA={type:'object',additionalProperties:false,required:['激活','名称'],properties:{激活:{type:'boolean'},名称:{type:'string'}}};
    const ASSET_RESULT_SCHEMA={
        type:'object',additionalProperties:false,required:['名称'],properties:{
            名称:{type:'string',minLength:1},操作:{type:'string',enum:['更新','移除','撤销本轮']},
            所属对象:{type:'string',minLength:1},类型:{type:'string'},主体规模:{type:'number',minimum:1,maximum:10},完整度:{type:'number',minimum:0,maximum:100},状态:{type:'string'},
            能源:{anyOf:[{type:'object',additionalProperties:false,properties:{类型:{type:'string'},当前:{type:'number'},上限:{type:'number'},描述:{type:'string'}}},{type:'null'}]},
            消耗单元:{type:'object',additionalProperties:{anyOf:[{type:'object',additionalProperties:false,properties:{余量:{type:'number'},上限:{type:'number'},加成:{type:'array',items:{type:'string'}}}},{type:'null'}]}},
            建设序列:{type:'object',additionalProperties:{anyOf:[{type:'object',additionalProperties:false,properties:{阶段:{type:'string',enum:['基础','进阶','专业','顶尖','禁忌']},功能:{type:'string'},加成:{type:'array',items:{type:'string'}},产出:{type:'string'}}},{type:'null'}]}},
            驻扎人员:{type:'object',additionalProperties:{anyOf:[{type:'string'},{type:'null'}]}},
            待办事件:{type:'array',items:{type:'string'}}
        }
    };
    const WORLD_RESULT_SCHEMA={
        type:'object',
        additionalProperties:false,
        required:['摘要'],
        properties:{
            摘要:{type:'string'},
            货币:{type:'object',additionalProperties:false,properties:{
                体系:{type:'string'},
                购买力基准:{type:'string'},
                经济波动:{type:'string'}
            }},
            历法:{type:'object',additionalProperties:false,properties:{
                名称:{type:'string'},
                月份天数:{type:'array',maxItems:24,items:{type:'integer',minimum:1,maximum:99}},
                闰年规则:{type:'string'}
            }},
            事件:{type:'array',maxItems:30,items:EVENT_RESULT_SCHEMA},
            人物:{type:'array',maxItems:25,items:namedEntitySchema({...RECORDS.人物,...MODEL_DETAILS.人物})},
            势力地区:{type:'array',maxItems:20,items:namedEntitySchema({...RECORDS.势力地区,...MODEL_DETAILS.势力地区})},
            历史:{type:'array',maxItems:12,items:namedEntitySchema(RECORDS.历史,['更新','撤销本轮'])},
            传播:{type:'array',maxItems:20,items:namedEntitySchema({...RECORDS.传播,...MODEL_DETAILS.传播},['更新','移除','撤销本轮'])},
            因果:{type:'object',additionalProperties:false,properties:{
                当前阶段:{type:'string'},
                宏观顺序:{type:'array',minItems:0,maxItems:5,items:{type:'string'}},
                偏移记录:{type:'array',maxItems:10,items:OFFSET_RESULT_SCHEMA}
            }},
            势力:{type:'array',maxItems:15,items:FACTION_RESULT_SCHEMA},
            探索:{type:'array',maxItems:20,items:EXPLORATION_RESULT_SCHEMA},
            资产:{type:'array',maxItems:20,items:ASSET_RESULT_SCHEMA},
            异端:{type:'array',maxItems:15,items:{type:'object',additionalProperties:false,required:['名称','状态'],properties:{名称:{type:'string',minLength:1},操作:{type:'string',enum:['更新','撤销本轮']},状态:{type:'string',enum:['活跃','死亡']}}}},
            传闻:{type:'object',additionalProperties:false,properties:{
                街头巷议:{type:'array',maxItems:3,items:STREET_RUMOR_RESULT_SCHEMA},
                情报交易:{type:'array',maxItems:3,items:INTEL_TRADE_RESULT_SCHEMA},
                布告与檄文:{type:'array',maxItems:3,items:namedEntitySchema(EXISTING.布告与檄文,['更新','移除','撤销本轮'],['发布者','内容','张贴位置'])}
            }},
            关系:{type:'array',maxItems:25,items:{type:'object',additionalProperties:false,required:['名称'],properties:{
                名称:{type:'string',minLength:1},操作:{type:'string',enum:['更新','撤销本轮']},
                在场:{type:'boolean'},种族:{type:'string'},身份:relationTagsSchema(),
                职业:{type:'object',additionalProperties:copy(RELATION_OCCUPATION_SCHEMA),maxProperties:12},
                层级:{type:'string',enum:copy(RELATION_RANKS)},HP:{type:'number',minimum:0,maximum:99999999},
                THP:{type:'number',minimum:0,maximum:99999999},EP:{type:'number',minimum:0,maximum:99999999},
                状态:{type:'object',additionalProperties:copy(RELATION_STATUS_SCHEMA),maxProperties:12},
                血统:{type:'object',additionalProperties:copy(RELATION_BLOODLINE_SCHEMA),maxProperties:2},
                装备:{type:'object',additionalProperties:copy(RELATION_EQUIP_SCHEMA),maxProperties:6},
                技能:{type:'object',additionalProperties:copy(RELATION_SKILL_SCHEMA),maxProperties:4},
                形态库:{type:'object',additionalProperties:copy(RELATION_FORM_SCHEMA),maxProperties:4},
                当前形态:copy(RELATION_CURRENT_FORM_SCHEMA),
                性格:{type:'string'},喜爱:{type:'string'},外貌:{type:'string'},着装:{type:'string'},
                是否队友:{type:'boolean'},好感度:{type:'number',minimum:-100,maximum:100},态度:{type:'string'},背景故事:{type:'string'}
            }}}
        }
    };
    function sampleForWorldResultList(key) {
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
    function detailTextField(sample) {
        for(const key of ['名称','事实','行动','影响','内容','说明','问题','对象','地点']){
            if(Object.hasOwn(sample||{},key)&&typeof sample[key]==='string')return key;
        }
        return Object.keys(sample||{}).find(key=>typeof sample[key]==='string')||'';
    }
    function normalizeStructuredDetail(value,sample) {
        const out=copy(sample||{});
        if(plain(value)){
            for(const key of Object.keys(sample||{})){
                if(Object.hasOwn(value,key))out[key]=normalizeResultField(value[key],sample[key]);
            }
            return out;
        }
        if(value!==undefined&&value!==null&&value!==''){
            const key=detailTextField(sample);
            if(key)out[key]=normalizeResultField(value,sample[key]);
        }
        return out;
    }
    function normalizeResultField(value,sample) {
        if(Array.isArray(sample)){
            const list=Array.isArray(value)?value:(value===undefined||value===null||value===''?[]:[value]);
            if(sample.length&&plain(sample[0]))return list.filter(item=>item!==undefined&&item!==null&&item!=='').map(item=>normalizeStructuredDetail(item,sample[0]));
            return list.map(copy);
        }
        if(plain(sample)){
            if(!plain(value))return copy(sample);
            const out=copy(sample);
            for(const key of Object.keys(sample))if(Object.hasOwn(value,key))out[key]=normalizeResultField(value[key],sample[key]);
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
    function normalizeNamedResultList(value,sample,allowedOps=['更新','撤销本轮']) {
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
            for(const key of fields)if(Object.hasOwn(raw,key))item[key]=normalizeResultField(raw[key],sample[key]);
            const id=nameKey(name),prev=map.get(id);
            if(item.操作==='撤销本轮'){map.delete(id);continue;}
            map.set(id,prev?Object.assign(prev,item):item);
        }
        return Array.from(map.values());
    }
    function normalizeAssetResultList(value) {
        const sourceList=Array.isArray(value)?value:plain(value)?Object.entries(value).map(([name,item])=>plain(item)?Object.assign({名称:name},copy(item)):{名称:name,操作:item==='移除'?'移除':'更新'}):[];
        const map=new Map(),stringFields=['所属对象','类型','状态'],numberFields=['主体规模','完整度'];
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
    function normalizeRelationResultList(value) {
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
    function normalizeWorldResult(value) {
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
            result[key]=normalizeNamedResultList(value[key],sampleForWorldResultList(key),operations);
        }
        result.资产=normalizeAssetResultList(value.资产);
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
        result.因果.偏移记录=normalizeNamedResultList(causal.偏移记录,EXISTING.偏移记录,['更新','撤销本轮']);
        result.传闻={};
        const rumors=plain(value.传闻)?value.传闻:{};
        for(const key of WORLD_RESULT_RUMORS){
            let list=normalizeNamedResultList(rumors[key],EXISTING[key],['更新','移除','撤销本轮']);
            if(key==='街头巷议'){
                for(const item of list)if(Object.hasOwn(item,'可信度'))item.可信度=normalizeRumorCredibility(item.可信度);
                const seen=new Set(),deduped=[];
                for(const item of list){
                    const signature=String(item.内容||'').replace(/\s+/g,' ').trim();
                    if(signature&&seen.has(signature))continue;
                    if(signature)seen.add(signature);
                    deduped.push(item);
                    if(deduped.length>=3)break;
                }
                list=deduped;
            }
            result.传闻[key]=list;
        }
        const relationSource=plain(value.关系)&&!Array.isArray(value.关系)
            ?Object.entries(value.关系).map(([name,item])=>plain(item)?Object.assign({名称:name},copy(item)):{名称:name,好感度:item})
            :value.关系;
        result.关系=normalizeRelationResultList(relationSource);
        return result;
    }
    function mergeNamedResultLists(base,incoming) {
        const map=new Map();
        for(const item of base||[])map.set(nameKey(item.名称),copy(item));
        for(const item of incoming||[]){
            const id=nameKey(item.名称);
            if(item.操作==='撤销本轮'){map.delete(id);continue;}
            map.set(id,Object.assign(map.get(id)||{},copy(item)));
        }
        return Array.from(map.values());
    }
    function mergeWorldResults(base,incoming) {
        const a=base?normalizeWorldResult(base):normalizeWorldResult({摘要:''});
        const b=normalizeWorldResult(incoming);
        const result={摘要:[a.摘要,b.摘要].filter(Boolean).filter((x,i,list)=>list.indexOf(x)===i).join('；')};
        result.货币=Object.assign({},a.货币||{},b.货币||{});
        result.历法=Object.assign({},a.历法||{},b.历法||{});
        for(const key of ['事件','人物','势力地区','历史','传播','势力','探索','资产','异端','关系'])result[key]=mergeNamedResultLists(a[key],b[key]);
        result.因果={
            偏移记录:mergeNamedResultLists(a.因果?.偏移记录,b.因果?.偏移记录)
        };
        if(Object.hasOwn(b.因果||{},'当前阶段'))result.因果.当前阶段=b.因果.当前阶段;
        else if(Object.hasOwn(a.因果||{},'当前阶段'))result.因果.当前阶段=a.因果.当前阶段;
        if(Array.isArray(b.因果?.宏观顺序)&&b.因果.宏观顺序.length)result.因果.宏观顺序=copy(b.因果.宏观顺序);
        else if(Array.isArray(a.因果?.宏观顺序))result.因果.宏观顺序=copy(a.因果.宏观顺序);
        result.传闻={};
        for(const key of WORLD_RESULT_RUMORS)result.传闻[key]=mergeNamedResultLists(a.传闻?.[key],b.传闻?.[key]);
        return result;
    }
    function worldResultFragments(value) {
        const result=normalizeWorldResult(value),fragments=[];
        const push=(label,body)=>fragments.push({label,result:Object.assign({摘要:''},body)});
        for(const [key,value] of Object.entries(result.货币||{}))push('货币/'+key,{货币:{[key]:copy(value)}});
        for(const [key,value] of Object.entries(result.历法||{}))push('历法/'+key,{历法:{[key]:copy(value)}});
        for(const key of ['事件','人物','势力地区','历史','传播','势力','探索','资产','异端']){
            for(const item of result[key]||[])push(key+'/'+item.名称,{[key]:[copy(item)]});
        }
        if(Object.hasOwn(result.因果||{},'当前阶段'))push('因果/当前阶段',{因果:{当前阶段:result.因果.当前阶段}});
        if(Array.isArray(result.因果?.宏观顺序)&&result.因果.宏观顺序.length)push('因果/宏观顺序',{因果:{宏观顺序:copy(result.因果.宏观顺序)}});
        for(const item of result.因果?.偏移记录||[])push('因果/偏移记录/'+item.名称,{因果:{偏移记录:[copy(item)]}});
        for(const key of WORLD_RESULT_RUMORS)for(const item of result.传闻?.[key]||[])push('传闻/'+key+'/'+item.名称,{传闻:{[key]:[copy(item)]}});
        for(const item of result.关系||[])push('关系/'+item.名称,{关系:[copy(item)]});
        return {摘要:result.摘要,fragments};
    }
    function shortSchemaValue(value) {
        if(value===undefined)return 'undefined';
        let raw;try{raw=JSON.stringify(value);}catch(_){raw=String(value);}
        if(raw===undefined)raw=String(value);
        return raw.length>140?raw.slice(0,137)+'…':raw;
    }
    function firstSchemaDifference(before,after,parts) {
        if(same(before,after))return null;
        if(plain(before)&&plain(after)){
            const keys=Array.from(new Set([...Object.keys(before),...Object.keys(after)]));
            for(const key of keys){
                const diff=firstSchemaDifference(before[key],after[key],parts.concat(key));
                if(diff)return diff;
            }
        }
        if(Array.isArray(before)&&Array.isArray(after)&&before.length===after.length){
            for(let i=0;i<before.length;i++){
                const diff=firstSchemaDifference(before[i],after[i],parts.concat(String(i)));
                if(diff)return diff;
            }
        }
        return {parts,before,after};
    }
    function schemaMismatchError(beforeState,afterState,patchPath) {
        const parts=tokens(patchPath),before=get(beforeState,parts),after=get(afterState,parts);
        const diff=firstSchemaDifference(before,after,parts)||{parts,before,after};
        return new Error('字段未通过完整 Schema 校验：'+pointer(diff.parts)+'（'+shortSchemaValue(diff.before)+' → '+shortSchemaValue(diff.after)+'）');
    }
    function stageWorldResult(stat,accepted,incoming,validate) {
        const split=worldResultFragments(incoming);
        let staged=accepted?mergeWorldResults(accepted,{摘要:split.摘要}):normalizeWorldResult({摘要:split.摘要});
        let pending=split.fragments.map(unit=>Object.assign({},unit,{error:null})),progress=true;
        while(pending.length&&progress){
            progress=false;
            const nextPending=[];
            for(const unit of pending){
                const candidate=mergeWorldResults(staged,unit.result);
                try{
                    const compiled=compileWorldResult(stat,candidate);
                    const built=materializeWorldUpdate(stat,[],compiled.patches);
                    if(typeof validate==='function'){
                        const checked=validate(built.next);
                        for(const patch of compiled.patches){
                            if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(built.next,tokens(patch.path))))throw schemaMismatchError(built.next,checked,patch.path);
                        }
                    }
                    staged=candidate;
                    progress=true;
                }catch(error){
                    unit.error=error;
                    nextPending.push(unit);
                }
            }
            pending=nextPending;
        }
        return {
            accepted:staged,
            rejected:pending.map(unit=>({片段:unit.label,原因:String(unit.error?.message||unit.error||'业务片段未通过校验')}))
        };
    }
    function retryPlanForFailure(error,rejected=[]) {
        const plan=[];
        for(const item of rejected||[])plan.push(item.片段+'：'+item.原因);
        const message=String(error?.message||error||'');
        let match=message.match(/宏观事件不足：需要至少3个可推进宏观节点（进行中\+待发生），当前仅(\d+)个（进行中(\d+)个，待发生(\d+)个）/);
        if(match){
            const current=Math.max(0,Number(match[1])||0),active=Math.max(0,Number(match[2])||0),future=Math.max(0,Number(match[3])||0),missing=Math.max(0,3-current);
            plan.push('宏观骨架：当前可推进宏观节点'+current+'个（进行中'+active+'、待发生'+future+'），还需补充至少'+missing+'个真正的待发生宏观节点；会合、撤离、赶路、局部争夺/突破等近期节点不计入宏观骨架，不要反复把它们改标为宏观节点。新增宏观事件必须给出可执行的时间/条件/前因。');
            plan.push('因果轨道：在保留已接受宏观节点的基础上，补写 因果.宏观顺序，使用最终3~5个仍可推进的宏观节点名称形成顺序。');
        }else if(/因果轨道未形成有效宏观投影/.test(message)){
            plan.push('因果轨道：不要重写已接受事件，只补写 因果.宏观顺序；长度必须3~5，且每个名称都必须对应已建立且未取消的宏观节点。');
        }else if((match=message.match(/到期事件未处理：([^。]+)/))){
            plan.push('到期事件/'+match[1]+'：本轮必须明确启动该事件，或更新本轮复核日期、阻碍条件与下次检查。');
        }else if((match=message.match(/事件时间锚点缺失或过于模糊：([^；]+)/))){
            plan.push('事件/'+match[1]+'：补写明确时间锚点；优先具体世界日期/时段，精确日期未知时写相对或因果时间，禁止空值和“近期/稍后/未来/待定/未知”。');
        }else if((match=message.match(/事件时间锚点仍未补全：([^；]+)/))){
            for(const name of match[1].split('、').filter(Boolean))plan.push('事件/'+name+'：补写明确时间锚点；优先具体世界日期/时段，精确日期未知时写相对或因果时间，禁止空值和“近期/稍后/未来/待定/未知”。');
        }else if((match=message.match(/超期活动事件仍未复核：([^；]+)/))){
            for(const name of match[1].split('、').filter(Boolean))plan.push('事件/'+name+'：该局部活动已远超正常持续窗口。若实际早已结束则改为已完成并补结果；若失效则已取消；只有确实仍持续时才保留进行中，并把更新时间写为当前世界时间、更新当前描述并填写下次检查。');
        }else if((match=message.match(/时间越界记录仍未修复：([^；]+)/))){
            plan.push('时间一致性：修复这些已经发生的记录，任何已完成/进行中事件、人物更新时间、地区已发生变化、历史与传播都不得晚于当前世界时间：'+match[1]);
        }else if((match=message.match(/异端活动未复核：([^；]+)/))){
            for(const name of match[1].split('、').filter(Boolean))plan.push('异端活动/'+name+'：在 WorldResult.人物 中补写该活跃异端本轮的地点、目标、行动，并把更新时间精确写为当前世界时间；若本轮已确认死亡，则只更新异端状态=死亡，不再提交人物活动。');
        }else if((match=message.match(/NPC构筑审计未推进：([^；]+)/))){
            for(const name of match[1].split('、').filter(Boolean))plan.push('NPC构筑审计/'+name+'：只在 WorldResult.关系 中补齐该既有NPC至少一个列出的构筑缺口；优先补职业/血统/装备/技能/状态/形态或缺失档案字段，不得新建NPC、改HP_MAX/EP_MAX或输出真属性/最终属性。');
        }else if(message&&!rejected.length){
            plan.push('整体校验：'+message);
        }
        return Array.from(new Set(plan.filter(Boolean)));
    }
    function makeRetryFailure(rejected,globalError) {
        const reasons=[];
        if(rejected?.length)reasons.push('部分业务片段未通过：'+rejected.map(x=>x.片段).join('、'));
        if(globalError)reasons.push(String(globalError.message||globalError));
        const error=new Error(reasons.join('；')||'WorldResult 未通过业务校验');
        error.retryPlan=retryPlanForFailure(globalError,rejected);
        error.rejectedSlices=copy(rejected||[]);
        return error;
    }
    const MICRO_EXPLORATION_SEGMENT=/^(?:天台|教室|走廊|楼梯|楼层|办公室|医务室|校医室|房间|寝室|宿舍房间|洗手间|浴室|食堂|门厅|入口|出口|校门|桥头|街口|小巷)$/;
    function explorationGranularity(name) {
        const raw=String(name||'').trim();
        if(!raw)return {invalid:true,parent:''};
        if(MICRO_EXPLORATION_SEGMENT.test(raw))return {invalid:true,parent:''};
        const parts=raw.split(/\s*(?:-|—|–|→|>|\/|／|·|・)\s*/).filter(Boolean);
        if(parts.length>1&&MICRO_EXPLORATION_SEGMENT.test(parts.at(-1)))return {invalid:true,parent:parts.slice(0,-1).join('-')};
        return {invalid:false,parent:''};
    }
    function repairExplorationGranularity(stat) {
        const bucket=stat?.世界?.探索;if(!plain(bucket))return [];
        const patches=[];
        for(const name of Object.keys(bucket)){
            const info=explorationGranularity(name);if(!info.invalid||!info.parent)continue;
            const child=bucket[name],parent=bucket[info.parent];
            const merged=plain(parent)
                ? Object.assign(copy(EXISTING.探索),copy(parent),{探索度:Math.max(Number(parent.探索度)||0,Number(child?.探索度)||0)})
                : Object.assign(copy(EXISTING.探索),{
                    风险:String(child?.风险||'F'),
                    探索度:Number(child?.探索度)||0,
                    描述:'由旧版子区域探索记录合并，待补充整体地标描述',
                    隐藏真相:''
                });
            bucket[info.parent]=merged;delete bucket[name];
            patches.push({op:parent?'replace':'add',path:pointer(['世界','探索',info.parent]),value:copy(merged)});
            patches.push({op:'remove',path:pointer(['世界','探索',name])});
        }
        return patches;
    }
    function resultFields(item,sample) {
        const out={};
        for(const key of Object.keys(sample||{}))if(Object.hasOwn(item,key))out[key]=copy(item[key]);
        return out;
    }
    function validateStringArray(value,label) {
        if(!Array.isArray(value)||value.some(x=>typeof x!=='string'))throw new Error(label+' 必须是 string[]');
    }
    function validateStringMap(value,label) {
        if(!plain(value)||Object.values(value).some(x=>typeof x!=='string'))throw new Error(label+' 必须是 string map');
    }
    function validateQuality(value,label) {
        if(!RELATION_QUALITIES.includes(String(value||'')))throw new Error(label+' 只允许 '+RELATION_QUALITIES.join('/'));
    }
    function validateRawAttributes(value,label,{requireFive=false,allowNumbers=false}={}) {
        if(!plain(value))throw new Error(label+' 必须是对象');
        for(const key of Object.keys(value)){
            if(!RELATION_ATTR_KEYS.includes(key))throw new Error(label+' 含非法属性 '+key);
            if(allowNumbers&&typeof value[key]==='number'&&Number.isFinite(value[key])){
                if(value[key]===0)throw new Error(label+'.'+key+' 数值0应省略，避免ZOD清洗后产生无效差异');
                continue;
            }
            validateQuality(value[key],label+'.'+key);
        }
        if(requireFive)for(const key of RELATION_ATTR5)if(!Object.hasOwn(value,key))throw new Error(label+' 缺少基础属性 '+key);
    }
    function validateComponentShape(field,value,name='NPC') {
        if(!plain(value))throw new Error(name+' '+field+' 必须是对象');
        const assertFields=(item,keys,label)=>{for(const key of keys)if(!Object.hasOwn(item,key))throw new Error(label+' 缺少字段 '+key);};
        for(const [entryName,item] of Object.entries(value)){
            const label=name+' '+field+'.'+entryName;
            if(!entryName||!plain(item))throw new Error(label+' 必须是完整对象');
            if(field==='职业'){
                assertFields(item,['类型','特性','来源'],label);
                if(!['战斗','生活','辅助'].includes(item.类型))throw new Error(label+' 类型无效');
                validateStringArray(item.特性,label+'.特性');
                if(typeof item.来源!=='string')throw new Error(label+'.来源 必须是 string');
            }else if(field==='技能'){
                assertFields(item,['品质','类型','标签','效果','描述','消耗'],label);
                validateQuality(item.品质,label+'.品质');
                if(!Number.isInteger(item.类型)||item.类型<0||item.类型>2)throw new Error(label+'.类型 只能是0/1/2');
                validateStringArray(item.标签,label+'.标签');validateStringMap(item.效果,label+'.效果');
                if(typeof item.描述!=='string'||typeof item.消耗!=='string')throw new Error(label+' 描述/消耗必须是 string');
            }else if(field==='血统'){
                assertFields(item,['品质','标签','原始属性','效果','描述'],label);
                validateQuality(item.品质,label+'.品质');validateStringArray(item.标签,label+'.标签');
                validateRawAttributes(item.原始属性,label+'.原始属性',{requireFive:true});validateStringMap(item.效果,label+'.效果');
                if(typeof item.描述!=='string')throw new Error(label+'.描述 必须是 string');
            }else if(field==='装备'){
                assertFields(item,['品质','类型','标签','原始属性','效果','描述','消耗','状态'],label);
                validateQuality(item.品质,label+'.品质');
                if(!Number.isInteger(item.类型)||item.类型<0||item.类型>8)throw new Error(label+'.类型 只能是0~8');
                if(!Number.isInteger(item.状态)||item.状态<0||item.状态>2)throw new Error(label+'.状态 只能是0/1/2');
                validateStringArray(item.标签,label+'.标签');validateRawAttributes(item.原始属性,label+'.原始属性');
                validateStringMap(item.效果,label+'.效果');
                if(typeof item.描述!=='string'||typeof item.消耗!=='string')throw new Error(label+' 描述/消耗必须是 string');
            }else if(field==='状态'){
                assertFields(item,['类型','品质','持续','来源','原始属性','效果'],label);
                if(!['增益','减益','特殊'].includes(item.类型))throw new Error(label+'.类型无效');
                validateQuality(item.品质,label+'.品质');validateRawAttributes(item.原始属性,label+'.原始属性',{allowNumbers:true});
                if(typeof item.持续!=='string'||typeof item.来源!=='string'||typeof item.效果!=='string')throw new Error(label+' 持续/来源/效果必须是 string');
            }else if(field==='形态库'){
                assertFields(item,['层级','消耗','冷却','状态','标签','原始属性','效果','技能','描述'],label);
                if(!RELATION_RANKS.includes(item.层级))throw new Error(label+'.层级无效');
                validateStringArray(item.标签,label+'.标签');validateRawAttributes(item.原始属性,label+'.原始属性',{requireFive:true});
                validateStringMap(item.效果,label+'.效果');
                for(const key of ['消耗','冷却','状态','描述'])if(typeof item[key]!=='string')throw new Error(label+'.'+key+' 必须是 string');
                validateComponentShape('技能',item.技能,label);
            }
        }
    }
    function validateRelationSyncValue(field,value,npc,name='NPC') {
        if(field==='在场'||field==='是否队友'){if(typeof value!=='boolean')throw new Error(name+' '+field+' 必须是 boolean');return;}
        if(['种族','性格','喜爱','外貌','着装','态度','背景故事'].includes(field)){if(typeof value!=='string')throw new Error(name+' '+field+' 必须是 string');return;}
        if(field==='身份'){validateStringArray(value,name+' 身份');return;}
        if(field==='层级'){if(!RELATION_RANKS.includes(value))throw new Error(name+' 层级只允许 '+RELATION_RANKS.join('/'));return;}
        if(RELATION_COMPONENT_FIELDS.has(field)){validateComponentShape(field,value,name);return;}
        if(field==='当前形态'){
            if(!plain(value)||typeof value.激活!=='boolean'||typeof value.名称!=='string')throw new Error(name+' 当前形态必须是 {激活:boolean,名称:string}');
            return;
        }
        if(['HP','THP','EP','好感度'].includes(field)){
            if(typeof value!=='number'||!Number.isFinite(value))throw new Error(name+' '+field+' 必须是有效数字');
            if(field==='好感度'&&(value<-100||value>100))throw new Error(name+' 好感度范围 -100~100');
            if(field!=='好感度'&&value<0)throw new Error(name+' '+field+' 不能小于0');
            if(field==='HP'&&Number.isFinite(Number(npc?.HP_MAX))&&value>Number(npc.HP_MAX))throw new Error(name+' HP 不能超过 HP_MAX');
            if(field==='EP'&&Number.isFinite(Number(npc?.EP_MAX))&&value>Number(npc.EP_MAX))throw new Error(name+' EP 不能超过 EP_MAX');
        }
    }
    function materializeRelationComponent(field,value) {
        const out=copy(value);
        if(['血统','装备','状态','形态库'].includes(field)&&plain(out)){
            for(const item of Object.values(out)){
                if(!plain(item))continue;
                item.真属性={};
            }
        }
        return out;
    }
    function mergeRelationComponent(field,oldValue,incoming) {
        if(!RELATION_COMPONENT_FIELDS.has(field))return materializeRelationComponent(field,incoming);
        const merged=plain(oldValue)?copy(oldValue):{};
        for(const [name,item] of Object.entries(incoming||{}))merged[name]=materializeRelationComponent(field,{[name]:item})[name];
        return merged;
    }

    const ASSET_DEFAULTS={所属对象:'<user>',类型:'',主体规模:1,完整度:100,状态:'',建设序列:{},驻扎人员:{},待办事件:[]};
    const ASSET_ENERGY_DEFAULTS={类型:'',当前:0,上限:0,描述:''};
    const ASSET_UNIT_DEFAULTS={余量:0,上限:0,加成:[]};
    const ASSET_BUILD_DEFAULTS={阶段:'基础',功能:'',加成:[],产出:'',下次产出日期:'',下次产出游天:0};
    function materializeAssetRecord(oldValue,item,isNew=false) {
        const oldAsset=plain(oldValue)?copy(oldValue):{},asset=Object.assign(copy(ASSET_DEFAULTS),oldAsset);
        if(!String(asset.所属对象||'').trim())asset.所属对象='<user>';
        if(isNew){
            if(!Object.hasOwn(item,'所属对象')||!String(item.所属对象||'').trim())throw new Error('新资产必须明确所属对象：'+item.名称);
            if(!Object.hasOwn(item,'类型')||!String(item.类型||'').trim())throw new Error('新资产必须明确类型：'+item.名称);
        }
        for(const field of ['所属对象','类型','主体规模','完整度','状态'])if(Object.hasOwn(item,field))asset[field]=copy(item[field]);
        if(Object.hasOwn(item,'能源')){
            if(item.能源===null)delete asset.能源;
            else asset.能源=Object.assign(copy(ASSET_ENERGY_DEFAULTS),plain(oldAsset.能源)?copy(oldAsset.能源):{},plain(item.能源)?copy(item.能源):{});
        }
        const mergeNamedMap=(field,defaults)=>{
            if(!Object.hasOwn(item,field))return;
            const merged=plain(oldAsset[field])?copy(oldAsset[field]):{};
            for(const [name,value] of Object.entries(item[field]||{})){
                if(forbidden.has(name))continue;
                if(value===null){delete merged[name];continue;}
                const previous=plain(merged[name])?copy(merged[name]):{};
                merged[name]=Object.assign(copy(defaults),previous,copy(value));
            }
            if(Object.keys(merged).length)asset[field]=merged;else delete asset[field];
        };
        mergeNamedMap('消耗单元',ASSET_UNIT_DEFAULTS);
        mergeNamedMap('建设序列',ASSET_BUILD_DEFAULTS);
        if(Object.hasOwn(item,'驻扎人员')){
            const merged=plain(oldAsset.驻扎人员)?copy(oldAsset.驻扎人员):{};
            for(const [name,value] of Object.entries(item.驻扎人员||{})){
                if(forbidden.has(name))continue;
                if(value===null)delete merged[name];else merged[name]=String(value??'');
            }
            asset.驻扎人员=merged;
        }
        if(Object.hasOwn(item,'待办事件'))asset.待办事件=copy(item.待办事件||[]);
        if(!plain(asset.建设序列))asset.建设序列={};
        if(!plain(asset.驻扎人员))asset.驻扎人员={};
        if(!Array.isArray(asset.待办事件))asset.待办事件=[];
        return asset;
    }

    function compileWorldResult(stat,value) {
        const result=normalizeWorldResult(value),patches=[],warnings=[];
        const exists=parts=>get(stat,canonicalizeParts(parts,stat));
        const addEntity=(parts,item,sample,options={})=>{
            if(item.操作==='撤销本轮')return;
            let actual=canonicalizeParts(parts,stat),old=get(stat,actual);
            if(item.操作==='移除'){
                if(old!==undefined&&options.removable)patches.push({op:'remove',path:pointer(actual)});
                return;
            }
            const record=resultFields(item,sample);
            if(options.person&&!old&&!Object.hasOwn(record,'所属世界'))record.所属世界=stat.世界?.名称||'';
            if(options.event&&!Object.hasOwn(record,'描述'))record.描述=item.名称;
            if(options.event){
                const mergedEvent=Object.assign(copy(RECORDS.事件),plain(old)?old:{},record);
                if(['待发生','进行中'].includes(mergedEvent.状态)){
                    const anchor=eventTimeAnchor(mergedEvent);
                    if(!anchor||VAGUE_EVENT_TIME.test(anchor))throw new Error('事件时间锚点缺失或过于模糊：'+item.名称+'；请填写具体世界时间/时段，或明确相对/因果时间（如“爆发后数日”“前置节点完成后当日傍晚”），禁止空值和“近期/稍后/未来/待定/未知”');
                }
            }
            if(!Object.keys(record).length){warnings.push('忽略空业务记录：'+item.名称);return;}
            patches.push({op:old===undefined?'add':'replace',path:pointer(actual),value:record});
        };
        for(const [key,value] of Object.entries(result.货币||{})){
            const parts=['世界','货币',key],old=get(stat,parts);
            if(old!==value)patches.push({op:old===undefined?'add':'replace',path:pointer(parts),value});
        }
        for(const [key,value] of Object.entries(result.历法||{})){
            const parts=['世界','历法',key],old=get(stat,parts);
            if(!same(old,value))patches.push({op:old===undefined?'add':'replace',path:pointer(parts),value:copy(value)});
        }
        for(const item of result.事件)addEntity(['世界',PATH,'事件',item.名称],item,{...RECORDS.事件,...MODEL_DETAILS.事件},{event:true});
        const plannedDead=new Set((result.异端||[]).filter(item=>item.操作!=='撤销本轮'&&item.状态==='死亡').map(item=>nameKey(item.名称)));
        for(const item of result.人物){
            const alien=alienRosterMatch(stat,item.名称);
            if((alien&&alien.记录?.状态==='死亡')||plannedDead.has(nameKey(item.名称))){warnings.push('异端已死亡，禁止恢复后台人物：'+item.名称);continue;}
            addEntity(['世界',PATH,'人物',item.名称],item,{...RECORDS.人物,...MODEL_DETAILS.人物},{person:true});
        }
        for(const item of result.势力地区)addEntity(['世界',PATH,'势力地区',item.名称],item,{...RECORDS.势力地区,...MODEL_DETAILS.势力地区});
        for(const item of result.传播)addEntity(['世界',PATH,'传播',item.名称],item,{...RECORDS.传播,...MODEL_DETAILS.传播},{removable:true});
        for(const item of result.历史){
            if(item.操作==='撤销本轮')continue;
            let name=item.名称,parts=['世界',PATH,'历史',name],record=resultFields(item,RECORDS.历史);
            if(!Object.keys(record).length){warnings.push('忽略空历史记录：'+name);continue;}
            if(get(stat,parts)!==undefined){
                const old=get(stat,parts);
                if(same(normalizeBackendRecord('历史',record,old),old))continue;
                let n=2;while(get(stat,['世界',PATH,'历史',name+'#'+n])!==undefined)n++;
                name=name+'#'+n;parts=['世界',PATH,'历史',name];
            }
            patches.push({op:'add',path:pointer(parts),value:record});
        }
        const causal=result.因果||{};
        if(Object.hasOwn(causal,'当前阶段')){
            const parts=['世界','因果轨道','当前阶段'],old=get(stat,parts);
            patches.push({op:old===undefined?'add':'replace',path:pointer(parts),value:causal.当前阶段});
        }
        if(Array.isArray(causal.宏观顺序)&&causal.宏观顺序.length>=3&&causal.宏观顺序.length<=5){
            const parts=['世界','因果轨道','故事线'],story=causal.宏观顺序.join(' -> '),old=get(stat,parts);
            patches.push({op:old===undefined?'add':'replace',path:pointer(parts),value:story});
        } else if(Array.isArray(causal.宏观顺序)&&causal.宏观顺序.length)warnings.push('宏观顺序不足3个，等待补齐后再投影因果轨道');
        for(const item of causal.偏移记录||[]){
            if((stat.设置||{}).世界超稳){warnings.push('世界超稳：忽略偏移 '+item.名称);continue;}
            addEntity(['世界','因果轨道','偏移记录',item.名称],item,EXISTING.偏移记录);
        }
        for(const item of result.势力)addEntity(['世界','势力',item.名称],item,EXISTING.势力);
        for(const item of result.资产||[]){
            if(item.操作==='撤销本轮')continue;
            const target=stableNameIn(stat.资产||{},item.名称),existing=target?(stat.资产||{})[target]:undefined;
            if(item.操作==='移除'){
                if(target)patches.push({op:'remove',path:pointer(['资产',target])});
                else warnings.push('资产对象不存在，忽略移除：'+item.名称);
                continue;
            }
            const finalName=target||item.名称;
            const record=materializeAssetRecord(existing,item,!target);
            if(existing&&same(existing,record))continue;
            patches.push({op:target?'replace':'add',path:pointer(['资产',finalName]),value:record});
        }
        for(const item of result.探索){
            const granularity=explorationGranularity(item.名称);
            if(granularity.invalid)throw new Error('探索粒度过细：'+item.名称+'。世界.探索只记录整体地标/区域'+(granularity.parent?'，请改为“'+granularity.parent+'”并把微观进展累加到主区域':'，禁止把天台、教室、走廊、房间等子区域作为独立探索项'));
            const old=(stat.世界?.探索||{})[item.名称];
            if(old&&Object.hasOwn(item,'探索度')&&Number(item.探索度)<Number(old.探索度||0))throw new Error('探索度不能无因回退：'+item.名称+' '+old.探索度+' -> '+item.探索度);
            addEntity(['世界','探索',item.名称],item,EXISTING.探索);
        }
        if(!(stat.设置||{}).单一世界)for(const item of result.异端){
            if(item.操作==='撤销本轮')continue;
            const roster=stat.世界?.异端雷达?.名单||{},target=stableNameIn(roster,item.名称);
            if(!target){warnings.push('异端名单对象不存在，禁止世界引擎新增：'+item.名称);continue;}
            const oldStatus=roster[target]?.状态;
            if(oldStatus==='死亡'&&item.状态!=='死亡'){warnings.push('死亡异端状态不可逆：'+target);continue;}
            if(oldStatus===item.状态)continue;
            patches.push({op:'replace',path:pointer(['世界','异端雷达','名单',target,'状态']),value:item.状态});
        } else if(result.异端.length)warnings.push('单一世界：忽略异端雷达更新');
        for(const key of WORLD_RESULT_RUMORS)for(const item of result.传闻[key])addEntity(['传闻',key,item.名称],item,EXISTING[key],{removable:true});
        const auditNames=new Set(npcBuildAudit(stat).map(item=>nameKey(item.名称)));
        for(const item of result.关系||[]){
            if(item.操作==='撤销本轮')continue;
            const target=stableNameIn(stat.关系列表||{},item.名称);
            if(!target){warnings.push('关系对象不存在，禁止世界引擎新建：'+item.名称);continue;}
            const npc=stat.关系列表[target],fields=resultFields(item,RELATION_SYNC_FIELDS);
            if(!Object.keys(fields).length){warnings.push('忽略空关系更新：'+target);continue;}
            for(const [field,value] of Object.entries(fields)){
                if(RELATION_AUDIT_ONLY_FIELDS.has(field)&&!auditNames.has(nameKey(target))){
                    warnings.push('NPC当前不在构筑审计名单，忽略构筑字段：'+target+'/'+field);
                    continue;
                }
                validateRelationSyncValue(field,value,npc,target);
                const nextValue=RELATION_COMPONENT_FIELDS.has(field)?mergeRelationComponent(field,npc?.[field],value):materializeRelationComponent(field,value);
                if(RELATION_COMPONENT_FIELDS.has(field)){
                    const count=Object.keys(nextValue||{}).length;
                    const limit=field==='血统'?2:field==='装备'?6:field==='技能'?4:field==='形态库'?4:12;
                    if(count>limit)throw new Error(target+' '+field+' 数量超过NPC生成规则上限 '+limit);
                }
                if(same(npc?.[field],nextValue))continue;
                patches.push({op:npc?.[field]===undefined?'add':'replace',path:pointer(['关系列表',target,field]),value:copy(nextValue)});
            }
        }
        return {result,patches,warnings};
    }

    function validateState(stat) {
        const state = stat.世界[PATH];
        for (const [category, template] of Object.entries(RECORDS)) {
            if (!plain(state[category]) || Object.keys(state[category]).length > 300) throw new Error(category + '记录过多或结构错误');
            for (const [name,value] of Object.entries(state[category])) {
                if (forbidden.has(name)) throw new Error('非法记录名');
                checkRecord(value,template,DETAILS[category]);
                checkDetails(value,DETAILS[category]);
            }
        }
        for (const [name,event] of Object.entries(state.事件)) {
            if (!['待发生','进行中','已完成','已取消'].includes(event.状态)) throw new Error('非法事件状态：'+name+' = '+String(event.状态||'空')+'；只允许 待发生/进行中/已完成/已取消');
            if (!EVENT_CATEGORIES.has(event.分类)) throw new Error('非法事件分类：'+name+' = '+String(event.分类||'空'));
            if (event.前因.some(id => !Object.hasOwn(state.事件,id))) throw new Error('事件前因不存在：' + name);
        }
        const calendar=plain(stat.世界?.历法)?stat.世界.历法:{};
        const monthDays=Array.isArray(calendar.月份天数)?calendar.月份天数:[];
        if(monthDays.length>24||monthDays.some(n=>!Number.isInteger(Number(n))||Number(n)<1||Number(n)>99))throw new Error('世界历法月份天数无效');
        const hasMonthDay=value=>/\d{1,2}\s*月\s*-?\s*\d{1,2}\s*日/.test(String(value||''));
        if(monthDays.length&&hasMonthDay(stat.世界.时间)&&!calendarDate(stat.世界.时间,calendar))throw new Error('世界时间违反历法月长：'+stat.世界.时间);
        if(monthDays.length){
            for(const [name,event] of Object.entries(state.事件)){
                for(const value of [event.时间,event.开始时间,event.结束时间]){
                    if(hasMonthDay(value)&&!calendarDate(value,calendar))throw new Error('事件日期违反世界历法：'+name+' = '+value);
                }
            }
        }
        const range = (v,min,max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
        for (const [name,item] of Object.entries(stat.世界.势力 || {})) if (!QUALITY_RANKS.includes(item.实力) || !range(item.声望,-5000,10000)) throw new Error('势力品质或声望越界：'+name+'，实力='+String(item.实力)+'，声望='+String(item.声望)+'；实力只允许 '+QUALITY_RANKS.join('/')+'，声望范围 -5000~10000');
        for (const [name,item] of Object.entries(stat.世界.探索 || {})) if (!QUALITY_RANKS.includes(item.风险) || !range(item.探索度,0,100)) throw new Error('探索品质或进度越界：'+name+'，风险='+String(item.风险)+'，探索度='+String(item.探索度)+'；风险只允许 '+QUALITY_RANKS.join('/')+'，探索度范围 0~100');
        for (const item of Object.values((stat.世界.因果轨道 || {}).偏移记录 || {})) if (!range(item.影响程度,-100,120)) throw new Error('因果偏移越界');
        for (const item of Object.values(stat.关系列表 || {})) if (!range(item.好感度,-100,100)) throw new Error('人物好感越界');
        for (const item of Object.values((stat.任务 || {}).列表 || {})) if (!['进行中','可交付','可结算','失败'].includes(item.状态)) throw new Error('任务状态无效');
        for (const item of Object.values((stat.任务 || {}).副本成就 || {})) if (!['未达成','已达成'].includes(item.状态)) throw new Error('成就状态无效');
        for (const category of ['街头巷议','情报交易','布告与檄文']) {
            const items = Object.values((stat.传闻 || {})[category] || {});
            if (items.length > 3) throw new Error('每类当前传闻最多3条');
            if (category === '街头巷议' && items.some(i => !['酒话','可疑','或许可信'].includes(i.可信度))) throw new Error('传闻可信度无效');
        }
        const visiting = new Set(), visited = new Set();
        function visit(name) {
            if (visiting.has(name)) throw new Error('事件前因形成循环');
            if (visited.has(name)) return;
            visiting.add(name); state.事件[name].前因.forEach(visit); visiting.delete(name); visited.add(name);
        }
        Object.keys(state.事件).forEach(visit);
        for (const category of ['人物','势力地区','传播']) {
            for (const record of Object.values(state[category])) if (record.关联事件.some(id => !Object.hasOwn(state.事件,id))) throw new Error('关联事件不存在');
        }
    }
    function applyPatches(stat, patches) {
        if (!Array.isArray(patches) || patches.length > 100) throw new Error('每轮最多 100 条补丁');
        const next = copy(stat);
        next.世界[PATH] = Object.assign(emptyState(), next.世界[PATH] || {});
        normalizeBackendState(next);
        for (const patch of patches) {
            if (!plain(patch) || !['add','replace','remove'].includes(patch.op)) throw new Error('不支持的补丁操作');
            let p = canonicalizeParts(tokens(patch.path),next);
            patch.path=pointer(p);
            if (!allowed(p,next)) throw new Error('禁止写入：' + patch.path);
            bootstrapBackendParent(next,p);
            const old = get(next,p);
            if (p[1] === PATH && p[2] === '历史' && (patch.op !== 'add' || old !== undefined)) throw new Error('历史只允许新增');
            // 世界模型经常把“首次设置”写成 replace；对允许创建的世界记录按 upsert 处理。
            if (patch.op !== 'add' && old === undefined && !canUpsertMissing(p,next)) throw new Error('目标不存在：' + patch.path);
            if (patch.op === 'remove' && !(p[0] === '传闻' || (p[1] === PATH && p[2] === '传播') || (p[0] === '资产' && p.length === 2))) throw new Error('仅可移除过期传播、传闻与已彻底消失的资产，其他记录使用状态结束');
            let value=patch.value;
            if (patch.op !== 'remove') {
                if (value === undefined) throw new Error('缺少补丁值');
                const category = p.length === 3 ? p[1] : p.length === 4 ? p[2] : '';
                if(p[0]==='世界'&&p[1]===PATH&&p.length===4&&Object.hasOwn(RECORDS,category)){
                    value=normalizeBackendRecord(category,value,old);
                    checkRecord(value,RECORDS[category],DETAILS[category]);
                    checkDetails(value,DETAILS[category]);
                } else if (EXISTING[category]) {
                    const schema=EXISTING[category];
                    if(plain(value)){
                        const merged=Object.assign(copy(schema),plain(old)?copy(old):{});
                        for(const key of Object.keys(schema))if(Object.hasOwn(value,key))merged[key]=copy(value[key]);
                        value=merged;
                    }
                    checkRecord(value,schema);
                    if(p[0]==='传闻'&&p[1]==='情报交易'&&!(next.系统状态||{}).是否在主神空间&&next.世界?.名称!=='主神空间'&&/空间币/.test(String(value.要价||'')))throw new Error('任务世界情报交易必须使用本地货币，不能使用空间币');
                }
                else if (old !== undefined && (typeof old !== typeof value || Array.isArray(old) !== Array.isArray(value))) throw new Error('字段类型发生改变');
                if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('数值无效');
                if (p[0] === '世界' && p[1] === '因果轨道' && p.length === 3 && typeof value !== 'string') throw new Error('因果摘要必须是文本');
                if (p[0] === '任务' && p[1] === '副本成就' && old === '已达成' && value !== old) throw new Error('不能回退已达成成就');
                if(p[0]==='关系列表'&&p.length===3)validateRelationSyncValue(p[2],value,next.关系列表?.[p[1]],p[1]);
                if (p[p.length-1] === '好感度' && Math.abs(value - old) > 20) throw new Error('单轮好感变动超过20');
            }
            let parent = next;
            for (const key of p.slice(0,-1)) {
                if (parent[key] === undefined) parent[key] = {};
                if (!plain(parent[key])) throw new Error('父路径不是对象');
                parent = parent[key];
            }
            if (patch.op === 'remove') delete parent[p.at(-1)]; else parent[p.at(-1)] = copy(value);
        }
        normalizeBackendState(next);
        normalizeEventLayers(next);
        validateTemporalWrites(stat,next,patches);
        validateState(next);
        for (const [name,item] of Object.entries(next.世界.势力 || {})) {
            const old = (stat.世界.势力 || {})[name];
            if (Math.abs(item.声望 - (old ? old.声望 : 0)) > 1000) throw new Error('单轮声望变动超过1000');
        }
        return next;
    }
    function materializeWorldUpdate(stat,seedPatches,modelPatches) {
        const work=copy(stat);
        work.世界[PATH]=Object.assign(emptyState(),work.世界[PATH]||{});
        normalizeBackendState(work);compactWorldLifecycle(work);
        const appliedSeeds=(seedPatches||[]).filter(p=>get(work,canonicalizeParts(tokens(p.path),work))===undefined);
        let next=applyPatches(work,appliedSeeds);
        next=applyPatches(next,modelPatches||[]);
        const explorationPatches=repairExplorationGranularity(next);
        const layerPatches=normalizeEventLayers(next);
        const causalPatches=repairCausalProjection(next);
        const predecessorPatches=repairMacroPredecessors(next);
        const linkPatches=repairExplicitEventLinks(next);
        compactWorldLifecycle(next);
        validateState(next);
        const repairPatches=[...explorationPatches,...layerPatches,...causalPatches,...predecessorPatches,...linkPatches];
        return {next,appliedSeeds,repairPatches};
    }
    function ensureDueHandled(next,dueList,worldTime) {
        for(const due of dueList||[]){
            const event=next.世界[PATH].事件[due.名称];
            if(!event)continue;
            if(event.状态==='待发生'&&(event.更新时间!==worldTime||!event.下次检查||!event.条件)){
                throw new Error('到期事件未处理：'+due.名称+'。需启动事件，或记录本轮复核日期、阻碍条件与下次检查。');
            }
        }
    }
    function unscheduledEvents(stat) {
        return Object.entries(stat?.世界?.[PATH]?.事件||{}).filter(([,event])=>{
            if(!['待发生','进行中'].includes(event?.状态))return false;
            const anchor=eventTimeAnchor(event);
            return !anchor||VAGUE_EVENT_TIME.test(anchor);
        }).map(([名称,event])=>({名称,分类:event.分类,状态:event.状态,条件:event.条件,前因:copy(event.前因||[]),当前时间:eventTimeAnchor(event)}));
    }
    function ensureEventTimeAnchors(next,required=[]) {
        const missing=[];
        for(const item of required||[]){
            const event=next?.世界?.[PATH]?.事件?.[item.名称];
            if(!event||!['待发生','进行中'].includes(event.状态))continue;
            const anchor=eventTimeAnchor(event);
            if(!anchor||VAGUE_EVENT_TIME.test(anchor))missing.push(item.名称);
        }
        if(missing.length)throw new Error('事件时间锚点仍未补全：'+missing.join('、')+'；请逐项补写具体世界日期/时段，或明确相对/因果时间，禁止空值和“近期/稍后/未来/待定/未知”');
    }
    function ensureStaleActiveHandled(next,required=[],worldTime='') {
        const now=worldDateKey(worldTime),state=next?.世界?.[PATH];
        const unresolved=[],resolved=[];
        for(const item of required||[]){
            const event=state?.事件?.[item.名称];
            if(!event)continue;
            if(['已完成','已取消'].includes(event.状态)){resolved.push(item.名称);continue;}
            const updated=worldDateKey(event.更新时间);
            if(event.状态==='进行中'&&updated!==null&&now!==null&&updated===now&&String(event.下次检查||'').trim())continue;
            unresolved.push(item.名称);
        }
        if(unresolved.length)throw new Error('超期活动事件仍未复核：'+unresolved.join('、')+'；局部事件跨越过长时间仍标记进行中，必须结束/取消，或更新到当前时间并填写下次检查');
        // 对“本轮刚刚确认早已结束”的陈旧局部事件绕过24小时展示宽限：
        // 清理人物/地区/传播的软引用；若没有活跃事件继续依赖它，则立即压成历史。
        for(const name of resolved){
            const event=state?.事件?.[name];if(!event)continue;
            detachEventSoftRefs(state,name);
            const hardRef=Object.entries(state.事件||{}).some(([other,record])=>other!==name&&!['已完成','已取消'].includes(record?.状态)&&Array.isArray(record?.前因)&&record.前因.includes(name));
            if(!hardRef)archiveFinishedEvent(next,state,name,event,[]);
        }
    }
    function ensureTemporalAnomaliesResolved(next,required=[]) {
        if(!(required||[]).length)return;
        const remaining=temporalAnomalies(next);
        const keys=new Set((required||[]).map(item=>item.类型+'\u0000'+item.名称));
        const bad=remaining.filter(item=>keys.has(item.类型+'\u0000'+item.名称));
        if(bad.length)throw new Error('时间越界记录仍未修复：'+bad.map(item=>item.类型+'/'+item.名称+'('+item.字段+'='+item.值+')').join('、'));
    }
    function ensureMacroBackbone(next,timeline,required=true) {
        if(!required||!timeline?.需要补充远期)return;
        const allMacro=Object.entries(next?.世界?.[PATH]?.事件||{}).filter(([,e])=>e.分类==='宏观节点'&&e.状态!=='已取消');
        const activeMacro=allMacro.filter(([,e])=>e.状态==='进行中');
        const futureMacro=allMacro.filter(([,e])=>e.状态==='待发生');
        const openMacro=allMacro.filter(([,e])=>['进行中','待发生'].includes(e.状态));
        if(openMacro.length<3)throw new Error('宏观事件不足：需要至少3个可推进宏观节点（进行中+待发生），当前仅'+openMacro.length+'个（进行中'+activeMacro.length+'个，待发生'+futureMacro.length+'个）');
        const stages=storyStages(next?.世界?.因果轨道?.故事线);
        const names=new Set(allMacro.map(([name])=>name));
        if(stages.length<3||stages.length>5||stages.some(name=>!names.has(name)))throw new Error('因果轨道未形成有效宏观投影：请用已建立的宏观节点生成3~5节点故事线');
    }

    function progressionAnchorChanged(before,after) {
        return before?.世界?.名称!==after?.世界?.名称||before?.世界?.时间!==after?.世界?.时间||!!before?.系统状态?.是否在主神空间!==!!after?.系统状态?.是否在主神空间;
    }
    function firstCompleteJsonObject(source) {
        const text=String(source||''),start=text.indexOf('{');
        if(start<0)return '';
        let depth=0,inString=false,escaped=false;
        for(let i=start;i<text.length;i++){
            const ch=text[i];
            if(inString){
                if(escaped)escaped=false;
                else if(ch==='\\')escaped=true;
                else if(ch==='"')inString=false;
                continue;
            }
            if(ch==='"'){inString=true;continue;}
            if(ch==='{')depth++;
            else if(ch==='}'){
                depth--;
                if(depth===0)return text.slice(start,i+1);
                if(depth<0)return '';
            }
        }
        return '';
    }
    function parseReply(text) {
        let source=String(text).trim();
        const block=source.match(/<world_update\s*>([\s\S]*?)<\/world_update>/i);
        if(block)source=block[1].trim();
        const fence=source.match(/\x60\x60\x60(?:json)?\s*([\s\S]*?)\x60\x60\x60/i);
        if(fence)source=fence[1].trim();
        let result;
        try {result=JSON.parse(source);}
        catch(error){
            const candidate=firstCompleteJsonObject(source);
            try {if(!candidate)throw error;result=JSON.parse(candidate);}
            catch(_){throw new Error('返回 JSON 无法解析：'+error.message+'；原始回复保留在请求检查。');}
        }
        if(!plain(result))throw new Error('回复必须是一个 JSON 对象');
        for(const key of ['WorldResult','world_result','world_update','result']){
            if(plain(result[key])&&Object.keys(result).length===1){result=result[key];break;}
        }
        if(Array.isArray(result.patches)&&typeof result.summary==='string'){
            return {kind:'legacy_patches',summary:result.summary,patches:result.patches};
        }
        const worldResult=normalizeWorldResult(result);
        return {kind:'world_result',summary:worldResult.摘要,worldResult};
    }
