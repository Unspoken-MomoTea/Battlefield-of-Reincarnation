    // 自动推进策略：顶部开关独立控制自动调度；请求检查页配置推进间隔；战斗中暂停且不计轮次。
    const SamsaraWorldEngineBeforeAutoProgress=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeAutoProgress {
        constructor(host,env) {
            super(host,env);
            let dirty=false;
            if(!Object.hasOwn(this.config,'autoProgress')){this.config.autoProgress=true;dirty=true;}
            else this.config.autoProgress=this.config.autoProgress!==false;
            const hadInterval=Object.hasOwn(this.config,'autoProgressInterval');
            const interval=Number(this.config.autoProgressInterval);
            this.config.autoProgressInterval=Math.max(1,Math.min(20,Number.isFinite(interval)?Math.round(interval):2));
            if(!hadInterval)dirty=true;
            this.autoProgressCycleKey='';
            this.autoProgressLastSeenFingerprint='';
            this.autoProgressRoundsSinceRun=0;
            this.autoProgressHasRun=false;
            if(dirty)this.saveConfig();
        }
        blocked(snapshot) {
            if(snapshot?.stat?.系统状态?.是否战斗中===true)return '战斗中，世界推进暂停';
            return super.blocked(snapshot);
        }
        autoProgressIntervalValue() {
            const value=Number(this.config.autoProgressInterval);
            return Math.max(1,Math.min(20,Number.isFinite(value)?Math.round(value):2));
        }
        autoProgressContextKey(snapshot) {
            let chat='';
            try{const parsed=JSON.parse(String(snapshot?.fingerprint||''));chat=String(parsed?.[0]??'');}catch(_){}
            return chat+'\u0000'+String(snapshot?.stat?.世界?.名称||'');
        }
        autoProgressFingerprintChat(fingerprint) {
            try{return String(JSON.parse(String(fingerprint||''))?.[0]??'');}catch(_){return '';}
        }
        initializeAutoProgressCycle(snapshot) {
            const key=this.autoProgressContextKey(snapshot);
            if(this.autoProgressCycleKey===key)return;
            this.autoProgressCycleKey=key;
            this.autoProgressRoundsSinceRun=0;
            const handled=String(snapshot?.stat?.世界?.[PATH]?.已处理楼层||'');
            const currentChat=this.autoProgressFingerprintChat(snapshot?.fingerprint);
            const handledChat=this.autoProgressFingerprintChat(handled);
            const sameContext=!!handled&&(!currentChat||!handledChat||currentChat===handledChat);
            this.autoProgressHasRun=sameContext;
            this.autoProgressLastSeenFingerprint=sameContext?handled:'';
        }
        autoProgressShouldSchedule(snapshot) {
            this.initializeAutoProgressCycle(snapshot);
            const fingerprint=String(snapshot?.fingerprint||'');
            if(!fingerprint||this.autoProgressLastSeenFingerprint===fingerprint)return false;
            this.autoProgressLastSeenFingerprint=fingerprint;
            if(!this.autoProgressHasRun)return true;
            this.autoProgressRoundsSinceRun++;
            return this.autoProgressRoundsSinceRun>=this.autoProgressIntervalValue();
        }
        markAutoProgressRun(snapshot) {
            if(snapshot)this.initializeAutoProgressCycle(snapshot);
            this.autoProgressHasRun=true;
            this.autoProgressRoundsSinceRun=0;
            if(snapshot?.fingerprint)this.autoProgressLastSeenFingerprint=String(snapshot.fingerprint);
        }
        resetAutoProgressCycle() {
            this.autoProgressCycleKey='';
            this.autoProgressLastSeenFingerprint='';
            this.autoProgressRoundsSinceRun=0;
            this.autoProgressHasRun=false;
        }
        schedule() {
            if(this.config.autoProgress!==true){
                if(this.timer){clearTimeout(this.timer);this.timer=null;}
                return;
            }
            if(this.disposed||this.committing||!this.isEnabled())return;
            if(this.busy){this.pending=true;return;}
            let snapshot;
            try{snapshot=this.snapshot();}catch(_){return;}
            if(this.blocked(snapshot))return;
            if(!this.autoProgressShouldSchedule(snapshot))return;
            return super.schedule();
        }
        async run() {
            let snapshot=null;
            try{snapshot=this.snapshot();}catch(_){}
            const result=await super.run();
            if(result===true)this.markAutoProgressRun(snapshot);
            return result;
        }
        toggleAutoProgress() {
            this.config.autoProgress=!this.config.autoProgress;
            if(!this.config.autoProgress){
                if(this.timer){clearTimeout(this.timer);this.timer=null;}
                this.pending=false;
                this.status='自动推进已关闭 · 可手动推进';
            }else{
                this.resetAutoProgressCycle();
                this.status='自动推进已开启';
            }
            this.saveConfig();
            this.render(true);
        }
        mountAutoProgressTopControl() {
            if(!this.panel)return;
            const header=this.panel.querySelector('header'),run=header?.querySelector('[data-action="run"]');
            if(!header||!run)return;
            let button=header.querySelector('[data-auto-progress-toggle-top]');
            if(!button){
                button=this.host.document.createElement('button');
                button.type='button';button.className='we-btn we-switch';button.dataset.autoProgressToggleTop='';
                run.insertAdjacentElement('beforebegin',button);
                button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();this.toggleAutoProgress();});
            }
            button.classList.toggle('on',this.config.autoProgress===true);
            button.setAttribute('aria-pressed',String(this.config.autoProgress===true));
            button.title=this.config.autoProgress?'自动推进已开启':'自动推进已关闭';
            button.innerHTML='<span>自动推进</span><span class="we-switch-track"><i></i></span>';
        }
        mountAutoProgressIntervalSetting() {
            if(this.tab!=='请求检查'||!this.panel)return;
            const main=this.panel.querySelector('main');if(!main)return;
            let section=main.querySelector('[data-auto-progress-interval-setting]');
            if(!section){
                section=this.host.document.createElement('section');section.className='we-section';section.dataset.autoProgressIntervalSetting='';
                const retry=[...main.querySelectorAll('.we-section')].find(item=>item.querySelector('.we-section-head h2')?.textContent?.trim()==='失败自动重试');
                if(retry)main.insertBefore(section,retry);else main.prepend(section);
            }
            const enabled=this.config.autoProgress===true,interval=this.autoProgressIntervalValue();
            section.innerHTML='<div class="we-section-head"><h2>自动推进频率</h2><small>正文轮次</small></div>'+
                '<div class="we-config-row"><label>推进间隔 <input data-auto-progress-interval type="number" min="1" max="20" value="'+interval+'" '+(enabled?'':'disabled')+'> 轮</label><span class="we-muted">'+
                (enabled?'首次符合条件的正文立即推进；之后按正文回复轮次触发。2 = 第1、3、5…次正文后推进；1 = 每轮推进。战斗中不计轮数。':'自动推进已关闭，此设置不参与调度。')+
                '</span></div>';
            const input=section.querySelector('[data-auto-progress-interval]');
            input?.addEventListener('change',()=>{
                const value=Math.max(1,Math.min(20,Number(input.value)||2));
                this.config.autoProgressInterval=Math.round(value);input.value=String(this.config.autoProgressInterval);
                this.resetAutoProgressCycle();this.saveConfig();
                this.status='自动推进间隔已设为 '+this.config.autoProgressInterval+' 轮';
                this.render(true);
            });
        }
        render(force=false) {
            const result=super.render(force);
            this.panel?.querySelector('[data-auto-progress-setting]')?.remove();
            this.mountAutoProgressTopControl();
            this.mountAutoProgressIntervalSetting();
            return result;
        }
    };
