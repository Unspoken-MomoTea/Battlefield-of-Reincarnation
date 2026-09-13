    // 自动推进策略：自动调度可独立关闭；战斗中暂停一切世界推进。
    const SamsaraWorldEngineBeforeAutoProgress=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeAutoProgress {
        constructor(host,env) {
            super(host,env);
            if(!Object.hasOwn(this.config,'autoProgress')){
                this.config.autoProgress=true;
                this.saveConfig();
            }else this.config.autoProgress=this.config.autoProgress!==false;
        }
        blocked(snapshot) {
            if(snapshot?.stat?.系统状态?.是否战斗中===true)return '战斗中，世界推进暂停';
            return super.blocked(snapshot);
        }
        schedule() {
            if(this.config.autoProgress!==true){
                if(this.timer){clearTimeout(this.timer);this.timer=null;}
                return;
            }
            return super.schedule();
        }
        mountAutoProgressSetting() {
            if(this.tab!=='设置'||!this.panel)return;
            const main=this.panel.querySelector('main');
            if(!main||main.querySelector('[data-auto-progress-setting]'))return;
            const section=this.host.document.createElement('section');
            section.className='we-section';
            section.dataset.autoProgressSetting='';
            section.innerHTML='<div class="we-section-head"><h2>推进方式</h2><small>自动调度</small></div>'+
                '<div class="we-setting-row"><div class="we-setting-copy"><b>自动推进</b><small>开启后，每个正文楼层的 MVU 更新完成时自动推进一次；关闭后仅保留手动推进。战斗中无论此开关状态如何都暂停推进。</small></div><div class="we-setting-actions"><button class="we-setting-btn we-switch '+(this.config.autoProgress?'on':'')+'" data-auto-progress-toggle><span>'+(this.config.autoProgress?'已启用':'未启用')+'</span><span class="we-switch-track"><i></i></span></button></div></div>';
            const first=main.querySelector('.we-section');
            if(first)main.insertBefore(section,first);else main.appendChild(section);
            section.querySelector('[data-auto-progress-toggle]')?.addEventListener('click',()=>{
                this.config.autoProgress=!this.config.autoProgress;
                this.saveConfig();
                if(!this.config.autoProgress){
                    if(this.timer){clearTimeout(this.timer);this.timer=null;}
                    this.status='自动推进已关闭 · 可手动推进';
                }else this.status='自动推进已开启';
                this.render(true);
            });
        }
        render(force=false) {
            const result=super.render(force);
            this.mountAutoProgressSetting();
            return result;
        }
    };
