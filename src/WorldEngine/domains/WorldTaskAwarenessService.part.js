    class WorldTaskAwarenessService {
        projectList(value) {
            if(!plain(value))return {};
            const out={};
            for(const [name,task] of Object.entries(value)){
                if(!plain(task))continue;
                const projected={};
                for(const key of ['委托方','目标','隐藏真相','难度','交付','状态']){
                    if(Object.hasOwn(task,key))projected[key]=copy(task[key]);
                }
                if(Object.keys(projected).length)out[name]=projected;
            }
            return out;
        }

        validateReferences(stat,result) {
            const taskNames=new Set(Object.keys(stat?.任务?.列表||{}));
            for(const event of result?.事件||[]){
                if(!Array.isArray(event?.关联任务))continue;
                for(const taskName of event.关联任务){
                    const name=String(taskName||'').trim();
                    if(name&&!taskNames.has(name))throw new Error('事件/'+String(event.名称||'未命名')+'：关联任务不存在：'+name);
                }
            }
            return result;
        }
    }

    const DEFAULT_WORLD_TASK_AWARENESS_SERVICE=new WorldTaskAwarenessService();
