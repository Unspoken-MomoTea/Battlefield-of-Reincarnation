    class WorldTokenTelemetry {
        estimate(value) {
            const source=typeof value==='string'?value:JSON.stringify(value??'');
            if(!source)return 0;
            let eastAsian=0,nonAscii=0,ascii=0;
            for(const ch of source){
                const cp=ch.codePointAt(0);
                const east=(cp>=0x3400&&cp<=0x9fff)||(cp>=0xf900&&cp<=0xfaff)||(cp>=0x3040&&cp<=0x30ff)||(cp>=0x31f0&&cp<=0x31ff)||(cp>=0xac00&&cp<=0xd7af)||(cp>=0x3100&&cp<=0x312f)||(cp>=0xff00&&cp<=0xffef);
                if(east)eastAsian++;
                else if(cp<=0x7f)ascii++;
                else nonAscii++;
            }
            return Math.max(1,Math.ceil(eastAsian*1.08+nonAscii+ascii/3.8));
        }
        format(count,estimated=true) {
            const n=Math.max(0,Math.round(Number(count)||0));
            let value=String(n);
            if(n>=1000){
                const digits=n>=100000?0:n>=10000?1:2;
                value=(n/1000).toFixed(digits).replace(/(\.\d*?[1-9])0+$|\.0+$/,'$1')+'k';
            }
            return (estimated?'≈':'')+value+' tk';
        }
        normalizeUsage(usage) {
            if(!plain(usage))return null;
            const finite=value=>Number.isFinite(Number(value))&&Number(value)>=0?Math.round(Number(value)):null;
            const inputTokens=finite(usage.prompt_tokens??usage.input_tokens??usage.promptTokens??usage.inputTokens);
            const outputTokens=finite(usage.completion_tokens??usage.output_tokens??usage.completionTokens??usage.outputTokens);
            let totalTokens=finite(usage.total_tokens??usage.totalTokens);
            if(totalTokens===null&&inputTokens!==null&&outputTokens!==null)totalTokens=inputTokens+outputTokens;
            return inputTokens===null&&outputTokens===null&&totalTokens===null?null:{inputTokens,outputTokens,totalTokens};
        }
        request(system,input,schema) {
            const systemText=String(system||''),inputText=String(input||'');
            let payload=null;try{payload=JSON.parse(inputText);}catch(_){}
            const systemParts=systemText.split(/\n(?=【)/).filter(Boolean).map((part,index)=>({
                名称:(part.match(/^【([^】]+)】/)||[])[1]||'system '+(index+1),
                估算Tokens:this.estimate(part)
            }));
            const userParts=plain(payload)?Object.entries(payload).filter(([,value])=>value!==undefined).map(([name,value])=>({
                名称:name,估算Tokens:this.estimate(JSON.stringify({[name]:value},null,2))
            })):[];
            const systemTokens=this.estimate(systemText),userTokens=this.estimate(inputText);
            return {
                估算:true,
                请求估算Tokens:systemTokens+userTokens,
                System估算Tokens:systemTokens,
                User估算Tokens:userTokens,
                Schema估算Tokens:this.estimate(JSON.stringify(schema||{},null,2)),
                System分段:systemParts,
                User分段:userParts
            };
        }
    }

    const DEFAULT_WORLD_TOKEN_TELEMETRY=new WorldTokenTelemetry();
    let ACTIVE_WORLD_TOKEN_TELEMETRY=DEFAULT_WORLD_TOKEN_TELEMETRY;
    function estimateTokens(value){return ACTIVE_WORLD_TOKEN_TELEMETRY.estimate(value);}
    function formatTokenCount(count,estimated=true){return ACTIVE_WORLD_TOKEN_TELEMETRY.format(count,estimated);}
    function normalizeTokenUsage(usage){return ACTIVE_WORLD_TOKEN_TELEMETRY.normalizeUsage(usage);}
    function requestTokenTelemetry(system,input,schema){return ACTIVE_WORLD_TOKEN_TELEMETRY.request(system,input,schema);}
