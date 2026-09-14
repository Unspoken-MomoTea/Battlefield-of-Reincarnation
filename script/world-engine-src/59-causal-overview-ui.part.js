    // 主面板只保留最新因果摘要；完整偏移、故事线、法则与经济资料进入独立“因果档案”页。
    const CAUSAL_OVERVIEW_LIMIT=3;
    function causalOffsetEntries(stat) {
        const bucket=stat?.世界?.因果轨道?.偏移记录;
        return Object.entries(plain(bucket)?bucket:{}).slice().reverse();
    }
    function latestCausalOffsets(stat,limit=CAUSAL_OVERVIEW_LIMIT) {
        return causalOffsetEntries(stat).slice(0,Math.max(0,Number(limit)||0));
    }
    function causalImpactLabel(value) {
        const n=Number(value);
        return Number.isFinite(n)?(n>0?'+':'')+n:'影响未记录';
    }
    function causalOverviewEscape(value) {
        return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }
    function causalCompactHtml(stat) {
        const world=stat?.世界||{},offsets=causalOffsetEntries(stat),latest=offsets.slice(0,CAUSAL_OVERVIEW_LIMIT);
        const stable=world.稳定!==null&&world.稳定!==''&&Number.isFinite(Number(world.稳定))?Number(world.稳定):null;
        const rows=latest.map(([name,record])=>'<button class="we-causal-jump" data-tab="因果档案"><span><b>'+causalOverviewEscape(name)+'</b><small>'+causalOverviewEscape(record?.引发者||'引发者未记录')+'</small></span><strong>'+causalOverviewEscape(causalImpactLabel(record?.影响程度))+'</strong><p>'+causalOverviewEscape(record?.描述||'暂无偏移描述')+'</p></button>').join('');
        return '<div class="we-causal-summary"><button class="we-stability-compact" data-tab="因果档案"><span><small>世界稳定值</small><strong>'+causalOverviewEscape(stable===null?'未记录':stable)+'</strong></span><em>查看因果档案 →</em></button>'
            +(rows?'<div class="we-causal-latest">'+rows+'</div>':'<div class="we-empty"><b>暂无因果偏移</b><small>重大且已确认的因果改变会记录在这里。</small></div>')
            +'<button class="we-link-btn" data-tab="因果档案">查看全部 '+offsets.length+' 条偏移、故事线与世界法则 →</button></div>';
    }
    function causalArchiveHtml(stat) {
        const world=stat?.世界||{},orbit=world.因果轨道||{},offsets=causalOffsetEntries(stat),stable=world.稳定!==null&&world.稳定!==''&&Number.isFinite(Number(world.稳定))?Number(world.稳定):null;
        const offsetCard=([name,record])=>'<article class="we-offset"><div class="we-offset-head"><b>'+causalOverviewEscape(name)+'</b><span>'+causalOverviewEscape(causalImpactLabel(record?.影响程度))+'</span></div><p>'+causalOverviewEscape(record?.描述||'暂无偏移描述')+'</p><small>引发者 · '+causalOverviewEscape(record?.引发者||'未记录')+'</small></article>';
        const recent=offsets.slice(0,12),older=offsets.slice(12);
        const laws=Array.isArray(world.法则)?world.法则:(world.法则?[world.法则]:[]);
        const money=world.货币||{};
        const story='<article class="we-card we-causal-track"><dl><dt>当前阶段</dt><dd>'+causalOverviewEscape(orbit.当前阶段||'待初始化')+'</dd><dt>故事线</dt><dd>'+causalOverviewEscape(orbit.故事线||'未记录')+'</dd><dt>下一节点</dt><dd>'+causalOverviewEscape(orbit.下一节点||'未记录')+'</dd></dl></article>';
        const stability='<div class="we-causal"><div class="we-stability"><div><small>世界稳定值</small><strong data-world-stability>'+causalOverviewEscape(stable===null?'未记录':stable)+'</strong></div><span>完整偏移保留为因果记忆；主面板仅显示最新 '+CAUSAL_OVERVIEW_LIMIT+' 条</span></div>'
            +(stable===null?'':'<meter min="0" max="120" value="'+Math.max(0,Math.min(120,stable))+'" aria-label="世界稳定值">'+stable+'</meter>')
            +'</div>';
        const offsetList=recent.length?recent.map(offsetCard).join(''):'<div class="we-empty"><b>暂无因果偏移</b><small>只有已发生的重大不可逆结果才会建立记录。</small></div>';
        const olderHtml=older.length?'<details class="we-offset-more"><summary>查看更早 '+older.length+' 条偏移</summary>'+older.map(offsetCard).join('')+'</details>':'';
        const moneyHtml='<article class="we-card"><dl><dt>货币体系</dt><dd>'+causalOverviewEscape(money.体系||'未记录')+'</dd><dt>购买力基准</dt><dd>'+causalOverviewEscape(money.购买力基准||'未记录')+'</dd><dt>经济波动</dt><dd>'+causalOverviewEscape(money.经济波动||'未记录')+'</dd></dl></article>';
        const lawHtml=laws.length?'<div class="we-reading we-world-laws">'+laws.map(item=>'<article><p>'+causalOverviewEscape(item)+'</p></article>').join('')+'</div>':'<div class="we-empty"><b>尚无世界法则</b><small>明确生效的法则会在这里维护。</small></div>';
        return '<div class="we-causal-archive-grid"><div><section class="we-section"><div class="we-section-head"><h2>因果偏移档案</h2><small>'+offsets.length+' 条 · 最新在前</small></div>'+stability+offsetList+olderHtml+'</section></div><aside><section class="we-section"><div class="we-section-head"><h2>因果轨道</h2><small>长期方向</small></div>'+story+'</section><section class="we-section"><div class="we-section-head"><h2>货币与经济</h2><small>世界推进维护</small></div>'+moneyHtml+'</section><section class="we-section"><div class="we-section-head"><h2>世界法则</h2><small>'+laws.length+' 条</small></div>'+lawHtml+'</section></aside></div>';
    }
    function causalSectionByTitle(root,title) {
        return Array.from(root?.querySelectorAll?.('.we-section')||[]).find(section=>section.querySelector('.we-section-head h2')?.textContent?.trim()===title)||null;
    }

    const SamsaraWorldEngineBeforeCausalOverview=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeCausalOverview {
        ensureCausalOverviewStyles() {
            if(!this.style||this.style.textContent.includes('.we-causal-summary{'))return;
            this.style.textContent+='\n#sam-world-engine .we-causal-summary{display:grid;gap:9px}#sam-world-engine .we-stability-compact,#sam-world-engine .we-causal-jump{width:100%;border:1px solid var(--we-line,var(--line));border-radius:10px;background:var(--we-card,#18222f);color:var(--we-ink,var(--ink));text-align:left}#sam-world-engine .we-stability-compact{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px}#sam-world-engine .we-stability-compact span{display:flex;align-items:baseline;gap:9px}#sam-world-engine .we-stability-compact small{color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-stability-compact strong{font-size:22px}#sam-world-engine .we-stability-compact em{font-style:normal;color:var(--we-gold,var(--gold));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-causal-latest{display:grid;gap:6px}#sam-world-engine .we-causal-jump{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 9px;padding:9px 10px}#sam-world-engine .we-causal-jump:hover,#sam-world-engine .we-stability-compact:hover{background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-causal-jump span{min-width:0}#sam-world-engine .we-causal-jump b,#sam-world-engine .we-causal-jump small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#sam-world-engine .we-causal-jump small{margin-top:1px;color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-causal-jump strong{color:var(--we-gold,var(--gold));font-size:12px}#sam-world-engine .we-causal-jump p{grid-column:1/-1;margin:2px 0 0!important;color:var(--we-sub,var(--sub))!important;font-size:var(--we-fs-small,12px)!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}#sam-world-engine .we-causal-archive-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(260px,1fr);gap:23px;align-items:start;margin-top:22px}#sam-world-engine .we-causal-track dl{grid-template-columns:76px minmax(0,1fr)}@media(max-width:900px){#sam-world-engine .we-causal-archive-grid{grid-template-columns:1fr}}';
        }
        ensureCausalArchiveTab() {
            const nav=this.panel?.querySelector?.('nav');if(!nav)return;
            let button=nav.querySelector('[data-tab="因果档案"]');
            if(!button){
                button=this.host.document.createElement('button');button.dataset.tab='因果档案';button.innerHTML='<span class="we-tab-icon" aria-hidden="true">◇</span>因果档案';
                const worldButton=nav.querySelector('[data-tab="世界推进"]');
                if(worldButton)worldButton.insertAdjacentElement('afterend',button);else nav.appendChild(button);
            }
            for(const item of nav.querySelectorAll('[data-tab]'))item.setAttribute('aria-selected',String(item.dataset.tab===this.tab));
        }
        compactWorldOverview() {
            const main=this.panel?.querySelector?.('main');if(!main)return;
            const stat=this.snapshot().stat,causal=causalSectionByTitle(main,'因果状态');
            if(causal){
                const head=causal.querySelector('.we-section-head');
                if(head){const h=head.querySelector('h2'),small=head.querySelector('small');if(h)h.textContent='因果摘要';if(small)small.textContent='最新 '+Math.min(CAUSAL_OVERVIEW_LIMIT,causalOffsetEntries(stat).length)+' 条 · 点击进入档案';}
                Array.from(causal.children).filter(child=>child!==head).forEach(child=>child.remove());
                causal.insertAdjacentHTML('beforeend',causalCompactHtml(stat));
            }
            for(const title of ['货币与经济','世界法则'])causalSectionByTitle(main,title)?.remove();
        }
        renderCausalArchive() {
            const main=this.panel?.querySelector?.('main');if(!main)return;
            main.insertAdjacentHTML('beforeend',causalArchiveHtml(this.snapshot().stat));
        }
        render(force) {
            const result=super.render(force);
            if(!this.panel)return result;
            this.ensureCausalOverviewStyles();
            this.ensureCausalArchiveTab();
            if(this.tab==='世界推进')this.compactWorldOverview();
            else if(this.tab==='因果档案')this.renderCausalArchive();
            return result;
        }
    };
