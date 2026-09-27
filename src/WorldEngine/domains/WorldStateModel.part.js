    class WorldRecordCatalog {
        constructor(){
            this.npcAuditLevels=['杂兵级','精英级','首领/Boss级'];
            this.records={
                事件:{描述:'',时间:'',条件:'',前因:[],状态:'待发生',默认走向:'',结果:'',公开征兆:'',地点:''},
                人物:{所属世界:'',审计级别:'',地点:'',目标:'',行动:'',认知:[],下次检查:'',关联事件:[],公开动态:''},
                势力地区:{类型:'地区',描述:'',目标:'',进展:'',下次检查:'',关联事件:[],公开动态:''},
                历史:{时间:'',事实:'',关联事件:[]},
                传播:{关联事件:[],来源:'',范围:'',时间:'',内容:'',真相:'',状态:'传播中'}
            };
            this.details={
                事件:{分类:'',开始时间:'',预计结束:'',更新时间:'',下次检查:'',参与者:[],关联任务:[],可见影响:[{时间:'',地点:'',影响:''}]},
                人物:{状态:'',更新时间:'',开始时间:'',预计结束:'',行程:[{开始:'',结束:'',地点:'',行动:'',状态:'',结果:''}],承诺:[{对象:'',内容:'',期限:'',解除条件:''}],待决事项:[{问题:'',选项:[],等待:''}],关系变化:[{对象:'',关系:'',变化:'',时间:''}],认知来源:[{事实:'',来源:'',获知时间:'',状态:''}],登场条件:'',背景关联:[{类型:'',名称:'',关系:''}]},
                势力地区:{更新时间:'',控制方:'',争夺方:[],资源:[{名称:'',数量:'',用途:'',限制:''}],内部派系:[{名称:'',立场:'',行动:'',影响:''}],近期变化:[{时间:'',事实:'',关联事件:''}],环境状态:[],现场群体:[{名称:'',规模:'',身份:'',动态:''}]},
                历史:{},
                传播:{更新时间:'',到期时间:'',受众:[],引发行动:[]}
            };
            this.modelRecords=copy(this.records);
            this.modelDetails=copy(this.details);
            for(const key of ['承诺','待决事项','关系变化'])delete this.modelDetails.人物[key];
        }
    }

    class WorldEntityIdentityPolicy {
        key(value){
            return String(value||'').toLowerCase().replace(/[\\/／·・._\-\s]+/g,'');
        }
        stableNameIn(bucket,name){
            if(!plain(bucket))return '';
            if(Object.hasOwn(bucket,name))return name;
            const key=this.key(name),matches=Object.keys(bucket).filter(item=>this.key(item)===key);
            return matches.length===1?matches[0]:'';
        }
        locationRelated(a,b){
            const x=this.key(a),y=this.key(b);if(!x||!y)return false;
            return x===y||x.includes(y)||y.includes(x);
        }
    }

    const DEFAULT_WORLD_RECORD_CATALOG=new WorldRecordCatalog();
    const DEFAULT_WORLD_ENTITY_IDENTITY_POLICY=new WorldEntityIdentityPolicy();

    const NPC_AUDIT_LEVELS=DEFAULT_WORLD_RECORD_CATALOG.npcAuditLevels;
    const RECORDS=DEFAULT_WORLD_RECORD_CATALOG.records;
    const DETAILS=DEFAULT_WORLD_RECORD_CATALOG.details;
    const MODEL_RECORDS=DEFAULT_WORLD_RECORD_CATALOG.modelRecords;
    const MODEL_DETAILS=DEFAULT_WORLD_RECORD_CATALOG.modelDetails;

    const nameKey=value=>DEFAULT_WORLD_ENTITY_IDENTITY_POLICY.key(value);
    function stableNameIn(bucket,name){return DEFAULT_WORLD_ENTITY_IDENTITY_POLICY.stableNameIn(bucket,name);}
    function worldLocationRelated(a,b){return DEFAULT_WORLD_ENTITY_IDENTITY_POLICY.locationRelated(a,b);}
