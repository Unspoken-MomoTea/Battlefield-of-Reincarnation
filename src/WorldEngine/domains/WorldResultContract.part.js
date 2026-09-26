    class WorldResultContract {
        constructor(){this.schema=this.build();}
        schemaFromSample(sample) {
            if(Array.isArray(sample))return {type:'array',items:sample.length?this.schemaFromSample(sample[0]):{type:'string'}};
            if(plain(sample)){
                const properties=Object.fromEntries(Object.entries(sample).map(([key,value])=>[key,this.schemaFromSample(value)]));
                return {type:'object',properties,additionalProperties:false};
            }
            if(typeof sample==='number')return {type:'number'};
            if(typeof sample==='boolean')return {type:'boolean'};
            return {type:'string'};
        }
        namedEntitySchema(sample,operations=['更新','撤销本轮'],requiredFields=[]) {
            const properties={名称:{type:'string',minLength:1},操作:{type:'string',enum:operations}};
            for(const [key,value] of Object.entries(sample||{}))properties[key]=this.schemaFromSample(value);
            return {type:'object',properties,required:['名称',...requiredFields],additionalProperties:false};
        }
        build(){
        const FACTION_RESULT_SCHEMA=this.namedEntitySchema(EXISTING.势力);
        FACTION_RESULT_SCHEMA.properties.实力={type:'string',enum:copy(QUALITY_RANKS)};
        FACTION_RESULT_SCHEMA.properties.声望={type:'number',minimum:-5000,maximum:10000};
        const EXPLORATION_RESULT_SCHEMA=this.namedEntitySchema(EXISTING.探索);
        EXPLORATION_RESULT_SCHEMA.properties.风险={type:'string',enum:copy(QUALITY_RANKS)};
        EXPLORATION_RESULT_SCHEMA.properties.探索度={type:'number',minimum:0,maximum:100};
        const EVENT_RESULT_SCHEMA=this.namedEntitySchema({...RECORDS.事件,...MODEL_DETAILS.事件});
        EVENT_RESULT_SCHEMA.properties.状态={type:'string',enum:['待发生','进行中','已完成','已取消']};
        EVENT_RESULT_SCHEMA.properties.分类={type:'string',enum:Array.from(EVENT_CATEGORIES)};
        const PERSON_RESULT_SCHEMA=this.namedEntitySchema({...RECORDS.人物,...MODEL_DETAILS.人物});
        PERSON_RESULT_SCHEMA.properties.审计级别={type:'string',enum:copy(NPC_AUDIT_LEVELS)};
        const OFFSET_RESULT_SCHEMA=this.namedEntitySchema(EXISTING.偏移记录);
        OFFSET_RESULT_SCHEMA.properties.影响程度={type:'number',minimum:-100,maximum:120};
        const STREET_RUMOR_RESULT_SCHEMA=this.namedEntitySchema(EXISTING.街头巷议,['更新','移除','撤销本轮'],['来源','内容','可信度']);
        STREET_RUMOR_RESULT_SCHEMA.properties.可信度={type:'string',enum:copy(RUMOR_CREDIBILITY)};
        const INTEL_TRADE_RESULT_SCHEMA=this.namedEntitySchema(EXISTING.情报交易,['更新','移除','撤销本轮'],['卖家','情报评级','摘要','要价','真实内幕']);
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
        所属对象:{type:'array',items:{type:'string',minLength:1},maxItems:12},类型:{type:'string',enum:copy(WORLD_ASSET_TYPES)},主体规模:{type:'number',minimum:1,maximum:10},完整度:{type:'number',minimum:0,maximum:100},状态:{type:'string'},
        能源:{anyOf:[{type:'object',additionalProperties:false,properties:{类型:{type:'string'},当前:{type:'number'},上限:{type:'number'},描述:{type:'string'}}},{type:'null'}]},
        消耗单元:{type:'object',additionalProperties:{anyOf:[{type:'object',additionalProperties:false,properties:{余量:{type:'number'},上限:{type:'number'},加成:{type:'array',items:{type:'string'}}}},{type:'null'}]}},
        建设序列:{type:'object',additionalProperties:{anyOf:[{type:'object',additionalProperties:false,properties:{阶段:{type:'string',enum:['基础','进阶','专业','顶尖','禁忌']},功能:{type:'string'},加成:{type:'array',items:{type:'string'}},产出:{type:'string'}}},{type:'null'}]}},
        驻扎人员:{type:'object',additionalProperties:{anyOf:[{type:'string'},{type:'null'}]}},
        待办事件:{type:'array',items:{type:'string'}}
        }
        };
        const schema={
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
        人物:{type:'array',maxItems:25,items:PERSON_RESULT_SCHEMA},
        势力地区:{type:'array',maxItems:20,items:this.namedEntitySchema({...RECORDS.势力地区,...MODEL_DETAILS.势力地区})},
        历史:{type:'array',maxItems:12,items:this.namedEntitySchema(RECORDS.历史,['更新','撤销本轮'])},
        传播:{type:'array',maxItems:20,items:this.namedEntitySchema({...RECORDS.传播,...MODEL_DETAILS.传播},['更新','移除','撤销本轮'])},
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
        街头巷议:{type:'array',maxItems:6,items:STREET_RUMOR_RESULT_SCHEMA},
        情报交易:{type:'array',maxItems:6,items:INTEL_TRADE_RESULT_SCHEMA},
        布告与檄文:{type:'array',maxItems:6,items:this.namedEntitySchema(EXISTING.布告与檄文,['更新','移除','撤销本轮'],['发布者','内容','张贴位置'])}
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
        this.schemas={
            faction:FACTION_RESULT_SCHEMA,exploration:EXPLORATION_RESULT_SCHEMA,event:EVENT_RESULT_SCHEMA,person:PERSON_RESULT_SCHEMA,
            offset:OFFSET_RESULT_SCHEMA,streetRumor:STREET_RUMOR_RESULT_SCHEMA,intelTrade:INTEL_TRADE_RESULT_SCHEMA,
            relationSkill:RELATION_SKILL_SCHEMA,relationOccupation:RELATION_OCCUPATION_SCHEMA,relationBloodline:RELATION_BLOODLINE_SCHEMA,
            relationEquip:RELATION_EQUIP_SCHEMA,relationStatus:RELATION_STATUS_SCHEMA,relationForm:RELATION_FORM_SCHEMA,
            relationCurrentForm:RELATION_CURRENT_FORM_SCHEMA,asset:ASSET_RESULT_SCHEMA
        };
        return schema;
        }
    }
    const WORLD_RESULT_CONTRACT=new WorldResultContract();
    // Transitional aliases: legacy features still decorate component schemas at startup.
    const FACTION_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.faction;
    const EXPLORATION_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.exploration;
    const EVENT_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.event;
    const PERSON_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.person;
    const OFFSET_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.offset;
    const STREET_RUMOR_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.streetRumor;
    const INTEL_TRADE_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.intelTrade;
    const RELATION_SKILL_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationSkill;
    const RELATION_OCCUPATION_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationOccupation;
    const RELATION_BLOODLINE_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationBloodline;
    const RELATION_EQUIP_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationEquip;
    const RELATION_STATUS_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationStatus;
    const RELATION_FORM_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationForm;
    const RELATION_CURRENT_FORM_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationCurrentForm;
    const ASSET_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.asset;
    const WORLD_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schema;
