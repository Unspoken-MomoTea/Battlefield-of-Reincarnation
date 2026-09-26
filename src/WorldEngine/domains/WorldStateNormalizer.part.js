    const EVENT_CATEGORIES=new Set(['当前事件','近期节点','宏观节点']);
    const LOCAL_EVENT_WORDS=/(?:天台|教室|办公室|医务室|走廊|楼梯|楼层|入口|门扉|校门|校车|桥头|大桥|房间|仓库|食堂|街口|小巷|会合|汇合|集结|夺取|抢夺|突破|开门|绕行|护送|搜索|调查)/;
    const MACRO_EVENT_WORDS=/(?:世界级|全国|跨国|地区级灾难|城市级灾难|战略级|核(?:打击|爆|武器)|EMP|电磁脉冲|战争|政权|社会秩序|基础设施(?:失效|崩溃)|大规模迁移|长期流亡|生存阶段|篇章转折|据点(?:建立|失守|沦陷|崩溃|保卫)|文明|国家|大陆)/;

    class WorldStateNormalizer {
        normalizeBackendState(stat) {
            const state=stat?.世界?.[PATH]; if(!state)return stat;
            const legacySummary=String(state.公开摘要||'').trim();
            if(legacySummary){
                if(!plain(stat.世界.因果轨道))stat.世界.因果轨道={当前阶段:'',故事线:'',下一节点:'',偏移记录:{}};
                stat.世界.因果轨道.当前阶段=legacySummary;
            }
            delete state.公开摘要;
            delete state.正文承接;
            delete state.运行记录;
            state.版本=Math.max(5,Number(state.版本)||0);
            if(!plain(state.历史总结))state.历史总结={};
            for(const category of Object.keys(RECORDS)){
                if(!plain(state[category]))state[category]={};
                for(const [name,value] of Object.entries(state[category])){
                    if(plain(value))state[category][name]=normalizeBackendRecord(category,value);
                }
            }
            pruneDeadAlienPeople(stat);
            return stat;
        }
        eventText(name,event) {
            return [name,event?.描述,event?.条件,event?.默认走向,event?.结果,event?.公开征兆,event?.地点].filter(Boolean).join(' ');
        }
        obviouslyLocalMacro(name,event) {
            const text=this.eventText(name,event);
            if(MACRO_EVENT_WORDS.test(text))return false;
            const fineLocation=/(?:天台|教室|办公室|医务室|走廊|楼梯|楼层|入口|门扉|校门|校车|桥头|大桥|房间|仓库|食堂|街口|小巷)/.test(String(event?.地点||'')+' '+String(name||''));
            return fineLocation&&LOCAL_EVENT_WORDS.test(text);
        }
        normalizedEventCategory(name,event) {
            const raw=String(event?.分类||'').trim();
            if(raw==='宏观节点')return this.obviouslyLocalMacro(name,event)?(event?.状态==='进行中'?'当前事件':'近期节点'):'宏观节点';
            if(raw==='当前事件')return '当前事件';
            if(raw==='近期节点')return event?.状态==='进行中'?'当前事件':'近期节点';
            if(raw==='近期事件'||raw==='主线节点'||!EVENT_CATEGORIES.has(raw))return event?.状态==='进行中'?'当前事件':'近期节点';
            return raw;
        }
        normalizeEventLayers(stat) {
            const events=stat?.世界?.[PATH]?.事件||{},patches=[];
            for(const [name,event] of Object.entries(events)){
                const category=this.normalizedEventCategory(name,event);
                if(event.分类!==category){
                    event.分类=category;
                    patches.push({op:'replace',path:pointer(['世界',PATH,'事件',name,'分类']),value:category});
                }
            }
            return patches;
        }
        explicitPersonAliases(name) {
            const full=String(name||'').trim(),short=full.split(/[·・／/]/)[0].trim();
            return [...new Set([full,short].filter(x=>x.length>=2))];
        }
        repairExplicitEventLinks(stat) {
            const state=stat?.世界?.[PATH],patches=[]; if(!state)return patches;
            const events=state.事件||{},people=state.人物||{};
            for(const [eventName,event] of Object.entries(events)){
                const haystack=this.eventText(eventName,event);
                const participants=Array.isArray(event.参与者)?event.参与者.slice():[];
                let participantsChanged=false;
                for(const personName of Object.keys(people)){
                    const explicit=participants.some(x=>nameKey(x)===nameKey(personName))
                        ||this.explicitPersonAliases(personName).some(alias=>haystack.includes(alias));
                    if(!explicit)continue;
                    if(!participants.some(x=>nameKey(x)===nameKey(personName))){
                        participants.push(personName);participantsChanged=true;
                    }
                    const person=people[personName],links=Array.isArray(person.关联事件)?person.关联事件:[];
                    if(!links.includes(eventName)){
                        person.关联事件=[...links,eventName];
                        patches.push({op:'replace',path:pointer(['世界',PATH,'人物',personName,'关联事件']),value:copy(person.关联事件)});
                    }
                }
                if(participantsChanged){
                    event.参与者=participants;
                    patches.push({op:'replace',path:pointer(['世界',PATH,'事件',eventName,'参与者']),value:copy(participants)});
                }
            }
            return patches;
        }
        repairMacroPredecessors(stat) {
            const state=stat?.世界?.[PATH],orbit=stat?.世界?.因果轨道||{},patches=[]; if(!state)return patches;
            const stages=storyStages(orbit.故事线).filter(name=>state.事件?.[name]?.分类==='宏观节点'&&state.事件[name].状态!=='已取消');
            for(let i=1;i<stages.length;i++){
                const prev=stages[i-1],name=stages[i],event=state.事件[name],parents=Array.isArray(event.前因)?event.前因:[];
                if(!parents.includes(prev)){
                    event.前因=[...parents,prev];
                    patches.push({op:'replace',path:pointer(['世界',PATH,'事件',name,'前因']),value:copy(event.前因)});
                }
            }
            return patches;
        }
    }

    const DEFAULT_WORLD_STATE_NORMALIZER=new WorldStateNormalizer();
    let ACTIVE_WORLD_STATE_NORMALIZER=DEFAULT_WORLD_STATE_NORMALIZER;
    function normalizeBackendState(stat){return ACTIVE_WORLD_STATE_NORMALIZER.normalizeBackendState(stat);}
    function normalizeEventLayers(stat){return ACTIVE_WORLD_STATE_NORMALIZER.normalizeEventLayers(stat);}
    function repairExplicitEventLinks(stat){return ACTIVE_WORLD_STATE_NORMALIZER.repairExplicitEventLinks(stat);}
    function repairMacroPredecessors(stat){return ACTIVE_WORLD_STATE_NORMALIZER.repairMacroPredecessors(stat);}
