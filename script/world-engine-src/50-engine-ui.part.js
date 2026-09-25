        createPanel() {
            if (this.panel && this.panel.isConnected) return;
            const doc=this.host.document;
            this.style=doc.createElement('style');
            this.style.textContent = worldEngineBaseStyleText();
            this.panel=doc.createElement('section');this.panel.id='sam-world-engine';this.panel.hidden=true;
            this.panel.dataset.tone=this.statusTone();this.panel.dataset.fontScale=this.config.fontScale||'standard';
            this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','世界引擎');
            this.panel.innerHTML='<header><div class="we-brand"><i>◈</i>世界引擎<small>WORLD CHRONICLE</small></div><button class="we-btn we-primary" data-action="run">推进世界</button><button class="we-btn" data-action="close" aria-label="返回主神终端">返回 ↗</button></header><div class="we-layout"><nav></nav><main></main></div><footer><span></span><small>剧情时间驱动 · 由主神终端「世界推进」总开关控制</small></footer>';
            this.panel.addEventListener('click',event=>{
                const button=event.target.closest('button');if(!button)return;
                const a=button.dataset.action;
                if(button.dataset.directory){this.directoryTab=button.dataset.directory;this.render();return;}
                if(button.dataset.area){this.selectedArea=button.dataset.area;this.directoryTab='探索';this.render();return;}
                if(button.dataset.faction){if(button.hasAttribute('data-asset-owner'))this.tab='探索与势力';this.selectedFaction=button.dataset.faction;this.directoryTab='势力';this.render();return;}
                if(button.dataset.jumpPerson){this.selectedPerson=button.dataset.jumpPerson;this.tab='角色管理';this.filter='全部';this.query='';this.selectedDate='';this.render(true);return;}
                if(button.dataset.jumpEvent){
                    this.jumpEvent=button.dataset.jumpEvent;this.tab='世界推进';this.filter='全部';this.query='';
                    const world=this.snapshot().stat.世界,event=world[PATH]?.事件?.[this.jumpEvent],calendar=world.历法;
                    const date=calendarDate(event?.时间||event?.开始时间,calendar),today=calendarDate(world.时间,calendar);
                    const monthsPerYear=Array.isArray(calendar?.月份天数)&&calendar.月份天数.length?calendar.月份天数.length:12;
                    this.selectedDate=date?.key||'';this.calendarMode=date?'date':'undated';
                    this.monthOffset=date&&today?(date.y-today.y)*monthsPerYear+date.m-today.m:0;
                    this.eventLimit=Number.MAX_SAFE_INTEGER;this.render(true);return;
                }
                if(button.dataset.person){this.selectedPerson=button.dataset.person;this.render();return;}
                if(a==='close')this.close();
                else if(a==='run'){
                    if(this.busy){if(!this.committing){this.cancel();this.status='已请求停止';this.render();}}
                    else this.run().catch(()=>{});
                }
                else if(a==='cancel'){this.cancel();this.status='已请求停止';this.render();}
                else if(a==='save'){
                    const settings=this.readPromptEditor();
                    this.applyPromptSettings(settings);
                    this.promptDraft=null;
                    this.status='提示词与资料范围已保存';
                    this.panel.querySelector('footer span').textContent=this.status;
                }
                else if(a==='prompt-edit'){
                    this.promptEditing=!this.promptEditing;
                    button.textContent=this.promptEditing?'锁定编辑':'开启编辑';button.setAttribute('aria-pressed',String(this.promptEditing));
                    this.panel.querySelectorAll('[data-segment-title],[data-segment],[data-structure-prompt],[data-npc-audit-prompt]').forEach(el=>el.readOnly=!this.promptEditing);
                    this.panel.querySelectorAll('[data-action^="segment-"]').forEach(el=>el.disabled=!this.promptEditing);
                }
                else if(a==='save-default'){
                    const settings=this.readPromptEditor();this.applyPromptSettings(settings);
                    this.config.userDefaultPromptSettings=copy(settings);
                    const docs=this.getPromptDocuments();
                    let doc=docs.find(d=>d.id===USER_DEFAULT_PROMPT_DOCUMENT_ID);
                    const now=new Date().toISOString();
                    if(doc){doc.settings=copy(settings);doc.updatedAt=now;}
                    else docs.push({id:USER_DEFAULT_PROMPT_DOCUMENT_ID,type:'samsara-world-prompt-document',version:1,builtin:false,name:'个人默认设置',createdAt:now,updatedAt:now,settings:copy(settings)});
                    this.config.activePromptDocumentId=USER_DEFAULT_PROMPT_DOCUMENT_ID;
                    this.saveConfig();this.status='已保存为个人默认设置';this.panel.querySelector('footer span').textContent=this.status;
                }
                else if(a==='segment-add'){
                    if(!this.promptEditing)return;
                    const list=this.panel.querySelector('[data-segment-list]');if(!list)return;
                    const row=this.host.document.createElement('details');row.open=true;row.className='we-segment';row.setAttribute('data-segment-row','');
                    row.innerHTML='<summary>新分段</summary><div class="we-segment-head"><input data-segment-title aria-label="分段标题" placeholder="分段标题（可留空）"><small>新分段</small><span class="we-segment-actions"><button type="button" data-action="segment-up" title="上移">↑</button><button type="button" data-action="segment-down" title="下移">↓</button><button type="button" data-action="segment-delete" title="删除">删除</button></span></div><textarea data-segment data-title="" aria-label="新分段正文" placeholder="输入这一段的提示词正文…"></textarea>';
                    list.appendChild(row);row.querySelector('[data-segment-title]').focus();
                }
                else if(a==='segment-up'||a==='segment-down'){
                    if(!this.promptEditing)return;
                    const row=button.closest('[data-segment-row]'),parent=row?.parentElement;if(!row||!parent)return;
                    if(a==='segment-up'&&row.previousElementSibling)parent.insertBefore(row,row.previousElementSibling);
                    if(a==='segment-down'&&row.nextElementSibling)parent.insertBefore(row.nextElementSibling,row);
                }
                else if(a==='segment-delete'){if(!this.promptEditing)return;button.closest('[data-segment-row]')?.remove();}
                else if(a==='doc-save'){
                    try{
                        const settings=this.readPromptEditor(),name=this.panel.querySelector('[data-doc-name]')?.value||'';
                        this.applyPromptSettings(settings);
                        const doc=this.savePromptDocument(name,settings);this.promptDraft=null;
                        this.status='已保存预设文档：'+doc.name;this.render(true);
                    }catch(e){this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;}
                }
                else if(a==='doc-apply'){
                    const doc=this.getPromptDocuments().find(item=>item.id===button.dataset.docId);if(!doc)return;
                    this.applyPromptSettings(doc.settings);this.config.activePromptDocumentId=doc.id;
                    if(doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id){
                        this.config.builtinDefaultWorldbookExclusionsApplied=[];
                        this.applyBuiltinDefaultWorldbookExclusions(this.bookCatalogue||[]);
                    }
                    this.saveConfig();this.promptDraft=null;
                    this.status='已应用预设文档：'+doc.name+(Array.isArray(doc.settings?.selectedEntries)&&!(this.bookCatalogue||[]).length?' · 世界书勾选将在加载目录后显示':'');
                    this.render(true);
                }
                else if(a==='doc-export'){
                    try{this.exportPromptDocument(button.dataset.docId);this.status='预设文档已导出';this.panel.querySelector('footer span').textContent=this.status;}
                    catch(e){this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;}
                }
                else if(a==='doc-delete'){
                    this.promptDraft=this.readPromptEditor();
                    const doc=this.getPromptDocuments().find(item=>item.id===button.dataset.docId);
                    if(this.deletePromptDocument(button.dataset.docId)){this.status='已删除预设文档'+(doc?'：'+doc.name:'');this.render(true);}
                }
                else if(a==='doc-import'){
                    this.promptDraft=this.readPromptEditor();
                    const input=this.panel.querySelector('[data-doc-import]');if(input){input.value='';input.click();}
                }
                else if(a==='books'){
                    this.promptDraft=this.readPromptEditor();
                    this.catalogue().then(list=>{this.bookCatalogue=list;this.render(true);}).catch(e=>{this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;});
                }
                else if(a==='book-all'||a==='book-none'){this.panel.querySelectorAll('[data-book]').forEach(e=>{e.checked=a==='book-all'&&!e.disabled;});}
                else if(a==='preview'){
                    const settings=this.tab==='提示词预设'?this.readPromptEditor():null;
                    if(settings)this.applyPromptSettings(settings);
                    this.promptDraft=null;
                    this.buildRequest(this.snapshot()).then(r=>{this.previewRequest=r;this.tab='请求检查';this.render(true);}).catch(e=>{this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;});
                }
                else if(button.dataset.fontOption){
                    const scale=button.dataset.fontOption;
                    if(WORLD_FONT_SCALES[scale]){this.config.fontScale=scale;this.panel.dataset.fontScale=scale;this.saveConfig();this.status='界面字号已切换为 '+WORLD_FONT_SCALES[scale].name;this.render(true);}
                }
                else if(a==='dedicated-toggle'){
                    this.cancel();
                    const api=this.normalizeDedicatedApi(this.config.dedicatedApi);
                    api.enabled=!api.enabled;this.config.dedicatedApi=api;
                    if(!api.enabled&&this.isConfigured()){
                        const terminal=this.host.Samsara&&this.host.Samsara.terminal;
                        if(terminal&&typeof terminal.enableApi==='function')terminal.enableApi();
                    }
                    this.saveConfig();
                    this.status=api.enabled?'已启用世界推进专属 API · 不再使用主神终端 API':'已关闭专属 API · 回退使用主神终端 API';
                    this.render(true);
                }
                else if(a==='dedicated-models'){
                    this.status='正在加载专属 API 模型列表';this.panel.querySelector('footer span').textContent=this.status;
                    this.fetchDedicatedModels().then(list=>{this.status='已加载 '+list.length+' 个模型';this.render(true);}).catch(e=>{this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;});
                }
                else if(a==='dedicated-preset-save'){
                    try{
                        const name=this.panel.querySelector('[data-dedicated-preset-name]')?.value||'';
                        const entry=this.saveDedicatedApiPreset(name);
                        this.status='已保存 API 预设：'+entry.name;this.render(true);
                    }catch(e){this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;}
                }
                else if(a==='dedicated-preset-delete'){
                    const name=this.panel.querySelector('[data-dedicated-preset]')?.value||'';
                    if(!name){this.status='请先选择要删除的 API 预设';this.panel.querySelector('footer span').textContent=this.status;}
                    else if(this.deleteDedicatedApiPreset(name)){this.status='已删除 API 预设：'+name;this.render(true);}
                }
                else if(a==='month'){
                    this.monthOffset=(this.monthOffset||0)+Number(button.dataset.step);
                    const world=this.snapshot().stat.世界,calendar=world.历法,today=calendarDate(world.时间,calendar);
                    if(today){
                        const custom=Array.isArray(calendar?.月份天数)?calendar.月份天数.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=99).slice(0,24):[];
                        if(custom.length){
                            let y=today.y,m=today.m+this.monthOffset;
                            while(m<1){m+=custom.length;y--;}
                            while(m>custom.length){m-=custom.length;y++;}
                            this.selectedDate=y+'-'+m+'-1';
                        }else{
                            const date=new Date(0);date.setFullYear(today.y,today.m-1+this.monthOffset,1);
                            this.selectedDate=date.getFullYear()+'-'+(date.getMonth()+1)+'-1';
                        }
                    }
                    this.calendarMode='date';this.eventLimit=12;this.render();
                }
                else if(a==='date'){this.selectedDate=button.dataset.date;this.calendarMode='date';this.eventLimit=12;this.render();}
                else if(a==='clear-date'){this.selectedDate='';this.calendarMode='all';this.eventLimit=12;this.render();}
                else if(a==='today'){this.selectedDate=undefined;this.calendarMode='today';this.monthOffset=0;this.eventLimit=12;this.render();}
                else if(a==='undated'){this.selectedDate='';this.calendarMode='undated';this.eventLimit=12;this.render();}
                else if(a==='more-events'){this.eventLimit=(this.eventLimit||12)+12;this.render();}
                else if(button.dataset.filter){this.filter=button.dataset.filter;this.render();}
                else if(button.dataset.tab){this.tab=button.dataset.tab;this.filter='全部';this.query='';this.selectedDate=undefined;this.calendarMode='today';this.monthOffset=0;this.eventLimit=12;this.render(true);}
            });
            this.panel.addEventListener('input',event=>{
                if(event.target.matches('[data-search]')){
                    const caret=event.target.selectionStart;this.query=event.target.value;this.render();
                    const input=this.panel.querySelector('[data-search]');input.focus();input.setSelectionRange(caret,caret);
                }else if(event.target.matches('[data-segment-title]')){
                    const row=event.target.closest('[data-segment-row]'),body=row?.querySelector('[data-segment]');
                    if(body)body.dataset.title=cleanSegmentTitle(event.target.value);
                }
            });
            this.panel.addEventListener('change',event=>{
                if(event.target.matches('[data-retries]')){
                    const value=Math.max(1,Math.min(5,Number(event.target.value)||1));
                    this.config.retryAttempts=value;event.target.value=value;this.saveConfig();
                    this.status='最大尝试次数已设为 '+value+' 次';
                    this.panel.querySelector('footer span').textContent=this.status;
                }else if(event.target.matches('[data-doc-import]')){
                    const input=event.target,file=input.files&&input.files[0];if(!file)return;
                    Promise.resolve(file.text()).then(raw=>{
                        const doc=this.importPromptDocument(raw);
                        this.status='已导入预设文档：'+doc.name;this.render(true);
                    }).catch(e=>{this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;}).finally(()=>{input.value='';});
                }
                else if(event.target.matches('[data-dedicated-field]')){
                    const field=event.target.dataset.dedicatedField,value=event.target.value||'';
                    if(['apiUrl','apiKey','model'].includes(field)){
                        this.setDedicatedApi({[field]:value});
                        this.status='专属 API 配置已保存';this.panel.querySelector('footer span').textContent=this.status;
                    }
                }
                else if(event.target.matches('[data-dedicated-preset]')){
                    const name=event.target.value||'';
                    if(name){
                        try{this.applyDedicatedApiPreset(name);this.status='已应用 API 预设：'+name;this.render(true);}
                        catch(e){this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;}
                    }
                }
            });
            isolated.appendChild(this.panel);
            doc.body.appendChild(this.mount);
        }
        render(force) {
            if(!this.isOpen())return;
            let snapshot,state=emptyState(),reason='';
            try{
                snapshot=this.snapshot();
                snapshot.stat.世界[PATH]=Object.assign(emptyState(),snapshot.stat.世界[PATH]||{});
                normalizeBackendState(snapshot.stat);normalizeEventLayers(snapshot.stat);repairCausalProjection(snapshot.stat);
                state=Object.assign(state,snapshot.stat.世界[PATH]||{});
                reason=this.blocked(snapshot);
            }catch(e){reason=e.message;}
            const s=snapshot?snapshot.stat:{},w=s.世界||{},orbit=w.因果轨道||{};
            this.syncStatusTone();
            this.panel.dataset.fontScale=this.config.fontScale||'standard';
            if(this.tab==='总览')this.tab='世界推进';
            const main=this.panel.querySelector('main'),scroll=main.scrollTop;
            const opened=new Set(Array.from(main.querySelectorAll('details[open]')).map(d=>d.dataset.detail));
            this.panel.querySelector('footer span').textContent=this.status;
            const availabilityReason=this.isConfigured()&&!this.isAvailable()
                ?(this.usesDedicatedApi()?'专属 API 未准备好：请在「设置」中填写 API 地址并选择模型':'主神终端额外模型未准备好：请在主神终端设置中配置 API 地址并选择模型')
                :'';
            const runButton=this.panel.querySelector('[data-action=run]');
            const stopping=this.busy&&!!this.controller?.signal.aborted;
            runButton.disabled=this.busy?(this.committing||stopping):!!reason||!!availabilityReason;
            runButton.textContent=this.busy?(this.committing?'保存中…':stopping?'停止中…':'停止推进'):'推进世界';
            runButton.setAttribute('aria-label',runButton.textContent);

            const tabs=[['世界推进','◈'],['角色管理','♙'],['探索与势力','⌖'],['世界事件','▤'],['资产','▣'],['传闻','◎'],['提示词预设','✎'],['请求检查','⌕'],['运行记录','≋','历史记忆'],['设置','⚙']];
            this.panel.querySelector('nav').innerHTML='<div class="we-navtitle">世界档案</div>'+tabs.map(([t,i,label])=>'<button data-tab="'+t+'" aria-selected="'+(this.tab===t)+'"><span class="we-tab-icon" aria-hidden="true">'+i+'</span>'+(label||t)+'</button>').join('');
            if(this.tab==='提示词预设'&&main.querySelector('textarea')&&!force)return;
            const text=v=>escape(v==null?'':v);
            const exists=v=>v!==''&&v!=null&&(!Array.isArray(v)||v.length)&&(!plain(v)||Object.keys(v).length);
            const pill=(v,kind='')=>'<span class="we-pill '+kind+'">'+text(v)+'</span>';
            const empty=(title,desc='首次推演后，会在这里呈现有依据的世界记录。')=>'<div class="we-empty"><b>'+text(title)+'</b>'+text(desc)+'</div>';
            const value=v=>Array.isArray(v)?(v.every(x=>!plain(x))?'<div class="we-chips">'+v.map(x=>pill(x,'dim')).join('')+'</div>':v.map(x=>'<div class="we-card">'+fields(x)+'</div>').join('')):plain(v)?fields(v):text(v);
            const fields=obj=>'<dl>'+Object.entries(obj||{}).filter(([,v])=>exists(v)).map(([k,v])=>'<dt>'+text(k)+'</dt><dd>'+value(v)+'</dd>').join('')+'</dl>';
            const details=(id,obj,title='查看完整档案')=>Object.values(obj).some(exists)?'<details data-detail="'+text(id)+'"'+(opened.has(id)?' open':'')+'><summary>'+text(title)+'</summary>'+fields(obj)+'</details>':'';
            const section=(title,body,hint='')=>'<section class="we-section"><div class="we-section-head"><h2>'+text(title)+'</h2><small>'+text(hint)+'</small></div>'+body+'</section>';
            const entries=obj=>Object.entries(obj||{});
            const parseDate=value=>calendarDate(value,w.历法);
            const contextKey=JSON.stringify([snapshot?.fingerprint?JSON.parse(snapshot.fingerprint)[0]:null,w.名称]);
            if(this.calendarContext!==contextKey){this.calendarContext=contextKey;this.selectedDate=undefined;this.calendarMode="today";this.monthOffset=0;}
            if(this.selectedDate===undefined||this.calendarMode==="today")this.selectedDate=parseDate(w.时间)?.key||"";
            if(this.calendarMode==='date'){
                const anchor=parseDate(w.时间),selected=parseDate(this.selectedDate);
                const monthsPerYear=Array.isArray(w.历法?.月份天数)&&w.历法.月份天数.length?w.历法.月份天数.length:12;
                if(anchor&&selected)this.monthOffset=(selected.y-anchor.y)*monthsPerYear+selected.m-anchor.m;
            }
            const dateLabel=str=>{const d=parseDate(str);return d?d.m+'月'+d.d+'日':str||'时间待补';};
            // 稳定阶段与防御强度取自 ⚙️世界因果与法则协议；这里只展示当前阶段。
            const stabilityStages=[
                {min:111,max:120,title:'黄金祝福 | 稳定强化',effects:['世界基本消化外来干涉，原生因果处于高强度收束状态','轮回者没有主动围剿压力，但外来力量仍受完整原生法则约束']},
                {min:101,max:110,title:'世界青睐 | 稳定强化',effects:['因果结构优于原始基准，秩序与资源循环趋于健康','世界对轮回者的主动排异很低']},
                {min:100,max:100,title:'原著时间线 | 稳定',effects:['世界按既定轨迹运行，不主动针对轮回者，也不提供额外庇护']},
                {min:90,max:99,title:'因果警觉 | 稳定',effects:['世界开始识别异常源','目击、调查、误会与敌意沿合理因果链向轮回者汇聚']},
                {min:80,max:89,title:'定向排异 | 稳定',effects:['藏身处、计划、联系人与资源链持续受压','压力优先集中到轮回者本人及其直接关系网']},
                {min:70,max:79,title:'因果追猎 | 松动',effects:['原生强者、组织与主线冲突逐步被因果收束引向轮回者','据点、盟友、补给与撤退路线开始被系统性破坏']},
                {min:60,max:69,title:'全面围剿 | 松动',effects:['多个原生势力可从各自合理动机同时追捕、封锁或攻击轮回者','普通安全生活基本结束，逃离一处不代表摆脱追猎']},
                {min:50,max:59,title:'世界武器化 | 松动',effects:['战争、灾害、怪物潮与原生顶级强者可被因果链引向轮回者活动区','世界开始接受区域毁灭与大规模误伤作为清除代价']},
                {min:40,max:49,title:'猎杀现实 | 崩坏',effects:['环境、空间、时间与残存原生规则都可成为猎杀轮回者的载体','世界接受永久区域毁灭，只求把入侵源一并埋葬']},
                {min:30,max:39,title:'献祭式清除 | 崩坏',effects:['世界进入免疫风暴，围剿不再优先保护自身秩序','可牺牲主线人物、城市、国家乃至文明结构换取清除轮回者']},
                {min:10,max:29,title:'终焉围猎 | 混乱',effects:['毁灭性事件持续向轮回者及其停留区域收束','长期停留会把灾难引向当前位置，必须修复因果或持续撤离']},
                {min:1,max:9,title:'同归于尽 | 混乱',effects:['世界放弃自保，主动牺牲法则、时间线与现实结构清除轮回者','只剩修复异常根源或在世界死亡前撤离']},
                {min:0,max:0,title:'世界毁灭',effects:['因果链、世界法则、时间线与现实结构全部终止','所有未撤离实体的生命、意识与灵魂一并被彻底抹除']}
            ];
            const stabilityDescription=stable=>{
                if(s.设置?.世界超稳===true)return '<p class="we-muted">世界超稳 · 稳定值固定100<br>禁止新增因果偏移与主动排异升级</p>';
                if(stable===null)return '<p class="we-muted">世界稳定值未记录</p>';
                const normalized=Math.max(0,Math.min(120,Number(stable)));
                const stage=stabilityStages.find(item=>normalized>=item.min&&normalized<=item.max);
                return stage?'<div class="we-stability-description"><p><b>'+text(stage.title)+'</b></p><ul>'+stage.effects.map(effect=>'<li>'+text(effect)+'</li>').join('')+'</ul></div>':'<p class="we-muted">稳定值超出协议范围</p>';
            };
            const events=sortWorldEvents(state.事件,orbit);
            const active=events.filter(([,e])=>e.状态==='进行中'),future=events.filter(([,e])=>e.状态==='待发生');
            const relationRoster=s.关系列表||{};
            const relationNamesByKey=new Map(entries(relationRoster).map(([name])=>[nameKey(name),name]));
            const peopleAll=new Map(entries(state.人物));entries(relationRoster).forEach(([n,p])=>{if(!peopleAll.has(n))peopleAll.set(n,{状态:p.在场?'在场':'场外',公开动态:p.态度||'',地点:'',目标:'',行动:''});});
            const userName=String(this.host.SillyTavern?.name1||this.env.SillyTavern?.name1||this.host.SillyTavern?.getContext?.()?.name1||this.host.name1||'').trim();
            const playerAliases=new Set([userName,'{{user}}','<user>','玩家'].filter(Boolean).map(nameKey));
            const deadAlienAliases=new Set(entries(w.异端雷达?.名单).filter(([,alien])=>alien?.状态==='死亡').map(([name])=>nameKey(name)));
            const people=new Map(Array.from(peopleAll).filter(([name])=>!playerAliases.has(nameKey(name))&&!deadAlienAliases.has(nameKey(name))));
            const formalPeople=new Map(entries(relationRoster)
                .filter(([name])=>!playerAliases.has(nameKey(name))&&!deadAlienAliases.has(nameKey(name)))
                .map(([name,rel])=>{
                    const backend=Array.from(people).find(([otherName])=>nameKey(otherName)===nameKey(name))?.[1];
                    return [name,backend||{状态:rel.在场?'在场':'场外',公开动态:rel.态度||'',地点:'',目标:'',行动:''}];
                }));
            const backstagePeople=Array.from(people).filter(([name])=>!relationNamesByKey.has(nameKey(name)));
            const person=(name,p,full=false)=>{
                const profileName=relationNamesByKey.get(nameKey(name))||'';
                const rel=profileName?relationRoster[profileName]||{}:{};
                return '<article class="'+(full?'we-card':'we-person')+'">'+(!full?'<div class="we-avatar">'+text(name.slice(0,1))+'</div>':'')+'<div><div class="we-card-top"><h3>'+text(name)+'</h3>'+pill(p.状态||(rel.在场?'在场':'场外'),'dim')+'</div><p>'+text(p.行动||p.公开动态||rel.态度||'尚无行动记录')+'</p><div class="we-meta"><span>⌖ '+text(p.地点||'地点未明')+'</span>'+(p.预计结束?'<span>至 '+text(dateLabel(p.预计结束))+'</span>':'')+'</div>'+(full?fields({档案类型:profileName?'正式关系人物':'世界活动人物',目标:p.目标,当前时间段:[p.开始时间,p.预计结束].filter(Boolean).join(' → '),下次检查:p.下次检查,所属世界:p.所属世界,好感度:rel.好感度})+details('person-'+name,{行程:p.行程,认知:p.认知,认知来源:p.认知来源,登场条件:p.登场条件,关联事件:p.关联事件,更新时间:p.更新时间,人物背景:rel.背景故事},'行程 · 认知 · 关联事件'):'')+'</div></article>';
            };
            const compactPerson=(name,p)=>{
                const profileName=relationNamesByKey.get(nameKey(name))||'';
                const rel=profileName?relationRoster[profileName]||{}:{};
                const targetName=profileName||name;
                const inner='<span class="we-avatar">'+text(name.slice(0,1))+'</span><span class="we-person-copy"><strong>'+text(name)+'</strong><small>'+text(p.地点||'地点未明')+'</small><em>'+text(p.行动||p.公开动态||rel.态度||'暂无新动态')+'</em></span>';
                return '<button class="we-person-compact" data-jump-person="'+text(targetName)+'" title="'+text(profileName?'查看正式人物档案':'查看世界人物动态；不会创建关系列表档案')+'">'+inner+'</button>';
            };
            const contextRows=context=>{
                const rows=[];
                for(const link of context?.背景关联||[])rows.push('<div class="we-context-row"><span class="we-context-kind">'+text(link.类型||'关联')+'</span><span class="we-context-copy"><b>'+text(link.名称||'未命名关联')+'</b><small>'+text(link.关系||'持续关联')+'</small></span></div>');
                for(const eventName of context?.关联事件||[])rows.push('<button class="we-context-row" data-jump-event="'+text(eventName)+'"><span class="we-context-kind">事件</span><span class="we-context-copy"><b>'+text(eventName)+'</b><small>查看关联世界事件 →</small></span></button>');
                return rows.length?'<div class="we-context-list">'+rows.join('')+'</div>':empty('暂无背景关联','世界引擎只记录持续的组织/社交关系与事件关联，不重复人物背景故事。');
            };
            const sceneLane=(title,items,kind)=>{
                const list=Array.isArray(items)?items:[];
                const body=list.map(item=>{
                    if(kind==='person'){
                        const meta=[item.关系,item.身份,item.档案类型||'世界人物'].filter(Boolean).join(' · ');
                        const inner='<b>'+text(item.名称)+'</b><small>'+text(meta||'现场标签')+'</small>'+(item.行动?'<p>'+text(item.行动)+'</p>':'');
                        return item.可查看档案&&item.档案名称
                            ?'<button class="we-scene-item" data-jump-person="'+text(item.档案名称)+'">'+inner+'</button>'
                            :'<article class="we-scene-item we-scene-label">'+inner+'</article>';
                    }
                    if(kind==='group')return '<article class="we-scene-item"><b>'+text(item.名称||'未命名群体')+'</b><small>'+text([item.规模,item.身份].filter(Boolean).join(' · ')||'现场群体')+'</small>'+(item.动态?'<p>'+text(item.动态)+'</p>':'')+'</article>';
                    return '';
                }).join('');
                return '<div class="we-scene-lane"><div class="we-scene-lane-head"><b>'+text(title)+'</b><span>'+list.length+'</span></div>'+(body||'<div class="we-muted">暂无记录</div>')+'</div>';
            };
            const sceneContextBody=context=>{
                const hasScene=!!(context&&(context.地区||context.身边人物?.length||context.现场群体?.length));
                if(!hasScene)return empty('暂无身边发展','人物尚未匹配到可用的地区现场；不会为填充面板而虚构周边信息。');
                const control=[context.控制方?'控制 · '+context.控制方:'',context.争夺方?.length?'争夺 · '+context.争夺方.join('、'):''].filter(Boolean).join(' · ');
                return '<div class="we-scene-hero"><div class="we-scene-head"><div><small>当前世界现场</small><h3>'+text(context.地区||'未命名地区')+'</h3></div><small>'+text(control||'控制关系未记录')+'</small></div>'+(context.地区动态?'<p>'+text(context.地区动态)+'</p>':'')+(context.环境状态?.length?'<div class="we-chips">'+context.环境状态.map(x=>pill(x,'dim')).join('')+'</div>':'')+'</div><div class="we-scene-grid">'+sceneLane('身边人物',context.身边人物,'person')+sceneLane('现场群体',context.现场群体,'group')+'</div>';
            };
            const areaSceneBody=record=>{
                const groups=Array.isArray(record?.现场群体)?record.现场群体:[];
                if(!groups.length)return '';
                return sceneLane('现场群体',groups,'group');
            };
            const eventTasks=(eventName,event)=>{
                const names=Array.from(new Set((Array.isArray(event.关联任务)?event.关联任务:[]).filter(name=>typeof name==='string'&&name.trim())));
                if(!names.length)return '';
                const roster=s.任务?.列表||{};
                return '<div class="we-event-tasks"><div class="we-meta"><b>关联任务</b><span>'+names.length+' 项</span></div>'+names.map(name=>{
                    const task=Object.hasOwn(roster,name)&&plain(roster[name])?roster[name]:null;
                    const id='event-task-'+JSON.stringify([eventName,name]);
                    return '<details class="we-event-task" data-detail="'+text(id)+'"'+(opened.has(id)?' open':'')+'><summary><span class="we-task-name">'+text(name)+'</span>'+pill(task?.状态|| (task?'状态未记录':'任务记录缺失'),'dim')+'</summary>'
                        +(task?'<p>'+text(task.目标||'目标尚未记录')+'</p>'+fields({委托方:task.委托方,难度:task.难度,交付:task.交付}):'<p class="we-muted">当前任务列表中未找到该任务，保留事件中的关联名称。</p>')+'</details>';
                }).join('')+'</div>';
            };
            const eventCard=(name,e)=>'<article class="we-card" data-event-card="'+text(name)+'"><div class="we-card-top"><h3>'+text(name)+'</h3><div class="we-card-tags">'+pill(e.分类||'近期节点',e.分类==='宏观节点'?'future':'dim')+pill(e.状态,e.状态==='待发生'?'future':e.状态==='进行中'?'':'dim')+'</div></div><div class="we-meta"><span>◷ '+text(eventScheduleLabel(e))+'</span><span>⌖ '+text(e.地点||'地点未明')+'</span></div><p>'+text(e.公开征兆||e.描述||'等待明确事件内容')+'</p>'+eventTasks(name,e)+details('event-'+name,{事件描述:e.描述,分类:e.分类,前因:e.前因,触发条件:e.条件,参与者:e.参与者,预计结束:e.预计结束,下次检查:e.下次检查,可见影响:e.可见影响,默认走向:e.默认走向,已确认结果:e.结果,更新时间:e.更新时间},'因果关联与事件详情')+'</article>';
            const timelineCards=list=>{
                const groups=[
                    ['当前进行',list.filter(([,e])=>e.状态==='进行中'||(e.状态==='待发生'&&e.分类==='当前事件'))],
                    ['近期桥接',list.filter(([,e])=>e.状态!=='进行中'&&e.状态==='待发生'&&e.分类==='近期节点')],
                    ['宏观锚点',list.filter(([,e])=>e.状态!=='进行中'&&e.状态==='待发生'&&e.分类==='宏观节点')],
                    ['已结束',list.filter(([,e])=>['已完成','已取消'].includes(e.状态))]
                ];
                const assigned=new Set(groups.flatMap(([,items])=>items.map(([name])=>name)));
                groups.push(['待归类记录',list.filter(([name])=>!assigned.has(name))]);
                return groups.filter(([,items])=>items.length).map(([title,items])=>'<div class="we-timeline-group"><div class="we-timeline-group-title">'+text(title)+'<small>'+items.length+'</small></div>'+items.map(([n,e])=>eventCard(n,e)).join('')+'</div>').join('');
            };
            const matched=(name,obj)=>!this.query||(name+' '+Object.values(obj).filter(v=>typeof v==='string').join(' ')).toLowerCase().includes(this.query.toLowerCase());
            const calendarCandidates=events.filter(([n,e])=>matched(n,e)&&((this.filter||'全部')==='全部'||e.状态===this.filter));
            const tools=(filters=[])=>'<div class="we-tools"><input data-search aria-label="搜索档案" placeholder="搜索名称、地点或内容…" value="'+text(this.query||'')+'">'+filters.map(f=>'<button data-filter="'+f+'" class="'+((this.filter||'全部')===f?'active':'')+'">'+f+'</button>').join('')+'</div>';
            const calendar=()=>{
                const today=parseDate(w.时间);
                if(!today){const semantic=events.filter(([,e])=>!parseDate(e.时间||e.开始时间)&&String(e.时间||e.开始时间||'').trim()).slice(0,12);return '<div class="we-calendar"><h3>作品内时间轴</h3><p class="we-muted">当前锚点 · '+text(w.时间||'尚无副本时间')+'</p>'+(semantic.length?'<div class="we-timeline">'+semantic.map(([n,e])=>'<p><b>'+text(e.时间||e.开始时间)+'</b><br>'+text(n)+'</p>').join('')+'</div>':'<p class="we-muted">暂无带作品内时间标记的事件</p>')+'</div>';}
                const customMonths=Array.isArray(w.历法?.月份天数)?w.历法.月份天数.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=99).slice(0,24):[];
                let y=today.y,m=today.m+(this.monthOffset||0),first=0,count=0;
                if(customMonths.length){
                    while(m<1){m+=customMonths.length;y--;}
                    while(m>customMonths.length){m-=customMonths.length;y++;}
                    count=customMonths[m-1];
                }else{
                    const month=new Date(0);month.setFullYear(today.y,today.m-1+(this.monthOffset||0),1);month.setHours(0,0,0,0);
                    y=month.getFullYear();m=month.getMonth()+1;first=(month.getDay()+6)%7;
                    const last=new Date(month);last.setMonth(last.getMonth()+1,0);count=last.getDate();
                }
                const marked=new Map();
                calendarCandidates.forEach(([,e])=>{const key=parseDate(e.时间||e.开始时间)?.key;if(key)marked.set(key,(marked.get(key)||0)+1);});
                let cells=['一','二','三','四','五','六','日'].map(x=>'<span>'+x+'</span>').join('')+'<span></span>'.repeat(first);
                for(let d=1;d<=count;d++){const key=y+'-'+m+'-'+d;cells+='<button data-action="date" data-date="'+key+'" aria-label="'+key+'" aria-pressed="'+(this.selectedDate===key)+'" title="'+key+' · '+(marked.get(key)||0)+' 个匹配事件" class="'+(today.key===key?'today ':'')+(marked.has(key)?'has-event ':'')+(this.selectedDate===key?'selected':'')+'">'+d+'</button>';}
                return '<div class="we-calendar"><div class="we-calhead"><button class="we-btn" data-action="month" data-step="-1" aria-label="上月">‹</button><strong>'+y+' 年 '+m+' 月</strong><button class="we-btn" data-action="month" data-step="1" aria-label="下月">›</button></div><div class="we-days">'+cells+'</div><div class="we-meta"><span>'+text(customMonths.length?(w.历法?.名称||'作品历法')+' · 本月 '+count+' 天':'公历显示 · 本月 '+count+' 天')+'</span><span>金框 · 当前日期</span><span>绿点 · 已排定事件</span></div></div>';
            };
            const radar=w.异端雷达||{};
            const alienAlive=entries(radar.名单).filter(([,a])=>a&&a.状态!=='死亡').length;
            const showRadar=!(s.设置||{}).单一世界&&!(s.系统状态||{}).是否在主神空间;
            const prose=v=>'<div class="we-reading we-world-laws">'+(Array.isArray(v)?v:[v]).map(paragraph=>'<article><p>'+text(paragraph)+'</p></article>').join('')+'</div>';
            const hero='<div class="we-hero"><div><div class="we-eyebrow">SAMSARA / WORLD ARCHIVE</div><h1>'+text(w.名称&&w.名称!=='待初始化'?w.名称:'世界尚未建立')+'</h1><div class="we-world-ranks"><span>位格 <b>'+text(w.位格||'未记录')+'</b></span><span>难度 <b>'+text(w.难度||'未记录')+'</b></span></div><div class="we-muted">'+text(w.地点||'地点待确认')+' · '+text(orbit.当前阶段&&orbit.当前阶段!=='待初始化'?orbit.当前阶段:'等待篇章开启')+'</div></div><div class="we-date">'+text(w.时间||'副本日期待确认')+'<small>累计游玩 '+text((s.系统状态||{}).游玩天数||0)+' 天 · '+(reason?'推进暂停':'副本进行中')+'</small></div></div>';
            let html=hero+(reason?'<div class="we-notice">'+text(reason)+'</div>':'')+(availabilityReason?'<div class="we-notice">'+text(availabilityReason)+'</div>':'');
            if(this.tab==='世界推进'){
                html+=worldEngineRenderWorldTab({
                    engine:this,s,w,orbit,events,active,future,people,calendarCandidates,snapshot,
                    entries,text,empty,section,stabilityDescription,parseDate,calendar,tools,
                    timelineCards,exists,fields,prose,compactPerson
                });
            }else if(this.tab==='角色管理'){
                html+=worldEngineRenderPeopleTab({
                    engine:this,s,radar,showRadar,alienAlive,entries,formalPeople,backstagePeople,
                    relationRoster,matched,userName,section,text,pill,fields,contextRows,
                    sceneContextBody,empty,tools,person,exists,value
                });
            }else if(this.tab==='探索与势力'){
                html+=worldEngineRenderExplorationTab({
                    engine:this,state,w,events,entries,text,fields,areaSceneBody,exists,details,
                    empty,section,eventCard
                });
            }else if(this.tab==='资产'){
                const ownersOf=asset=>Array.from(new Set((Object.hasOwn(asset,'所属对象')?(Array.isArray(asset.所属对象)?asset.所属对象:[asset.所属对象]):['<user>']).map(x=>String(x??'').trim()).filter(x=>x&&x!=='无主')));
                const assets=entries(s.资产).filter(([,asset])=>plain(asset));
                const list=assets.filter(([name,asset])=>{
                    const owners=ownersOf(asset),category=this.filter||'全部';
                    return (category==='全部'||category==='玩家相关'&&owners.includes('<user>')||category==='共同持有'&&owners.length>1||category==='无主'&&!owners.length)&&matched(name,{...asset,归属:owners.join(' ')});
                });
                html+=tools(['全部','玩家相关','共同持有','无主']);
                html+=section('资产与归属',list.map(([name,asset])=>{
                    const owners=ownersOf(asset);
                    const ownerLinks=owners.length?owners.map(owner=>{
                        const label=owner==='<user>'?(userName||'玩家'):owner;
                        if(owner!=='<user>'&&(relationNamesByKey.has(nameKey(owner))||people.has(owner)))return '<button data-jump-person="'+text(relationNamesByKey.get(nameKey(owner))||owner)+'">'+text(label)+' ↗</button>';
                        if(Object.hasOwn(w.势力||{},owner))return '<button data-faction="'+text(owner)+'" data-asset-owner>'+text(label)+' ↗</button>';
                        return pill(label,'dim');
                    }).join(''):pill('无主','dim');
                    return '<article class="we-card" data-asset-card="'+text(name)+'"><div class="we-card-top"><h3>'+text(name)+'</h3>'+pill(asset.类型||'类型未记录','dim')+'</div><div class="we-tools"><b>所属对象</b>'+ownerLinks+(owners.length>1?pill('共同持有','future'):'')+'</div><p>'+text(asset.状态||'状态未记录')+'</p>'+fields({主体规模:asset.主体规模,完整度:asset.完整度==null?undefined:asset.完整度+'%'})+details('asset-'+name,{能源:asset.能源,建设序列:asset.建设序列,驻扎人员:asset.驻扎人员,待办事件:asset.待办事件},'运转详情 · 建设 / 驻扎 / 待办')+'</article>';
                }).join('')||empty('暂无符合条件的资产'),'共 '+assets.length+' 项 · 可按名称、所属对象或状态搜索');
            }else if(this.tab==='世界事件'){
                html+=worldEngineRenderWorldEventsTab({
                    engine:this,events,matched,tools,section,timelineCards,empty
                });
            }else if(this.tab==='传闻'){
                html+=tools();
                for(const category of ['街头巷议','情报交易','布告与檄文'])html+=section(category,entries((s.传闻||{})[category]).filter(([n,r])=>matched(n,r)).map(([n,r])=>'<article class="we-card"><h3>'+text(n)+'</h3><p>'+text(r.内容||r.摘要)+'</p>'+fields({来源:r.来源||r.卖家||r.发布者,可信度:r.可信度,要价:r.要价,位置:r.张贴位置})+details('rumor-'+n,{真实内幕:r.真实内幕},'主持人档案')+'</article>').join('')||empty('暂无'+category,'传闻来自已发生事件与传播渠道。'));
                html+=section('传播链',entries(state.传播).map(([n,r])=>'<article class="we-card"><div class="we-card-top"><h3>'+text(n)+'</h3>'+pill(r.状态,'dim')+'</div><p>'+text(r.内容)+'</p>'+fields({时间:r.时间,来源:r.来源,范围:r.范围,受众:r.受众,到期时间:r.到期时间})+details('spread-'+n,{关联事件:r.关联事件,引发行动:r.引发行动,真相:r.真相},'因果与传播详情')+'</article>').join('')||empty('尚无传播链'));
            }else if(this.tab==='运行记录'){
                html+=worldEngineRenderRunRecordTab({
                    state,radar,showRadar,exists,section,text,entries,fields,empty,pill
                });
            }else if(this.tab==='设置'){
                const api=this.normalizeDedicatedApi(this.config.dedicatedApi);
                const fontButtons=Object.entries(WORLD_FONT_SCALES).map(([key,item])=>'<button class="we-setting-btn '+(this.config.fontScale===key?'active':'')+'" data-font-option="'+key+'">'+text(item.name)+' · '+text(item.size)+'</button>').join('');
                const presets=api.apiPresets.map(p=>'<option value="'+text(p.name)+'">'+text(p.name)+'</option>').join('');
                const modelOptions=Array.from(new Set([api.model,...api.fetchedModels].filter(Boolean))).map(model=>'<option value="'+text(model)+'"></option>').join('');
                const terminalReady=!!(this.host.Samsara?.terminal?.apiReady?.());
                const sourceState=this.usesDedicatedApi()
                    ?(this.dedicatedApiReady()?'专属 API 已就绪':'专属 API 已接管，但配置尚不完整')
                    :(terminalReady?'使用主神终端额外模型':'主神终端额外模型尚未准备好');
                html+=section('界面字号','<div class="we-setting-row"><div class="we-setting-copy"><b>界面字号</b><small>色调跟随主神终端；这里仅调整世界推进自己的文字大小。</small></div><div class="we-setting-actions">'+fontButtons+'</div></div>','色调跟随主神终端 · 默认标准 16px');
                const historyToProse=this.config.sendHistoryToProse===true;
                html+=section('历史记忆','<div class="we-setting-row"><div class="we-setting-copy"><b>向正文提供历史记忆</b><small>开启后，正文AI额外读取“近期原始锚点 + 更早长期总结”；关闭只影响正文，世界推进自身仍始终使用完整的分层历史脉络。</small></div><div class="we-setting-actions"><button class="we-setting-btn we-switch '+(historyToProse?'on':'')+'" data-action="history-prose-toggle"><span>'+text(historyToProse?'已启用':'未启用')+'</span><span class="we-switch-track"><i></i></span></button></div></div>','默认关闭 · 原始历史事实不会因关闭而删除');
                html+=section('模型接口',
                    '<div class="we-setting-row"><div class="we-setting-copy"><b>当前调用来源</b><small>'+text(sourceState)+'</small></div><div class="we-setting-actions"><span class="we-source-badge">'+text(this.apiSourceLabel())+'</span></div></div>'
                    +'<div class="we-setting-row"><div class="we-setting-copy"><b>世界推进专属 API</b><small>开启后世界推进只走这里，不再调用状态栏 / 主神终端的 API；即使配置不完整也不会偷偷回退。</small></div><div class="we-setting-actions"><button class="we-setting-btn we-switch '+(api.enabled?'on':'')+'" data-action="dedicated-toggle"><span>'+text(api.enabled?'已启用':'未启用')+'</span><span class="we-switch-track"><i></i></span></button></div></div>'
                    +(api.enabled
                        ?'<div class="we-api-toolbar"><select class="we-setting-input" data-dedicated-preset><option value="">— 选择已保存 API 预设 —</option>'+presets+'</select><input class="we-setting-input" data-dedicated-preset-name maxlength="80" placeholder="预设名称"><button class="we-setting-btn" data-action="dedicated-preset-save">保存预设</button><button class="we-setting-btn" data-action="dedicated-preset-delete">删除预设</button></div>'
                         +'<div class="we-api-grid"><label class="wide">API 地址<input class="we-setting-input" data-dedicated-field="apiUrl" value="'+text(api.apiUrl)+'" placeholder="https://example.com/v1"></label><label class="wide">API Key<input class="we-setting-input" data-dedicated-field="apiKey" type="password" value="'+text(api.apiKey)+'" autocomplete="off" placeholder="sk-..."></label><label>模型<input class="we-setting-input" data-dedicated-field="model" list="we-dedicated-models" value="'+text(api.model)+'" placeholder="输入或加载模型名"><datalist id="we-dedicated-models">'+modelOptions+'</datalist></label><label>模型目录<span class="we-setting-actions"><button class="we-setting-btn" data-action="dedicated-models">加载模型 / 测试连接</button></span></label></div>'
                         +'<p class="we-muted">接口按 OpenAI-compatible /v1/chat/completions 与 /v1/models 方式连接，并保留 JSON Schema → JSON Object → 普通文本的结构化兼容降级。</p>'
                        :'<div class="we-notice">当前关闭专属 API。世界推进继续使用主神终端「额外模型配置」；这里不会复制或读取状态栏里的 API Key。</div>')
                    ,'接口配置只存本地 localStorage，不写入 MVU');
            }else if(this.tab==='提示词预设'){
                const promptView=this.promptDraft||{
                    preset:this.config.preset,
                    corePrompt:this.config.corePrompt??CORE_WORLD_RULES,
                    macroPrompt:this.config.macroPrompt??DEFAULT_MACRO_PROMPT,
                    stabilityPromptTemplate:this.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE,
                    structurePrompt:this.config.structurePrompt,
                    npcAuditPrompt:this.config.npcAuditPrompt,
                    contextTurns:this.config.contextTurns||6,
                    activationMode:this.config.activationMode||'respect_activation',
                    selectedEntries:Array.isArray(this.config.selectedEntries)?copy(this.config.selectedEntries):null
                };
                const docs=this.getPromptDocuments(),activeDoc=docs.find(doc=>doc.id===this.config.activePromptDocumentId);
                html+='<div class="we-preset-toolbar"><div><b>提示词工作台</b><small>主要操作固定在顶部，不需要再滚到页面底部寻找保存。</small></div><div><button class="we-btn we-primary" data-action="save">保存当前设置</button><button class="we-btn" data-action="save-default">保存为个人默认</button><button class="we-btn" data-action="preview">预览下一次请求</button></div></div>';
                html+=section('预设文档','<div class="we-doc-create"><input data-doc-name maxlength="80" placeholder="文档名称，例如：原著推进·标准" value="'+text(activeDoc?.builtin?'':activeDoc?.name||'')+'"><button class="we-btn we-primary" data-action="doc-save">保存为文档</button><button class="we-btn" data-action="doc-import">导入文档</button><input data-doc-import type="file" accept=".json,application/json" hidden></div>'+
                    (docs.length?'<div class="we-doc-list">'+docs.map(doc=>'<div class="we-doc-row"><div><b>'+text(doc.name)+(doc.builtin?' <span class="we-doc-badge">内置默认</span>':'')+'</b><small>'+text(doc.updatedAt?new Date(doc.updatedAt).toLocaleString():'未记录时间')+(doc.id===this.config.activePromptDocumentId?' · 当前应用':'')+'</small></div><span class="we-doc-actions"><button data-action="doc-apply" data-doc-id="'+text(doc.id)+'">应用</button><button data-action="doc-export" data-doc-id="'+text(doc.id)+'">导出</button>'+(doc.builtin?'':'<button data-action="doc-delete" data-doc-id="'+text(doc.id)+'">删除</button>')+'</span></div>').join('')+'</div>':empty('还没有预设文档','保存当前设置后，可以在这里应用、导出或删除。')),'内置“默认设置”始终跟随代码版本；“保存为个人默认”会另存全部可编辑提示词、正文窗口与资料范围，不会覆盖内置模板');
                html+='<div class="we-notice">世界书目录会读取角色主书、角色附加书、当前聊天绑定书和酒馆全局启用书。蓝绿灯表示条目触发方式；“实际读取”仍以请求检查中的本次清单为准。</div>';
                const groups=new Map();
                for(const e of this.bookCatalogue||[]){if(!groups.has(e.book))groups.set(e.book,[]);groups.get(e.book).push(e);}
                const selectedEntries=Array.isArray(promptView.selectedEntries)?promptView.selectedEntries:null;
                const selected=e=>!e.technical&&(this.isNpcAuditWorldbook(e)?this.isNpcBuildAuditEnabled():selectedEntryMatches(e,selectedEntries));
                html+=section('资料读取范围','<div class="we-config-row"><label>正文窗口 <input data-floors type="number" min="1" max="100" value="'+text(promptView.contextTurns||6)+'"> 层</label><label>读取方式 <select data-activation><option value="respect_activation" '+(promptView.activationMode!=='force_selected'?'selected':'')+'>遵循蓝绿灯</option><option value="force_selected" '+(promptView.activationMode==='force_selected'?'selected':'')+'>强制读取勾选项</option></select></label></div><p class="we-muted">遵循蓝绿灯：蓝灯常驻，绿灯扫描上述正文窗口关键词；禁用项不读。强制模式可纳入普通禁用项，但 [variables]、[mvu_update]、正文额外思考及任务/输出技术条目始终隔离。未绑定且未全局启用的世界书不会被自动读取。</p><div class="we-tools"><button data-action="books">加载 / 刷新目录</button><button data-action="book-all">全选</button><button data-action="book-none">全不选</button></div>'+
                    (groups.size?Array.from(groups).map(([book,list])=>'<details class="we-book" open><summary>'+text(book)+' <small>'+text((list[0]?.sources||[]).join(' · ')||'已绑定')+' · '+list.filter(selected).length+' / '+list.length+' 项已勾选</small></summary><div class="we-book-list">'+list.map(e=>{
                        const report=(this.readReport||[]).find(r=>r.世界书===e.book&&r.条目ID===e.id);
                        return '<label class="we-book-row"><input type="checkbox" data-book value="'+text(JSON.stringify([e.book,e.id]))+'" '+(selected(e)?'checked':'')+' '+(e.technical?'disabled':'')+'><span class="we-lamp '+(e.technical?'gray':e.mode==='constant'?'blue':e.mode==='selective'?'green':'gray')+'" title="'+text(e.technical?'技术条目 · 已隔离':e.mode==='constant'?'蓝灯 · 常驻':e.mode==='selective'?'绿灯 · 关键词触发':'其他激活方式')+'"></span><span class="we-book-title"><b>'+text(e.title)+'</b><small>'+text(e.technical?'技术条目 · 世界引擎不读取':(e.mode==='constant'?'常驻':e.mode==='selective'?'关键词：'+(Array.isArray(e.keys)?e.keys.map(k=>typeof k==='string'?k:'正则条件').join('、'):e.keys):e.mode)+(e.enabled?'':' · 已禁用'))+'</small></span><small class="we-read-state">'+text(report?'上次检查：'+report.原因:e.technical?'固定隔离':'尚未检查')+'</small></label>';
                    }).join('')+'</div></details>').join(''):empty('尚未加载目录','点击“加载 / 刷新目录”读取当前绑定和全局启用的世界书。')));
                const segments=splitPresetSegments(promptView.preset);
                html+=section('分段提示词','<div class="we-segment-toolbar"><span>默认只读，展开查看；开启编辑后可修改。</span><button class="we-btn" data-action="prompt-edit" aria-pressed="'+!!this.promptEditing+'">'+(this.promptEditing?'锁定编辑':'开启编辑')+'</button><button class="we-btn" data-action="segment-add" '+(this.promptEditing?'':'disabled')+'>＋ 新增分段</button></div><div class="we-segment-list" data-segment-list>'+segments.map((part,i)=>'<details class="we-segment" data-segment-row><summary>'+text(part.title||'未命名分段')+' <small>'+formatTokenCount(estimateTokens(part.body),true)+'</small></summary><div class="we-segment-head"><input '+(this.promptEditing?'':'readonly')+' data-segment-title aria-label="分段标题 '+i+'" placeholder="分段标题（可留空）" value="'+text(part.title)+'"><small>'+formatTokenCount(estimateTokens(part.body),true)+'</small><span class="we-segment-actions"><button type="button" '+(this.promptEditing?'':'disabled')+' data-action="segment-up" title="上移">↑</button><button type="button" '+(this.promptEditing?'':'disabled')+' data-action="segment-down" title="下移">↓</button><button type="button" '+(this.promptEditing?'':'disabled')+' data-action="segment-delete" title="删除">删除</button></span></div><textarea '+(this.promptEditing?'':'readonly')+' data-segment="'+i+'" data-title="'+text(part.title)+'" aria-label="预设分段 '+i+'">'+text(part.body)+'</textarea></details>').join('')+'</div><p class="we-muted">这些分段属于主要工作层，可以新增、删除或调整顺序。核心约束与条件提示词在下方单独编辑，并与同一预设文档一起保存。</p>');
                html+=section('系统提示词','<div class="we-notice">这里展示的文本都会直接参与实际 system 请求，并随预设文档保存、应用、导入和导出。条件提示词只在对应条件成立时发送；只有程序字段 Schema 保持固定。</div>'+                    '<details class="we-segment"><summary>世界引擎核心约束 · '+(this.promptEditing?'编辑中':'点击展开')+'</summary><textarea data-core-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.corePrompt??CORE_WORLD_RULES)+'</textarea><p class="we-muted">始终发送。可修改或留空；留空即不额外注入核心约束。</p></details>'+                    '<details class="we-segment"><summary>宏观骨架交付 · 条件提示词</summary><textarea data-macro-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.macroPrompt??DEFAULT_MACRO_PROMPT)+'</textarea><p class="we-muted">仅在本轮需要建立/补足宏观骨架时发送。</p></details>'+                    '<details class="we-segment"><summary>世界自救 · 条件提示词模板</summary><textarea data-stability-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE)+'</textarea><p class="we-muted">世界稳定值低于100且未开启世界超稳时发送。可使用 {{阶段}}、{{稳定值}}、{{规则}} 占位符。</p></details>'+                    '<details class="we-segment"><summary>角色管理 · NPC构筑审计 · '+(this.isNpcBuildAuditEnabled()?'当前启用':'当前关闭')+'</summary><textarea data-npc-audit-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.npcAuditPrompt??NPC_BUILD_AUDIT_RULES)+'</textarea><p class="we-muted">无论开关状态都可编辑并保存；只有开启审计且本轮存在审计对象时才发送。</p></details>','核心与条件提示词均可编辑');
                html+=section('WorldResult 输出协议','<details class="we-segment"><summary>WorldResult 协议说明 · 点击展开</summary><textarea data-structure-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())+'</textarea></details><details class="we-segment"><summary>程序字段 Schema · 只读</summary><textarea readonly>'+text(JSON.stringify(WORLD_RESULT_SCHEMA,null,2))+'</textarea></details><p class="we-muted">协议说明使用上方编辑开关。保存后用于实际 system 请求；Schema 固定只读，修改任何文字提示词都不会改变程序变量结构。</p>');
            }else if(this.tab==='请求检查'){
                const fold=(title,body)=>'<details class="we-inspect"><summary>'+text(title)+'</summary><div class="we-inspect-body">'+body+'</div></details>';
                const raw=(label,v)=>fold(label,'<textarea class="we-raw" readonly>'+text(v)+'</textarea>');
                const readable=(name,v)=>Array.isArray(v)?v.map((item,i)=>fold((item.名称||item.楼层!==undefined&&(item.角色+' · 第 '+item.楼层+' 层')||name+' '+(i+1)),fields(item))).join(''):fields(plain(v)?v:{内容:v});
                const retryLog=(this.lastRetryLog||[]).map(item=>{
                    const feedback=retryFeedback(item.错误,Array.isArray(item.片段)?item.片段:[],Array.isArray(item.补充清单)?item.补充清单:[]);
                    const details=feedback.issues.length?'<p><b>具体问题</b><br>'+feedback.issues.map(text).join('<br>')+'</p>':'';
                    const guidance=feedback.actions.length?'<p><b>修复要求</b><br>'+feedback.actions.map(text).join('<br>')+'</p>':'';
                    return '<div class="we-change"><time>#'+text(item.尝试)+'</time><div><b>模型回复被拒绝</b><p>'+text(feedback.summary)+'</p>'+details+guidance+'</div></div>';
                }).join('');
                const tokenLabel=(value,estimated=true)=>Number.isFinite(Number(value))?formatTokenCount(Number(value),estimated):'—';
                html+=section('失败自动重试','<div class="we-config-row"><label>最大尝试次数 <input data-retries type="number" min="1" max="5" value="'+text(this.config.retryAttempts??5)+'"> 次</label><span class="we-muted">包含首次请求。1 = 只请求一次；5 = 最多总共尝试 5 次。只纠正 WorldResult 业务结果/编译校验，危险越权、上下文变化和写入未确认不会自动重试。</span></div>'+(this.lastAttemptCount?'<p class="we-muted">最近一次共尝试 '+text(this.lastAttemptCount)+' 次；每次模型业务拒绝都会在下方完整保留，包括最后一次失败。</p>':'')+(retryLog||''));
                html+='<div class="we-tools"><button data-action="preview">生成下一次请求预览（不调用 API）</button></div>';
                for(const [label,r] of [['最近实际发送',this.lastRequest],['下一次请求预览',this.previewRequest]]){
                    if(!r){html+=section(label,empty('暂无'+label));continue;}
                    const m=r.manifest||{},books=m.世界书条目||[],floors=m.正文楼层||[],obs=m.观测||requestTokenTelemetry(r.system,r.input,r.schema||WORLD_RESULT_SCHEMA);
                    const readChecks=(m.读取判定||[]).filter(item=>item.读取===true);
                    const exactInput=obs.实际输入Tokens!=null,exactOutput=obs.实际输出Tokens!=null;
                    let body='<div class="we-request-summary">'+pill(m.输出协议||'WorldResult v1','dim')+pill('结构化 '+(obs.结构化实际模式||m.结构化输出||'auto'),'dim')+pill(obs.接口来源||m.接口来源||this.apiSourceLabel(),'dim')+pill(books.length+' 条世界书','dim')+pill(floors.length+' 层正文','dim')+pill((exactInput?tokenLabel(obs.实际输入Tokens,false):tokenLabel(obs.请求估算Tokens,true))+' 输入','dim')+(obs.输出估算Tokens!=null?pill((exactOutput?tokenLabel(obs.实际输出Tokens,false):tokenLabel(obs.输出估算Tokens,true))+' 输出','dim'):'')+(m.尝试序号?pill('尝试 '+m.尝试序号,'dim'):'')+(m.最大尝试次数!==undefined?pill('最多尝试 '+m.最大尝试次数,'dim'):'')+'</div>';
                    const userTokenFields=Object.fromEntries((obs.User分段||[]).map(item=>[item.名称,tokenLabel(item.估算Tokens,true)]));
                    body+='<p class="we-muted">带“≈”的 tk 只是本地容量粗估，不等于服务商真实 token；主神终端通道拿不到 usage 时无法确认精确总量。总输入 = System + 下列 User 分项；这里不再重复显示 User 总项或 Schema 子项。专属 API 返回 usage 时仅总输入/输出改用服务端实际 token。</p>';
                    body+=fold('Token 构成（点击展开）',fields(Object.assign({总输入:exactInput?tokenLabel(obs.实际输入Tokens,false):tokenLabel(obs.请求估算Tokens,true),System:tokenLabel(obs.System估算Tokens,true)},userTokenFields,{接口:obs.接口来源||m.接口来源||'',模型:obs.模型||'',模式尝试:Array.isArray(obs.模式尝试)&&obs.模式尝试.length?obs.模式尝试.join(' → '):'',耗时:Number.isFinite(Number(obs.耗时毫秒))?(Number(obs.耗时毫秒)/1000).toFixed(2).replace(/\.00$/,'')+' s':''}))+fold('system 分段',fields({分段:(obs.System分段||[]).map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))})));
                    body+=fold('本轮实际读取资料（点击展开）',(readChecks.length?readable('条目',readChecks):empty('本轮未读取世界书','没有勾选命中或强制读取的世界书条目。'))+fold('实际读取世界书',fields({条目:books.map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))}))+fold('实际正文楼层',fields({楼层:floors.map(f=>'第 '+f.楼层+' 层 · '+f.角色+' · '+tokenLabel(f.估算Tokens,true))}))+fold('时间容量',fields(m.本轮时间容量||{})));
                    body+=fold('输出契约 · JSON Schema',raw('samsara_world_result_v1',JSON.stringify(r.schema||WORLD_RESULT_SCHEMA,null,2)));
                    body+=fold('system · 分段阅读',r.system.split(/\n(?=【)/).map((part,i)=>fold((part.match(/^【([^】]+)】/)||[])[1]||'身份 / 协议 '+(i+1),'<div class="we-prose">'+text(part)+'</div>')).join(''))+raw('system · 实际发送原文',r.system);
                    let payload;try{payload=JSON.parse(r.input);}catch(_){payload={正文:r.input};}
                    body+=fold('user · 分段阅读',Object.entries(payload).map(([name,v])=>fold(name,readable(name,v))).join(''))+raw('user · 实际发送原文',r.input);
                    html+=section(label,body);
                }
                if(this.lastWorldResult)html+=section('最近 WorldResult · 业务层',raw('模型已接受并累计的业务结果',JSON.stringify(this.lastWorldResult,null,2)));
                if((this.lastCompiledPatches||[]).length)html+=section('程序编译补丁 · 存储层',raw('由 WorldResult Compiler 生成，模型不直接控制这些路径',JSON.stringify(this.lastCompiledPatches,null,2)));
                if((this.lastCompileWarnings||[]).length)html+=section('编译警告',(this.lastCompileWarnings||[]).map(w=>'<div class="we-notice">'+text(w)+'</div>').join(''));
                if(this.lastFailure)html+='<div class="we-notice">'+text(this.lastFailure)+'</div>';
                if(this.lastReply){const lastAttempt=(this.lastAttemptTelemetry||[]).at(-1),replyTk=lastAttempt?.API输出Tokens!=null?formatTokenCount(lastAttempt.API输出Tokens,false):formatTokenCount(estimateTokens(this.lastReply),true);html+=section('副 API 原始回复 · '+replyTk,raw('查看模型返回原文（用于定位格式问题）',this.lastReply));}
            }
            main.innerHTML=html;main.scrollTop=force?0:scroll;
            if(this.jumpEvent){
                const jumpName=this.jumpEvent;
                const target=Array.from(main.querySelectorAll('[data-event-card]')).find(el=>el.dataset.eventCard===jumpName);
                if(target){
                    target.classList.add('is-jump');
                    target.scrollIntoView({behavior:'smooth',block:'center'});
                    setTimeout(()=>target.classList.remove('is-jump'),1200);
                }
                this.jumpEvent='';
            }
        }
        dispose() {
            this.close(); this.disposed = true; this.cancel(); clearTimeout(this.initTimer);
            this.unsub.forEach(off => off()); this.unsub = [];
            if (this.keyHandler) this.host.document.removeEventListener('keydown',this.keyHandler,true);
            if (this.panel) this.panel.remove(); if (this.style) this.style.remove();
            if (this.mount) this.mount.remove();
        }
    }
