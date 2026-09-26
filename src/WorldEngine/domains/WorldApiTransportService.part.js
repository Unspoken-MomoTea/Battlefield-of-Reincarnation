    class WorldApiTransportService {
        constructor(engine){this.engine=engine;this.modeCache=engine.apiModeCache||{};}
        normalize(value){
            const api=plain(value)?value:{};
            return {
                enabled:api.enabled===true,
                apiUrl:String(api.apiUrl||'').trim(),
                apiKey:String(api.apiKey||''),
                model:String(api.model||'').trim(),
                apiPresets:Array.isArray(api.apiPresets)?api.apiPresets.filter(plain).map(p=>({
                    name:String(p.name||'').trim().slice(0,80),
                    apiUrl:String(p.apiUrl||'').trim(),
                    apiKey:String(p.apiKey||''),
                    model:String(p.model||'').trim()
                })).filter(p=>p.name).slice(0,30):[],
                fetchedModels:Array.isArray(api.fetchedModels)?api.fetchedModels.map(String).filter(Boolean).slice(0,500):[]
            };
        }
        usesDedicated(){return this.engine.config?.dedicatedApi?.enabled===true;}
        ready(){
            const api=this.engine.config?.dedicatedApi||{};
            return api.enabled===true&&!!String(api.apiUrl||'').trim()&&!!String(api.model||'').trim();
        }
        sourceLabel(){return this.usesDedicated()?'世界推进专属 API':'主神终端额外模型';}
        set(patch){
            const engine=this.engine,current=this.normalize(engine.config.dedicatedApi);
            const next=this.normalize(Object.assign({},current,plain(patch)?patch:{}));
            if(patch&&Object.hasOwn(patch,'apiUrl')&&String(patch.apiUrl||'').trim()!==current.apiUrl)next.fetchedModels=[];
            engine.config.dedicatedApi=next;engine.saveConfig();return next;
        }
        savePreset(name){
            const engine=this.engine,clean=String(name||'').trim().slice(0,80);
            if(!clean)throw new Error('请输入 API 预设名称');
            const api=this.normalize(engine.config.dedicatedApi),entry={name:clean,apiUrl:api.apiUrl,apiKey:api.apiKey,model:api.model};
            const idx=api.apiPresets.findIndex(p=>p.name===clean);
            if(idx>=0)api.apiPresets[idx]=entry;else api.apiPresets.unshift(entry);
            api.apiPresets=api.apiPresets.slice(0,30);engine.config.dedicatedApi=api;engine.saveConfig();return entry;
        }
        deletePreset(name){
            const engine=this.engine,clean=String(name||'').trim(),api=this.normalize(engine.config.dedicatedApi);
            const before=api.apiPresets.length;api.apiPresets=api.apiPresets.filter(p=>p.name!==clean);
            engine.config.dedicatedApi=api;engine.saveConfig();return before!==api.apiPresets.length;
        }
        applyPreset(name){
            const engine=this.engine,api=this.normalize(engine.config.dedicatedApi),preset=api.apiPresets.find(p=>p.name===String(name||''));
            if(!preset)throw new Error('API 预设不存在');
            api.apiUrl=preset.apiUrl;api.apiKey=preset.apiKey;api.model=preset.model;api.fetchedModels=[];
            engine.config.dedicatedApi=api;engine.saveConfig();return api;
        }
        endpoint(kind='chat'){
            const api=this.normalize(this.engine.config.dedicatedApi);
            let endpoint=String(api.apiUrl||'').trim().replace(/\/+$/,'');
            if(!endpoint)throw new Error('请先填写专属 API 地址');
            if(kind==='models'){
                if(/\/chat\/completions$/i.test(endpoint))endpoint=endpoint.replace(/\/chat\/completions$/i,'/models');
                else if(/\/v1$/i.test(endpoint))endpoint+='/models';
                else if(/\/v1\//i.test(endpoint))endpoint=endpoint.replace(/\/v1\/.*$/i,'/v1/models');
                else endpoint+=/\/v\d+$/i.test(endpoint)?'/models':'/v1/models';
                return endpoint;
            }
            if(/\/chat\/completions$/i.test(endpoint))return endpoint;
            if(/\/v1$/i.test(endpoint))return endpoint+'/chat/completions';
            if(/\/v1\//i.test(endpoint))return endpoint.replace(/\/v1\/.*$/i,'/v1/chat/completions');
            return endpoint+(/\/v\d+$/i.test(endpoint)?'/chat/completions':'/v1/chat/completions');
        }
        async fetchModels(){
            const engine=this.engine,api=this.normalize(engine.config.dedicatedApi),fetcher=engine.host.fetch||(typeof fetch!=='undefined'?fetch:null);
            if(!fetcher)throw new Error('当前环境没有 fetch');
            const headers={};if(api.apiKey.trim())headers.Authorization='Bearer '+api.apiKey.trim();
            const response=await fetcher(this.endpoint('models'),{headers});
            if(!response.ok){
                let body='';try{body=await response.text();}catch(_){}
                throw new Error('加载模型失败：HTTP '+response.status+(body?' / '+body.slice(0,240):''));
            }
            const body=await response.json(),raw=Array.isArray(body?.data)?body.data:Array.isArray(body?.models)?body.models:[];
            const models=raw.map(item=>typeof item==='string'?item:item?.id||item?.name).filter(Boolean).map(String);
            if(!models.length)throw new Error('API 返回的模型列表为空');
            api.fetchedModels=Array.from(new Set(models)).sort().slice(0,500);
            if(api.model&&!api.fetchedModels.includes(api.model))api.fetchedModels.unshift(api.model);
            engine.config.dedicatedApi=api;engine.saveConfig();return api.fetchedModels;
        }
        structuredUnsupported(status,body){
            const code=Number(status),text=String(body||'');
            return [400,404,415,422].includes(code)&&/response[_ -]?format|json[_ -]?schema|json[_ -]?object|unknown (?:field|parameter)|unrecognized|unsupported|not supported|invalid.*schema|INVALID_ARGUMENT|invalid[_ -]?argument/i.test(text);
        }
        async requestDedicated(system,input,options={}){
            const engine=this.engine,api=this.normalize(engine.config.dedicatedApi),fetcher=engine.host.fetch||(typeof fetch!=='undefined'?fetch:null);
            if(!this.ready())throw new Error('世界推进专属 API 已启用，但地址或模型未配置完整');
            if(!fetcher)throw new Error('当前环境没有 fetch');
            const endpoint=this.endpoint('chat'),headers={'Content-Type':'application/json'};
            if(api.apiKey.trim())headers.Authorization='Bearer '+api.apiKey.trim();
            const cacheKey=endpoint+'|'+api.model,wants=options.structured==='auto'&&plain(options.schema);
            const cached=wants?this.modeCache[cacheKey]:'';
            const modes=!wants?['plain']:cached==='json_schema'?['json_schema','json_object','plain']:cached==='json_object'?['json_object','plain']:cached==='plain'?['plain']:['json_schema','json_object','plain'];
            let lastError='';const modeAttempts=[];
            for(const mode of modes){
                modeAttempts.push(mode);
                const body={model:api.model,messages:[{role:'system',content:String(system||'')},{role:'user',content:String(input||'')}],stream:false,temperature:Number.isFinite(Number(options.temperature))?Number(options.temperature):0.3};
                if(mode==='json_schema')body.response_format={type:'json_schema',json_schema:{name:String(options.schemaName||'samsara_world_result').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,64),strict:false,schema:options.schema}};
                else if(mode==='json_object')body.response_format={type:'json_object'};
                const response=await fetcher(endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:options.signal});
                if(!response.ok){
                    let err='';try{err=await response.text();}catch(_){}
                    lastError='HTTP '+response.status+': '+response.statusText+(err?' / '+err.slice(0,300):'');
                    if(mode!=='plain'&&this.structuredUnsupported(response.status,err)){delete this.modeCache[cacheKey];continue;}
                    engine.lastTransportInfo={接口:'世界推进专属 API',模型:api.model,结构化模式:mode,尝试模式:copy(modeAttempts),usage:null};
                    throw new Error(lastError);
                }
                const data=await response.json(),message=data?.choices?.[0]?.message,raw=message?.content;
                const content=typeof raw==='string'?raw:(plain(raw)?JSON.stringify(raw):message?.parsed?JSON.stringify(message.parsed):'');
                if(!content)throw new Error('专属 API 返回内容为空');
                if(wants)this.modeCache[cacheKey]=mode;
                engine.apiModeCache=this.modeCache;
                engine.lastTransportInfo={接口:'世界推进专属 API',模型:api.model,结构化模式:mode,尝试模式:copy(modeAttempts),usage:normalizeTokenUsage(data?.usage)};
                return content;
            }
            throw new Error(lastError||'专属 API 不支持当前结构化输出模式');
        }
        async request(system,input,options={}){
            const engine=this.engine;
            if(this.usesDedicated()){
                const api=this.normalize(engine.config.dedicatedApi);
                engine.lastTransportInfo={接口:'世界推进专属 API',模型:api.model,结构化模式:'请求中',尝试模式:[],usage:null};
                return this.requestDedicated(system,input,options);
            }
            const terminal=engine.host.Samsara&&engine.host.Samsara.terminal;
            if(!terminal||typeof terminal.request!=='function'||!terminal.apiReady?.())throw new Error('请在主神终端设置中启用额外模型并选择模型');
            engine.lastTransportInfo={接口:'主神终端额外模型',模型:'',结构化模式:options.structured==='auto'?'auto（由主神终端协商）':'plain',尝试模式:[],usage:null};
            return terminal.request(system,input,options);
        }
    }
