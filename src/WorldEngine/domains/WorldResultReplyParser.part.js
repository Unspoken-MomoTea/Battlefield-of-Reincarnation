    class WorldResultReplyParser {
        firstCompleteJsonObject(source) {
            const text=String(source||''),start=text.indexOf('{');
            if(start<0)return '';
            let depth=0,inString=false,escaped=false;
            for(let i=start;i<text.length;i++){
                const ch=text[i];
                if(inString){
                    if(escaped)escaped=false;
                    else if(ch==='\\')escaped=true;
                    else if(ch==='"')inString=false;
                    continue;
                }
                if(ch==='"'){inString=true;continue;}
                if(ch==='{')depth++;
                else if(ch==='}'){
                    depth--;
                    if(depth===0)return text.slice(start,i+1);
                    if(depth<0)return '';
                }
            }
            return '';
        }
            parse(text) {
            let source=String(text).trim();
            const block=source.match(/<world_update\s*>([\s\S]*?)<\/world_update>/i);
            if(block)source=block[1].trim();
            const fence=source.match(/\x60\x60\x60(?:json)?\s*([\s\S]*?)\x60\x60\x60/i);
            if(fence)source=fence[1].trim();
            let result;
            try {result=JSON.parse(source);}
            catch(error){
                const candidate=this.firstCompleteJsonObject(source);
                try {if(!candidate)throw error;result=JSON.parse(candidate);}
                catch(_){throw new Error('返回 JSON 无法解析：'+error.message+'；原始回复保留在请求检查。');}
            }
            if(!plain(result))throw new Error('回复必须是一个 JSON 对象');
            for(const key of ['WorldResult','world_result','world_update','result']){
                if(plain(result[key])&&Object.keys(result).length===1){result=result[key];break;}
            }
            if(Array.isArray(result.patches)&&typeof result.summary==='string'){
                return {kind:'legacy_patches',summary:result.summary,patches:result.patches};
            }
            const worldResult=normalizeWorldResult(result);
            return {kind:'world_result',summary:worldResult.摘要,worldResult};
        }
    }
    const DEFAULT_WORLD_RESULT_REPLY_PARSER=new WorldResultReplyParser();
    let ACTIVE_WORLD_RESULT_REPLY_PARSER=DEFAULT_WORLD_RESULT_REPLY_PARSER;
    function parseReply(text){return ACTIVE_WORLD_RESULT_REPLY_PARSER.parse(text);}
