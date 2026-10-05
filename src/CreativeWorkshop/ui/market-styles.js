export const MARKET_CSS = `
.rw-market-tab{position:relative}
.rw-market-test-badge{margin-left:6px;padding:1px 5px;border-radius:999px;font-size:9px;font-weight:800;letter-spacing:.08em;color:#ffd98a;background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.38)}
.rw-market-page{display:flex;flex-direction:column;gap:14px}
.rw-market-hero{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:18px;border:1px solid rgba(245,158,11,.2);border-radius:16px;background:linear-gradient(135deg,rgba(245,158,11,.09),rgba(255,255,255,.02))}
.rw-market-hero-copy small{color:#f6c96f;font-size:10px;font-weight:800;letter-spacing:.14em}
.rw-market-hero-copy h2{margin:4px 0 6px;font-size:22px}
.rw-market-hero-copy p{margin:0;color:var(--rw-muted,#9aa3b2);max-width:760px;line-height:1.55}
.rw-market-hero-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.rw-market-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
.rw-market-stat{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.025)}
.rw-market-stat span{font-size:10px;color:var(--rw-muted,#9aa3b2)}
.rw-market-stat strong{font-size:13px}
.rw-market-toolbar{display:flex;gap:8px;flex-wrap:wrap}
.rw-market-toolbar .rw-input{flex:1;min-width:180px}
.rw-market-toolbar .rw-select{min-width:120px}
.rw-market-note{padding:10px 12px;border-radius:10px;border:1px solid rgba(245,158,11,.24);background:rgba(245,158,11,.07);font-size:11px;line-height:1.55;color:#d9c18f}
.rw-market-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.rw-market-card{display:flex;flex-direction:column;gap:9px;min-height:205px;padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015));transition:transform .16s,border-color .16s,background .16s}
.rw-market-card:hover{transform:translateY(-2px);border-color:rgba(245,158,11,.28);background:linear-gradient(180deg,rgba(245,158,11,.055),rgba(255,255,255,.02))}
.rw-market-card h3{margin:0;font-size:15px}
.rw-market-card-head,.rw-market-card-foot{display:flex;align-items:center;justify-content:space-between;gap:8px}
.rw-market-badges{display:flex;gap:6px;flex-wrap:wrap}
.rw-market-kind,.rw-market-quality{padding:2px 7px;border-radius:999px;font-size:9px;font-weight:800}
.rw-market-kind{background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.28);color:#9fc9ff}
.rw-market-quality{background:rgba(168,85,247,.12);border:1px solid rgba(168,85,247,.28);color:#cbb1ff}
.rw-market-qty,.rw-market-card-meta{font-size:10px;color:var(--rw-muted,#9aa3b2)}
.rw-market-card-copy{margin:0;color:#c0c7d2;font-size:11px;line-height:1.5;min-height:34px}
.rw-market-card-foot{margin-top:auto;padding-top:7px;border-top:1px solid rgba(255,255,255,.06)}
.rw-market-price strong{font-size:17px;color:#f3c969}
.rw-market-price span{font-size:10px;color:var(--rw-muted,#9aa3b2)}
.rw-market-detail{display:grid;gap:6px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}
.rw-market-detail-row{display:flex;justify-content:space-between;gap:20px;padding:3px 0;font-size:11px}
.rw-market-detail-row span{color:var(--rw-muted,#9aa3b2)}
.rw-market-json{margin-top:4px;font-size:10px;color:var(--rw-muted,#9aa3b2)}
.rw-market-json summary{cursor:pointer;color:#c6a85d}
.rw-market-json pre{max-height:240px;overflow:auto;padding:10px;border-radius:8px;background:rgba(0,0,0,.24);white-space:pre-wrap;word-break:break-word;color:#d5d8df}
.rw-market-total{margin:10px 0;font-size:16px;font-weight:800;color:#f3c969}
.rw-market-notice{padding:9px 10px;border-radius:9px;background:rgba(96,165,250,.07);border:1px solid rgba(96,165,250,.18);font-size:10px;line-height:1.5;color:#afc8e9}
.rw-market-notice.warning{background:rgba(245,158,11,.07);border-color:rgba(245,158,11,.22);color:#dac18d}
.rw-market-sell-preview{margin:10px 0}
.rw-market-wallet{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border:1px solid rgba(245,158,11,.22);border-radius:12px;background:rgba(245,158,11,.065)}
.rw-market-wallet>div{display:flex;flex-direction:column;gap:4px}
.rw-market-wallet span{font-size:10px;color:var(--rw-muted,#9aa3b2)}
.rw-market-wallet strong{font-size:20px;color:#f3c969}
.rw-market-mine-section{margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}
.rw-market-mine-section h3{margin:0 0 8px;font-size:13px}
.rw-market-tx-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 4px;border-bottom:1px solid rgba(255,255,255,.055)}
.rw-market-tx-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
.rw-market-tx-copy strong{font-size:11px}
.rw-market-tx-copy span{font-size:10px;color:var(--rw-muted,#9aa3b2)}
.rw-market-tx-actions{display:flex;gap:6px;flex-shrink:0}
@media (max-width:760px){
  .rw-market-hero{flex-direction:column}
  .rw-market-hero-actions{width:100%;justify-content:flex-start}
  .rw-market-grid{grid-template-columns:1fr}
  .rw-market-wallet,.rw-market-tx-row{align-items:flex-start;flex-direction:column}
}
`;
