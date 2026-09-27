    class WorldRelationSyncPolicy {
        validateStringArray(value,label) {
            if(!Array.isArray(value)||value.some(x=>typeof x!=='string'))throw new Error(label+' 必须是 string[]');
        }
        validateStringMap(value,label) {
            if(!plain(value)||Object.values(value).some(x=>typeof x!=='string'))throw new Error(label+' 必须是 string map');
        }
        validateQuality(value,label) {
            if(!RELATION_QUALITIES.includes(String(value||'')))throw new Error(label+' 只允许 '+RELATION_QUALITIES.join('/'));
        }
        validateRawAttributes(value,label,{requireFive=false,allowNumbers=false}={}) {
            if(!plain(value))throw new Error(label+' 必须是对象');
            for(const key of Object.keys(value)){
                if(!RELATION_ATTR_KEYS.includes(key))throw new Error(label+' 含非法属性 '+key);
                if(allowNumbers&&typeof value[key]==='number'&&Number.isFinite(value[key])){
                    if(value[key]===0)throw new Error(label+'.'+key+' 数值0应省略，避免ZOD清洗后产生无效差异');
                    continue;
                }
                this.validateQuality(value[key],label+'.'+key);
            }
            if(requireFive)for(const key of RELATION_ATTR5)if(!Object.hasOwn(value,key))throw new Error(label+' 缺少基础属性 '+key);
        }
        validateComponentShape(field,value,name='NPC') {
            if(!plain(value))throw new Error(name+' '+field+' 必须是对象');
            const assertFields=(item,keys,label)=>{for(const key of keys)if(!Object.hasOwn(item,key))throw new Error(label+' 缺少字段 '+key);};
            for(const [entryName,item] of Object.entries(value)){
                const label=name+' '+field+'.'+entryName;
                if(!entryName||!plain(item))throw new Error(label+' 必须是完整对象');
                if(field==='职业'){
                    assertFields(item,['类型','特性','来源'],label);
                    if(!['战斗','生活','辅助'].includes(item.类型))throw new Error(label+' 类型无效');
                    this.validateStringArray(item.特性,label+'.特性');
                    if(typeof item.来源!=='string')throw new Error(label+'.来源 必须是 string');
                }else if(field==='技能'){
                    assertFields(item,['品质','类型','标签','效果','描述','消耗'],label);
                    this.validateQuality(item.品质,label+'.品质');
                    if(!Number.isInteger(item.类型)||item.类型<0||item.类型>2)throw new Error(label+'.类型 只能是0/1/2');
                    this.validateStringArray(item.标签,label+'.标签');this.validateStringMap(item.效果,label+'.效果');
                    if(typeof item.描述!=='string'||typeof item.消耗!=='string')throw new Error(label+' 描述/消耗必须是 string');
                }else if(field==='血统'){
                    assertFields(item,['品质','标签','原始属性','效果','描述'],label);
                    this.validateQuality(item.品质,label+'.品质');this.validateStringArray(item.标签,label+'.标签');
                    this.validateRawAttributes(item.原始属性,label+'.原始属性',{requireFive:true});this.validateStringMap(item.效果,label+'.效果');
                    if(typeof item.描述!=='string')throw new Error(label+'.描述 必须是 string');
                }else if(field==='装备'){
                    assertFields(item,['品质','类型','标签','原始属性','效果','描述','消耗','状态'],label);
                    this.validateQuality(item.品质,label+'.品质');
                    if(!Number.isInteger(item.类型)||item.类型<0||item.类型>8)throw new Error(label+'.类型 只能是0~8');
                    if(!Number.isInteger(item.状态)||item.状态<0||item.状态>2)throw new Error(label+'.状态 只能是0/1/2');
                    this.validateStringArray(item.标签,label+'.标签');this.validateRawAttributes(item.原始属性,label+'.原始属性');
                    this.validateStringMap(item.效果,label+'.效果');
                    if(typeof item.描述!=='string'||typeof item.消耗!=='string')throw new Error(label+' 描述/消耗必须是 string');
                }else if(field==='状态'){
                    assertFields(item,['类型','品质','持续','来源','原始属性','效果'],label);
                    if(!['增益','减益','特殊'].includes(item.类型))throw new Error(label+'.类型无效');
                    this.validateQuality(item.品质,label+'.品质');this.validateRawAttributes(item.原始属性,label+'.原始属性',{allowNumbers:true});
                    if(typeof item.持续!=='string'||typeof item.来源!=='string'||typeof item.效果!=='string')throw new Error(label+' 持续/来源/效果必须是 string');
                }else if(field==='形态库'){
                    assertFields(item,['层级','消耗','冷却','状态','标签','原始属性','效果','技能','描述'],label);
                    if(!RELATION_RANKS.includes(item.层级))throw new Error(label+'.层级无效');
                    this.validateStringArray(item.标签,label+'.标签');this.validateRawAttributes(item.原始属性,label+'.原始属性',{requireFive:true});
                    this.validateStringMap(item.效果,label+'.效果');
                    for(const key of ['消耗','冷却','状态','描述'])if(typeof item[key]!=='string')throw new Error(label+'.'+key+' 必须是 string');
                    this.validateComponentShape('技能',item.技能,label);
                }
            }
        }
        validateRelationSyncValue(field,value,npc,name='NPC') {
            if(field==='在场'||field==='是否队友'){if(typeof value!=='boolean')throw new Error(name+' '+field+' 必须是 boolean');return;}
            if(['种族','性格','喜爱','外貌','着装','态度','背景故事'].includes(field)){if(typeof value!=='string')throw new Error(name+' '+field+' 必须是 string');return;}
            if(field==='身份'){this.validateStringArray(value,name+' 身份');return;}
            if(field==='层级'){if(!RELATION_RANKS.includes(value))throw new Error(name+' 层级只允许 '+RELATION_RANKS.join('/'));return;}
            if(RELATION_COMPONENT_FIELDS.has(field)){this.validateComponentShape(field,value,name);return;}
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
        materializeRelationComponent(field,value) {
            const out=copy(value);
            if(['血统','装备','状态','形态库'].includes(field)&&plain(out)){
                for(const item of Object.values(out)){
                    if(!plain(item))continue;
                    item.真属性={};
                }
            }
            return out;
        }
        mergeRelationComponent(field,oldValue,incoming) {
            if(!RELATION_COMPONENT_FIELDS.has(field))return this.materializeRelationComponent(field,incoming);
            const merged=plain(oldValue)?copy(oldValue):{};
            for(const [name,item] of Object.entries(incoming||{}))merged[name]=this.materializeRelationComponent(field,{[name]:item})[name];
            return merged;
        }

        assertComponentLimit(field,value,name='NPC') {
            if(!RELATION_COMPONENT_FIELDS.has(field))return;
            const count=Object.keys(value||{}).length;
            const limit=field==='血统'?2:field==='装备'?6:field==='技能'?4:field==='形态库'?4:12;
            if(count>limit)throw new Error(name+' '+field+' 数量超过NPC生成规则上限 '+limit);
        }
    }

    const DEFAULT_WORLD_RELATION_SYNC_POLICY=new WorldRelationSyncPolicy();
