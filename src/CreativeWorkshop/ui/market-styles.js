export const MARKET_CSS = `
.rw-market-tab{position:relative}
.rw-market-test-badge{margin-left:6px;padding:1px 5px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.08em;color:#ffd98a;background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.38)}
.rw-market-page{display:flex;flex-direction:column;gap:0;min-height:0}
.rw-auction-house{--ah-line:rgba(255,255,255,.085);--ah-soft:rgba(255,255,255,.035);--ah-gold:#e7bd63;--ah-muted:var(--rw-muted,#9099a8)}
.rw-ah-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:14px 16px 12px;border:1px solid var(--ah-line);border-bottom:0;border-radius:14px 14px 0 0;background:linear-gradient(180deg,rgba(245,158,11,.065),rgba(255,255,255,.015))}
.rw-ah-title{min-width:0}
.rw-ah-kicker{display:flex;align-items:center;gap:4px;color:#d9b35f;font-size:11px;font-weight:900;letter-spacing:.14em}
.rw-ah-title h2{margin:4px 0 3px;font-size:24px}
.rw-ah-title p{margin:0;max-width:680px;color:var(--ah-muted);font-size:12px;line-height:1.45}
.rw-ah-account-strip{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
.rw-ah-account-cell{display:flex;flex-direction:column;gap:2px;min-width:82px;padding:7px 9px;border:1px solid var(--ah-line);border-radius:8px;background:rgba(0,0,0,.14)}
.rw-ah-account-cell span{font-size:10px;color:var(--ah-muted);text-transform:uppercase;letter-spacing:.06em}
.rw-ah-account-cell strong{font-size:13px;color:#e8ebf0}

.rw-ah-tabs{display:flex;align-items:center;gap:2px;padding:0 10px;border:1px solid var(--ah-line);border-bottom-color:rgba(255,255,255,.13);background:rgba(0,0,0,.18)}
.rw-ah-tab{position:relative;padding:10px 16px;border:0;background:transparent;color:#aeb6c2;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.rw-ah-tab:hover{color:#fff;background:rgba(255,255,255,.035)}
.rw-ah-tab.is-active{color:#f5d486}
.rw-ah-tab.is-active:after{content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:2px;background:#d7aa4a;box-shadow:0 0 8px rgba(215,170,74,.35)}
.rw-ah-tab-spacer{flex:1}
.rw-ah-region-note{font-size:11px;color:var(--ah-muted);padding-right:4px}

.rw-ah-panel{min-height:0}
.rw-ah-toolbar{display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--ah-line);border-top:0;background:rgba(255,255,255,.018)}
.rw-ah-search{display:flex;align-items:center;gap:7px;flex:1;min-width:180px;padding-left:9px;border:1px solid var(--ah-line);border-radius:7px;background:rgba(0,0,0,.18)}
.rw-ah-search>span{font-size:15px;color:#788392}
.rw-ah-search .rw-input{flex:1;border:0!important;background:transparent!important;box-shadow:none!important;padding-left:0}
.rw-ah-toolbar .rw-select{min-width:140px}
.rw-ah-toolbar .rw-select,.rw-ah-toolbar .rw-button,.rw-ah-search .rw-input{font-size:12px}
.rw-ah-result-count{min-width:138px;text-align:right;font-size:11px;color:var(--ah-muted)}

.rw-ah-browser{display:grid;grid-template-columns:174px minmax(340px,1fr) 318px;min-height:530px;border:1px solid var(--ah-line);border-top:0;border-radius:0 0 14px 14px;overflow:hidden;background:rgba(6,8,12,.28)}
.rw-ah-categories{padding:10px 8px;border-right:1px solid var(--ah-line);background:rgba(0,0,0,.15)}
.rw-ah-side-title{padding:4px 9px 8px;font-size:11px;font-weight:900;letter-spacing:.12em;color:#7f8997;text-transform:uppercase}
.rw-ah-category{display:flex;align-items:center;justify-content:space-between;width:100%;padding:8px 9px;margin:1px 0;border:1px solid transparent;border-radius:6px;background:transparent;color:#b9c0ca;font:inherit;font-size:12px;cursor:pointer;text-align:left}
.rw-ah-category small{font-size:9px;color:#66717f;letter-spacing:.08em}
.rw-ah-category:hover{background:rgba(255,255,255,.035);color:#fff}
.rw-ah-category.is-active{border-color:rgba(215,170,74,.28);background:rgba(215,170,74,.09);color:#f2d183}
.rw-ah-category.is-active small{color:#b99a59}
.rw-ah-side-rule{height:1px;margin:10px 7px;background:var(--ah-line)}
.rw-ah-side-help{padding:2px 8px;color:#717b89;font-size:10px;line-height:1.55}

.rw-ah-results{display:flex;min-width:0;min-height:0;flex-direction:column;border-right:1px solid var(--ah-line)}
.rw-ah-table-head,.rw-ah-result-row{display:grid;grid-template-columns:minmax(180px,1fr) 56px 50px 50px 88px;align-items:center}
.rw-ah-table-head{height:34px;padding:0 10px;border-bottom:1px solid var(--ah-line);background:rgba(255,255,255,.02);color:#737e8c;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
.rw-ah-table-head span:nth-child(n+2){text-align:right}
.rw-ah-list{min-height:0;max-height:590px;overflow:auto}
.rw-ah-result-row{width:100%;min-height:58px;padding:5px 10px;border:0;border-bottom:1px solid rgba(255,255,255,.045);background:transparent;color:#d8dde5;font:inherit;cursor:pointer;text-align:left}
.rw-ah-result-row:hover{background:rgba(255,255,255,.035)}
.rw-ah-result-row.is-selected{background:linear-gradient(90deg,rgba(210,164,72,.13),rgba(210,164,72,.035));box-shadow:inset 2px 0 #d2a448}
.rw-ah-result-item{display:flex;align-items:center;gap:9px;min-width:0}
.rw-ah-result-item-copy,.rw-ah-inventory-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.rw-ah-result-item-copy strong,.rw-ah-inventory-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.rw-ah-result-item-copy small,.rw-ah-inventory-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#798492}
.rw-ah-item-icon{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border:1px solid rgba(255,255,255,.13);border-radius:5px;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.13),rgba(255,255,255,.02));color:#c7ced8;font-size:16px;font-weight:900}
.rw-ah-item-icon[data-quality="F"],.rw-ah-item-icon[data-quality="NONE"]{border-color:rgba(148,163,184,.36);color:#cbd5e1;background:rgba(148,163,184,.08)}
.rw-ah-item-icon[data-quality="E"]{border-color:rgba(248,250,252,.34);color:#f8fafc;background:rgba(248,250,252,.07)}
.rw-ah-item-icon[data-quality="D"]{border-color:rgba(34,197,94,.38);color:#4ade80;background:rgba(34,197,94,.09)}
.rw-ah-item-icon[data-quality="C"]{border-color:rgba(59,130,246,.4);color:#60a5fa;background:rgba(59,130,246,.1)}
.rw-ah-item-icon[data-quality="B"]{border-color:rgba(168,85,247,.42);color:#c084fc;background:rgba(168,85,247,.1)}
.rw-ah-item-icon[data-quality="A"]{border-color:rgba(249,115,22,.44);color:#fb923c;background:rgba(249,115,22,.1)}
.rw-ah-item-icon[data-quality="S"]{border-color:rgba(234,179,8,.46);color:#facc15;background:rgba(234,179,8,.11)}
.rw-ah-item-icon[data-quality="SS"]{border-color:rgba(239,68,68,.48);color:#f87171;background:rgba(239,68,68,.11)}
.rw-ah-item-icon[data-quality="SSS"],.rw-ah-item-icon[data-quality="EX"]{border-color:rgba(236,72,153,.5);color:#f472b6;background:rgba(236,72,153,.11)}
.rw-ah-result-kind,.rw-ah-result-quality,.rw-ah-result-stock,.rw-ah-result-price{text-align:right;font-size:11px;color:#aeb7c3}
.rw-ah-type-tag{display:inline-flex;justify-content:center;min-width:34px;padding:2px 5px;border:1px solid rgba(96,165,250,.18);border-radius:999px;background:rgba(96,165,250,.07);color:#9fbce4;font-size:9px;font-weight:800}
.rw-ah-result-quality{color:#a99be2}
.rw-ah-result-price{display:flex;align-items:baseline;justify-content:flex-end;gap:3px}
.rw-ah-result-price strong{font-size:12px;color:#e5c36e}
.rw-ah-result-price small{font-size:9px;color:#806f48}
.rw-ah-inspector{min-width:0;min-height:0;padding:12px;background:rgba(0,0,0,.11);overflow:auto}
.rw-ah-empty-inspector{display:flex;min-height:260px;align-items:center;justify-content:center;flex-direction:column;gap:6px;text-align:center;color:#737d8a}
.rw-ah-empty-inspector strong{font-size:13px;color:#aab2bd}
.rw-ah-empty-inspector span{max-width:240px;font-size:11px;line-height:1.5}
.rw-ah-empty-icon{font-size:32px;color:#5f6875}
.rw-ah-inspector-body,.rw-ah-sell-editor-body{display:flex;flex-direction:column;gap:11px}
.rw-ah-detail-head{padding-bottom:9px;border-bottom:1px solid var(--ah-line)}
.rw-ah-inspector-title{margin-bottom:7px;color:#7c8795;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
.rw-ah-detail-head h3{margin:0;font-size:17px}
.rw-ah-inspector-head{display:flex;align-items:center;gap:10px;padding-bottom:9px;border-bottom:1px solid var(--ah-line)}
.rw-ah-inspector-head h3{margin:4px 0 0;font-size:16px}
.rw-ah-inspector-kicker{display:flex;gap:5px;align-items:center}
.rw-market-kind,.rw-market-quality{padding:2px 6px;border-radius:999px;font-size:9px;font-weight:800}
.rw-market-kind{background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.24);color:#9fc9ff}
.rw-market-quality{background:rgba(168,85,247,.1);border:1px solid rgba(168,85,247,.24);color:#cbb1ff}
.rw-ah-asset-detail{display:flex;flex-direction:column;gap:8px}
.rw-ah-description{margin:0;color:#9ca6b3;font-size:11px;line-height:1.55}
.rw-ah-data-section{display:flex;flex-direction:column;gap:6px;padding-top:2px}
.rw-ah-data-object{display:flex;flex-direction:column;border:1px solid var(--ah-line);border-radius:7px;overflow:hidden;background:rgba(0,0,0,.09)}
.rw-ah-data-object.nested{width:100%;border-color:rgba(255,255,255,.055);background:rgba(255,255,255,.012)}
.rw-ah-data-row,.rw-ah-data-nested{display:grid;grid-template-columns:minmax(72px,34%) minmax(0,1fr);gap:8px;align-items:start;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.045)}
.rw-ah-data-row:last-child,.rw-ah-data-nested:last-child{border-bottom:0}
.rw-ah-data-key{font-size:10px;color:#778391;line-height:1.5;word-break:break-word}
.rw-ah-data-value{font-size:10px;color:#c7ced7;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.rw-ah-data-value.muted{color:#697482}
.rw-ah-data-list{display:flex;gap:4px;flex-wrap:wrap;min-width:0}
.rw-ah-data-chip{padding:2px 5px;border:1px solid rgba(255,255,255,.075);border-radius:999px;background:rgba(255,255,255,.025);font-size:9px;color:#b7c0cb}
.rw-ah-section-label{margin-bottom:5px;color:#7c8795;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.rw-ah-ladder{padding:8px;border:1px solid var(--ah-line);border-radius:7px;background:rgba(0,0,0,.12)}
.rw-ah-ladder-row{display:flex;justify-content:space-between;padding:4px 2px;border-bottom:1px solid rgba(255,255,255,.04);font-size:11px}
.rw-ah-ladder-row:last-child{border-bottom:0}
.rw-ah-ladder-row span:first-child{color:#dfbd66}
.rw-ah-ladder-row span:last-child{color:#8f99a6}
.rw-ah-seller-line{display:flex;justify-content:space-between;padding:8px;border:1px solid var(--ah-line);border-radius:7px;font-size:11px}
.rw-ah-seller-line span{color:#7f8995}
.rw-ah-purchase-box{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid rgba(215,170,74,.24);border-radius:8px;background:rgba(215,170,74,.055)}
.rw-ah-purchase-box>strong{font-size:13px}
.rw-ah-purchase-box>p{margin:0;color:#8d97a4;font-size:11px;line-height:1.5}
.rw-ah-quantity-field,.rw-ah-form-field{display:flex;align-items:center;justify-content:space-between;gap:10px}
.rw-ah-quantity-field>span,.rw-ah-form-field>span{font-size:11px;color:#8a95a2}
.rw-ah-quantity-field .rw-input,.rw-ah-form-field .rw-input{width:110px}
.rw-ah-buy-total{display:flex;justify-content:space-between;align-items:baseline}
.rw-ah-buy-total span{font-size:10px;color:#7f8996}
.rw-ah-buy-total strong{font-size:15px;color:#e6c26d}
.rw-ah-purchase-help{color:#737d89;font-size:10px;line-height:1.45}

.rw-ah-sell-layout{display:grid;grid-template-columns:320px minmax(0,1fr);min-height:535px;border:1px solid var(--ah-line);border-top:0;border-radius:0 0 14px 14px;overflow:hidden}
.rw-ah-inventory-pane{display:flex;min-height:0;flex-direction:column;border-right:1px solid var(--ah-line);background:rgba(0,0,0,.13)}
.rw-ah-pane-head,.rw-ah-mine-toolbar{display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border-bottom:1px solid var(--ah-line)}
.rw-ah-pane-head small,.rw-ah-mine-toolbar small{font-size:9px;color:#737d8a;letter-spacing:.1em}
.rw-ah-pane-head h3,.rw-ah-mine-toolbar h3{margin:2px 0 0;font-size:14px}
.rw-ah-pane-head>span{font-size:10px;color:#7d8794}
.rw-ah-inventory-list{max-height:590px;overflow:auto}
.rw-ah-inventory-row{display:flex;align-items:center;gap:9px;width:100%;padding:7px 10px;border:0;border-bottom:1px solid rgba(255,255,255,.045);background:transparent;color:#d6dce4;font:inherit;text-align:left;cursor:pointer}
.rw-ah-inventory-row:hover{background:rgba(255,255,255,.035)}
.rw-ah-inventory-row.is-selected{background:rgba(215,170,74,.09);box-shadow:inset 2px 0 #d2a448}
.rw-ah-inventory-copy{flex:1}
.rw-ah-inventory-qty{font-size:11px;color:#8e98a5}
.rw-ah-sell-editor{padding:16px;overflow:auto;background:rgba(0,0,0,.07)}
.rw-ah-sell-editor-body{max-width:620px;margin:0 auto}
.rw-ah-reference-price{display:flex;align-items:center;justify-content:space-between;padding:9px 10px;border:1px solid var(--ah-line);border-radius:7px;background:rgba(255,255,255,.02)}
.rw-ah-reference-price span{font-size:10px;color:#7f8996}
.rw-ah-reference-price strong{font-size:13px;color:#e4bf66}
.rw-ah-sell-form{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:11px;border:1px solid rgba(215,170,74,.2);border-radius:8px;background:rgba(215,170,74,.04)}
.rw-ah-sell-total{grid-column:1/-1;padding-top:7px;border-top:1px solid var(--ah-line);font-size:12px;color:#d7b460}
.rw-ah-sell-form>.rw-button{grid-column:1/-1}
.rw-ah-blocked{display:flex;flex-direction:column;gap:3px;padding:11px;border:1px solid rgba(239,68,68,.2);border-radius:7px;background:rgba(239,68,68,.055)}
.rw-ah-blocked strong{font-size:12px;color:#e3aaaa}
.rw-ah-blocked span{font-size:10px;color:#9b8080}

.rw-ah-mine-toolbar{border:1px solid var(--ah-line);border-top:0;background:rgba(0,0,0,.1)}
.rw-ah-mine-content{min-height:490px;padding:12px;border:1px solid var(--ah-line);border-top:0;border-radius:0 0 14px 14px;background:rgba(0,0,0,.08)}
.rw-ah-mine-stack{display:flex;flex-direction:column;gap:10px}
.rw-ah-wallet{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px;border:1px solid rgba(215,170,74,.22);border-radius:8px;background:rgba(215,170,74,.05)}
.rw-ah-wallet>div{display:flex;flex-direction:column;gap:2px}
.rw-ah-wallet span{font-size:10px;color:#8a94a1}
.rw-ah-wallet strong{font-size:17px;color:#e3be65}
.rw-ah-mine-section{border:1px solid var(--ah-line);border-radius:8px;overflow:hidden;background:rgba(255,255,255,.012)}
.rw-ah-mine-section-head{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid var(--ah-line);background:rgba(255,255,255,.018)}
.rw-ah-mine-section-head h4{margin:0;font-size:12px}
.rw-ah-mine-section-head span{font-size:10px;color:#7d8794}
.rw-ah-transaction-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.045)}
.rw-ah-transaction-row:last-child{border-bottom:0}
.rw-ah-transaction-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.rw-ah-transaction-copy strong{font-size:11px}
.rw-ah-transaction-copy span{font-size:10px;color:#7f8995}
.rw-ah-transaction-actions{display:flex;gap:5px;flex-shrink:0}
.rw-ah-muted-line{padding:9px;color:#707b89;font-size:10px}

.rw-market-notice{padding:8px 9px;border-radius:7px;background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.17);font-size:10px;line-height:1.5;color:#9fb7d3}
.rw-market-notice.warning{background:rgba(245,158,11,.06);border-color:rgba(245,158,11,.2);color:#cbb17b}

@media (max-width:1050px){
  .rw-ah-browser{grid-template-columns:150px minmax(320px,1fr) 280px}
  .rw-ah-sell-layout{grid-template-columns:280px minmax(0,1fr)}
}
@media (max-width:850px){
  .rw-ah-head{flex-direction:column}
  .rw-ah-account-strip{justify-content:flex-start}
  .rw-ah-browser{grid-template-columns:130px minmax(300px,1fr)}
  .rw-ah-inspector{grid-column:1/-1;border-top:1px solid var(--ah-line);min-height:260px}
  .rw-ah-results{border-right:0}
}
@media (max-width:650px){
  .rw-ah-tabs{overflow:auto}
  .rw-ah-region-note{display:none}
  .rw-ah-toolbar{align-items:stretch;flex-wrap:wrap}
  .rw-ah-search{flex-basis:100%}
  .rw-ah-result-count{display:none}
  .rw-ah-browser{display:flex;flex-direction:column}
  .rw-ah-categories{display:flex;gap:4px;overflow:auto;border-right:0;border-bottom:1px solid var(--ah-line)}
  .rw-ah-side-title,.rw-ah-side-rule,.rw-ah-side-help{display:none}
  .rw-ah-category{flex:0 0 auto;width:auto;padding:7px 9px}
  .rw-ah-category small{display:none}
  .rw-ah-table-head,.rw-ah-result-row{grid-template-columns:minmax(150px,1fr) 48px 42px 76px}
  .rw-ah-table-head span:nth-child(3),.rw-ah-result-quality{display:none}
  .rw-ah-sell-layout{display:flex;flex-direction:column}
  .rw-ah-inventory-pane{border-right:0;border-bottom:1px solid var(--ah-line);max-height:280px}
  .rw-ah-sell-form{grid-template-columns:1fr}
  .rw-ah-sell-total,.rw-ah-sell-form>.rw-button{grid-column:1}
  .rw-ah-transaction-row{align-items:flex-start;flex-direction:column}
}
`;
