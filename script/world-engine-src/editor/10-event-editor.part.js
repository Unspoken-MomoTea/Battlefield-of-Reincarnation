    // 事件管理编辑器：编辑/重命名/删除世界后台事件，并维护引用与同楼 replay。
    function worldEventRetargetReferences(stat,oldName,newName,deleted=false) {
        const backend=worldEditorBackend(stat);
        const retarget=list=>{
            if(!Array.isArray(list))return [];
            const out=[];
            for(const item of list){
                const value=String(item||'');
                if(value!==oldName){if(value&&!out.includes(value))out.push(value);continue;}
                if(!deleted&&newName&&!out.includes(newName))out.push(newName);
            }
            return out;
        };
        for(const [name,event] of Object.entries(backend.事件||{})){
            if(name===newName&&!deleted)continue;
            if(Array.isArray(event?.前因))event.前因=retarget(event.前因);
        }
        for(const category of ['人物','势力地区','传播','历史']){
            for(const record of Object.values(backend[category]||{})){
                if(Array.isArray(record?.关联事件))record.关联事件=retarget(record.关联事件);
            }
        }
        const orbit=stat?.世界?.因果轨道;
        if(plain(orbit)&&String(orbit.下一节点||'')===oldName)orbit.下一节点=deleted?'':newName;
    }
    function worldEventValidateGraph(stat) {
        const backend=worldEditorBackend(stat),events=backend.事件||{};
        for(const [name,event] of Object.entries(events)){
            if(!plain(event))throw new Error('事件记录无效：'+name);
            if(!['待发生','进行中','已完成','已取消'].includes(String(event.状态||'')))throw new Error('事件状态只允许：待发生 / 进行中 / 已完成 / 已取消');
            if(!EVENT_CATEGORIES.has(String(event.分类||'')))throw new Error('事件分类只允许：当前事件 / 近期节点 / 宏观节点');
            if(!Array.isArray(event.前因))throw new Error('事件前因必须是列表');
            if(event.前因.includes(name))throw new Error('事件不能把自己设为前因：'+name);
            for(const cause of event.前因)if(!Object.hasOwn(events,cause))throw new Error('事件前因不存在：'+cause);
        }
        const visiting=new Set(),visited=new Set();
        const visit=name=>{
            if(visiting.has(name))throw new Error('事件前因形成循环');
            if(visited.has(name))return;
            visiting.add(name);
            for(const cause of events[name]?.前因||[])visit(cause);
            visiting.delete(name);visited.add(name);
        };
        Object.keys(events).forEach(visit);
        for(const category of ['人物','势力地区','传播','历史']){
            for(const record of Object.values(backend[category]||{})){
                if(!Array.isArray(record?.关联事件))continue;
                for(const eventName of record.关联事件)if(!Object.hasOwn(events,eventName))throw new Error(category+'关联了不存在的事件：'+eventName);
            }
        }
    }
    function worldEventSelect(value,options,field) {
        return '<select data-world-event-field="'+field+'">'+options.map(option=>'<option value="'+worldEditorEscape(option)+'"'+(String(value)===option?' selected':'')+'>'+worldEditorEscape(option)+'</option>').join('')+'</select>';
    }
