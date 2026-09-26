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
                html+=(this.services?.views?.render('world',{
                    engine:this,s,w,orbit,events,active,future,people,calendarCandidates,snapshot,
                    entries,text,empty,section,stabilityDescription,parseDate,calendar,tools,
                    timelineCards,exists,fields,prose,compactPerson
                })??worldEngineRenderWorldTab({engine:this,s,w,orbit,events,active,future,people,calendarCandidates,snapshot,entries,text,empty,section,stabilityDescription,parseDate,calendar,tools,timelineCards,exists,fields,prose,compactPerson}));
            }else if(this.tab==='角色管理'){
                html+=(this.services?.views?.render('people',{
                    engine:this,s,radar,showRadar,alienAlive,entries,formalPeople,backstagePeople,
                    relationRoster,matched,userName,section,text,pill,fields,contextRows,
                    sceneContextBody,empty,tools,person,exists,value
                })??worldEngineRenderPeopleTab({engine:this,s,radar,showRadar,alienAlive,entries,formalPeople,backstagePeople,relationRoster,matched,userName,section,text,pill,fields,contextRows,sceneContextBody,empty,tools,person,exists,value}));
            }else if(this.tab==='探索与势力'){
                html+=(this.services?.views?.render('exploration',{
                    engine:this,state,w,events,entries,text,fields,areaSceneBody,exists,details,
                    empty,section,eventCard
                })??worldEngineRenderExplorationTab({engine:this,state,w,events,entries,text,fields,areaSceneBody,exists,details,empty,section,eventCard}));
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
                html+=(this.services?.views?.render('events',{
                    engine:this,events,matched,tools,section,timelineCards,empty
                })??worldEngineRenderWorldEventsTab({engine:this,events,matched,tools,section,timelineCards,empty}));
            }else if(this.tab==='传闻'){
                html+=tools();
                for(const category of ['街头巷议','情报交易','布告与檄文'])html+=section(category,entries((s.传闻||{})[category]).filter(([n,r])=>matched(n,r)).map(([n,r])=>'<article class="we-card"><h3>'+text(n)+'</h3><p>'+text(r.内容||r.摘要)+'</p>'+fields({来源:r.来源||r.卖家||r.发布者,可信度:r.可信度,要价:r.要价,位置:r.张贴位置})+details('rumor-'+n,{真实内幕:r.真实内幕},'主持人档案')+'</article>').join('')||empty('暂无'+category,'传闻来自已发生事件与传播渠道。'));
                html+=section('传播链',entries(state.传播).map(([n,r])=>'<article class="we-card"><div class="we-card-top"><h3>'+text(n)+'</h3>'+pill(r.状态,'dim')+'</div><p>'+text(r.内容)+'</p>'+fields({时间:r.时间,来源:r.来源,范围:r.范围,受众:r.受众,到期时间:r.到期时间})+details('spread-'+n,{关联事件:r.关联事件,引发行动:r.引发行动,真相:r.真相},'因果与传播详情')+'</article>').join('')||empty('尚无传播链'));
            }else if(this.tab==='运行记录'){
                html+=(this.services?.views?.render('history',{
                    state,radar,showRadar,exists,section,text,entries,fields,empty,pill
                })??worldEngineRenderRunRecordTab({state,radar,showRadar,exists,section,text,entries,fields,empty,pill}));
            }else if(this.tab==='设置'){
                html+=(this.services?.views?.render('settings',{engine:this,section,text})??worldEngineRenderSettingsTab({engine:this,section,text}));
            }else if(this.tab==='提示词预设'){
                html+=(this.services?.views?.render('prompts',{engine:this,text,section,empty})??worldEngineRenderPromptTab({engine:this,text,section,empty}));
            }else if(this.tab==='请求检查'){
                html+=(this.services?.views?.render('requestInspector',{engine:this,text,section,empty,fields,pill})??worldEngineRenderRequestInspector({engine:this,text,section,empty,fields,pill}));
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
