    const WORLD_ASSET_TYPES=['固定地产','大型载具','要塞'];
    const WORLD_ASSET_TYPE_SET=new Set(WORLD_ASSET_TYPES);
    const ITEMLIKE_ASSET_NAME=/(?:纹章|免疫|抗性|初解|技能|能力|药剂?|药水|圣水|解药|血清|试剂|瓶|钥匙|摇把|手柄|材料|矿石|零件|部件|残骸|卷轴|食物|口粮|弹药|消耗品|道具|护符|符文|芯片|样本)$/i;

    const ASSET_DEFAULTS={所属对象:[],类型:'',主体规模:1,完整度:100,状态:'',建设序列:{},驻扎人员:{},待办事件:[]};
    const ASSET_ENERGY_DEFAULTS={类型:'',当前:0,上限:0,描述:''};
    const ASSET_UNIT_DEFAULTS={余量:0,上限:0,加成:[]};
    const ASSET_BUILD_DEFAULTS={阶段:'基础',功能:'',加成:[],产出:'',下次产出日期:'',下次产出游天:0};

    class WorldAssetMaterializationPolicy {
        validateScope(item,isNew=false) {
            if(!isNew)return;
            const type=String(item?.类型||'').trim(),name=String(item?.名称||'').trim();
            if(!WORLD_ASSET_TYPE_SET.has(type))throw new Error('新资产类型非法：'+(name||'未命名')+'；资产只允许固定地产、大型载具或要塞，普通道具/材料/消耗品不得进入资产账簿');
            if(ITEMLIKE_ASSET_NAME.test(name))throw new Error('疑似道具被误写为资产：'+name+'；请写入角色道具/装备/形态等对应字段，不得写入资产');
        }

        normalizeOwners(value) {
            const source=Array.isArray(value)?value:(value===undefined?[]:[value]),out=[];
            for(const raw of source){
                const owner=String(raw??'').trim();
                if(!owner||owner==='无主'||out.includes(owner))continue;
                out.push(owner);
            }
            return out.slice(0,12);
        }

        materializeRecord(oldValue,item,isNew=false) {
            const oldAsset=plain(oldValue)?copy(oldValue):{},asset=Object.assign(copy(ASSET_DEFAULTS),oldAsset);
            // 旧资产没有所属对象时兼容为玩家资产；显式空数组则表示无主。
            asset.所属对象=Object.hasOwn(oldAsset,'所属对象')?this.normalizeOwners(oldAsset.所属对象):['<user>'];
            if(isNew){
                if(!Object.hasOwn(item,'所属对象'))throw new Error('新资产必须明确所属对象数组；无主资产请使用空数组：'+item.名称);
                if(!Object.hasOwn(item,'类型')||!String(item.类型||'').trim())throw new Error('新资产必须明确类型：'+item.名称);
            }
            if(Object.hasOwn(item,'所属对象'))asset.所属对象=this.normalizeOwners(item.所属对象);
            for(const field of ['类型','主体规模','完整度','状态'])if(Object.hasOwn(item,field))asset[field]=copy(item[field]);
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
    }

    const DEFAULT_WORLD_ASSET_MATERIALIZATION_POLICY=new WorldAssetMaterializationPolicy();
