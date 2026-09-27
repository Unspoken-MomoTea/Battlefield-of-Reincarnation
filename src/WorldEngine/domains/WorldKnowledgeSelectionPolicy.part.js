    const WORLD_TECHNICAL_BOOK_PATTERNS=[/^\[variables\]/i,/^\[mvu_update\]/i,/^output_format_/i,/^⚙️额外思考(?:\.|$)/,/^行动选项_/i,/^【(?:主神任务|结算任务|试炼任务|选择世界)】/];

    class WorldKnowledgeSelectionPolicy {
        parseKey(value) {
            try{
                const parsed=JSON.parse(String(value||''));
                return Array.isArray(parsed)&&parsed.length>=2?[String(parsed[0]||''),String(parsed[1]??'')]:null;
            }catch(_){return null;}
        }
        normalizeIdentity(value) {
            let name=String(value||'').trim().toLowerCase();
            const versionAt=name.search(/(?:\bv(?:er(?:sion)?)?|版本)?\s*\d+(?:\.\d+){1,3}/i);
            if(versionAt>0)name=name.slice(0,versionAt);
            return name.replace(/[\s_\-·.]+/g,'');
        }
        normalizeTitle(value) {
            return String(value||'').trim().replace(/^⚙(?:\uFE0F)?\s*/u,'').trim();
        }
        matches(entry,selectedEntries) {
            if(!Array.isArray(selectedEntries))return entry?.enabled!==false;
            const exact=JSON.stringify([String(entry?.book||''),String(entry?.id??'')]);
            if(selectedEntries.includes(exact))return true;
            const entryBook=this.normalizeIdentity(entry?.book),entryId=String(entry?.id??'');
            for(const raw of selectedEntries){
                const ref=this.parseKey(raw);if(!ref||ref[1]!==entryId)continue;
                if(ref[0]==='*'||(entryBook&&this.normalizeIdentity(ref[0])===entryBook))return true;
            }
            return false;
        }
        isTechnical(title) {
            return WORLD_TECHNICAL_BOOK_PATTERNS.some(rule=>rule.test(String(title||'').trim()));
        }
        isTimelineBackbone(title) {
            const name=String(title||'').replace(/\s+/g,'');
            if(/(?:变量|输出格式|更新规则|COT|思考|风格|助手|状态栏)/i.test(name))return false;
            return /(?:校历|世界年表|事件年表|原著年表|时间线|时间轴|大事记|大事件摘要|历史大事件|剧情大纲|剧情章节|章节控制器|主线年表)/i.test(name);
        }
    }

    const DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY=new WorldKnowledgeSelectionPolicy();
    let ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY=DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY;
    function parseSelectedEntryKey(value){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.parseKey(value);}
    function normalizeWorldbookIdentity(value){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.normalizeIdentity(value);}
    function normalizeWorldbookEntryTitle(value){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.normalizeTitle(value);}
    function selectedEntryMatches(entry,selectedEntries){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.matches(entry,selectedEntries);}
    function isTechnicalBook(title){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.isTechnical(title);}
    function isTimelineBackboneEntry(title){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.isTimelineBackbone(title);}
