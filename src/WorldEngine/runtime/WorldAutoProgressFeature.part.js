    // 自动推进策略：顶部开关独立控制自动调度；请求检查页配置推进间隔；战斗中暂停且不计轮次。
    class WorldAutoProgressFeature {
        constructor(engine){
            this.engine=engine;this.baseBlocked=engine.blocked.bind(engine);this.runSnapshot=null;
        }
        initialize(){
            const e=this.engine;let dirty=false;
            if(!Object.hasOwn(e.config,'autoProgress')){e.config.autoProgress=true;dirty=true;}else e.config.autoProgress=e.config.autoProgress!==false;
            const hadInterval=Object.hasOwn(e.config,'autoProgressInterval'),interval=Number(e.config.autoProgressInterval);
            e.config.autoProgressInterval=Math.max(1,Math.min(20,Number.isFinite(interval)?Math.round(interval):2));
            if(!hadInterval)dirty=true;
            e.autoProgressCycleKey='';e.autoProgressLastSeenFingerprint='';e.autoProgressDueFingerprint='';e.autoProgressRoundsSinceRun=0;e.autoProgressHasRun=false;
            e.blocked=snapshot=>snapshot?.stat?.系统状态?.是否战斗中===true?'战斗中，世界推进暂停':this.baseBlocked(snapshot);
            for(const name of ['autoProgressIntervalValue','autoProgressContextKey','autoProgressFingerprintChat','autoProgressBackendHasContent','initializeAutoProgressCycle','autoProgressShouldSchedule','markAutoProgressRun','resetAutoProgressCycle','toggleAutoProgress','mountAutoProgressTopControl','mountAutoProgressIntervalSetting']){
                e[name]=this[name].bind(this);
            }
            e.schedule=(...args)=>this.schedule(...args);
            if(dirty)e.saveConfig();
        }
        autoProgressIntervalValue(){const value=Number(this.engine.config.autoProgressInterval);return Math.max(1,Math.min(20,Number.isFinite(value)?Math.round(value):2));}
        autoProgressContextKey(snapshot){let chat='';try{chat=String(JSON.parse(String(snapshot?.fingerprint||''))?.[0]??'');}catch(_){}return chat+'\u0000'+String(snapshot?.stat?.世界?.名称||'');}
        autoProgressFingerprintChat(fingerprint){try{return String(JSON.parse(String(fingerprint||''))?.[0]??'');}catch(_){return '';}}
        autoProgressBackendHasContent(snapshot){
            const backend=snapshot?.stat?.世界?.[PATH];if(!plain(backend))return false;
            const maps=['事件','人物','势力地区','历史','历史总结','传播'];
            return maps.some(key=>plain(backend[key])&&Object.keys(backend[key]).length>0)||(Array.isArray(backend.最近变化)&&backend.最近变化.length>0);
        }
        initializeAutoProgressCycle(snapshot){
            const e=this.engine,key=this.autoProgressContextKey(snapshot);if(e.autoProgressCycleKey===key)return;
            e.autoProgressCycleKey=key;e.autoProgressRoundsSinceRun=0;
            const handled=String(snapshot?.stat?.世界?.[PATH]?.已处理楼层||''),currentChat=this.autoProgressFingerprintChat(snapshot?.fingerprint),handledChat=this.autoProgressFingerprintChat(handled);
            const sameContext=!!handled&&(!currentChat||!handledChat||currentChat===handledChat),restoredRun=sameContext&&this.autoProgressBackendHasContent(snapshot);
            e.autoProgressHasRun=restoredRun;e.autoProgressLastSeenFingerprint=restoredRun?handled:'';e.autoProgressDueFingerprint=restoredRun?handled:'';
        }
        autoProgressShouldSchedule(snapshot){
            const e=this.engine;this.initializeAutoProgressCycle(snapshot);
            const fingerprint=String(snapshot?.fingerprint||'');if(!fingerprint)return false;
            const handled=String(snapshot?.stat?.世界?.[PATH]?.已处理楼层||'');
            if(e.autoProgressLastSeenFingerprint===fingerprint)return e.autoProgressDueFingerprint===fingerprint&&handled!==fingerprint;
            e.autoProgressLastSeenFingerprint=fingerprint;
            if(e.autoProgressHasRun)e.autoProgressRoundsSinceRun++;
            const due=!e.autoProgressHasRun||e.autoProgressRoundsSinceRun>=this.autoProgressIntervalValue();
            if(due)e.autoProgressDueFingerprint=fingerprint;
            return due;
        }
        markAutoProgressRun(snapshot){
            const e=this.engine;if(snapshot)this.initializeAutoProgressCycle(snapshot);
            e.autoProgressHasRun=true;e.autoProgressRoundsSinceRun=0;
            if(snapshot?.fingerprint){e.autoProgressLastSeenFingerprint=String(snapshot.fingerprint);e.autoProgressDueFingerprint=String(snapshot.fingerprint);}
        }
        resetAutoProgressCycle(){
            const e=this.engine;e.autoProgressCycleKey='';e.autoProgressLastSeenFingerprint='';e.autoProgressDueFingerprint='';e.autoProgressRoundsSinceRun=0;e.autoProgressHasRun=false;
        }
        schedule(){
            const e=this.engine;
            if(e.config.autoProgress!==true){if(e.timer){clearTimeout(e.timer);e.timer=null;}return;}
            if(e.disposed||e.committing||!e.isEnabled())return;
            if(e.busy){e.pending=true;return;}
            clearTimeout(e.timer);
            e.timer=setTimeout(()=>{
                e.timer=null;
                if(e.config.autoProgress!==true||e.disposed||e.committing||!e.isEnabled())return;
                if(e.busy){e.pending=true;return;}
                let snapshot;try{snapshot=e.snapshot();}catch(_){return;}
                const reason=e.blocked(snapshot);if(reason){e.status=reason;e.render();return;}
                if(!this.autoProgressShouldSchedule(snapshot))return;
                e.run().catch(()=>{});
            },900);
        }
        async aroundRun(next){
            try{this.runSnapshot=this.engine.snapshot();}catch(_){this.runSnapshot=null;}
            try{
                const result=await next();
                if(result===true)this.markAutoProgressRun(this.runSnapshot);
                return result;
            }finally{this.runSnapshot=null;}
        }
        toggleAutoProgress(){
            const e=this.engine;e.config.autoProgress=!e.config.autoProgress;
            if(!e.config.autoProgress){if(e.timer){clearTimeout(e.timer);e.timer=null;}e.pending=false;e.status='自动推进已关闭 · 可手动推进';}
            else{this.resetAutoProgressCycle();e.status='自动推进已开启';}
            e.saveConfig();e.render(true);
        }
        mountAutoProgressTopControl(){
            const e=this.engine;if(!e.panel)return;
            const header=e.panel.querySelector('header'),run=header?.querySelector('[data-action="run"]');if(!header||!run)return;
            let button=header.querySelector('[data-auto-progress-toggle-top]');
            if(!button){
                button=e.host.document.createElement('button');button.type='button';button.className='we-btn we-switch';button.dataset.autoProgressToggleTop='';
                run.insertAdjacentElement('beforebegin',button);button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();this.toggleAutoProgress();});
            }
            button.classList.toggle('on',e.config.autoProgress===true);button.setAttribute('aria-pressed',String(e.config.autoProgress===true));button.title=e.config.autoProgress?'自动推进已开启':'自动推进已关闭';
            button.innerHTML='<span>自动推进</span><span class="we-switch-track"><i></i></span>';
        }
        mountAutoProgressIntervalSetting(){
            const e=this.engine;if(e.tab!=='请求检查'||!e.panel)return;
            const main=e.panel.querySelector('main');if(!main)return;
            let section=main.querySelector('[data-auto-progress-interval-setting]');
            if(!section){section=e.host.document.createElement('section');section.className='we-section';section.dataset.autoProgressIntervalSetting='';const retry=[...main.querySelectorAll('.we-section')].find(item=>item.querySelector('.we-section-head h2')?.textContent?.trim()==='失败自动重试');if(retry)main.insertBefore(section,retry);else main.prepend(section);}
            const enabled=e.config.autoProgress===true,interval=this.autoProgressIntervalValue();
            section.innerHTML='<div class="we-section-head"><h2>自动推进频率</h2><small>正文轮次</small></div><div class="we-config-row"><label>推进间隔 <input data-auto-progress-interval type="number" min="1" max="20" value="'+interval+'" '+(enabled?'':'disabled')+'> 轮</label><span class="we-muted">'+(enabled?'首次符合条件、或检测到世界后台尚未建立时立即推进；之后按正文回复轮次触发。2 = 第1、3、5…次正文后推进；1 = 每轮推进。战斗中不计轮数。':'自动推进已关闭，此设置不参与调度。')+'</span></div>';
            const input=section.querySelector('[data-auto-progress-interval]');
            input?.addEventListener('change',()=>{const value=Math.max(1,Math.min(20,Number(input.value)||2));e.config.autoProgressInterval=Math.round(value);input.value=String(e.config.autoProgressInterval);this.resetAutoProgressCycle();e.saveConfig();e.status='自动推进间隔已设为 '+e.config.autoProgressInterval+' 轮';e.render(true);});
        }
        afterRender(){
            const e=this.engine;e.panel?.querySelector('[data-auto-progress-setting]')?.remove();this.mountAutoProgressTopControl();this.mountAutoProgressIntervalSetting();
        }
    }
