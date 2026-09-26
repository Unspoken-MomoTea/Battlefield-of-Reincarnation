    class WorldAutoProgressController {
        constructor(engine){this.engine=engine;}
        initialize(){
            const e=this.engine;let dirty=false;
            if(!Object.hasOwn(e.config,'autoProgress')){e.config.autoProgress=true;dirty=true;}
            else e.config.autoProgress=e.config.autoProgress!==false;
            const hadInterval=Object.hasOwn(e.config,'autoProgressInterval'),value=Number(e.config.autoProgressInterval);
            e.config.autoProgressInterval=Math.max(1,Math.min(20,Number.isFinite(value)?Math.round(value):2));
            if(!hadInterval)dirty=true;
            this.resetCycle();
            if(dirty)e.saveConfig();
        }
        interval(){
            const value=Number(this.engine.config.autoProgressInterval);
            return Math.max(1,Math.min(20,Number.isFinite(value)?Math.round(value):2));
        }
        contextKey(snapshot){
            let chat='';try{chat=String(JSON.parse(String(snapshot?.fingerprint||''))?.[0]??'');}catch(_){}
            return chat+'\u0000'+String(snapshot?.stat?.世界?.名称||'');
        }
        fingerprintChat(fingerprint){
            try{return String(JSON.parse(String(fingerprint||''))?.[0]??'');}catch(_){return '';}
        }
        backendHasContent(snapshot){
            const backend=snapshot?.stat?.世界?.[PATH];if(!plain(backend))return false;
            const maps=['事件','人物','势力地区','历史','历史总结','传播'];
            if(maps.some(key=>plain(backend[key])&&Object.keys(backend[key]).length>0))return true;
            return Array.isArray(backend.最近变化)&&backend.最近变化.length>0;
        }
        initializeCycle(snapshot){
            const e=this.engine,key=this.contextKey(snapshot);
            if(e.autoProgressCycleKey===key)return;
            e.autoProgressCycleKey=key;e.autoProgressRoundsSinceRun=0;
            const handled=String(snapshot?.stat?.世界?.[PATH]?.已处理楼层||'');
            const currentChat=this.fingerprintChat(snapshot?.fingerprint),handledChat=this.fingerprintChat(handled);
            const sameContext=!!handled&&(!currentChat||!handledChat||currentChat===handledChat);
            const restoredRun=sameContext&&this.backendHasContent(snapshot);
            e.autoProgressHasRun=restoredRun;e.autoProgressLastSeenFingerprint=restoredRun?handled:'';e.autoProgressDueFingerprint=restoredRun?handled:'';
        }
        fingerprintParts(fingerprint){
            try{const parsed=JSON.parse(String(fingerprint||''));return {chat:String(parsed?.[0]??''),id:Number(parsed?.[1]),swipe:Number(parsed?.[2]||0),digest:String(parsed?.[3]??'')};}
            catch(_){return {chat:'',id:NaN,swipe:0,digest:''};}
        }
        sameFloor(left,right){
            const a=this.fingerprintParts(left),b=this.fingerprintParts(right);
            return !!a.chat&&a.chat===b.chat&&Number.isFinite(a.id)&&a.id===b.id;
        }
        duringExtraAnalysis(){
            const e=this.engine,mvu=e.env.Mvu||e.host.Mvu;
            try{return mvu?.isDuringExtraAnalysis?.()===true;}catch(_){return false;}
        }
        shouldSchedule(snapshot){
            const e=this.engine;this.initializeCycle(snapshot);
            const fingerprint=String(snapshot?.fingerprint||'');if(!fingerprint)return false;
            const handled=String(snapshot?.stat?.世界?.[PATH]?.已处理楼层||'');
            if(e.autoProgressLastSeenFingerprint===fingerprint)return e.autoProgressDueFingerprint===fingerprint&&handled!==fingerprint;
            const previous=e.autoProgressLastSeenFingerprint;
            if(previous&&this.sameFloor(previous,fingerprint)){
                const wasDue=e.autoProgressDueFingerprint===previous;
                e.autoProgressLastSeenFingerprint=fingerprint;
                if(wasDue)e.autoProgressDueFingerprint=fingerprint;
                return wasDue;
            }
            e.autoProgressLastSeenFingerprint=fingerprint;
            if(e.autoProgressHasRun)e.autoProgressRoundsSinceRun++;
            const due=!e.autoProgressHasRun||e.autoProgressRoundsSinceRun>=this.interval();
            if(due)e.autoProgressDueFingerprint=fingerprint;
            return due;
        }
        markRun(snapshot){
            const e=this.engine;if(snapshot)this.initializeCycle(snapshot);
            e.autoProgressHasRun=true;e.autoProgressRoundsSinceRun=0;
            if(snapshot?.fingerprint){e.autoProgressLastSeenFingerprint=String(snapshot.fingerprint);e.autoProgressDueFingerprint=String(snapshot.fingerprint);}
        }
        resetCycle(){
            const e=this.engine;
            e.autoProgressCycleKey='';e.autoProgressLastSeenFingerprint='';e.autoProgressDueFingerprint='';e.autoProgressRoundsSinceRun=0;e.autoProgressHasRun=false;e.autoProgressWaitingForVariable=false;
        }
        blocked(snapshot,baseReason=''){
            if(snapshot?.stat?.系统状态?.是否战斗中===true)return '战斗中，世界推进暂停';
            return baseReason;
        }
        schedule(source='variable-update',attempt=0){
            const e=this.engine;
            if(e.config.autoProgress!==true){if(e.timer){clearTimeout(e.timer);e.timer=null;}return;}
            if(e.disposed||e.committing||!e.isEnabled())return;
            if(e.busy){e.pending=true;return;}
            const trigger=String(source||'variable-update'),proseTrigger=trigger==='generation-ended'||trigger==='message-received';
            const tries=Math.max(0,Number(attempt)||0);
            if(proseTrigger&&this.duringExtraAnalysis()){
                e.autoProgressWaitingForVariable=true;clearTimeout(e.timer);
                if(tries<120)e.timer=setTimeout(()=>{e.timer=null;this.schedule(trigger,tries+1);},1000);
                return;
            }
            e.autoProgressWaitingForVariable=false;clearTimeout(e.timer);
            const delay=proseTrigger?(tries>0?250:800):900;
            e.timer=setTimeout(()=>{
                e.timer=null;
                if(e.config.autoProgress!==true||e.disposed||e.committing||!e.isEnabled())return;
                if(e.busy){e.pending=true;return;}
                if(proseTrigger&&this.duringExtraAnalysis()){
                    e.autoProgressWaitingForVariable=true;
                    if(tries<120)e.timer=setTimeout(()=>{e.timer=null;this.schedule(trigger,tries+1);},1000);
                    return;
                }
                let snapshot;
                try{snapshot=e.snapshot();}
                catch(_){
                    if(proseTrigger&&tries<4)e.timer=setTimeout(()=>{e.timer=null;this.schedule(trigger,tries+1);},250);
                    return;
                }
                e.autoProgressWaitingForVariable=false;
                const reason=e.blocked(snapshot);
                if(reason){e.status=reason;e.render();return;}
                if(!this.shouldSchedule(snapshot))return;
                e.run({automatic:true}).catch(()=>{});
            },delay);
        }
        async aroundRun(next,_options={}){
            let snapshot=null;try{snapshot=this.engine.snapshot();}catch(_){}
            const result=await next();
            if(result===true)this.markRun(snapshot);
            return result;
        }
        toggle(){
            const e=this.engine;e.config.autoProgress=!e.config.autoProgress;
            if(!e.config.autoProgress){
                if(e.timer){clearTimeout(e.timer);e.timer=null;}e.pending=false;e.status='自动推进已关闭 · 可手动推进';
            }else{this.resetCycle();e.status='自动推进已开启';}
            e.saveConfig();e.render(true);return e.config.autoProgress;
        }
        mountTopControl(){
            const e=this.engine;if(!e.panel)return;
            const header=e.panel.querySelector('header'),run=header?.querySelector('[data-action="run"]');if(!header||!run)return;
            let button=header.querySelector('[data-auto-progress-toggle-top]');
            if(!button){
                button=e.host.document.createElement('button');button.type='button';button.className='we-btn we-switch';button.dataset.autoProgressToggleTop='';
                run.insertAdjacentElement('beforebegin',button);
                button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();this.toggle();});
            }
            button.classList.toggle('on',e.config.autoProgress===true);button.setAttribute('aria-pressed',String(e.config.autoProgress===true));
            button.title=e.config.autoProgress?'自动推进已开启':'自动推进已关闭';
            button.innerHTML='<span>自动推进</span><span class="we-switch-track"><i></i></span>';
        }
        mountIntervalSetting(){
            const e=this.engine;if(e.tab!=='请求检查'||!e.panel)return;
            const main=e.panel.querySelector('main');if(!main)return;
            let section=main.querySelector('[data-auto-progress-interval-setting]');
            if(!section){
                section=e.host.document.createElement('section');section.className='we-section';section.dataset.autoProgressIntervalSetting='';
                const retry=[...main.querySelectorAll('.we-section')].find(item=>item.querySelector('.we-section-head h2')?.textContent?.trim()==='失败自动重试');
                if(retry)main.insertBefore(section,retry);else main.prepend(section);
            }
            const enabled=e.config.autoProgress===true,interval=this.interval();
            section.innerHTML='<div class="we-section-head"><h2>自动推进频率</h2><small>正文轮次</small></div>'
                +'<div class="we-config-row"><label>推进间隔 <input data-auto-progress-interval type="number" min="1" max="20" value="'+interval+'" '+(enabled?'':'disabled')+'> 轮</label><span class="we-muted">'
                +(enabled?'首次符合条件、或检测到世界后台尚未建立时立即推进；之后按正文回复轮次触发。2 = 第1、3、5…次正文后推进；1 = 每轮推进。战斗中不计轮数。':'自动推进已关闭，此设置不参与调度。')+'</span></div>';
            const input=section.querySelector('[data-auto-progress-interval]');
            input?.addEventListener('change',()=>{
                const value=Math.max(1,Math.min(20,Number(input.value)||2));
                e.config.autoProgressInterval=Math.round(value);input.value=String(e.config.autoProgressInterval);
                this.resetCycle();e.saveConfig();e.status='自动推进间隔已设为 '+e.config.autoProgressInterval+' 轮';e.render(true);
            });
        }
        afterRender(){
            this.engine.panel?.querySelector('[data-auto-progress-setting]')?.remove();
            this.mountTopControl();this.mountIntervalSetting();
        }
    }
