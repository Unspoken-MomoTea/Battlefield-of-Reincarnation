    class WorldKnowledgeService {
        constructor(engine){this.engine=engine;}
        activation(entry,scan,force){
            if(!String(entry.content||'').trim())return {read:false,reason:'内容为空'};
            if(force)return {read:true,reason:'强制读取'};
            if(!entry.enabled)return {read:false,reason:'条目禁用'};
            if(entry.mode==='constant')return {read:true,reason:'蓝灯常驻'};
            if(entry.mode!=='selective')return {read:false,reason:'不支持的激活方式，需显式强制读取'};
            const list=v=>Array.isArray(v)?v:typeof v==='string'?v.split(',').map(x=>x.trim()).filter(Boolean):[];
            const match=k=>{
                if(k instanceof RegExp){k.lastIndex=0;return k.test(scan);}
                if(plain(k)){try{return new RegExp(k.pattern||k.source||k.regex,k.flags||'').test(scan);}catch(_){return false;}}
                return !!String(k||'')&&scan.includes(String(k));
            };
            if(!list(entry.keys).some(match))return {read:false,reason:'绿灯未命中关键词'};
            const second=entry.secondary||{},keys=list(second.keys||second),hits=keys.map(match);
            const ok=!keys.length||(second.logic==='and_all'?hits.every(Boolean):second.logic==='not_all'?!hits.every(Boolean):second.logic==='not_any'?!hits.some(Boolean):hits.some(Boolean));
            return {read:ok,reason:ok?'绿灯已命中':'绿灯次要条件未满足'};
        }
        async catalogue(){
            const engine=this.engine;
            return await (async function(){
                            const get=this.fn('getWorldbook');
                            if(!get)return [];
                            const sources=new Map(),addSource=(book,label)=>{
                                const name=String(book||'').trim();if(!name)return;
                                if(!sources.has(name))sources.set(name,new Set());
                                sources.get(name).add(label);
                            };
                            const namesFn=this.fn('getCharWorldbookNames');
                            if(namesFn){
                                const names=await namesFn('current')||{};
                                addSource(names.primary,'角色主书');
                                for(const book of names.additional||[])addSource(book,'角色附加');
                            }
                            const chatFn=this.fn('getChatWorldbookName');
                            if(chatFn){
                                try{addSource(await chatFn('current'),'聊天绑定');}catch(_){}
                            }
                            const globalFn=this.fn('getGlobalWorldbookNames');
                            if(globalFn){
                                try{for(const book of await globalFn()||[])addSource(book,'全局启用');}catch(_){}
                            }
                            const result=[];
                            for(const [book,labels] of sources){
                                const entries=await get(book)||[];
                                entries.forEach((e,i)=>{
                                    const title=e.name||e.comment||'未命名';
                                    result.push({
                                        book,id:String(e.uid??e.id??i),title,sources:Array.from(labels),
                                        technical:isTechnicalBook(title),enabled:e.enabled!==false&&!e.disable&&!e.disabled,
                                        mode:e.strategy?.type||e.type||(e.constant===false?'selective':'constant'),
                                        keys:e.strategy?.keys||e.keys||e.key||[],
                                        secondary:e.strategy?.keys_secondary||e.keys_secondary||e.secondary_keys||{},
                                        content:e.content||''
                                    });
                                });
                            }
                            this.applyBuiltinDefaultWorldbookExclusions(result);
                            return result;
            }).call(engine);
        }
        async worldbook(scan='',options={}){
            const engine=this.engine;
            return await (async function(scan,options){
                            const catalogue=await this.catalogue(),output=[];
                            this.bookCatalogue=catalogue;
                            const report=[];this.readReport=report;
                            for(const e of catalogue){
                                const selected=!e.technical&&selectedEntryMatches(e,this.config.selectedEntries);
                                const timelineBackbone=!!options.timelineBackbone&&selected&&e.enabled&&isTimelineBackboneEntry(e.title);
                                const decision=e.technical?{read:false,reason:'世界引擎技术条目已隔离'}:timelineBackbone?{read:true,reason:'宏观资料补充'}:selected?this.activation(e,scan,this.config.activationMode==='force_selected'):{read:false,reason:'未勾选'};
                                report.push({世界书:e.book,条目ID:e.id,名称:e.title,灯:e.mode==='constant'?'蓝灯':e.mode==='selective'?'绿灯':'其他',读取:decision.read,原因:decision.reason});
                                if(!decision.read)continue;
                                let content=e.content;
                                if(content.includes('<%')){
                                    const ejs=this.host.EjsTemplate;
                                    if(!ejs?.evalTemplate||!ejs?.prepareContext)throw new Error('所选世界书含动态模板，需要 EJS 扩展：'+e.title);
                                    content=await ejs.evalTemplate(content,await ejs.prepareContext({}));
                                }
                                output.push({世界书:e.book,条目ID:e.id,名称:e.title,内容:content});
                            }
                            Object.defineProperty(output,'report',{value:report});
                            return output;
            }).call(engine,scan,options);
        }
    }
