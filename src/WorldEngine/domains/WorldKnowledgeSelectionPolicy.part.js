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
    }

    const DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY=new WorldKnowledgeSelectionPolicy();
    let ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY=DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY;
    function parseSelectedEntryKey(value){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.parseKey(value);}
    function normalizeWorldbookIdentity(value){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.normalizeIdentity(value);}
    function normalizeWorldbookEntryTitle(value){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.normalizeTitle(value);}
    function selectedEntryMatches(entry,selectedEntries){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.matches(entry,selectedEntries);}
