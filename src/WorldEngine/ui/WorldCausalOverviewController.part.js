    class WorldCausalOverviewController {
        constructor(engine){this.engine=engine;}
        ensureStyles(){
            const engine=this.engine;
            if(!engine.style||engine.style.textContent.includes('.we-causal-summary{'))return;
            engine.style.textContent+='\n#sam-world-engine .we-causal-summary{display:grid;gap:9px}#sam-world-engine .we-stability-compact,#sam-world-engine .we-causal-jump{width:100%;border:1px solid var(--we-line,var(--line));border-radius:10px;background:var(--we-card,#18222f);color:var(--we-ink,var(--ink));text-align:left}#sam-world-engine .we-stability-compact{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px}#sam-world-engine .we-stability-compact span{display:flex;align-items:baseline;gap:9px}#sam-world-engine .we-stability-compact small{color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-stability-compact strong{font-size:22px}#sam-world-engine .we-stability-compact em{font-style:normal;color:var(--we-gold,var(--gold));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-causal-latest{display:grid;gap:6px}#sam-world-engine .we-causal-jump{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 9px;padding:9px 10px}#sam-world-engine .we-causal-jump:hover,#sam-world-engine .we-stability-compact:hover{background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-causal-jump span{min-width:0}#sam-world-engine .we-causal-jump b,#sam-world-engine .we-causal-jump small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#sam-world-engine .we-causal-jump small{margin-top:1px;color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-causal-jump strong{color:var(--we-gold,var(--gold));font-size:12px}#sam-world-engine .we-causal-jump p{grid-column:1/-1;margin:2px 0 0!important;color:var(--we-sub,var(--sub))!important;font-size:var(--we-fs-small,12px)!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}#sam-world-engine .we-causal-archive-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(260px,1fr);gap:23px;align-items:start;margin-top:22px}#sam-world-engine .we-causal-track dl{grid-template-columns:76px minmax(0,1fr)}@media(max-width:900px){#sam-world-engine .we-causal-archive-grid{grid-template-columns:1fr}}';
        }
        ensureArchiveTab(){
            const engine=this.engine,nav=engine.panel?.querySelector?.('nav');if(!nav)return;
            let button=nav.querySelector('[data-tab="因果档案"]');
            if(!button){
                button=engine.host.document.createElement('button');button.dataset.tab='因果档案';button.innerHTML='<span class="we-tab-icon" aria-hidden="true">◇</span>因果档案';
                const worldButton=nav.querySelector('[data-tab="世界推进"]');
                if(worldButton)worldButton.insertAdjacentElement('afterend',button);else nav.appendChild(button);
            }
            for(const item of nav.querySelectorAll('[data-tab]'))item.setAttribute('aria-selected',String(item.dataset.tab===engine.tab));
        }
        hideRedundantPlayerModules(){
            const nav=this.engine.panel?.querySelector?.('nav');if(!nav)return;
            for(const tab of WORLD_ENGINE_HIDDEN_PLAYER_TABS)nav.querySelector('[data-tab="'+tab+'"]')?.remove();
        }
        compactWorldOverview(){
            const engine=this.engine,main=engine.panel?.querySelector?.('main');if(!main)return;
            const stat=engine.snapshot().stat,causal=causalSectionByTitle(main,'因果状态');
            main.querySelector('.we-kpi-grid.we-kpi-compact')?.remove();
            if(causal){
                const head=causal.querySelector('.we-section-head');
                if(head){
                    const h=head.querySelector('h2'),small=head.querySelector('small');
                    if(h)h.textContent='因果摘要';
                    if(small)small.textContent='最新 '+Math.min(CAUSAL_OVERVIEW_LIMIT,causalOffsetEntries(stat).length)+' 条 · 点击进入档案';
                }
                Array.from(causal.children).filter(child=>child!==head).forEach(child=>child.remove());
                causal.insertAdjacentHTML('beforeend',causalCompactHtml(stat));
            }
            for(const title of ['货币与经济','世界法则'])causalSectionByTitle(main,title)?.remove();
        }
        removeRunRecordInterference(){
            const main=this.engine.panel?.querySelector?.('main');if(!main)return;
            causalSectionByTitle(main,'干涉模式')?.remove();
        }
        renderArchive(){
            const main=this.engine.panel?.querySelector?.('main');if(!main)return;
            main.insertAdjacentHTML('beforeend',causalArchiveHtml(this.engine.snapshot().stat));
        }
        beforeRender(){
            if(isWorldEnginePlayerTabHidden(this.engine.tab))this.engine.tab='世界推进';
        }
        afterRender(){
            const engine=this.engine;if(!engine.panel)return;
            this.ensureStyles();
            this.ensureArchiveTab();
            this.hideRedundantPlayerModules();
            if(engine.tab==='世界推进')this.compactWorldOverview();
            else if(engine.tab==='因果档案')this.renderArchive();
            else if(engine.tab==='运行记录')this.removeRunRecordInterference();
        }
    }
