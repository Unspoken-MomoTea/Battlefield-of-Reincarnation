export const MARKET_CSS = `
.rw-market-tab{position:relative}
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
.rw-ah-table-head,.rw-ah-result-row{display:grid;grid-template-columns:minmax(160px,1fr) 52px 42px 46px minmax(90px,110px);align-items:center}
.rw-ah-table-head{height:34px;padding:0 10px;border-bottom:1px solid var(--ah-line);background:rgba(255,255,255,.02);color:#737e8c;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
.rw-ah-table-head span:nth-child(n+2){text-align:right}
.rw-ah-list{min-height:0;max-height:590px;overflow:auto}
.rw-ah-result-row{width:100%;min-height:58px;padding:5px 10px;border:0;border-bottom:1px solid rgba(255,255,255,.045);background:transparent;color:#d8dde5;font:inherit;cursor:pointer;text-align:left}
.rw-ah-result-row:hover{background:rgba(255,255,255,.035)}
.rw-ah-result-row.is-selected{background:linear-gradient(90deg,rgba(210,164,72,.13),rgba(210,164,72,.035));box-shadow:inset 2px 0 #d2a448}
.rw-ah-result-item{display:flex;align-items:center;min-width:0}
.rw-ah-result-item-copy,.rw-ah-inventory-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.rw-ah-result-item-copy strong,.rw-ah-inventory-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.rw-ah-result-item-copy small,.rw-ah-inventory-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#798492}
.rw-ah-quality-name[data-quality="F"],.rw-ah-quality-name[data-quality="NONE"]{color:#cbd5e1}
.rw-ah-quality-name[data-quality="E"]{color:#f8fafc}
.rw-ah-quality-name[data-quality="D"]{color:#4ade80}
.rw-ah-quality-name[data-quality="C"]{color:#60a5fa}
.rw-ah-quality-name[data-quality="B"]{color:#c084fc}
.rw-ah-quality-name[data-quality="A"]{color:#fb923c}
.rw-ah-quality-name[data-quality="S"]{color:#facc15}
.rw-ah-quality-name[data-quality="SS"]{color:#f87171}
.rw-ah-quality-name[data-quality="SSS"]{color:#f472b6}
.rw-ah-result-kind,.rw-ah-result-quality,.rw-ah-result-stock,.rw-ah-result-price{text-align:right;font-size:11px;color:#aeb7c3}
.rw-ah-type-tag{display:inline-flex;justify-content:center;min-width:34px;padding:2px 5px;border:1px solid rgba(96,165,250,.18);border-radius:999px;background:rgba(96,165,250,.07);color:#9fbce4;font-size:9px;font-weight:800}
.rw-ah-result-quality{color:#a99be2}
.rw-ah-result-price{display:flex;align-items:center;justify-content:flex-end;min-width:0}
.rw-ah-result-price strong{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-variant-numeric:tabular-nums;color:#e5c36e}
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

.rw-ah-teammate-detail{display:flex;flex-direction:column;gap:9px}
.rw-ah-teammate-card{overflow:hidden;border:1px solid var(--ah-line);border-radius:8px;background:rgba(255,255,255,.018)}
.rw-ah-teammate-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.055);background:rgba(255,255,255,.018)}
.rw-ah-teammate-card-head>strong,.rw-ah-teammate-card-title{font-size:11px;font-weight:800;color:#d7dde5}
.rw-ah-teammate-card-title{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.055);background:rgba(255,255,255,.018)}
.rw-ah-teammate-active-form{max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;color:#c7a75e}
.rw-ah-teammate-overview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:rgba(255,255,255,.045)}
.rw-ah-teammate-overview-cell{display:flex;flex-direction:column;gap:2px;padding:8px 10px;background:#0e1013}
.rw-ah-teammate-overview-cell span{font-size:9px;color:#778391}
.rw-ah-teammate-overview-cell strong{font-size:12px;color:#dbe1e8}
.rw-ah-teammate-meta-row,.rw-ah-teammate-build-row,.rw-ah-teammate-profile-row{display:grid;grid-template-columns:56px minmax(0,1fr);gap:8px;align-items:start;padding:8px 10px;border-top:1px solid rgba(255,255,255,.04)}
.rw-ah-teammate-overview+.rw-ah-teammate-meta-row{border-top:0}
.rw-ah-teammate-meta-label{padding-top:2px;font-size:9px;font-weight:700;color:#75808e}
.rw-ah-teammate-chips{display:flex;flex-wrap:wrap;gap:5px;min-width:0}
.rw-ah-teammate-chip{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:3px 6px;border:1px solid rgba(255,255,255,.08);border-radius:5px;background:rgba(255,255,255,.025)}
.rw-ah-teammate-chip strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#cbd2db}
.rw-ah-teammate-chip small{font-size:9px;color:#9d90d0}
.rw-ah-teammate-chip em{font-style:normal;font-size:9px;color:#8b95a2}
.rw-ah-teammate-chip.has-raw{flex-wrap:wrap;align-items:flex-start}
.rw-ah-teammate-raw{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;min-width:0}
.rw-ah-teammate-chip>.rw-ah-teammate-raw{flex-basis:100%;padding-top:3px;border-top:1px solid rgba(255,255,255,.055)}
.rw-ah-teammate-raw-item{display:inline-flex;align-items:baseline;gap:2px;max-width:100%;font-size:9px;color:#8290a1;word-break:break-word}
.rw-ah-teammate-raw-item strong{font-size:9px;font-weight:800;color:#cbd5e1}
.rw-ah-teammate-build-list,.rw-ah-teammate-profile{display:flex;flex-direction:column}
.rw-ah-teammate-build-row:first-child,.rw-ah-teammate-profile-row:first-child{border-top:0}
.rw-ah-teammate-profile-row p{margin:0;font-size:10px;line-height:1.55;color:#bcc5cf;white-space:pre-wrap;word-break:break-word}
.rw-ah-teammate-relation-card{border-color:rgba(215,170,74,.2);background:rgba(215,170,74,.025)}
.rw-ah-teammate-relation{display:flex;flex-direction:column}
.rw-ah-teammate-relation-row{display:grid;grid-template-columns:56px minmax(0,1fr);gap:8px;padding:8px 10px;border-top:1px solid rgba(255,255,255,.04)}
.rw-ah-teammate-relation-row:first-child{border-top:0}
.rw-ah-teammate-relation-row span{font-size:9px;color:#8c8068}
.rw-ah-teammate-relation-row strong{font-size:10px;line-height:1.55;color:#ddc58f;word-break:break-word}
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
.rw-ah-inventory-group{border-bottom:1px solid var(--ah-line)}
.rw-ah-inventory-group-head{display:flex;align-items:center;gap:8px;padding:11px 12px;cursor:pointer;font-size:12px;font-weight:800;color:#c7cedb;background:rgba(255,255,255,.035);list-style:none;user-select:none}
.rw-ah-inventory-group-head::-webkit-details-marker{display:none}
.rw-ah-inventory-group-head::before{content:'▸';font-size:12px;color:#cba457;transition:transform .15s}
.rw-ah-inventory-group[open]>.rw-ah-inventory-group-head::before{transform:rotate(90deg)}
.rw-ah-inventory-group-head small{margin-left:auto;color:#8792a2;font-weight:600}
.rw-ah-inventory-group-head:hover{background:rgba(215,170,74,.09)}
.rw-ah-inventory-group-content{padding-left:6px}
.rw-ah-listing-slots{align-self:flex-start;padding:5px 9px;border:1px solid rgba(215,170,74,.3);border-radius:6px;color:#ddc184;background:rgba(215,170,74,.07);font-size:11px;font-weight:800}
.rw-ah-listing-slots.is-full{color:#f6a6a6;border-color:rgba(239,68,68,.35);background:rgba(239,68,68,.08)}
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
.rw-ah-listing-fee{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 9px;border:1px solid var(--ah-line);border-radius:7px;background:rgba(0,0,0,.12)}
.rw-ah-listing-fee span{font-size:10px;color:#8c96a3}
.rw-ah-listing-fee strong{font-size:12px;color:#e6c26d}
.rw-ah-sell-total{grid-column:1/-1;padding-top:7px;border-top:1px solid var(--ah-line);font-size:12px;color:#d7b460}
.rw-ah-sell-form>.rw-button{grid-column:1/-1}
.rw-ah-buyback-box{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px;border:1px solid rgba(96,165,250,.2);border-radius:8px;background:rgba(96,165,250,.045)}
.rw-ah-buyback-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}
.rw-ah-buyback-copy>span{font-size:10px;color:#8e99a7}
.rw-ah-buyback-copy>strong{font-size:15px;color:#a9c8f5}
.rw-ah-buyback-copy>small{font-size:10px;line-height:1.5;color:#778391}
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
.rw-market-notice[hidden],.rw-market-notice:empty{display:none!important}
.rw-market-notice.warning{background:rgba(245,158,11,.06);border-color:rgba(245,158,11,.2);color:#cbb17b}


.rw-ah-toolbar--browse{flex-wrap:wrap}
.rw-ah-toolbar--browse .rw-ah-search{min-width:260px;flex:1 1 320px}
.rw-ah-toolbar--browse>.rw-select{min-width:120px}
.rw-ah-price-filter{width:94px;flex:0 0 94px}
.rw-ah-load-more{display:flex;justify-content:center;padding:10px;border-top:1px solid var(--ah-line)}
.rw-ah-price-history{padding:8px;border:1px solid var(--ah-line);border-radius:7px;background:rgba(0,0,0,.1)}
.rw-ah-price-history-table{display:flex;flex-direction:column}
.rw-ah-price-history-row{display:grid;grid-template-columns:42px 1fr 1.25fr 54px;gap:7px;padding:4px 2px;border-bottom:1px solid rgba(255,255,255,.04);font-size:10px}
.rw-ah-price-history-row:last-child{border-bottom:0}
.rw-ah-price-history-row span:first-child{color:#7e8997}
.rw-ah-price-history-row span:nth-child(2){color:#dec071}
.rw-ah-price-history-row span:nth-child(n+3){text-align:right;color:#929dab}
.rw-ah-sell-market{overflow:hidden;border:1px solid var(--ah-line);border-radius:8px;background:rgba(0,0,0,.1)}
.rw-ah-sell-market-head{display:flex;justify-content:space-between;gap:10px;padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.05)}
.rw-ah-sell-market-head span{font-size:10px;color:#7f8996}
.rw-ah-sell-market-head strong{font-size:13px;color:#e4bf66}
.rw-ah-sell-market-ladder{display:flex;flex-direction:column;padding:4px 10px}
.rw-ah-sell-market-row{display:grid;grid-template-columns:1fr 70px 80px;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:10px}
.rw-ah-sell-market-row:last-child{border-bottom:0}
.rw-ah-sell-market-row span:first-child{color:#dfbd66}
.rw-ah-sell-market-row span:nth-child(n+2){text-align:right;color:#8d97a4}
.rw-ah-sell-market-history{display:block;padding:7px 10px;border-top:1px solid rgba(255,255,255,.05);color:#7f8996;font-size:9px;line-height:1.45}
.rw-ah-subtab{border:1px solid transparent;border-radius:6px;background:transparent;padding:6px 9px;color:#8e98a5;font:inherit;font-size:10px;font-weight:700;cursor:pointer}
.rw-ah-subtab:hover{color:#dce2ea;background:rgba(255,255,255,.035)}
.rw-ah-subtab.is-active{border-color:rgba(215,170,74,.25);background:rgba(215,170,74,.09);color:#e4c477}
.rw-ah-mine-tabs,.rw-ah-orders-tabs,.rw-ah-orders-actions{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.rw-ah-orders-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border:1px solid var(--ah-line);border-top:0;background:rgba(0,0,0,.1)}
.rw-ah-orders-layout{display:grid;grid-template-columns:minmax(280px,38%) minmax(0,1fr);min-height:500px;border:1px solid var(--ah-line);border-top:0;border-radius:0 0 14px 14px;overflow:hidden}
.rw-ah-orders-list{overflow:auto;border-right:1px solid var(--ah-line);background:rgba(0,0,0,.11)}
.rw-ah-orders-editor{overflow:auto;padding:14px;background:rgba(0,0,0,.055)}
.rw-ah-order-row{display:flex;flex-direction:column;gap:3px;width:100%;padding:9px 11px;border:0;border-bottom:1px solid rgba(255,255,255,.045);background:transparent;color:#cbd2db;font:inherit;text-align:left;cursor:pointer}
.rw-ah-order-row:hover{background:rgba(255,255,255,.035)}
.rw-ah-order-row.is-selected{background:rgba(215,170,74,.08);box-shadow:inset 2px 0 #d2a448}
.rw-ah-order-row strong{font-size:11px}
.rw-ah-order-row span{font-size:10px;color:#c6aa64}
.rw-ah-order-row small{font-size:9px;color:#747f8d}
.rw-ah-order-form,.rw-ah-order-detail{display:flex;flex-direction:column;gap:10px;max-width:720px}
.rw-ah-order-form h3,.rw-ah-order-detail h3{margin:0;font-size:17px}
.rw-ah-order-help{margin:0;font-size:10px;line-height:1.55;color:#84909e}
.rw-ah-order-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px;border:1px solid var(--ah-line);border-radius:8px;background:rgba(0,0,0,.1)}
.rw-ah-order-field{display:flex;flex-direction:column;gap:5px}
.rw-ah-order-field>span{font-size:9px;color:#7c8795}
.rw-ah-order-estimate{font-size:11px;color:#c8b283}
.rw-ah-order-estimate[hidden]{display:none!important}
.rw-ah-order-row.is-demo{border-left:2px solid rgba(215,170,74,.18)}
.rw-ah-example-marker{color:#c9a667!important;font-size:9px}
.rw-ah-example-detail{max-width:700px}
.rw-ah-example-disclaimer{padding:7px 0;border-top:1px solid var(--ah-line);color:#74808e;font-size:10px;line-height:1.6}
.rw-ah-order-facts{display:flex;flex-wrap:wrap;gap:5px}
.rw-ah-order-facts span{padding:3px 6px;border:1px solid rgba(255,255,255,.07);border-radius:5px;background:rgba(255,255,255,.02);font-size:9px;color:#aeb7c2}
.rw-ah-order-match-list{display:flex;flex-direction:column;border:1px solid var(--ah-line);border-radius:8px;overflow:hidden}
.rw-ah-order-match{display:grid;grid-template-columns:minmax(0,1fr) 78px auto;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.045)}
.rw-ah-order-match:last-child{border-bottom:0}
.rw-ah-order-match-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.rw-ah-order-match-copy strong{font-size:11px}
.rw-ah-order-match-copy span{font-size:9px;color:#788390}
.rw-ah-swap-exchange{display:grid;grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr);gap:8px;align-items:stretch}
.rw-ah-swap-side{display:flex;flex-direction:column;gap:4px;padding:10px;border:1px solid var(--ah-line);border-radius:8px;background:rgba(255,255,255,.018)}
.rw-ah-swap-side>span{font-size:9px;color:#778391}
.rw-ah-swap-side>strong{font-size:12px;color:#d4dbe4}
.rw-ah-swap-side>small{font-size:9px;color:#968bc3}
.rw-ah-swap-arrow{display:grid;place-items:center;color:#caa955;font-size:16px}

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
  .rw-ah-table-head,.rw-ah-result-row{grid-template-columns:minmax(145px,1fr) 44px 40px 84px}
  .rw-ah-table-head span:nth-child(3),.rw-ah-result-quality{display:none}
  .rw-ah-sell-layout{display:flex;flex-direction:column}
  .rw-ah-inventory-pane{border-right:0;border-bottom:1px solid var(--ah-line);max-height:280px}
  .rw-ah-sell-form{grid-template-columns:1fr}
  .rw-ah-listing-fee,.rw-ah-sell-total,.rw-ah-sell-form>.rw-button{grid-column:1}
  .rw-ah-buyback-box{align-items:stretch;flex-direction:column}
  .rw-ah-teammate-meta-row,.rw-ah-teammate-build-row,.rw-ah-teammate-profile-row,.rw-ah-teammate-relation-row{grid-template-columns:50px minmax(0,1fr)}
  .rw-ah-order-form-grid{grid-template-columns:1fr}
  .rw-ah-orders-head{align-items:stretch;flex-direction:column}
  .rw-ah-orders-layout{display:flex;flex-direction:column}
  .rw-ah-orders-list{max-height:300px;border-right:0;border-bottom:1px solid var(--ah-line)}
  .rw-ah-order-match{grid-template-columns:minmax(0,1fr) 72px}
  .rw-ah-order-match>.rw-button{grid-column:1/-1}
  .rw-ah-swap-exchange{grid-template-columns:1fr}
  .rw-ah-swap-arrow{transform:rotate(90deg)}
  .rw-ah-transaction-row{align-items:flex-start;flex-direction:column}
}
.rw-ah-deal-asset-picks,.rw-ah-deal-asset-rows{display:flex;flex-direction:column;gap:7px}
.rw-ah-deal-asset-row{display:grid;grid-template-columns:minmax(0,1fr) 75px auto;gap:6px}
.rw-ah-deal-offer,.rw-ah-deal-bid,.rw-ah-deal-claim{padding:9px;border:1px solid var(--ah-line);border-radius:8px;background:rgba(255,255,255,.018);display:flex;flex-direction:column;gap:6px}
.rw-ah-deal-bid{margin:8px 0}
.rw-ah-deal-asset-detail{border:1px solid var(--ah-line);padding:5px 8px;border-radius:5px}
.rw-ah-deal-asset-detail summary{cursor:pointer;color:#cbd5e1;font-size:11px}
.rw-ah-deal-asset-detail pre{font-size:10px;white-space:pre-wrap;overflow-wrap:anywhere;color:#9ba7b7}
.rw-ah-deal-claim{flex-direction:row;align-items:center;justify-content:space-between;flex-wrap:wrap}
.rw-ah-order-detail-section{padding:8px 0;font-size:11px;color:#d4b96e;font-weight:700}
@media(max-width:650px){.rw-ah-deal-asset-row{grid-template-columns:minmax(0,1fr) 65px auto}}

/* Unified negotiated-order UI: readable controls, cards, and responsive text. */
.rw-ah-orders-layout{grid-template-columns:minmax(0,34%) minmax(0,1fr);min-width:0}
.rw-ah-orders-list,.rw-ah-orders-editor{min-width:0;max-width:100%;overflow-x:hidden}
.rw-ah-orders-editor{padding:18px clamp(12px,2.3vw,26px)}
.rw-ah-order-form,.rw-ah-order-detail{box-sizing:border-box;width:100%;max-width:920px;min-width:0;gap:16px}
.rw-ah-order-form h3,.rw-ah-order-detail h3{font-size:19px;line-height:1.35;overflow-wrap:anywhere;color:#f1f3f6}
.rw-ah-order-help{font-size:12px;line-height:1.7;color:#a9b5c5;overflow-wrap:anywhere}
.rw-ah-order-field{min-width:0;gap:7px}
.rw-ah-order-field>span{font-size:12px;font-weight:700;color:#c4d0e0}
.rw-ah-order-form .rw-ah-deal-control,
.rw-ah-orders-editor .rw-ah-deal-control{
 box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:44px;
 padding:9px 11px;border:1px solid rgba(170,187,207,.30);border-radius:8px;
 background:#1b2028;color:#f4f6fa;font-size:13px;font-weight:600;
 -webkit-text-fill-color:currentColor;opacity:1;
}
.rw-ah-orders-editor .rw-ah-deal-control option{background:#1b2028;color:#f4f6fa}
.rw-ah-orders-editor .rw-ah-deal-control::placeholder{color:#9ba7b6;-webkit-text-fill-color:#9ba7b6}
.rw-ah-orders-editor .rw-ah-deal-control:focus{border-color:#dfb66a;outline:2px solid rgba(223,182,106,.18);background:#242b34}
.rw-ah-orders-editor .rw-ah-deal-control:disabled{opacity:.62;color:#c6ccd4}
.rw-ah-order-detail-section{font-size:12px;padding:5px 0;font-weight:800}
.rw-ah-orders-cards{min-width:0}
.rw-ah-order-row{box-sizing:border-box;min-width:0;max-width:100%;padding:13px;gap:7px;overflow-wrap:anywhere}
.rw-ah-order-row strong{font-size:13px;line-height:1.45}
.rw-ah-order-row small{font-size:11px;line-height:1.55;color:#a5b0bf;overflow-wrap:anywhere}
.rw-ah-order-row span{font-size:11px;line-height:1.5;overflow-wrap:anywhere}
.rw-ah-deal-asset-picks{box-sizing:border-box;min-width:0;max-width:100%;padding:12px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:rgba(255,255,255,.018)}
.rw-ah-deal-field-heading{font-size:13px;color:#e2e7ee}
.rw-ah-deal-asset-rows{gap:9px}
.rw-ah-deal-asset-row{min-width:0;grid-template-columns:minmax(0,1fr) minmax(70px,96px) auto;align-items:end;gap:8px;
 padding:10px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.10);border-radius:8px}
.rw-ah-deal-remove,.rw-ah-deal-add{min-height:42px;border:1px solid rgba(255,255,255,.17);border-radius:8px;
 background:#23252a;color:#e0e4eb;font-size:12px;font-weight:700;cursor:pointer;padding:8px 12px}
.rw-ah-deal-remove:hover,.rw-ah-deal-add:hover{background:#30343b;color:#fff}
.rw-ah-deal-add{width:100%;margin-top:3px;background:#161a20;border-style:dashed}
.rw-ah-deal-picker-preview{grid-column:1/-1;min-width:0}
.rw-ah-deal-picker-preview:empty{display:none}
.rw-ah-deal-offer,.rw-ah-deal-bid,.rw-ah-deal-claim{box-sizing:border-box;min-width:0;max-width:100%;padding:13px;gap:10px;
 border:1px solid rgba(255,255,255,.11);border-radius:10px;background:#12161b;overflow-wrap:anywhere}
.rw-ah-deal-offer-title{font-size:13px;color:#e0e6ed}
.rw-ah-deal-coin-line{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;
 padding:8px 10px;border:1px solid rgba(218,177,92,.2);border-radius:7px;background:rgba(218,177,92,.045)}
.rw-ah-deal-coin-line span{font-size:12px;color:#b9a473}
.rw-ah-deal-coin-line strong{font-size:14px;color:#f3d38b}
.rw-ah-deal-asset-detail{min-width:0;max-width:100%;padding:0;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.018)}
.rw-ah-deal-asset-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;
 box-sizing:border-box;min-width:0;padding:10px 12px;cursor:pointer;list-style:inside;
 color:#e1e7ef;font-size:12px;line-height:1.5}
.rw-ah-deal-asset-summary::marker{color:#c9a255}
.rw-ah-deal-asset-summary::-webkit-details-marker{color:#c9a255}
.rw-ah-deal-asset-name{font-size:12px;color:#e3ebf5;overflow-wrap:anywhere;min-width:0}
.rw-ah-deal-asset-meta{display:flex;flex:0 0 auto;gap:8px;font-size:12px;color:#d9bf81}
.rw-ah-deal-kind{display:inline-flex;align-items:center;justify-content:center;padding:2px 7px;
 border:1px solid rgba(103,166,236,.32);border-radius:5px;background:rgba(103,166,236,.09);
 color:#a9d5ff;font-size:11px;font-weight:800;white-space:nowrap}
.rw-ah-deal-asset-body{display:flex;flex-direction:column;gap:0;min-width:0;padding:4px 10px 10px;border-top:1px solid rgba(255,255,255,.07)}
.rw-ah-deal-attr-row{display:grid;grid-template-columns:minmax(70px,28%) minmax(0,1fr);gap:12px;min-width:0;
 padding:9px 5px;border-bottom:1px solid rgba(255,255,255,.055);align-items:start}
.rw-ah-deal-attr-row:last-child{border-bottom:0}
.rw-ah-deal-attr-key{font-size:11px;color:#a0b0c2;font-weight:650;overflow-wrap:anywhere;line-height:1.6}
.rw-ah-deal-value{min-width:0;font-size:12px;color:#e0e6ee;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65}
.rw-ah-deal-value.muted{color:#8995a5}
.rw-ah-deal-attrs{box-sizing:border-box;min-width:0;width:100%;border:1px solid rgba(255,255,255,.06);
 border-radius:7px;padding:2px 7px;background:rgba(255,255,255,.012)}
.rw-ah-deal-attrs.is-nested{border-color:rgba(255,255,255,.045)}
.rw-ah-deal-chips{display:flex;flex-wrap:wrap;gap:5px;min-width:0}
.rw-ah-deal-chip{min-width:0;max-width:100%;padding:3px 8px;border:1px solid rgba(255,255,255,.12);
 border-radius:6px;background:rgba(255,255,255,.025)}
.rw-ah-deal-claim{flex-direction:row;align-items:center;flex-wrap:wrap;justify-content:space-between}
@media(max-width:900px){
 .rw-ah-orders-layout{display:flex;flex-direction:column}
 .rw-ah-orders-list{max-height:260px;border-right:0;border-bottom:1px solid var(--ah-line)}
 .rw-ah-orders-editor{padding:14px}
}
@media(max-width:520px){
 .rw-ah-deal-asset-row{grid-template-columns:minmax(0,1fr) minmax(68px,88px);gap:8px}
 .rw-ah-deal-asset-row>.rw-ah-order-field:first-child{grid-column:1/-1}
 .rw-ah-deal-remove{grid-column:2}
 .rw-ah-deal-asset-summary{align-items:flex-start;flex-wrap:wrap}
 .rw-ah-deal-attr-row{grid-template-columns:minmax(68px,31%) minmax(0,1fr);gap:7px}
 .rw-ah-orders-editor{padding:10px}
}

.rw-ah-deal-description{height:auto!important;min-height:90px!important;resize:vertical;white-space:pre-wrap}
.rw-ah-deal-detail-head,.rw-ah-deal-bid-head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;flex-wrap:wrap}
.rw-ah-deal-detail-head h3{min-width:0;flex:1 1 180px;overflow-wrap:anywhere}
.rw-ah-deal-status{display:inline-flex;align-items:center;border:1px solid rgba(222,178,91,.30);
 border-radius:999px;padding:4px 9px;color:#f0cc80;font-size:11px;white-space:nowrap}
.rw-ah-deal-wanted{padding:12px 14px;border-left:3px solid rgba(226,177,83,.55);
 border-radius:8px;background:rgba(226,177,83,.045);min-width:0}
.rw-ah-deal-wanted .rw-ah-order-detail-section{padding-top:0}
.rw-ah-deal-wanted .rw-ah-order-help{color:#d1dae6;font-size:13px}
.rw-ah-deal-count{color:#acb7c4;font-size:11px}
.rw-ah-deal-bid-head strong{font-size:13px;overflow-wrap:anywhere}
.rw-ah-deal-row-title,.rw-ah-deal-row-wanted,.rw-ah-deal-row-terms{min-width:0;max-width:100%;overflow-wrap:anywhere}
.rw-ah-deal-row-wanted{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rw-ah-deal-row-terms{color:#d4b777!important}
.rw-ah-deal-pager{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;padding:12px 8px;border-top:1px solid var(--rw-line)}
.rw-ah-deal-page{font-size:12px;color:var(--rw-muted,#a9b0bb)}
.rw-ah-page-text{color:#b7c2cf;font-size:12px;min-width:90px;text-align:center}
`;
