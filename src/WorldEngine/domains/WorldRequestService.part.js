    class WorldRequestService {
        constructor(engine){this.engine=engine;}
        legacyPrototype(){
            const proto=this.engine?._worldEngineLegacyPrototype;
            if(!proto||typeof proto.buildRequest!=='function')throw new Error('世界推进旧请求构建器未挂载');
            return proto;
        }
        async build(base){
            const engine=this.engine,registry=engine.services?.prompts||engine.promptRegistry;
            registry?.syncLegacy();
            const request=await this.legacyPrototype().buildRequest.call(engine,base||engine.snapshot());
            if(registry){
                request.system=registry.rewriteSystem(request.system);
                request.manifest=request.manifest||{};
                const audit=registry.auditSystem(request.system);
                request.manifest.提示词注册表=registry.list().map(item=>({
                    key:item.key,标题:item.title,分组:item.group,来源:item.source,
                    估算Tokens:estimateTokens(item.value),启用:String(item.value||'').trim()!==''
                }));
                request.manifest.提示词审计={
                    已登记:audit.registered,
                    未登记:audit.unregistered
                };
                if(audit.unregistered.length)throw new Error('发现未登记的 system 提示词：'+audit.unregistered.join('、')+'；请加入 WorldPromptRegistry 后再发送');
                request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema||WORLD_RESULT_SCHEMA);
            }
            return request;
        }
        preview(){return this.engine.preview?.();}
        request(system,input,options){return this.engine.requestAI(system,input,options);}
    }
