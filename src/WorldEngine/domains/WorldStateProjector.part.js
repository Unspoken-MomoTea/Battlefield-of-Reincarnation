    class WorldStateProjector {
        constructor(engine=null){this.engine=engine;}
        omitKeys(value,keys=[]){
            if(!plain(value))return copy(value);
            const out=copy(value);
            for(const key of keys)delete out[key];
            return out;
        }
        abilityMap(value){
            if(!plain(value))return {};
            const out={};
            for(const [name,item] of Object.entries(value)){
                if(!plain(item))continue;
                out[name]=this.omitKeys(item,['原始属性','最终属性','强化','真属性']);
            }
            return out;
        }
        equipped(value){
            if(!plain(value))return {};
            const out={};
            for(const [name,item] of Object.entries(value)){
                if(!plain(item)||Number(item.状态)!==1)continue;
                out[name]=this.omitKeys(item,['原始属性','最终属性','强化','真属性']);
            }
            return out;
        }
        carriedItems(value){
            if(!plain(value))return {};
            const out={};
            for(const [name,item] of Object.entries(value)){
                if(!plain(item)||Number(item.状态)===2)continue;
                out[name]=this.omitKeys(item,['原始属性','最终属性','强化','真属性']);
            }
            return out;
        }
        forms(value){
            if(!plain(value))return {};
            const out={};
            for(const [name,item] of Object.entries(value)){
                if(!plain(item))continue;
                out[name]=this.omitKeys(item,['原始属性','最终属性','强化','真属性']);
            }
            return out;
        }
        character(value){
            const source=plain(value)?value:{},out={};
            for(const key of ['在场','种族','身份','职业','层级','HP_MAX','HP','THP','EP_MAX','EP','性格','喜爱','外貌','着装','是否队友','好感度','态度','背景故事','数量']){
                if(Object.hasOwn(source,key))out[key]=copy(source[key]);
            }
            const 状态=this.abilityMap(source.状态),血统=this.abilityMap(source.血统),技能=this.abilityMap(source.技能);
            const 装备=this.equipped(source.装备),道具=this.carriedItems(source.道具),形态库=this.forms(source.形态库);
            if(Object.keys(状态).length)out.状态=状态;
            if(Object.keys(血统).length)out.血统=血统;
            if(Object.keys(技能).length)out.技能=技能;
            if(Object.keys(装备).length)out.装备=装备;
            if(Object.keys(道具).length)out.道具=道具;
            if(Object.keys(形态库).length)out.形态库=形态库;
            if(plain(source.当前形态))out.当前形态=copy(source.当前形态);
            return out;
        }
        assets(value){
            if(!plain(value))return {};
            const out={};
            for(const [name,asset] of Object.entries(value)){
                if(!plain(asset))continue;
                const item=copy(asset);
                if(plain(item.建设序列)){
                    for(const seq of Object.values(item.建设序列||{})){
                        if(!plain(seq))continue;
                        delete seq.下次产出日期;
                        delete seq.下次产出游天;
                    }
                }
                out[name]=item;
            }
            return out;
        }
        tailRecord(value,limit){
            if(!plain(value))return {};
            return Object.fromEntries(Object.entries(value).slice(-Math.max(0,Number(limit)||0)).map(([key,item])=>[key,copy(item)]));
        }
        causalOrbit(value,currentStability){
            const orbit=plain(value)?value:{},entries=Object.entries(orbit.偏移记录||{});
            const recent=entries.slice(-HOT_OFFSET_TARGET);
            const total=entries.reduce((sum,[,item])=>sum+(Number(item?.影响程度)||0),0);
            return {
                当前阶段:orbit.当前阶段,
                故事线:orbit.故事线,
                下一节点:orbit.下一节点,
                偏移记录:Object.fromEntries(recent.map(([name,item])=>[name,copy(item)])),
                偏移摘要:{
                    记录总数:entries.length,
                    隐藏旧记录数:Math.max(0,entries.length-recent.length),
                    累计影响:total,
                    当前稳定:currentStability
                }
            };
        }
        baseWorld(stat){
            const src=plain(stat)?stat:{},world=plain(src.世界)?src.世界:{},backend=plain(world[PATH])?world[PATH]:{};
            const projectedBackend={
                版本:backend.版本,
                已处理时间:backend.已处理时间,
                事件:copy(backend.事件||{}),
                人物:projectHotWorldPeople(src),
                势力地区:copy(backend.势力地区||{}),
                历史:this.tailRecord(backend.历史,HOT_HISTORY_TARGET),
                传播:this.tailRecord(backend.传播,HOT_PROPAGATION_TARGET)
            };
            for(const area of Object.values(projectedBackend.势力地区||{}))if(plain(area))delete area.资源点;
            const out={
                世界:{
                    时间:world.时间,
                    地点:world.地点,
                    名称:world.名称,
                    位格:world.位格,
                    难度:world.难度,
                    稳定:world.稳定,
                    法则:copy(world.法则||[]),
                    货币:copy(world.货币||{}),
                    历法:copy(world.历法||{}),
                    探索:copy(world.探索||{}),
                    势力:copy(world.势力||{}),
                    因果轨道:this.causalOrbit(world.因果轨道,world.稳定),
                    异端雷达:copy(world.异端雷达||{}),
                    [PATH]:projectedBackend
                },
                角色:this.character(src.角色),
                关系列表:{},
                资产:this.assets(src.资产),
                资产删除保护:Object.keys(backend.资产墓碑||{}).filter(name=>!stableNameIn(src.资产||{},name)).slice(-50),
                传闻:copy(src.传闻||{}),
                系统状态:{
                    是否战斗中:!!src.系统状态?.是否战斗中,
                    是否在主神空间:!!src.系统状态?.是否在主神空间
                },
                世界模式:{
                    单一世界:!!src.设置?.单一世界,
                    世界超稳:!!src.设置?.世界超稳
                }
            };
            for(const [name,person] of Object.entries(src.关系列表||{}))out.关系列表[name]=this.character(person);
            if(!Object.keys(out.角色||{}).length)delete out.角色;
            if(!Object.keys(out.关系列表).length)delete out.关系列表;
            if(!Object.keys(out.资产).length)delete out.资产;
            if(!out.资产删除保护.length)delete out.资产删除保护;
            if(!Object.keys(out.传闻).length)delete out.传闻;
            return out;
        }
        // Public service path keeps legacy task/history decorators until they are class-migrated.
        world(stat){return projectWorldContext(stat);}
    }

    const DEFAULT_WORLD_STATE_PROJECTOR=new WorldStateProjector();
    ACTIVE_WORLD_STATE_PROJECTOR=DEFAULT_WORLD_STATE_PROJECTOR;

