    const WORLD_MODEL_IGNORED_PATHS = [
        /^\/任务(?:\/|$)/,
        /^\/系统状态\/待播报记录$/,
        /^\/世界\/后台\/(?:版本|已处理楼层|已处理时间|运行记录|最近变化)(?:\/|$)/,
        /^\/世界\/后台\/剧本(?:\/|$)/
    ];

    class WorldPatchPolicy {
        tokens(path) {
            if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('补丁路径必须以 / 开头');
            const parts = path.slice(1).split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
            if (parts.some(p => !p || forbidden.has(p))) throw new Error('补丁路径含非法键');
            return parts;
        }

        get(obj,parts) {
            return parts.reduce((v,key)=>v!=null&&Object.prototype.hasOwnProperty.call(v,key)?v[key]:undefined,obj);
        }

        pointer(parts) {
            return '/'+parts.map(p=>String(p).replace(/~/g,'~0').replace(/\//g,'~1')).join('/');
        }

        canonicalizeParts(parts,stat) {
            const p=parts.slice();
            if(p[0]==='世界'&&p[1]===PATH&&p[3]&&['人物','事件','势力地区'].includes(p[2])){
                const pools=[];
                const state=stat?.世界?.[PATH]||{};
                if(plain(state[p[2]]))pools.push(...Object.keys(state[p[2]]));
                if(p[2]==='人物'){
                    pools.push(...Object.keys(stat?.关系列表||{}));
                    pools.push(...Object.keys(stat?.世界?.异端雷达?.名单||{}));
                }
                const key=nameKey(p[3]),matches=[...new Set(pools)].filter(name=>nameKey(name)===key);
                if(matches.length===1)p[3]=matches[0];
            }
            return p;
        }

        bootstrapBackendParent(stat,parts) {
            if(parts[0]!=='世界'||parts[1]!==PATH||parts.length!==5)return;
            const category=parts[2],name=parts[3];
            if(!['事件','人物','势力地区','传播'].includes(category))return;
            const bucket=stat.世界[PATH][category]||(stat.世界[PATH][category]={});
            if(Object.hasOwn(bucket,name))return;
            const seed=category==='事件'?{描述:name}:category==='人物'?{所属世界:stat.世界.名称||'',地点:'',行动:''}:{};
            bucket[name]=this.normalizeBackendRecord(category,seed);
        }

        canUpsertMissing(parts,stat) {
            if(parts[0]==='世界'&&parts[1]===PATH){
                if(parts[2]==='历史'||parts[2]==='剧本')return false;
                if(parts.length===4&&['事件','人物','势力地区','传播'].includes(parts[2]))return true;
                if(parts.length===5&&['事件','人物','势力地区','传播'].includes(parts[2])&&!!this.get(stat,parts.slice(0,4)))return true;
            }
            if(parts[0]==='世界'&&parts[1]==='因果轨道'&&parts[2]==='偏移记录'&&parts.length===4)return true;
            if(parts[0]==='世界'&&['势力','探索'].includes(parts[1])&&parts.length===3)return true;
            if(parts[0]==='传闻'&&['街头巷议','情报交易','布告与檄文'].includes(parts[1])&&parts.length===3)return true;
            return false;
        }

        checkRecord(value,template,optional={}) {
            if(!plain(value))throw new Error('记录必须是完整对象，不能是文本或数组');
            const missing=Object.keys(template).filter(k=>!Object.hasOwn(value,k));
            const unknown=Object.keys(value).filter(k=>!Object.hasOwn(template,k)&&!Object.hasOwn(optional,k));
            if(missing.length||unknown.length)throw new Error('记录字段不完整或不受支持：'+(missing.length?'缺少 '+missing.join('、'):'')+(unknown.length?'；未知 '+unknown.join('、'):''));
            for(const [key,base] of Object.entries(template)){
                const v=value[key];
                if(Array.isArray(base)?!Array.isArray(v)||v.some(x=>typeof x!=='string'):typeof v!==typeof base)throw new Error('记录字段类型错误：'+key);
            }
        }

        checkDetails(value,optional) {
            for(const [key,base] of Object.entries(optional)){
                if(!Object.hasOwn(value,key))continue;
                const v=value[key];
                if(Array.isArray(base)){
                    if(!Array.isArray(v))throw new Error('明细需为列表：'+key);
                    if(base.length)v.forEach(item=>this.checkRecord(item,base[0]));
                    else if(v.some(item=>typeof item!=='string'))throw new Error('明细需为文本列表：'+key);
                }else if(typeof v!==typeof base)throw new Error('明细类型错误：'+key);
            }
        }

        normalizeBackendRecord(category,value,old) {
            if(!plain(value)||!Object.hasOwn(RECORDS,category))return value;
            const template=RECORDS[category],optional=DETAILS[category]||{};
            const out=Object.assign(copy(template),plain(old)?copy(old):{});
            for(const [key,item] of Object.entries(value)){
                if(Object.hasOwn(template,key)||Object.hasOwn(optional,key))out[key]=copy(item);
            }
            return out;
        }

        sanitizeModelPatches(patches) {
            if(!Array.isArray(patches))return patches;
            return patches.filter(p=>!(plain(p)&&typeof p.path==='string'&&WORLD_MODEL_IGNORED_PATHS.some(rule=>rule.test(p.path))));
        }

        normalizeModelPatches(patches) {
            if(!Array.isArray(patches))return patches;
            const out=[],esc=value=>String(value).replace(/~/g,'~0').replace(/\//g,'~1');
            for(const raw of patches){
                if(!plain(raw)){out.push(raw);continue;}
                const patch=copy(raw);
                if(typeof patch.path==='string')patch.path=patch.path.replace(/^\/世界\/因校轨道(?=\/|$)/,'/世界/因果轨道');
                if(patch.path==='/世界/因果轨道'&&patch.op!=='remove'&&plain(patch.value)){
                    for(const key of ['当前阶段','故事线','下一节点']){
                        if(Object.hasOwn(patch.value,key))out.push({op:'add',path:'/世界/因果轨道/'+key,value:copy(patch.value[key])});
                    }
                    if(plain(patch.value.偏移记录))for(const [name,value] of Object.entries(patch.value.偏移记录)){
                        out.push({op:'add',path:'/世界/因果轨道/偏移记录/'+esc(name),value:copy(value)});
                    }
                    continue;
                }
                if(patch.path==='/世界/因果轨道/偏移记录'&&patch.op!=='remove'&&plain(patch.value)){
                    for(const [name,value] of Object.entries(patch.value))out.push({op:'add',path:'/世界/因果轨道/偏移记录/'+esc(name),value:copy(value)});
                    continue;
                }
                out.push(patch);
            }
            return out;
        }

        allowed(parts,stat) {
            const [a,b,c,d]=parts;
            if(a==='世界'&&b===PATH){
                if(c==='剧本')return false;
                if(!Object.hasOwn(RECORDS,c)||!d)return false;
                if(c==='历史')return parts.length===4;
                return parts.length===4||(parts.length===5&&(Object.hasOwn(RECORDS[c],parts[4])||Object.hasOwn(DETAILS[c],parts[4])));
            }
            if(a==='世界'&&b==='因果轨道'){
                if(['当前阶段','故事线','下一节点'].includes(c))return parts.length===3;
                return !(stat.设置||{}).世界超稳&&c==='偏移记录'&&parts.length===4;
            }
            if(a==='世界'&&b==='货币')return parts.length===3&&Object.hasOwn(CURRENCY_FIELDS,c);
            if(a==='世界'&&b==='历法')return parts.length===3&&Object.hasOwn(CALENDAR_FIELDS,c);
            if(a==='世界'&&['势力','探索'].includes(b))return parts.length===3||(parts.length===4&&Object.hasOwn(b==='势力'?{实力:0,领地:0,描述:0,声望:0}:{风险:0,探索度:0,描述:0,隐藏真相:0},d));
            if(a==='世界'&&b==='异端雷达')return parts.length===5&&c==='名单'&&parts[4]==='状态'&&!(stat.设置||{}).单一世界;
            if(a==='传闻'&&['街头巷议','情报交易','布告与檄文'].includes(b))return parts.length===3;
            if(a==='资产')return parts.length===2&&!!b;
            if(a==='关系列表')return parts.length===3&&RELATION_SYNC_KEYS.has(c)&&!!this.get(stat,[a,b]);
            if(a==='任务')return parts.length===4&&['列表','副本成就'].includes(b)&&d==='状态'&&!!this.get(stat,[a,b,c]);
            return false;
        }
    }

    const DEFAULT_WORLD_PATCH_POLICY=new WorldPatchPolicy();
    let ACTIVE_WORLD_PATCH_POLICY=DEFAULT_WORLD_PATCH_POLICY;
    function tokens(path){return ACTIVE_WORLD_PATCH_POLICY.tokens(path);}
    function get(obj,parts){return ACTIVE_WORLD_PATCH_POLICY.get(obj,parts);}
    function pointer(parts){return ACTIVE_WORLD_PATCH_POLICY.pointer(parts);}
    function canonicalizeParts(parts,stat){return ACTIVE_WORLD_PATCH_POLICY.canonicalizeParts(parts,stat);}
    function bootstrapBackendParent(stat,parts){return ACTIVE_WORLD_PATCH_POLICY.bootstrapBackendParent(stat,parts);}
    function canUpsertMissing(parts,stat){return ACTIVE_WORLD_PATCH_POLICY.canUpsertMissing(parts,stat);}
    function checkRecord(value,template,optional={}){return ACTIVE_WORLD_PATCH_POLICY.checkRecord(value,template,optional);}
    function checkDetails(value,optional){return ACTIVE_WORLD_PATCH_POLICY.checkDetails(value,optional);}
    function normalizeBackendRecord(category,value,old){return ACTIVE_WORLD_PATCH_POLICY.normalizeBackendRecord(category,value,old);}
    function sanitizeModelPatches(patches){return ACTIVE_WORLD_PATCH_POLICY.sanitizeModelPatches(patches);}
    function normalizeModelPatches(patches){return ACTIVE_WORLD_PATCH_POLICY.normalizeModelPatches(patches);}
    function allowed(parts,stat){return ACTIVE_WORLD_PATCH_POLICY.allowed(parts,stat);}
