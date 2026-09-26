    class WorldNpcAuditPromptFeature {
        constructor(engine){this.engine=engine;}
        initialize(){
            const engine=this.engine,current=String(engine.config.npcAuditPrompt||'');
            const previousNarrativeDefault=current.includes('【角色管理 · NPC构筑审计】')
                &&current.includes('最低构筑：杂兵=血统1/装备2/技能1')
                &&(current.includes('审计级别只依据既有身份、职业、背景故事、态度体现的剧情份量判断')
                    ||current.includes('审计新增装备统一写状态=1'));
            if(!current.trim()||current===NPC_BUILD_AUDIT_RULES||previousNarrativeDefault){
                engine.config.npcAuditPrompt=NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT;
                if(plain(engine.config.promptRegistry))engine.config.promptRegistry.npcAudit=NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT;
            }
        }
    }
