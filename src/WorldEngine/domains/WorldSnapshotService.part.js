    const WORLD_SNAPSHOT_STORAGE='samsara_world_engine_snapshots_v1';

    class WorldSnapshotService {
        constructor(engine,mutations=null){this.engine=engine;this.mutations=mutations;}
        storage(){return this.engine?.host?.localStorage||null;}
        chatId(snapshot){
            try{return String(JSON.parse(String(snapshot?.fingerprint||''))?.[0]??'');}catch(_){return '';}
        }
        readAll(){
            let raw=[];
            try{raw=JSON.parse(this.storage()?.getItem?.(WORLD_SNAPSHOT_STORAGE)||'[]');}catch(_){raw=[];}
            return (Array.isArray(raw)?raw:[]).filter(item=>plain(item)&&item.id&&plain(item.data)).slice(0,12);
        }
        writeAll(items){
            const clean=(Array.isArray(items)?items:[]).slice(0,12);
            try{this.storage()?.setItem?.(WORLD_SNAPSHOT_STORAGE,JSON.stringify(clean));}catch(error){throw new Error('保存世界快照失败：'+String(error?.message||error));}
            return clean;
        }
        list(){
            const snapshot=this.engine.snapshot(),chat=this.chatId(snapshot);
            return this.readAll().filter(item=>!chat||String(item.chatId||'')===chat);
        }
        create(name=''){
            const snapshot=this.engine.snapshot(),stat=snapshot.stat||{},world=stat.世界||{},chat=this.chatId(snapshot);
            const cleanName=String(name||'').trim().slice(0,80)||String(world.时间||'世界快照');
            const item={
                id:'ws-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),
                name:cleanName,
                createdAt:new Date().toISOString(),
                chatId:chat,
                worldName:String(world.名称||''),
                worldTime:String(world.时间||''),
                data:{
                    世界:copy(stat.世界||{}),
                    资产:copy(stat.资产||{}),
                    关系列表:copy(stat.关系列表||{}),
                    传闻:copy(stat.传闻||{})
                }
            };
            const rest=this.readAll().filter(old=>String(old.id)!==item.id);
            this.writeAll([item,...rest]);
            return copy(item);
        }
        remove(id){
            const before=this.readAll(),after=before.filter(item=>String(item.id)!==String(id||''));
            if(after.length===before.length)return false;
            this.writeAll(after);return true;
        }
        async restore(id){
            const snapshot=this.engine.snapshot(),chat=this.chatId(snapshot),item=this.readAll().find(entry=>String(entry.id)===String(id||''));
            if(!item)throw new Error('世界快照不存在');
            if(item.chatId&&chat&&String(item.chatId)!==chat)throw new Error('世界快照属于其他聊天，禁止跨聊天恢复');
            if(item.worldName&&snapshot.stat?.世界?.名称&&String(item.worldName)!==String(snapshot.stat.世界.名称))throw new Error('世界快照属于其他世界，禁止直接覆盖');
            const commit=this.mutations?.commit?.bind(this.mutations);
            if(!commit)throw new Error('世界快照恢复服务未初始化');
            return commit(stat=>{
                stat.世界=copy(item.data.世界||stat.世界||{});
                stat.资产=copy(item.data.资产||{});
                stat.关系列表=copy(item.data.关系列表||{});
                stat.传闻=copy(item.data.传闻||{});
                if(!plain(stat.世界?.[PATH]))stat.世界[PATH]=emptyState();
                stat.世界[PATH].已处理楼层='';
                stat.世界[PATH].已处理时间='';
                return true;
            },'已恢复世界快照：'+item.name);
        }
    }
