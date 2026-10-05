    class WorldManualAdvanceFeature extends WorldRequestFeature {
        constructor(engine){super(engine);this.engine=engine;}
        normalizeInstruction(value){return String(value||'').trim().slice(0,4000);}
        rerunInfo(){
            const e=this.engine;
            try{
                const snapshot=e.snapshot(),handled=String(snapshot?.stat?.世界?.[PATH]?.已处理楼层||'');
                const replay=snapshot?.raw?.__samsaraWorldReplay;
                return {
                    processed:!!snapshot?.fingerprint&&handled===String(snapshot.fingerprint),
                    baseline:!!(plain(replay)&&String(replay.fingerprint||'')===String(snapshot?.fingerprint||'')&&Array.isArray(replay.rerunBaseline)&&replay.rerunBaseline.length)
                };
            }catch(_){return {processed:false,baseline:false};}
        }
        requestInstruction(){
            const e=this.engine,panel=e.panel,doc=e.host?.document;
            if(!panel||!doc||typeof doc.createElement!=='function')return Promise.resolve('');
            const existing=panel.querySelector('[data-manual-advance-dialog]');
            if(existing)existing.remove();
            const info=this.rerunInfo();
            return new Promise(resolve=>{
                const mask=doc.createElement('div');
                mask.className='we-manual-advance-mask';mask.dataset.manualAdvanceDialog='';
                const note=info.processed&&info.baseline
                    ?'<div class="we-manual-advance-rerun">当前楼层已有推进结果。本次会从这轮推进前的世界状态重新推演，并用新结果替换原结果。</div>'
                    :'';
                mask.innerHTML='<div class="we-manual-advance-dialog" role="dialog" aria-modal="true" aria-labelledby="we-manual-advance-title">'
                    +'<div class="we-manual-advance-head"><div><b id="we-manual-advance-title">本次推进指导</b><small>可选 · 仅本轮有效</small></div></div>'
                    +'<p>可以告诉世界 AI 这一次重点推进、暂缓或重新处理什么。留空则按正常规则推进。</p>'
                    +note
                    +'<textarea data-manual-advance-input rows="7" maxlength="4000" placeholder="例如：暂时不要推进第一层 Boss，重点维护攻略组准备和其他角色的场外行动。"></textarea>'
                    +'<div class="we-manual-advance-actions"><button type="button" class="we-btn" data-manual-advance-cancel>取消</button><button type="button" class="we-btn we-primary" data-manual-advance-submit>推进世界</button></div>'
                    +'</div>';
                panel.appendChild(mask);
                const input=mask.querySelector('[data-manual-advance-input]');
                let settled=false;
                const finish=value=>{
                    if(settled)return;settled=true;
                    mask.remove();
                    resolve(value);
                };
                mask.querySelector('[data-manual-advance-cancel]')?.addEventListener('click',()=>finish(null));
                mask.querySelector('[data-manual-advance-submit]')?.addEventListener('click',()=>finish(this.normalizeInstruction(input?.value)));
                mask.addEventListener('click',event=>{if(event.target===mask)finish(null);});
                mask.addEventListener('keydown',event=>{
                    if(event.key==='Escape'){event.preventDefault();finish(null);return;}
                    if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();finish(this.normalizeInstruction(input?.value));}
                });
                try{input?.focus();}catch(_){}
            });
        }
        async trigger(){
            const e=this.engine;if(e.busy)return false;
            const instruction=await this.requestInstruction();
            if(instruction===null)return false;
            return e.run({automatic:false,instruction});
        }
        async aroundRun(next,options={}){
            const e=this.engine,previous=e.manualAdvanceInstruction;
            const automatic=plain(options)&&options.automatic===true;
            e.manualAdvanceInstruction=automatic?'':this.normalizeInstruction(options?.instruction);
            try{return await next();}
            finally{e.manualAdvanceInstruction=previous;}
        }
        async afterBuildRequest(request,base){
            const instruction=this.normalizeInstruction(this.engine.manualAdvanceInstruction);
            if(!instruction)return request;
            let payload;try{payload=JSON.parse(String(request.input||''));}catch(_){return request;}
            const registry=this.engine.services?.prompts;
            const fallback=typeof WORLD_PROMPT_MANUAL_ADVANCE_GUIDANCE==='string'?WORLD_PROMPT_MANUAL_ADVANCE_GUIDANCE:'';
            payload.本轮人工指导={
                来源:'玩家手动推进',
                模式:base?.manualRerun?.restored===true?'重新推演当前楼层':'正常手动推进',
                要求:instruction,
                执行规则:String(registry?.value?.('manualAdvanceGuidance')||fallback)
            };
            request.input=JSON.stringify(payload,null,2);
            request.manifest=Object.assign({},request.manifest,{人工指导:{启用:true,模式:payload.本轮人工指导.模式,字符数:instruction.length}});
            return request;
        }
    }
