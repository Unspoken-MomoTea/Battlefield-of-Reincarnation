    class WorldProseExtractor {
        extract(value) {
            let source=String(value??'').replace(/\r\n?/g,'\n');
            source=source.replace(/<!--[\s\S]*?(?:-->|$)/g,'\n');
            source=source.replace(/<details\b[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>[\s\S]*?(?:<\/details>|$)/gi,
                (block,title)=>/思考|思维链|变量|更新|检定|结算|状态栏|thinking|reasoning|analysis/i.test(title)?'\n':block);
            const hidden=new Set(['think','thinking','reasoning','analysis','konatan_planning','dm_think','chain_of_thought',
                'updatevariable','jsonpatch','variables','status_current_variables','user_status_readonly',
                'worldresult','options','statusplaceholder',
                'action','summary','update','scene_time','pic','dicecombat','dicecheck','enemyoverview',
                'summonoverview','lootlog','experiencelog','questcontract','merchantstore','combatsnapshot',
                'combatresult','craftresult','checkresult',
                'ash-review','acu-review','ash_review','acu_note','acu-review-slot',
                'script','style','head','iframe']);
            // 部分正文模型通过 assistant prefill 注入隐藏块的开始标签，最终楼层只会保存结束标签。
            // 仅对思考类标签启用“首个隐藏标签为孤立结束标签”的兼容，避免误吞变量/面板前的正常正文。
            const prefillHidden=new Set(['think','thinking','reasoning','analysis','konatan_planning','dm_think','chain_of_thought']);
            // 按标签栈移除整个技术块，支持嵌套与属性；未闭合技术块的剩余内容也不发送。
            const tags=/<\s*(\/?)\s*([a-z_][\w-]*)\b[^>]*>/gi;
            const stack=[];let text='',cursor=0,match,seenHiddenTag=false;
            while((match=tags.exec(source))){
                const name=match[2].toLowerCase();
                if(!hidden.has(name))continue;
                const closing=!!match[1];
                // assistant prefill 可能把 <thinking>/<konatan_planning~> 等开始标签放在保存文本之外。
                // 若本楼第一个隐藏边界就是对应结束标签，则从消息开头到该标签都属于隐藏思考。
                if(closing&&!stack.length&&!seenHiddenTag&&prefillHidden.has(name)){
                    cursor=tags.lastIndex;
                    seenHiddenTag=true;
                    continue;
                }
                seenHiddenTag=true;
                if(!stack.length)text+=source.slice(cursor,match.index);
                if(closing){
                    const at=stack.lastIndexOf(name);
                    if(at>=0)stack.length=at;
                }else if(!/\/\s*>$/.test(match[0]))stack.push(name);
                cursor=tags.lastIndex;
                if(!stack.length)text+='\n';
            }
            if(!stack.length)text+=source.slice(cursor);
            // 代码面板不属于已演出剧情；无语言标记的纯叙事围栏仍可兼容。
            text=text.replace(/^[ \t]*(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gm,
                (_block,_fence,language,body)=>{
                    if(/^(?:json\w*|ya?ml|html|xml|javascript|js|typescript|ts|css|python|diff)\b/i.test(language.trim()))return '\n';
                    try{const data=JSON.parse(body);if(data&&typeof data==='object')return '\n';}catch(_){}
                    return body;
                });
            // 对应参考助手 bodyTagsText 为空的模式：始终清洗整楼，不按正文标签截取。
            try{const data=JSON.parse(text);if(data&&typeof data==='object')return '';}catch(_){}
            return text.replace(/<[^>]+>/g,tag=>/^<user>$/i.test(tag)?tag:'')
                .replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
        }
    }

    const DEFAULT_WORLD_PROSE_EXTRACTOR=new WorldProseExtractor();
    let ACTIVE_WORLD_PROSE_EXTRACTOR=DEFAULT_WORLD_PROSE_EXTRACTOR;
    function extractWorldProse(value){return ACTIVE_WORLD_PROSE_EXTRACTOR.extract(value);}
