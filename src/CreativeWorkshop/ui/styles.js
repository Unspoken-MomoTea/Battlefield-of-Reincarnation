export const WORKSHOP_CSS = `
  :root{
    --rw-bg:#0f1012;
    --rw-surface:#18191c;
    --rw-surface-2:#1f2024;
    --rw-surface-3:#27282d;
    --rw-line:rgba(255,255,255,.075);
    --rw-line-strong:rgba(255,255,255,.12);
    --rw-text:#ececea;
    --rw-muted:#8f8d87;
    --rw-faint:#66645f;
    --rw-accent:#a28b6b;
    --rw-accent-soft:rgba(162,139,107,.10);
    --rw-accent-text:#d5c2a5;
    --rw-good:#6fa884;
    --rw-bad:#d87b78;
    --rw-warn:#d6ad68;
    --rw-radius:12px;
  }
  .rw-launcher{
    position:fixed;right:22px;bottom:88px;z-index:2147483400;
    width:50px;height:50px;border:1px solid rgba(162,139,107,.28);border-radius:14px;
    background:rgba(24,25,28,.94);color:var(--rw-accent-text);cursor:grab;
    box-shadow:0 12px 34px rgba(0,0,0,.30);backdrop-filter:blur(16px);
    touch-action:none;user-select:none;-webkit-user-select:none;
    font:800 18px/1 "LXGW WenKai Lite","Microsoft YaHei",sans-serif;
    transition:transform .15s ease,background .15s ease,border-color .15s ease;
  }
  .rw-launcher:hover{transform:translateY(-2px);background:#202126;border-color:rgba(162,139,107,.45)}
  .rw-launcher.is-dragging,.rw-launcher.is-dragging:hover{cursor:grabbing;transform:none;transition:none}
  .rw-overlay{
    --rw-layer-create:120;
    --rw-layer-modal:220;
    --rw-layer-confirm:320;
    position:fixed;inset:0;z-index:2147483390;display:none;align-items:center;justify-content:center;
    padding:16px;background:rgba(5,6,8,.74);backdrop-filter:blur(8px);
    font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;color:var(--rw-text);
    box-sizing:border-box;
  }
  .rw-overlay.is-open{display:flex}
  #toast-container{z-index:2147483647!important}
  .rw-panel{
    width:min(1540px,98vw);height:min(940px,96vh);overflow:hidden;
    display:grid;grid-template-columns:190px minmax(0,1fr);grid-template-rows:58px minmax(0,1fr);
    border:1px solid var(--rw-line);border-radius:18px;background:var(--rw-bg);
    box-shadow:0 28px 90px rgba(0,0,0,.55);
  }

  .rw-head{
    grid-column:2;grid-row:1;display:flex;align-items:center;gap:8px;min-width:0;
    padding:8px 14px;border-bottom:1px solid var(--rw-line);background:rgba(18,19,22,.96);
  }
  .rw-title{
    min-width:76px;flex:none;font-family:"LXGW WenKai Lite","Microsoft YaHei",sans-serif;
    font-size:14px;font-weight:800;white-space:nowrap;color:var(--rw-text)
  }
  .rw-head-discover-tools{min-width:260px;flex:1;display:flex;align-items:center;gap:7px}
  .rw-head-discover-tools[hidden]{display:none!important}
  .rw-discover-home{display:flex;flex-direction:column;gap:38px;padding:10px 0 34px}
  .rw-discover-home[hidden],.rw-catalog[hidden]{display:none!important}
  .rw-showcase{min-width:0}
  .rw-showcase-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:0 0 12px}
  .rw-showcase-head small{display:block;margin-bottom:4px;color:var(--rw-faint);font-size:9px;font-weight:800;letter-spacing:.16em}
  .rw-showcase-head h2{margin:0;font-size:17px;line-height:1.2;color:#e8e7e3;font-weight:780}
  .rw-showcase-more{border:0;background:transparent;color:var(--rw-accent-text);cursor:pointer;font:700 11px/1 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
  .rw-showcase-more:hover{color:#fff}
  .rw-showcase-row{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;min-height:190px;align-items:start}
  .rw-showcase-card{min-width:0;cursor:pointer;outline:none}
  .rw-showcase-cover{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border:1px solid rgba(255,255,255,.055);border-radius:9px;background:#17181b;box-shadow:0 10px 28px rgba(0,0,0,.18);transition:transform .16s ease,border-color .16s ease,filter .16s ease}
  .rw-showcase-card:hover .rw-showcase-cover,.rw-showcase-card:focus-visible .rw-showcase-cover{transform:translateY(-2px);border-color:rgba(162,139,107,.38);filter:brightness(1.05)}
  .rw-showcase-cover--empty{display:flex;align-items:center;justify-content:center;color:var(--rw-faint);font-size:12px}
  .rw-showcase-copy{display:flex;flex-direction:column;gap:3px;padding:8px 2px 0;min-width:0}
  .rw-showcase-copy strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#d9d8d4;font-size:11px;line-height:1.45;min-height:32px}
  .rw-showcase-copy>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--rw-faint);font-size:10px}
  .rw-showcase-meta{display:flex;align-items:center;gap:7px;min-width:0}
  .rw-showcase-meta>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rw-showcase-type{flex:none;padding:2px 5px;border-radius:4px;background:rgba(162,139,107,.10);color:#aa9270;font-size:9px;font-weight:750}
  .rw-catalog{min-width:0}

  .rw-head-actions{
    margin-left:auto;flex:none;display:flex;align-items:center;justify-content:flex-end;gap:8px;white-space:nowrap
  }
  .rw-head-discover-tools .rw-input{min-width:180px}
  .rw-head-discover-tools .rw-select{min-width:96px;max-width:128px}
  .rw-account-wrap{position:relative;flex:none}
  .rw-account{
    min-height:38px;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    border:1px solid var(--rw-line);border-radius:9px;background:rgba(255,255,255,.025);color:#c8c7c2;
    padding:0 10px;cursor:pointer;font:650 11px/1 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif
  }
  .rw-account:hover{background:rgba(255,255,255,.055);border-color:var(--rw-line-strong);color:#fff}
  .rw-account-dropdown{
    position:absolute;right:0;top:44px;z-index:80;width:160px;display:grid;gap:3px;padding:6px;
    border:1px solid var(--rw-line);border-radius:10px;background:#1a1b1f;box-shadow:0 18px 42px rgba(0,0,0,.42)
  }
  .rw-account-dropdown[hidden]{display:none!important}
  .rw-account-dropdown button{
    min-height:36px;border:0;border-radius:7px;background:transparent;color:#c2c0ba;padding:0 10px;
    text-align:left;cursor:pointer;font:650 11px/1 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif
  }
  .rw-account-dropdown button:hover{background:rgba(255,255,255,.055);color:#fff}
  .rw-account-dropdown button.danger{color:#e59a96}
  .rw-version{color:var(--rw-faint);font-size:10px}
  .rw-close,.rw-button,.rw-tab{
    min-height:38px;border:1px solid var(--rw-line);border-radius:9px;background:rgba(255,255,255,.025);
    color:#c8c7c2;padding:0 12px;cursor:pointer;font:650 13px/1 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;
    transition:background .14s ease,border-color .14s ease,color .14s ease,transform .14s ease;
  }
  .rw-close:hover,.rw-button:hover,.rw-tab:hover{background:rgba(255,255,255,.055);border-color:var(--rw-line-strong);color:#fff}
  .rw-button.primary{border-color:rgba(162,139,107,.22);background:var(--rw-accent-soft);color:var(--rw-accent-text)}
  .rw-button.primary:hover{background:rgba(162,139,107,.16)}
  .rw-button.good{border-color:rgba(111,168,132,.24);background:rgba(111,168,132,.10);color:#a9d4b8}
  .rw-button.danger{border-color:rgba(216,123,120,.26);background:rgba(216,123,120,.10);color:#efaaa7}
  .rw-button:disabled,.rw-tab:disabled{opacity:.45;cursor:not-allowed;transform:none}
  .rw-close{border-color:rgba(216,123,120,.22);background:rgba(216,123,120,.07);color:#e6a09e}

  .rw-tabs{
    grid-column:1;grid-row:1/3;display:flex;flex-direction:column;gap:4px;min-width:0;
    padding:72px 10px 12px;border-right:1px solid var(--rw-line);background:#17181b;
    position:relative;overflow:auto;
  }
  .rw-tabs::before{
    content:"轮回战场";position:absolute;left:16px;top:18px;color:var(--rw-text);
    font-family:"LXGW WenKai Lite","Microsoft YaHei",sans-serif;font-size:16px;font-weight:800;
  }
  .rw-tabs::after{
    content:"CREATIVE WORKSHOP";position:absolute;left:16px;top:42px;color:var(--rw-faint);
    font-size:9px;font-weight:750;letter-spacing:.10em;
  }
  .rw-tab{
    width:100%;display:flex;align-items:center;justify-content:flex-start;min-height:42px;
    border-color:transparent;background:transparent;color:var(--rw-muted);text-align:left;
  }
  .rw-tab:hover{transform:none;background:rgba(255,255,255,.035)}
  .rw-tab.is-active{
    position:relative;border-color:rgba(162,139,107,.16);background:var(--rw-accent-soft);color:var(--rw-accent-text)
  }
  .rw-tab.is-active::before{
    content:"";position:absolute;left:-1px;top:9px;bottom:9px;width:2px;border-radius:2px;background:var(--rw-accent)
  }
  .rw-tab[hidden]{display:none!important}
  .rw-nav-label{
    padding:2px 7px 5px;color:var(--rw-faint);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase
  }
  .rw-nav-divider{height:1px;margin:4px 0;background:var(--rw-line)}
  .rw-nav-filter{min-height:38px;color:#a6a49e;font-size:12px}
  .rw-nav-filter.is-filter-active{color:var(--rw-accent-text)}
  .rw-nav-filter.is-filter-active::after{
    content:"";width:5px;height:5px;margin-left:auto;border-radius:999px;background:var(--rw-accent)
  }
  .rw-nav-connection{
    margin-top:auto;padding:10px 9px;border:1px solid rgba(111,168,132,.17);border-radius:9px;
    background:rgba(111,168,132,.055);color:#7fba92;font-size:10px;font-weight:750
  }

  .rw-body{
    grid-column:2;grid-row:2;min-width:0;min-height:0;overflow:auto;padding:18px 22px 34px;
    display:grid;align-content:start;gap:14px;background:var(--rw-bg);
  }
  .rw-body::-webkit-scrollbar{width:8px}.rw-body::-webkit-scrollbar-thumb{background:#33343a;border-radius:999px}

  .rw-section{min-width:0}.rw-section[hidden]{display:none!important}
  .rw-page-head{
    display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;
    padding:2px 2px 12px;border-bottom:1px solid var(--rw-line)
  }
  .rw-page-head-copy small{display:block;color:var(--rw-faint);font-size:10px;font-weight:800;letter-spacing:.10em;margin-bottom:3px}
  .rw-page-head-copy h2{margin:0;color:var(--rw-text);font-size:18px;font-weight:800}
  .rw-page-head-copy p{margin:4px 0 0;color:var(--rw-muted);font-size:12px}

  .rw-toolbar,.rw-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .rw-toolbar{
    margin-bottom:12px;padding:10px;border:1px solid var(--rw-line);border-radius:11px;background:var(--rw-surface)
  }
  .rw-input,.rw-select,.rw-textarea{
    box-sizing:border-box;border:1px solid var(--rw-line);border-radius:9px;background:#141518;color:var(--rw-text);
    outline:none;font:500 13px/1.4 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;
    transition:border-color .14s ease,box-shadow .14s ease,background .14s ease;
  }
  .rw-input,.rw-select{min-height:40px;padding:0 11px;min-width:140px}
  .rw-input.grow{flex:1;min-width:220px}
  .rw-textarea{width:100%;min-height:92px;padding:10px 11px;resize:vertical}
  .rw-input:focus,.rw-select:focus,.rw-textarea:focus{border-color:rgba(162,139,107,.45);box-shadow:0 0 0 3px rgba(162,139,107,.08);background:#17181b}
  .rw-input::placeholder,.rw-textarea::placeholder{color:#5f5f5d}

  .rw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:12px;align-items:start}
  .rw-project-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
  .rw-card{
    position:relative;min-width:0;display:grid;gap:10px;padding:13px;border:1px solid var(--rw-line);
    border-radius:12px;background:var(--rw-surface);box-shadow:0 8px 22px rgba(0,0,0,.08);
    transition:border-color .14s ease,background .14s ease,transform .14s ease;
  }
  .rw-card:hover{border-color:rgba(255,255,255,.12);background:#1b1c20}
  .rw-card h3{margin:0;color:var(--rw-text);font-size:15px;line-height:1.35}
  .rw-cover{
    width:calc(100% + 26px);margin:-13px -13px 1px;aspect-ratio:16/9;display:block;object-fit:cover;
    border:0;border-bottom:1px solid var(--rw-line);border-radius:12px 12px 0 0;background:#111216
  }
  .rw-cover-placeholder{
    box-sizing:border-box;place-items:center;padding:18px;text-align:center;color:#686761;
    background:
      radial-gradient(circle at 75% 20%,rgba(162,139,107,.10),transparent 34%),
      linear-gradient(145deg,#17181b,#111216);
    font-size:11px;font-weight:700;letter-spacing:.03em
  }
  .rw-field-title{color:var(--rw-accent-text);font-size:12px;font-weight:800}
  .rw-muted{color:var(--rw-muted);font-size:12px;line-height:1.55;white-space:pre-line}
  .rw-project-card{cursor:pointer}
  .rw-project-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
  .rw-project-card-top h3{min-width:0;flex:1}
  .rw-project-author{color:var(--rw-faint);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rw-project-summary{
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:38px;font-size:11px
  }
  .rw-project-footer{
    display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:2px;padding-top:9px;border-top:1px solid var(--rw-line)
  }
  .rw-project-stats{display:flex;gap:10px;color:#777671;font-size:10px}
  .rw-detail-cover{width:100%;max-height:360px;object-fit:cover;border:1px solid var(--rw-line);border-radius:11px;background:#111216}
  .rw-detail-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
  .rw-detail-heading h3{margin:0;color:var(--rw-text);font-size:21px}
  .rw-detail-description{color:#c1c0bb;font-size:13px;line-height:1.75;white-space:pre-wrap}
  .rw-detail-section{display:grid;gap:5px;padding:11px 0;border-top:1px solid var(--rw-line)}
  .rw-detail-section strong{font-size:12px;color:#c8c7c2}
  .rw-detail-actions{padding-top:4px}
  .rw-technical-details{border-top:1px solid var(--rw-line);padding-top:10px}
  .rw-technical-details summary{cursor:pointer;color:var(--rw-muted);font-size:11px}
  .rw-technical-details[open] summary{margin-bottom:8px}
  .rw-meta{display:flex;gap:5px;flex-wrap:wrap;color:#9d9b95;font-size:10px}
  .rw-pill{padding:3px 7px;border:1px solid var(--rw-line);border-radius:999px;background:rgba(255,255,255,.02)}
  .rw-status{font-size:12px}.rw-status.ok{color:#9dccae}.rw-status.bad{color:#e59a96}
  .rw-author-archive-status{
    white-space:pre-line;padding:9px 10px;border:1px solid rgba(216,123,120,.18);border-radius:8px;
    background:rgba(216,123,120,.045);line-height:1.55
  }
  .rw-author-owner-hidden{
    padding:9px 10px;border:1px solid rgba(214,173,104,.22);border-radius:8px;
    background:rgba(214,173,104,.055);color:#c7aa78;line-height:1.55
  }
  .rw-pill--warning{
    border-color:rgba(214,173,104,.24)!important;background:rgba(214,173,104,.07)!important;color:#d0b27e!important
  }
  .rw-author-card-actions{padding-top:2px}
  .rw-author-project-card>.rw-card-menu{z-index:6}

  .rw-delete-error{
    display:grid;gap:7px;padding:11px 12px;border:1px solid rgba(216,123,120,.22);border-radius:10px;
    background:rgba(216,123,120,.055);color:#aaa6a0
  }
  .rw-delete-error strong{color:#e4a09c;font-size:13px}
  .rw-delete-error div{white-space:pre-line;font-size:11px;line-height:1.6}
  .rw-admin-delete-project{margin-left:auto}

  .rw-editor,.rw-upload-box,.rw-danger-zone{
    display:grid;gap:9px;padding:11px;border:1px solid var(--rw-line);border-radius:10px;background:#141518
  }
  .rw-editor[hidden],.rw-upload-box[hidden],.rw-danger-zone[hidden]{display:none!important}
  .rw-field{display:grid;gap:5px;min-width:0}.rw-field[hidden]{display:none!important}.rw-field>span{color:var(--rw-muted);font-size:11px;font-weight:650}
  .rw-field>.rw-input,.rw-field>.rw-select,.rw-field>.rw-textarea{box-sizing:border-box;width:100%;min-width:0;max-width:100%}
  .rw-file-state{min-height:18px;color:var(--rw-muted);font-size:11px}
  .rw-artifact-list{display:grid;gap:6px;margin-top:7px}
  .rw-artifact-list[hidden]{display:none!important}
  .rw-artifact-row{
    display:flex;align-items:center;gap:8px;padding:8px 9px;border:1px solid var(--rw-line);
    border-radius:9px;background:#111216
  }
  .rw-artifact-row-copy{min-width:0;flex:1;display:grid;gap:2px}
  .rw-artifact-row-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cac8c2;font-size:11px}
  .rw-artifact-row-copy span{color:var(--rw-muted);font-size:10px}
  .rw-artifact-remove{min-height:30px!important;padding:0 8px!important;font-size:10px!important}

  .rw-create-form{
    position:fixed;left:50%;top:50%;z-index:var(--rw-layer-create);transform:translate(-50%,-50%);
    width:min(720px,calc(100vw - 36px));max-height:min(760px,90vh);overflow:auto;
    margin:0;padding:18px;border-color:rgba(162,139,107,.22);background:#1a1b1f;
    box-shadow:0 0 0 100vmax rgba(5,6,8,.72),0 24px 70px rgba(0,0,0,.55)
  }
  .rw-create-form[hidden]{display:none!important}
  .rw-create-form h3{font-size:17px;margin-bottom:4px}
  .rw-create-assets{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:2px}
  .rw-create-assets>.rw-field[data-role="create-artifact-kind"],
  .rw-create-assets>.rw-field[data-role="create-original-conflicts"]{grid-column:1/-1}
  .rw-review-toggle{
    grid-column:1/-1;display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid var(--rw-line);
    border-radius:9px;background:#151619;color:#aaa8a3;font-size:12px;cursor:pointer
  }
  .rw-review-toggle input{accent-color:var(--rw-accent)}
  .rw-author-cover-preview{
    width:100%;max-height:240px;display:block;object-fit:cover;border:1px solid var(--rw-line);
    border-radius:9px;background:#111216
  }
  .rw-author-cover-preview[hidden]{display:none!important}
  .rw-upload-actions{align-items:stretch}
  .rw-file-drop-button{
    flex:1;min-width:220px;min-height:76px;padding:12px 14px!important;
    border-style:dashed!important;border-color:rgba(162,139,107,.24)!important;
    background:rgba(162,139,107,.045)!important;color:#bdb0a0!important;
    white-space:normal;line-height:1.45!important;text-align:center
  }
  .rw-file-drop-button:hover,.rw-file-drop-button.is-dragover{
    border-color:rgba(162,139,107,.55)!important;background:rgba(162,139,107,.11)!important;color:var(--rw-accent-text)!important
  }

  .rw-create-form{
    position:fixed;left:50%;top:50%;z-index:var(--rw-layer-create);transform:translate(-50%,-50%);
    width:min(1180px,calc(100vw - 28px));height:min(900px,94vh);max-height:min(900px,94vh);overflow:hidden;
    grid-template-rows:auto minmax(0,1fr) auto;gap:0;
    margin:0;padding:0;border:1px solid var(--rw-line-strong);border-radius:14px;background:#18191d;
    box-shadow:0 0 0 100vmax rgba(5,6,8,.76),0 28px 80px rgba(0,0,0,.58)
  }
  .rw-create-form[hidden]{display:none!important}
  .rw-publish-form-head{
    display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;
    border-bottom:1px solid var(--rw-line);background:#1b1c20
  }
  .rw-publish-form-title{display:flex;align-items:center;gap:10px}
  .rw-publish-form-title>span{color:#c8ab7d;font-size:18px}
  .rw-publish-form-title div{display:grid;gap:2px}
  .rw-publish-form-title strong{color:#f0ede7;font-size:16px}
  .rw-publish-form-title small{color:var(--rw-faint);font-size:10px}
  .rw-publish-grid{
    display:grid;grid-template-columns:1.08fr .92fr;min-height:0;max-height:none;overflow:auto
  }
  .rw-publish-column{display:grid;align-content:start;gap:14px;padding:28px 30px 30px}
  .rw-publish-column+.rw-publish-column{border-left:1px solid var(--rw-line)}
  .rw-publish-step-title{display:flex;align-items:flex-start;gap:10px;margin-bottom:2px}
  .rw-publish-step-title>span,.rw-rule-section-title>span{
    flex:none;display:grid;place-items:center;width:28px;height:28px;border:1px solid rgba(200,171,125,.28);
    border-radius:8px;background:rgba(200,171,125,.07);color:#cfb286;font-size:10px;font-weight:800
  }
  .rw-publish-step-title>div,.rw-rule-section-title>div{display:grid;gap:3px}
  .rw-publish-step-title strong,.rw-rule-section-title strong{color:#d9d6cf;font-size:14px}
  .rw-publish-step-title small,.rw-rule-section-title small{color:var(--rw-faint);font-size:10px;line-height:1.45}
  .rw-publish-summary{min-height:128px}
  .rw-publish-divider{height:1px;margin:7px 0;background:var(--rw-line)}
  .rw-publish-advanced{
    border:1px solid var(--rw-line);border-radius:9px;background:#151619;overflow:hidden
  }
  .rw-publish-advanced>summary{padding:10px 11px;cursor:pointer;color:#aaa8a3;font-size:11px;font-weight:700}
  .rw-publish-advanced[open]>summary{border-bottom:1px solid var(--rw-line)}
  .rw-publish-advanced>.rw-field,.rw-publish-advanced>small{margin:10px}
  .rw-publish-advanced>.rw-dependency-picker{margin:10px}
  .rw-dependency-picker{display:grid;gap:8px}
  .rw-dependency-selected{display:grid;gap:6px}
  .rw-dependency-empty{
    padding:9px 10px;border:1px dashed var(--rw-line);border-radius:8px;color:#73716b;
    background:#111216;font-size:10px;text-align:center
  }
  .rw-dependency-row{
    display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;
    padding:8px 9px;border:1px solid var(--rw-line);border-radius:8px;background:#111216
  }
  .rw-dependency-copy{min-width:0;display:grid;gap:2px}
  .rw-dependency-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d0ccc4;font-size:11px}
  .rw-dependency-copy span,.rw-dependency-copy small{color:#77746e;font-size:9px;line-height:1.4}
  .rw-dependency-version{display:flex;align-items:center;gap:4px;color:#8b8881;font-size:9px}
  .rw-dependency-version input{
    width:58px;min-height:30px;padding:0 6px;border:1px solid var(--rw-line);border-radius:7px;
    background:#151619;color:#c9c5bd;font:600 10px/1 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif
  }
  .rw-dependency-add{width:max-content}
  .rw-dependency-hint{font-size:10px}
  .rw-dependency-search{display:grid;gap:10px}
  .rw-dependency-results{display:grid;gap:7px;max-height:520px;overflow:auto}
  .rw-dependency-result{
    display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;
    padding:10px 11px;border:1px solid var(--rw-line);border-radius:9px;background:#131417
  }
  .rw-dependency-result:hover{border-color:var(--rw-line-strong);background:#17181b}
  .rw-dependency-result .rw-button{min-width:72px}

  .rw-field-label{color:var(--rw-muted);font-size:11px;font-weight:650}
  .rw-publish-upload-block{display:grid;gap:8px}
  .rw-smart-dropzone,.rw-cover-dropzone{
    min-height:126px;display:grid;place-items:center;align-content:center;gap:5px;padding:18px;
    border:1px dashed rgba(200,171,125,.30);border-radius:11px;background:#131417;color:#bbb8b1;
    text-align:center;cursor:pointer;transition:border-color .14s ease,background .14s ease
  }
  .rw-smart-dropzone:hover,.rw-smart-dropzone.is-dragover,
  .rw-cover-dropzone:hover,.rw-cover-dropzone.is-dragover{
    border-color:rgba(200,171,125,.58);background:rgba(200,171,125,.055)
  }
  .rw-publish-upload-slots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .rw-smart-dropzone--compact{min-height:104px;padding:12px 8px}
  .rw-smart-dropzone--compact .rw-smart-dropzone-icon{
    display:grid;place-items:center;width:30px;height:30px;border:1px solid rgba(200,171,125,.24);
    border-radius:8px;background:rgba(200,171,125,.06);font-size:10px;font-weight:850
  }
  .rw-smart-add-more{
    min-height:34px;display:flex;align-items:center;justify-content:center;padding:0 10px;
    border:1px solid var(--rw-line);border-radius:8px;background:#151619;color:#8f8d87;
    cursor:pointer;font-size:10px;font-weight:700
  }
  .rw-smart-add-more:hover,.rw-smart-add-more.is-dragover{border-color:var(--rw-line-strong);color:#c3c0b9;background:#191a1e}
  .rw-smart-dropzone-icon,.rw-cover-dropzone-empty>span{color:#c5aa7e;font-size:22px;line-height:1}
  .rw-smart-dropzone strong,.rw-cover-dropzone strong{color:#d6d2ca;font-size:12px}
  .rw-smart-dropzone small,.rw-cover-dropzone small{max-width:420px;color:var(--rw-faint);font-size:10px;line-height:1.5}
  .rw-cover-dropzone{position:relative;min-height:178px;padding:0;overflow:hidden}
  .rw-cover-dropzone img{width:100%;height:100%;min-height:178px;max-height:240px;object-fit:cover;display:block}
  .rw-cover-dropzone img[hidden]{display:none!important}
  .rw-cover-dropzone img:not([hidden])+.rw-cover-dropzone-empty{display:none}
  .rw-cover-dropzone-empty{display:grid;place-items:center;gap:6px;padding:18px}
  .rw-smart-artifact-list{gap:7px}
  .rw-smart-artifact-row{
    display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;padding:8px 9px;
    border:1px solid var(--rw-line);border-radius:9px;background:#121316
  }
  .rw-smart-artifact-icon{
    width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--rw-line);border-radius:8px;
    background:rgba(255,255,255,.025);color:#aaa8a2;font-size:9px;font-weight:850
  }
  .rw-smart-artifact-icon--worldbook{color:#cfb286}
  .rw-smart-artifact-icon--regex{color:#9fc4b2}
  .rw-smart-artifact-icon--script{color:#b9acd7}
  .rw-smart-artifact-copy{min-width:0;display:grid;gap:2px}
  .rw-smart-artifact-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d0cdc6;font-size:11px}
  .rw-smart-artifact-copy span{color:var(--rw-faint);font-size:9px;line-height:1.35}
  .rw-smart-artifact-controls{display:flex;align-items:center;gap:5px}
  .rw-smart-kind{min-width:86px!important;min-height:30px!important;padding:0 7px!important;font-size:10px!important}
  .rw-smart-scope{min-width:82px!important;min-height:30px!important;padding:0 7px!important;font-size:10px!important}
  .rw-publish-footer{
    position:relative;z-index:6;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 16px;
    border-top:1px solid var(--rw-line);background:#1b1c20;box-shadow:0 -8px 22px rgba(0,0,0,.16)
  }
  .rw-publish-footer>.rw-row{flex:none;display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
  .rw-author-update-modal .rw-modal-body{padding:0!important;background:#18191d!important}
  .rw-update-form{display:grid;min-height:0;background:#18191d}
  .rw-update-grid{max-height:calc(95vh - 126px)}
  .rw-update-changelog{min-height:92px}
  .rw-update-cover-zone{min-height:210px}
  .rw-update-rules-view{display:grid;gap:12px;padding:16px;background:#18191d}
  .rw-update-footer{position:sticky;bottom:0;z-index:4}

  .rw-publish-footer-note{color:#718b79;font-size:10px}
  .rw-install-rules{display:grid;gap:12px}
  .rw-rule-section{display:grid;gap:9px;padding:12px;border:1px solid var(--rw-line);border-radius:10px;background:#141518}
  .rw-rule-section-title{display:flex;align-items:flex-start;gap:9px}
  .rw-rule-artifacts{display:grid;gap:5px}
  .rw-rule-artifact{
    display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 9px;
    border:1px solid var(--rw-line);border-radius:8px;background:#111216
  }
  .rw-rule-artifact strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c9c6bf;font-size:10px}
  .rw-rule-artifact span{flex:none;color:var(--rw-muted);font-size:9px}
  .rw-resource-groups{display:grid;gap:6px}
  .rw-resource-group{border:1px solid var(--rw-line);border-radius:8px;background:#111216;overflow:hidden}
  .rw-resource-group>summary{
    padding:9px 10px;cursor:pointer;color:#b9b6af;font-size:10px;font-weight:750;list-style:none
  }
  .rw-resource-group>summary::-webkit-details-marker{display:none}
  .rw-resource-group[open]>summary{border-bottom:1px solid var(--rw-line);background:#151619}
  .rw-resource-options{display:grid;max-height:320px;overflow:auto}
  .rw-resource-option-wrap{
    display:grid;border-bottom:1px solid rgba(255,255,255,.04);background:#101114
  }
  .rw-resource-option-wrap:last-child{border-bottom:0}
  .rw-resource-preview{padding:0 10px 8px 34px}
  .rw-resource-preview>summary{
    width:max-content;cursor:pointer;color:#8e8a83;font-size:10px;font-weight:700;list-style:none
  }
  .rw-resource-preview>summary::-webkit-details-marker{display:none}
  .rw-resource-preview>summary::before{content:"›";display:inline-block;margin-right:5px;color:#a88d63}
  .rw-resource-preview[open]>summary::before{transform:rotate(90deg)}
  .rw-resource-preview pre{
    margin:7px 0 0;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;
    padding:10px;border:1px solid var(--rw-line);border-radius:7px;background:#0b0c0e;color:#c8c4bc;
    font:11px/1.65 ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace
  }
  .rw-resource-option{
    display:flex;align-items:center;gap:9px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.035);
    cursor:pointer
  }
  .rw-resource-option:last-child{border-bottom:0}
  .rw-resource-option:hover{background:rgba(255,255,255,.025)}
  .rw-resource-option.is-disabled{opacity:.48;cursor:not-allowed}
  .rw-resource-option.is-disabled:hover{background:transparent}
  .rw-resource-option input{accent-color:var(--rw-accent)}
  .rw-resource-option>span{min-width:0;display:grid;gap:2px}
  .rw-resource-option strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c8c5be;font-size:10px}
  .rw-resource-option small{color:var(--rw-faint);font-size:9px}

  .rw-resource-state-editor{
    min-height:0;display:grid;gap:9px;border:1px solid var(--rw-line);border-radius:10px;background:#121316;overflow:hidden
  }
  .rw-resource-state-head{
    display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:11px 12px 0
  }
  .rw-resource-state-head-copy{min-width:0;display:grid;gap:3px}
  .rw-resource-state-head-copy strong{color:#ddd9d1;font-size:12px}
  .rw-resource-state-head-copy small{color:#7f7c75;font-size:9.5px;line-height:1.5}
  .rw-resource-state-refresh{flex:none;min-height:30px!important;padding:0 9px!important;font-size:9.5px!important}
  .rw-resource-state-tabs{
    display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:0 12px
  }
  .rw-resource-state-tab{
    min-height:34px;border:1px solid var(--rw-line);border-radius:8px;background:#0f1012;color:#8e8b84;
    cursor:pointer;font:750 10px/1 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif
  }
  .rw-resource-state-tab:hover{background:#17181b;color:#c8c4bd}
  .rw-resource-state-tab.is-active{
    border-color:rgba(162,139,107,.36);background:rgba(162,139,107,.10);color:#d6c2a4
  }
  .rw-resource-state-toolbar{
    display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:0 12px
  }
  .rw-resource-state-toolbar .rw-input{min-height:34px}
  .rw-resource-state-count{color:#85827b;font-size:9.5px;white-space:nowrap}
  .rw-resource-state-status{
    padding:0 12px;color:#77746e;font-size:9px;line-height:1.45
  }
  .rw-resource-state-body{
    box-sizing:border-box;min-height:360px;height:360px;max-height:360px;display:block;
    overflow-x:hidden!important;overflow-y:scroll!important;overscroll-behavior:contain;
    scrollbar-gutter:stable both-edges;scrollbar-width:thin;scrollbar-color:#4a4b52 #101114;
    -webkit-overflow-scrolling:touch;touch-action:pan-y;padding:0 8px 10px
  }
  .rw-resource-state-body::-webkit-scrollbar{width:10px!important;height:10px!important}
  .rw-resource-state-body::-webkit-scrollbar-track{
    background:#101114!important;border-left:1px solid rgba(255,255,255,.035)!important
  }
  .rw-resource-state-body::-webkit-scrollbar-thumb{
    min-height:42px!important;border:2px solid #101114!important;border-radius:999px!important;
    background:#4a4b52!important;background-clip:padding-box!important
  }
  .rw-resource-state-body::-webkit-scrollbar-thumb:hover{background:#62636b!important}
  .rw-resource-state-body>.rw-resource-state-group{margin-bottom:7px}
  .rw-resource-state-body>.rw-resource-state-group:last-child{margin-bottom:0}
  .rw-resource-state-group{
    display:grid;border:1px solid var(--rw-line);border-radius:8px;background:#0f1012;overflow:hidden
  }
  .rw-resource-state-group.is-saved-only{border-color:rgba(214,173,104,.20)}
  .rw-resource-state-group-head{
    display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 9px;
    border-bottom:1px solid var(--rw-line);background:#151619
  }
  .rw-resource-state-group-head strong{
    min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bcb8b0;font-size:10px
  }
  .rw-resource-state-group-head span{flex:none;color:#706d67;font-size:8.5px}
  .rw-resource-state-row{
    display:grid;gap:5px;padding:8px 9px;border-bottom:1px solid rgba(255,255,255,.04)
  }
  .rw-resource-state-row:last-child{border-bottom:0}
  .rw-resource-state-row:hover{background:rgba(255,255,255,.018)}
  .rw-resource-state-row.is-missing{background:rgba(214,173,104,.025)}
  .rw-resource-state-row-main{
    min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px
  }
  .rw-resource-state-copy{min-width:0;display:grid;gap:3px}
  .rw-resource-state-title{min-width:0;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
  .rw-resource-state-title strong{
    min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cecac2;font-size:10.5px
  }
  .rw-resource-state-copy>small{
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#77746e;font-size:8.8px
  }
  .rw-resource-current{
    flex:none;display:inline-flex;align-items:center;min-height:19px;padding:1px 5px;border:1px solid var(--rw-line);
    border-radius:999px;font-size:8px;font-weight:750
  }
  .rw-resource-current.is-enabled{
    border-color:rgba(111,168,132,.28);background:rgba(111,168,132,.07);color:#8fc29f
  }
  .rw-resource-current.is-disabled{color:#77746e;background:#121316}
  .rw-resource-current.is-missing{
    border-color:rgba(214,173,104,.22);background:rgba(214,173,104,.055);color:#bd9b67
  }
  .rw-resource-state-choices{
    display:grid;grid-template-columns:repeat(3,48px);gap:3px;padding:3px;border:1px solid var(--rw-line);
    border-radius:8px;background:#0b0c0e
  }
  .rw-resource-state-choice{
    min-height:27px;padding:0 5px;border:0;border-radius:6px;background:transparent;color:#75726c;
    cursor:pointer;font:750 9px/1 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif
  }
  .rw-resource-state-choice:hover{background:#191a1e;color:#bbb7af}
  .rw-resource-state-choice.is-selected{background:#24252a;color:#ddd9d1}
  .rw-resource-state-choice--enabled.is-selected{
    background:rgba(111,168,132,.13);color:#a4d0b1
  }
  .rw-resource-state-choice--disabled.is-selected{
    background:rgba(216,123,120,.12);color:#dfa09c
  }
  .rw-resource-state-choice:disabled{opacity:.32;cursor:not-allowed}
  .rw-resource-state-preview{padding-left:2px}
  .rw-resource-state-preview>summary{
    width:max-content;cursor:pointer;color:#8b887f;font-size:8.8px;font-weight:700;list-style:none
  }
  .rw-resource-state-preview>summary::-webkit-details-marker{display:none}
  .rw-resource-state-preview>summary::before{content:"›";display:inline-block;margin-right:5px;color:#a28b6b}
  .rw-resource-state-preview[open]>summary::before{transform:rotate(90deg)}
  .rw-resource-state-preview pre{
    margin:6px 0 0;max-height:210px;overflow:auto;white-space:pre-wrap;word-break:break-word;
    padding:9px;border:1px solid var(--rw-line);border-radius:7px;background:#090a0c;color:#bbb8b1;
    font:10px/1.65 ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace
  }
  .rw-resource-state-warning{
    color:#b79262;font-size:8.5px;line-height:1.45
  }
  .rw-submit-progress{
    white-space:pre-line;padding:10px 11px;border:1px solid var(--rw-line);border-radius:9px;
    background:#141518;color:#aaa8a2;font-size:10px;line-height:1.6
  }
  .rw-submit-progress[hidden]{display:none!important}
  .rw-submit-progress--working{
    border-color:rgba(214,173,104,.22);background:rgba(214,173,104,.055);color:#c9ab78
  }
  .rw-submit-progress--success{
    border-color:rgba(111,168,132,.26);background:rgba(111,168,132,.07);color:#9bcaaa
  }
  .rw-submit-progress--error{
    border-color:rgba(216,123,120,.30);background:rgba(216,123,120,.075);color:#e4a09c
  }
  .rw-publish-final-actions{position:sticky;bottom:-14px;padding:10px 0 0;background:#1a1b1f}

  .rw-empty{
    padding:42px 18px;text-align:center;color:var(--rw-muted);border:1px dashed var(--rw-line-strong);
    border-radius:12px;background:rgba(255,255,255,.018)
  }
  .rw-detail{
    margin:0;white-space:pre-wrap;word-break:break-word;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;
    max-height:260px;overflow:auto;background:#101114;border:1px solid var(--rw-line);border-radius:9px;padding:10px
  }

  .rw-card-menu{position:absolute;right:10px;top:10px;z-index:5}
  .rw-card-menu-trigger{
    width:34px;min-width:34px;height:34px;min-height:34px;padding:0!important;display:grid!important;place-items:center;
    border:1px solid rgba(255,255,255,.14)!important;border-radius:9px!important;
    background:rgba(17,18,21,.86)!important;color:#d4d1ca!important;
    box-shadow:0 2px 10px rgba(0,0,0,.28)!important;opacity:1!important;
    font-size:20px!important;font-weight:800!important;line-height:1!important
  }
  .rw-card-menu-trigger:hover{
    border-color:rgba(200,171,125,.38)!important;background:#202126!important;color:#f2ede4!important
  }
  .rw-card-menu-dropdown{
    position:absolute;right:0;top:40px;width:170px;display:grid;gap:4px;padding:6px;
    border:1px solid var(--rw-line-strong);border-radius:10px;background:#202126;
    box-shadow:0 16px 40px rgba(0,0,0,.35)
  }
  .rw-card-menu-dropdown[hidden]{display:none!important}
  .rw-card-menu-dropdown .rw-button{justify-content:flex-start;width:100%;text-align:left;background:transparent;border-color:transparent}

  .rw-confirm-backdrop{
    position:fixed;inset:0;z-index:var(--rw-layer-confirm);display:grid;place-items:center;padding:18px;
    background:rgba(5,6,8,.78);backdrop-filter:blur(8px)
  }
  .rw-confirm-dialog{
    width:min(440px,calc(100vw - 32px));display:grid;gap:16px;padding:16px;
    border:1px solid var(--rw-line-strong);border-radius:13px;background:#1a1b1f;
    box-shadow:0 24px 70px rgba(0,0,0,.55)
  }
  .rw-confirm-head{display:flex;align-items:flex-start;gap:11px}
  .rw-confirm-icon{
    flex:none;width:32px;height:32px;display:grid;place-items:center;border:1px solid rgba(200,171,125,.28);
    border-radius:9px;background:rgba(200,171,125,.08);color:#d0b488;font-size:13px;font-weight:900
  }
  .rw-confirm-icon.danger{
    border-color:rgba(216,123,120,.28);background:rgba(216,123,120,.08);color:#e59a96
  }
  .rw-confirm-copy{min-width:0;display:grid;gap:6px}
  .rw-confirm-copy strong{color:#e4e1da;font-size:14px}
  .rw-confirm-message{white-space:pre-line;color:#a4a19a;font-size:11px;line-height:1.6}
  .rw-confirm-actions{display:flex;justify-content:flex-end;gap:8px}
  .rw-confirm-actions .rw-button{min-width:92px}
  .rw-confirm-actions .rw-button:not(.primary):not(.danger){
    background:#141518;border-color:var(--rw-line);color:#aaa8a2
  }

  .rw-modal-backdrop{
    position:fixed;inset:0;z-index:var(--rw-layer-modal);display:flex;align-items:center;justify-content:center;
    padding:18px;background:rgba(5,6,8,.74);backdrop-filter:blur(8px);box-sizing:border-box
  }
  .rw-modal{
    width:min(620px,96%);max-height:min(760px,92%);display:flex;flex-direction:column;overflow:hidden;
    border:1px solid var(--rw-line-strong);border-radius:14px;background:#1a1b1f;
    box-shadow:0 24px 70px rgba(0,0,0,.55)
  }
  .rw-modal--wide{width:min(920px,96%)}
  .rw-modal--xl{width:min(1320px,97vw);max-height:min(920px,95vh)}
  .rw-modal--xl .rw-modal-body{padding:0;display:block;background:#111215}

  .rw-modal-head{
    flex:none;display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--rw-line);
    background:#1d1e22
  }
  .rw-modal-head h2{min-width:0;flex:1;margin:0;color:var(--rw-text);font-size:16px;font-weight:800}
  .rw-modal-close{
    width:36px!important;min-width:36px!important;height:36px!important;min-height:36px!important;padding:0!important;
    display:grid!important;place-items:center!important;
    border:1px solid var(--rw-line)!important;border-radius:9px!important;
    background:#141518!important;color:#8f8d87!important;
    box-shadow:none!important;appearance:none!important;-webkit-appearance:none!important;
    cursor:pointer!important;font:500 22px/1 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif!important;
    transition:background .14s ease,border-color .14s ease,color .14s ease!important
  }
  .rw-modal-close:hover{
    border-color:var(--rw-line-strong)!important;background:#202126!important;color:#ddd9d1!important
  }
  .rw-modal-close:focus-visible{
    outline:2px solid rgba(162,139,107,.48)!important;outline-offset:2px!important
  }
  .rw-modal-body{min-height:0;overflow:auto;padding:14px;display:grid;gap:12px}
  .rw-modal-body>.rw-editor,.rw-modal-body>.rw-upload-box,.rw-modal-body>.rw-danger-zone{background:#151619}
  .rw-publish-review{display:grid;gap:12px}
  .rw-publish-review h3{margin:0;color:var(--rw-text);font-size:18px}
  .rw-publish-review-facts{
    display:grid;gap:6px;padding:11px;border:1px solid var(--rw-line);border-radius:10px;background:#141518;
    color:#aaa8a3;font-size:12px;line-height:1.45
  }

  .rw-hot-update{
    display:grid;gap:12px;padding:2px 0 0;
    font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif
  }
  .rw-hot-update-card{
    display:grid;gap:18px;padding:20px;border:1px solid rgba(200,171,125,.24);border-radius:14px;
    background:
      radial-gradient(circle at 85% 0%,rgba(214,173,104,.11),transparent 34%),
      linear-gradient(145deg,#1c1b1a,#17181b 62%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.025)
  }
  .rw-hot-update-heading{
    display:grid;grid-template-columns:46px minmax(0,1fr);align-items:center;gap:13px
  }
  .rw-hot-update-mark{
    width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(214,173,104,.32);
    border-radius:12px;background:rgba(214,173,104,.10);color:#e0bd83;
    font-size:24px;font-weight:700;line-height:1
  }
  .rw-hot-update-title-copy{min-width:0;display:grid;gap:5px}
  .rw-hot-update-badge{
    width:max-content;padding:3px 7px;border-radius:999px;background:rgba(214,173,104,.12);
    color:#d9b77e;font-size:10px;font-weight:800;letter-spacing:.04em
  }
  .rw-hot-update-title-copy>strong{
    color:#f0ece4;font-size:19px;font-weight:850;line-height:1.2;letter-spacing:.01em
  }
  .rw-hot-update-title-copy>p{
    margin:0;color:#99958d;font-size:12px;line-height:1.55
  }
  .rw-hot-update-version{
    display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding:13px 15px;
    border:1px solid rgba(255,255,255,.055);border-radius:11px;background:rgba(10,11,13,.42)
  }
  .rw-hot-update-version-item{display:grid;gap:3px}
  .rw-hot-update-version-item>span{color:#74716b;font-size:10px}
  .rw-hot-update-version-item>strong{color:#c9c5bd;font-size:16px;line-height:1.2}
  .rw-hot-update-version-item--next{text-align:right}
  .rw-hot-update-version-item--next>strong{color:#e2c18b}
  .rw-hot-update-version-arrow{color:#9e8259;font-size:18px}
  .rw-hot-update-promises{
    display:flex;gap:8px;flex-wrap:wrap;color:#8eaa96;font-size:10px;line-height:1.35
  }
  .rw-hot-update-promises>span{
    padding:5px 8px;border:1px solid rgba(111,168,132,.14);border-radius:999px;
    background:rgba(111,168,132,.045)
  }
  .rw-hot-update-progress{
    display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:10px;padding:11px 12px;
    border:1px solid var(--rw-line);border-radius:10px;background:#121316
  }
  .rw-hot-update-progress[hidden]{display:none!important}
  .rw-hot-update-progress-icon{
    width:32px;height:32px;display:grid;place-items:center;border:1px solid rgba(214,173,104,.20);
    border-radius:9px;background:rgba(214,173,104,.055);color:#cdaa72;font-size:15px;font-weight:800
  }
  .rw-hot-update-progress-copy{min-width:0;display:grid;gap:3px}
  .rw-hot-update-progress-copy>strong{color:#c7c3bb;font-size:12px}
  .rw-hot-update-progress-copy>span{
    white-space:pre-line;color:#7d7a74;font-size:10px;line-height:1.5
  }
  .rw-hot-update-progress--working{
    border-color:rgba(214,173,104,.20);background:rgba(214,173,104,.045)
  }
  .rw-hot-update-progress--working .rw-hot-update-progress-icon{
    animation:rw-hot-update-spin 1.1s linear infinite
  }
  .rw-hot-update-progress--success{
    border-color:rgba(111,168,132,.23);background:rgba(111,168,132,.055)
  }
  .rw-hot-update-progress--success .rw-hot-update-progress-icon{
    border-color:rgba(111,168,132,.24);background:rgba(111,168,132,.08);color:#9ecbad
  }
  .rw-hot-update-progress--error{
    border-color:rgba(216,123,120,.25);background:rgba(216,123,120,.06)
  }
  .rw-hot-update-progress--error .rw-hot-update-progress-icon{
    border-color:rgba(216,123,120,.28);background:rgba(216,123,120,.08);color:#e2a09c
  }
  @keyframes rw-hot-update-spin{to{transform:rotate(360deg)}}
  .rw-hot-update-details{
    border-top:1px solid rgba(255,255,255,.055);padding-top:9px
  }
  .rw-hot-update-details>summary{
    width:max-content;list-style:none;cursor:pointer;color:#7c7972;font-size:10px;font-weight:700
  }
  .rw-hot-update-details>summary::-webkit-details-marker{display:none}
  .rw-hot-update-details>summary::before{
    content:"›";display:inline-block;margin-right:6px;color:#9e8259;transition:transform .14s ease
  }
  .rw-hot-update-details[open]>summary::before{transform:rotate(90deg)}
  .rw-hot-update-details-body{
    display:grid;gap:5px;margin-top:8px;padding:10px 11px;border:1px solid rgba(255,255,255,.045);
    border-radius:9px;background:#111215;color:#77746e;font-size:10px;line-height:1.55;word-break:break-word
  }
  .rw-hot-update-actions{
    display:grid;grid-template-columns:auto minmax(230px,1fr);align-items:center;gap:9px;padding-top:2px
  }
  .rw-hot-update-later{
    min-width:84px!important;min-height:44px!important;border-color:var(--rw-line)!important;
    background:#141518!important;color:#918e87!important;font-size:11px!important
  }
  .rw-hot-update-primary{
    min-height:48px!important;border-color:rgba(214,173,104,.48)!important;border-radius:10px!important;
    background:linear-gradient(180deg,#d1b17d,#b9925c)!important;color:#17130e!important;
    box-shadow:0 9px 24px rgba(185,146,88,.18)!important;font-size:13px!important;font-weight:900!important
  }
  .rw-hot-update-primary:hover:not(:disabled){
    background:linear-gradient(180deg,#dfc08c,#c29a61)!important;
    box-shadow:0 11px 30px rgba(185,146,88,.24)!important;transform:translateY(-1px)
  }
  .rw-hot-update-primary:disabled{
    opacity:.7!important;cursor:wait!important;transform:none!important
  }

  .rw-maintenance-protection{
    display:grid;gap:5px;padding:13px 14px;border:1px solid rgba(111,168,132,.25);border-radius:11px;
    background:rgba(111,168,132,.07);color:#a9d4b8
  }
  .rw-maintenance-protection strong{font-size:12px}
  .rw-maintenance-protection div{color:#8eab97;font-size:11px;line-height:1.55}
  .rw-maintenance-section{
    display:grid;gap:10px;padding:12px;border:1px solid var(--rw-line);border-radius:11px;background:#151619
  }
  .rw-maintenance-client{
    position:relative;overflow:hidden;transition:border-color .16s ease,background .16s ease,box-shadow .16s ease
  }
  .rw-maintenance-client--update{
    border-color:rgba(214,173,104,.42);
    background:linear-gradient(145deg,rgba(214,173,104,.11),rgba(21,22,25,.98) 58%);
    box-shadow:0 0 0 1px rgba(214,173,104,.05),0 16px 38px rgba(0,0,0,.18)
  }
  .rw-maintenance-client--update::before{
    content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:#caa96f
  }
  .rw-maintenance-client--latest{
    border-color:rgba(111,168,132,.16);background:linear-gradient(145deg,rgba(111,168,132,.045),#151619 52%)
  }
  .rw-maintenance-client--problem{border-color:rgba(216,123,120,.22)}
  .rw-update-state{display:grid;gap:5px}
  .rw-update-state>strong{font-size:12px}
  .rw-update-state>span{color:#7a7771;font-size:10px;line-height:1.45}
  .rw-update-state--available{gap:8px;padding:3px 0 2px}
  .rw-update-badge{
    width:max-content;padding:4px 8px;border:1px solid rgba(214,173,104,.34);border-radius:999px;
    background:rgba(214,173,104,.11);color:#dfbf87;font-size:9px;font-weight:850;letter-spacing:.04em
  }
  .rw-update-version-line{display:flex;align-items:center;gap:9px;color:#8a877f}
  .rw-update-version-line strong{color:#eee7da;font-size:18px;line-height:1.1}
  .rw-update-version-line span{color:#a88957;font-size:14px}
  .rw-update-summary{color:#a39e94;font-size:10px}
  .rw-update-state--latest{
    grid-template-columns:auto 1fr;align-items:center;gap:9px;padding:9px 10px;
    border:1px solid rgba(111,168,132,.13);border-radius:9px;background:rgba(111,168,132,.045)
  }
  .rw-update-state--latest strong{color:#9bcaaa}
  .rw-update-state--latest span{justify-self:end}
  .rw-update-state--problem{
    padding:9px 10px;border:1px solid rgba(216,123,120,.18);border-radius:9px;background:rgba(216,123,120,.05)
  }
  .rw-update-state--problem strong{color:#e1a19d}
  .rw-maintenance-update-cta{
    width:100%;min-height:48px!important;border-color:rgba(214,173,104,.48)!important;
    background:linear-gradient(180deg,#d0af78,#b99258)!important;color:#17130e!important;
    box-shadow:0 8px 22px rgba(185,146,88,.18)!important;font-size:12px!important;font-weight:900!important
  }
  .rw-maintenance-update-cta:hover{
    background:linear-gradient(180deg,#ddbd87,#c49d61)!important;
    box-shadow:0 10px 28px rgba(185,146,88,.24)!important;transform:translateY(-1px)
  }
  .rw-update-details{
    border-top:1px solid rgba(255,255,255,.045);padding-top:7px;color:#716e68
  }
  .rw-update-details>summary{
    width:max-content;cursor:pointer;list-style:none;color:#77746e;font-size:9px;font-weight:700
  }
  .rw-update-details>summary::-webkit-details-marker{display:none}
  .rw-update-details>summary::before{content:"›";display:inline-block;margin-right:5px;transition:transform .14s ease}
  .rw-update-details[open]>summary::before{transform:rotate(90deg)}
  .rw-update-details-body{display:grid;gap:6px;padding:8px 0 0;color:#66635d;font-size:9px;line-height:1.45}
  .rw-update-details-body .rw-button{width:max-content;min-height:30px;font-size:9px}
  .rw-maintenance-client-actions{align-items:center}
  .rw-maintenance-client-actions>.rw-update-details{margin-left:auto;border-top:0;padding-top:0}

  .rw-maintenance-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .rw-maintenance-section-head>div{display:grid;gap:3px}
  .rw-maintenance-section-head strong{color:#c9c7c0;font-size:12px}
  .rw-maintenance-list{display:grid;gap:8px}
  .rw-maintenance-item{
    display:grid;gap:8px;padding:10px;border:1px solid var(--rw-line);border-radius:9px;background:#121316
  }
  .rw-maintenance-item-title{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .rw-maintenance-item-title strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c8c6bf;font-size:11px}

  .rw-admin-tabs{
    display:flex;align-items:center;gap:6px;margin:0 0 12px;padding:5px;
    border:1px solid var(--rw-line);border-radius:11px;background:var(--rw-surface)
  }
  .rw-admin-tabs .rw-tab{
    width:auto;min-height:36px;justify-content:center;padding:0 13px;border-color:transparent;
    border-radius:8px;background:transparent;text-align:center
  }
  .rw-admin-tabs .rw-tab.is-active{border-color:rgba(162,139,107,.18);background:var(--rw-accent-soft)}
  .rw-admin-tabs .rw-tab.is-active::before{display:none}
  .rw-admin-project-card{gap:11px}
  .rw-admin-detail-cover{max-height:300px}
  .rw-admin-facts{
    display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:10px;
    border:1px solid var(--rw-line);border-radius:10px;background:#141518
  }
  .rw-admin-fact{display:grid;gap:3px;min-width:0}
  .rw-admin-fact span{color:var(--rw-faint);font-size:9px;font-weight:750;letter-spacing:.03em}
  .rw-admin-fact strong{overflow:hidden;text-overflow:ellipsis;color:#c5c3bc;font-size:11px;font-weight:650}
  .rw-admin-section-block{display:grid;gap:8px;padding-top:10px;border-top:1px solid var(--rw-line)}
  .rw-admin-section-title{color:#c9c7c0;font-size:12px;font-weight:800}
  .rw-admin-artifact-list,.rw-admin-history{display:grid;gap:6px}
  .rw-admin-artifact{
    border:1px solid var(--rw-line);border-radius:9px;background:#121316;overflow:hidden
  }
  .rw-admin-artifact>summary{
    display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;
    cursor:pointer;list-style:none
  }
  .rw-admin-artifact>summary::-webkit-details-marker{display:none}
  .rw-admin-artifact[open]>summary{border-bottom:1px solid var(--rw-line);background:#151619}
  .rw-admin-artifact .rw-detail{max-height:360px;border:0;border-radius:0}
  .rw-admin-protected-targets{
    display:grid;gap:4px;padding:9px 10px;border-bottom:1px solid var(--rw-line);background:rgba(214,173,104,.045)
  }
  .rw-admin-protected-targets strong{color:#cbb48d;font-size:10px}
  .rw-admin-artifact-title{min-width:0;display:grid;gap:2px}
  .rw-admin-artifact-title strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c9c7c0;font-size:11px}
  .rw-admin-artifact-title small{color:var(--rw-faint);font-size:9px}
  .rw-admin-artifact-flags{display:flex;justify-content:flex-end;gap:4px;flex-wrap:wrap}
  .rw-admin-history-row{
    display:grid;gap:3px;padding:8px 9px;border:1px solid var(--rw-line);border-radius:8px;background:#131417
  }
  .rw-admin-history-row strong{color:#bdbbb5;font-size:10px}
  .rw-admin-history-row span{color:var(--rw-muted);font-size:10px;line-height:1.45}
  .rw-admin-review-actions{
    position:sticky;bottom:-14px;z-index:5;margin:2px -14px -14px;padding:10px 14px;
    border-top:1px solid var(--rw-line);background:rgba(26,27,31,.96);backdrop-filter:blur(12px)
  }
  .rw-admin-review-shell .rw-workshop-reading{background:#111215}
  .rw-admin-review-decision{
    display:grid;gap:8px;padding:12px;border:1px solid rgba(214,173,104,.18);border-radius:10px;
    background:linear-gradient(160deg,rgba(214,173,104,.065),#121316 55%)
  }
  .rw-admin-review-decision .rw-button{width:100%;min-height:38px}
  .rw-admin-review-primary{min-height:44px!important}
  .rw-admin-review-history .rw-admin-history-row{padding:10px 11px}
  .rw-admin-review-history .rw-admin-history-row strong{font-size:11px}
  .rw-admin-review-history .rw-admin-history-row span{font-size:10px}


  .rw-health-chip{
    flex:none;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    padding:5px 8px;border:1px solid var(--rw-line);border-radius:999px;background:rgba(255,255,255,.025);
    color:var(--rw-faint);font-size:10px;font-weight:700
  }
  .rw-health-chip.ok{border-color:rgba(111,168,132,.18);color:#89bc9a;background:rgba(111,168,132,.07)}
  .rw-health-chip.bad{border-color:rgba(216,123,120,.20);color:#dc9390;background:rgba(216,123,120,.07)}

  .rw-page-head-meta{
    flex:none;padding:6px 9px;border:1px solid var(--rw-line);border-radius:999px;
    color:var(--rw-muted);background:rgba(255,255,255,.02);font-size:10px;font-weight:700
  }
  .rw-page-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}
  .rw-inline-file{display:inline-flex!important;align-items:center!important}

  .rw-discover-subtools{
    display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:-4px 0 12px
  }
  .rw-tag-input{max-width:190px}
  .rw-project-grid{grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}
  .rw-load-more-wrap{display:flex;justify-content:center;padding:14px 0 4px}
  .rw-load-more-wrap .rw-button{min-width:150px}

  .rw-project-card{overflow:hidden}
  .rw-project-card:focus-visible{outline:2px solid rgba(162,139,107,.55);outline-offset:2px}
  .rw-cover-badge{
    position:absolute;left:10px;top:10px;z-index:2;padding:5px 8px;border:1px solid rgba(255,255,255,.12);
    border-radius:999px;background:rgba(14,15,17,.78);backdrop-filter:blur(10px);color:#d8d6d0;
    font-size:9px;font-weight:800;letter-spacing:.04em;box-shadow:0 5px 16px rgba(0,0,0,.22)
  }
  .rw-cover-badge--character{color:#dac7e8}
  .rw-cover-badge--extension{color:#d8c5a9}
  .rw-card-primary{min-width:72px}
  .rw-card-primary.is-installed{border-color:rgba(111,168,132,.22);background:rgba(111,168,132,.08);color:#9bcaaa}
  .rw-card-primary.is-cached{background:rgba(255,255,255,.035);color:#aaa8a3}
  .rw-card-primary.has-update{border-color:rgba(214,173,104,.26);background:rgba(214,173,104,.10);color:#e0bd82}

  .rw-workshop-detail-shell{
    min-height:0;background:#111215;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility
  }
  .rw-workshop-detail-header{
    position:sticky;top:0;z-index:8;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;
    padding:16px 18px;border-bottom:1px solid var(--rw-line);background:rgba(24,25,28,.97);backdrop-filter:blur(14px)
  }
  .rw-workshop-detail-title{min-width:0;display:grid;gap:5px}
  .rw-workshop-detail-title h2{
    margin:0;overflow:hidden;text-overflow:ellipsis;color:#ece9e2;font-size:20px;line-height:1.25;font-weight:850
  }
  .rw-workshop-detail-identity{color:#9a968f;font-size:12px;line-height:1.45}
  .rw-workshop-detail-header>.rw-meta{justify-content:flex-end;max-width:46%}
  .rw-workshop-detail-grid{
    display:grid;grid-template-columns:minmax(0,1fr) 330px;align-items:start;min-height:0
  }
  .rw-workshop-reading{
    min-width:0;display:grid;align-content:start;gap:14px;padding:16px 18px 30px;border-right:1px solid var(--rw-line)
  }
  .rw-workshop-hero{
    width:100%;max-height:430px;display:block;object-fit:cover;border:1px solid var(--rw-line);
    border-radius:11px;background:#0e0f12;box-shadow:0 8px 24px rgba(0,0,0,.18)
  }
  .rw-workshop-rail{
    position:sticky;top:0;display:grid;align-content:start;gap:10px;padding:14px;background:#151619
  }
  .rw-workshop-action-panel,.rw-workshop-rail-section{
    display:grid;gap:9px;padding:11px;border:1px solid var(--rw-line);border-radius:10px;background:#121316
  }
  .rw-workshop-action-panel{
    border-color:rgba(162,139,107,.16);background:linear-gradient(160deg,rgba(162,139,107,.06),#121316 58%)
  }
  .rw-workshop-install-badge{
    width:max-content;padding:4px 7px;border:1px solid rgba(111,168,132,.22);border-radius:999px;
    background:rgba(111,168,132,.07);color:#9bcaaa;font-size:9px;font-weight:800
  }
  .rw-workshop-install-badge.muted{
    border-color:var(--rw-line);background:rgba(255,255,255,.02);color:#77756f
  }
  .rw-workshop-install-button{width:100%;min-height:44px!important;font-size:12px!important}
  .rw-workshop-interactions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
  .rw-workshop-interaction{
    min-width:0!important;min-height:54px!important;display:grid!important;place-items:center!important;align-content:center!important;
    gap:3px!important;padding:6px!important;border:1px solid var(--rw-line)!important;border-radius:9px!important;
    background:#151619!important;color:#9a9892!important
  }
  .rw-workshop-interaction:hover{border-color:var(--rw-line-strong)!important;background:#1b1c20!important;color:#d2d0ca!important}
  .rw-workshop-interaction strong{font-size:11px;line-height:1}
  .rw-workshop-interaction span{font-size:8px;color:#73716c}
  .rw-workshop-interaction.is-active{
    border-color:rgba(162,139,107,.34)!important;background:rgba(162,139,107,.105)!important;color:#dfc8a5!important
  }
  .rw-workshop-interaction--stat{cursor:default!important}
  .rw-workshop-report{width:100%;min-height:32px!important;font-size:9px!important}
  .rw-workshop-rail-label{
    color:#8a867f;font-size:10px;font-weight:850;letter-spacing:.08em;text-transform:uppercase
  }
  .rw-workshop-facts{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .rw-workshop-fact{
    min-width:0;display:grid;gap:2px;padding:7px 8px;border:1px solid rgba(255,255,255,.045);
    border-radius:8px;background:#0f1012
  }
  .rw-workshop-fact span{color:#7b7872;font-size:10px}
  .rw-workshop-fact strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d1cdc5;font-size:12px}
  .rw-workshop-protected{gap:7px}
  .rw-workshop-protected-note{color:#9f9688;font-size:11px;line-height:1.55}
  .rw-workshop-protected-row{
    display:grid;grid-template-columns:27px minmax(0,1fr);align-items:center;gap:7px;padding:7px;
    border:1px solid rgba(214,173,104,.10);border-radius:8px;background:rgba(214,173,104,.035)
  }
  .rw-workshop-protected-icon{
    width:25px;height:25px;display:grid;place-items:center;border:1px solid rgba(200,171,125,.20);
    border-radius:7px;color:#c9ae82;font-size:8px;font-weight:850
  }
  .rw-workshop-protected-icon.script{border-color:rgba(185,172,215,.18);color:#b9acd7}
  .rw-workshop-protected-copy{min-width:0;display:grid;gap:2px}
  .rw-workshop-protected-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d0ccc4;font-size:11px}
  .rw-workshop-protected-copy small{color:#85827b;font-size:10px;line-height:1.45}
  .rw-workshop-dependency-list{display:grid;gap:5px}
  .rw-workshop-dependency{
    padding:8px 9px;border:1px solid var(--rw-line);border-radius:7px;background:#0f1012;color:#b2aea6;font-size:11px
  }
  .rw-workshop-overview{background:#141518}
  .rw-detail-content-section{
    display:grid;gap:10px;padding:12px;border:1px solid var(--rw-line);border-radius:10px;background:#141518
  }
  .rw-detail-content-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
  .rw-detail-content-heading>div{min-width:0;display:grid;gap:3px}
  .rw-detail-content-heading strong{color:#e2ded7;font-size:16px}
  .rw-detail-content-heading span{color:#8d8982;font-size:11px;line-height:1.45}
  .rw-content-chip{
    display:inline-flex;align-items:center;min-height:24px;padding:3px 7px;border:1px solid var(--rw-line);
    border-radius:999px;background:#101114;color:#a29f98;font-size:10px;line-height:1.25
  }
  .rw-content-chip.good{border-color:rgba(111,168,132,.20);background:rgba(111,168,132,.055);color:#8dbb9c}
  .rw-content-chip.warning{border-color:rgba(214,173,104,.22);background:rgba(214,173,104,.06);color:#c7a66f}
  .rw-content-chip.muted{color:#66645f}
  .rw-content-chip.added{border-color:rgba(111,168,132,.22);color:#9dccae}
  .rw-content-chip.modified{border-color:rgba(214,173,104,.24);color:#d6b473}
  .rw-content-chip.removed{border-color:rgba(216,123,120,.22);color:#df9490}
  .rw-content-chip-list{display:flex;gap:5px;flex-wrap:wrap}
  .rw-content-reader-states{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap}
  .rw-strategy-chip{
    display:inline-flex;align-items:center;min-height:26px;padding:3px 8px;border:1px solid var(--rw-line);
    border-radius:999px;background:#111216;font-size:10px;font-weight:800;white-space:nowrap
  }
  .rw-strategy-chip--constant{
    border-color:rgba(92,155,255,.36);background:rgba(92,155,255,.10);color:#9cc4ff
  }
  .rw-strategy-chip--selective{
    border-color:rgba(82,188,120,.34);background:rgba(82,188,120,.09);color:#9dd9b1
  }
  .rw-strategy-chip--vectorized{
    border-color:rgba(176,143,224,.34);background:rgba(176,143,224,.09);color:#c7afea
  }
  .rw-strategy-chip.is-compact{
    min-height:20px;padding:1px 5px;font-size:9px
  }
  .rw-content-nav-title-row{min-width:0;display:flex;align-items:center;gap:6px}
  .rw-content-nav-title-row strong{min-width:0;flex:1}

  .rw-content-workspace{
    min-height:320px;display:grid;grid-template-columns:250px minmax(0,1fr);
    border:1px solid var(--rw-line);border-radius:9px;overflow:hidden;background:#101114
  }
  .rw-content-nav{
    min-height:0;max-height:560px;overflow:auto;display:grid;align-content:start;padding:5px;
    border-right:1px solid var(--rw-line);background:#111215
  }
  .rw-content-nav-item{
    min-width:0;display:grid;gap:3px;padding:8px 9px;border:0;border-radius:7px;background:transparent;color:#98958f;
    text-align:left;cursor:pointer;font-family:inherit
  }
  .rw-content-nav-item:hover{background:rgba(255,255,255,.035);color:#c7c4bd}
  .rw-content-nav-item.is-active{background:rgba(162,139,107,.10);color:#d4c0a1}
  .rw-content-nav-item strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.35}
  .rw-content-nav-item>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7d7a74;font-size:9px}
  .rw-content-reader{min-width:0;min-height:320px;max-height:640px;overflow:auto;background:#0f1012}
  .rw-content-reader-panel{display:grid;gap:14px;padding:18px}
  .rw-content-reader-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
  .rw-content-reader-title{min-width:0;display:grid;gap:3px}
  .rw-content-reader-title h3{margin:0;color:#f0ece4;font-size:17px;line-height:1.4}
  .rw-content-reader-title>span{color:#89867f;font-size:10px}
  .rw-content-entry-meta{display:flex;gap:5px;flex-wrap:wrap}
  .rw-content-keywords{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .rw-content-keywords>div{display:grid;gap:5px}
  .rw-content-keywords strong,.rw-regex-fields strong{color:#96928b;font-size:11px;letter-spacing:.02em}
  .rw-content-source{
    margin:0;max-height:420px;overflow:auto;white-space:pre-wrap;word-break:break-word;
    padding:15px;border:1px solid var(--rw-line);border-radius:8px;background:#0b0c0e;color:#d4d0c8;
    font:12.5px/1.72 ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace
  }
  .rw-content-source--worldbook{min-height:130px}
  .rw-content-source--script{color:#aaa6bd}
  .rw-content-source--compact{max-height:220px}
  .rw-regex-fields{display:grid;gap:10px}
  .rw-regex-fields>div{display:grid;gap:5px}
  .rw-content-empty{
    padding:20px;border:1px dashed var(--rw-line);border-radius:8px;color:#8b8881;text-align:center;font-size:11px
  }
  .rw-change-note{
    white-space:pre-wrap;padding:9px 10px;border-left:2px solid rgba(162,139,107,.45);
    background:rgba(162,139,107,.045);color:#c1bdb5;font-size:12px;line-height:1.65
  }
  .rw-change-summary{display:flex;gap:5px;flex-wrap:wrap}
  .rw-change-group{display:grid;gap:5px}
  .rw-change-group>strong{color:#a5a098;font-size:11px}
  .rw-change-row{
    display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;padding:6px 7px;
    border:1px solid rgba(255,255,255,.045);border-radius:7px;background:#101114
  }
  .rw-change-row-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c5c1b9;font-size:11px}
  .rw-change-row small{max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#88857f;font-size:10px}
  .rw-version-history{
    border:1px solid var(--rw-line);border-radius:10px;background:#131417;overflow:hidden
  }
  .rw-version-history>summary{padding:11px 12px;cursor:pointer;color:#c0bcb4;font-size:12px;font-weight:750}
  .rw-version-history[open]>summary{border-bottom:1px solid var(--rw-line)}
  .rw-version-history-list{display:grid}
  .rw-version-history-row{
    display:grid;grid-template-columns:auto auto 1fr;align-items:start;gap:8px;padding:8px 10px;
    border-bottom:1px solid rgba(255,255,255,.04)
  }
  .rw-version-history-row:last-child{border-bottom:0}
  .rw-version-history-row strong{color:#d8bd91;font-size:11px}
  .rw-version-history-row span{color:#7c7973;font-size:10px}
  .rw-version-history-row div{color:#aaa69e;font-size:11px;white-space:pre-wrap;line-height:1.5}
  .rw-extra-artifact{border:1px solid var(--rw-line);border-radius:8px;overflow:hidden;background:#101114}
  .rw-extra-artifact>summary{padding:8px 9px;cursor:pointer;color:#96938d;font-size:9px}
  .rw-extra-artifact[open]>summary{border-bottom:1px solid var(--rw-line)}
  .rw-extra-artifact .rw-content-source{border:0;border-radius:0}

  .rw-detail-titlebox{min-width:0;display:grid;gap:4px}
  .rw-detail-stats{display:flex;align-items:center;gap:10px;color:#85837d;font-size:10px;white-space:nowrap}
  .rw-install-cta.is-installed{
    border-color:rgba(111,168,132,.28);background:rgba(111,168,132,.09);color:#a4cfb1
  }
  .rw-engagement-button.is-active{
    border-color:rgba(162,139,107,.40);background:rgba(162,139,107,.14);color:var(--rw-accent-text)
  }
  .rw-secondary-action{color:#8d8b85}

  .rw-protection-pill{
    min-height:23px!important;padding:0 7px!important;border-color:rgba(200,171,125,.24)!important;
    background:rgba(200,171,125,.07)!important;color:#ceb185!important;font-size:9px!important
  }
  .rw-protection-section{
    display:grid;gap:8px;padding:11px;border:1px solid var(--rw-line);border-radius:10px;background:#141518
  }
  .rw-protection-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .rw-protection-heading strong{color:#d2cec6;font-size:12px}
  .rw-protection-heading span{color:#8d8a84;font-size:9px}
  .rw-protection-list{display:grid;gap:6px}
  .rw-protection-row{
    display:grid;grid-template-columns:32px minmax(0,1fr);align-items:center;gap:9px;padding:8px 9px;
    border:1px solid var(--rw-line);border-radius:8px;background:#111216
  }
  .rw-protection-icon{
    width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(200,171,125,.20);
    border-radius:8px;background:rgba(200,171,125,.055);color:#cfb286;font-size:9px;font-weight:850
  }
  .rw-protection-icon--script{border-color:rgba(185,172,215,.20);background:rgba(185,172,215,.05);color:#b9acd7}
  .rw-protection-copy{min-width:0;display:grid;gap:3px}
  .rw-protection-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c9c6bf;font-size:10px}
  .rw-protection-copy span{color:#77756f;font-size:9px;line-height:1.45}

  .rw-special-editor{
    display:grid;gap:14px;padding:14px;border:1px solid rgba(212,173,104,.16);border-radius:12px;
    background:linear-gradient(180deg,rgba(212,173,104,.035),rgba(255,255,255,.012))
  }
  .rw-special-editor[hidden]{display:none!important}
  .rw-special-editor-head{display:grid;gap:4px;padding-bottom:10px;border-bottom:1px solid var(--rw-line)}
  .rw-special-editor-head strong{color:#e4ded4;font-size:14px}
  .rw-special-editor-head small{color:#77746e;font-size:10px;line-height:1.55}
  .rw-special-grid,.rw-special-json-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px}
  .rw-special-subtitle{
    margin-top:2px;padding-top:12px;border-top:1px solid var(--rw-line);
    color:#caae7e;font-size:10px;font-weight:850;letter-spacing:.08em
  }
  .rw-special-subtitle-row{
    min-width:0;display:flex;align-items:center;justify-content:space-between;gap:12px;
    margin-top:2px;padding-top:12px;border-top:1px solid var(--rw-line)
  }
  .rw-special-subtitle-row .rw-special-subtitle{margin:0;padding:0;border:0}
  .rw-special-subtitle-row .rw-point-remaining{margin-left:auto}
  .rw-opening-skills-editor,.rw-opening-skills-list{display:grid;gap:10px}
  .rw-opening-skill-add{justify-self:start}
  .rw-opening-skill-head{gap:8px;flex-wrap:wrap}
  .rw-opening-skill-head .rw-auto-quality--inline{margin-left:auto}
  .rw-opening-skill-remove{flex:none}

  .rw-store-entry-list{display:grid;gap:10px}
  .rw-store-entry{
    display:grid;gap:12px;padding:12px;border:1px solid var(--rw-line);border-radius:10px;background:#111216
  }
  .rw-store-entry-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .rw-store-entry-head .rw-select{max-width:180px}
  .rw-store-remove{flex:none}
  .rw-store-add{justify-self:start}
  .rw-store-kind-specific{display:grid;gap:10px}
  .rw-store-attr-grid,.rw-opening-attr-grid{
    min-width:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:8px
  }
  .rw-store-attr-grid .rw-field,.rw-opening-attr-grid .rw-field{gap:4px;min-width:0}
  .rw-store-attr-grid .rw-field>span,.rw-opening-attr-grid .rw-field>span{font-size:9px}
  .rw-point-allocator{min-width:0;display:grid;gap:9px}
  .rw-point-head{display:flex;align-items:center;justify-content:flex-end;gap:10px}
  .rw-point-remaining{flex:none;color:#caae7e;font-size:10px;font-weight:800}
  .rw-point-grid{
    min-width:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:8px
  }
  .rw-point-card{
    min-width:0;display:flex;align-items:center;justify-content:space-between;gap:10px;
    padding:9px 11px;border:1px solid var(--rw-line);border-left:3px solid rgba(212,173,104,.45);
    border-radius:9px;background:#111216
  }
  .rw-point-card>strong{flex:none;color:#aaa69e;font-size:10px}
  .rw-point-controls{min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:7px}
  .rw-point-tier{
    min-width:42px;padding:4px 9px;border:1px solid rgba(212,173,104,.16);border-radius:7px;
    background:rgba(212,173,104,.055);color:#d0b47f;text-align:center;font-size:11px;font-weight:850
  }
  .rw-point-button{
    flex:none;width:28px;height:28px;padding:0;border:1px solid var(--rw-line);border-radius:7px;background:#18191d;color:#c8c4bc;
    cursor:pointer;font:800 15px/1 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif
  }
  .rw-point-button:disabled{opacity:.32;cursor:not-allowed}
  .rw-auto-quality{
    box-sizing:border-box;min-height:38px;display:flex;align-items:center;padding:0 10px;border:1px solid rgba(212,173,104,.18);
    border-radius:9px;background:rgba(212,173,104,.055);color:#d8b77e;font-size:11px;font-weight:800
  }
  .rw-auto-quality--inline{min-height:0;padding:3px 7px;border-radius:999px;font-size:9px}
  .rw-effect-editor,.rw-effect-list{display:grid;gap:8px}
  .rw-effect-row{
    min-width:0;display:grid;grid-template-columns:minmax(120px,.72fr) minmax(0,1.4fr) auto;align-items:end;gap:8px
  }
  .rw-effect-remove{align-self:end;min-height:38px}
  .rw-effect-add{justify-self:start}
  .rw-partner-equipment,.rw-partner-equipment-list{display:grid;gap:10px}
  .rw-opening-equipment-card{
    min-width:0;display:grid;gap:11px;padding:11px;border:1px solid var(--rw-line);border-radius:10px;background:#111216
  }
  .rw-opening-skill-card{
    display:grid;gap:10px;padding:11px;border:1px solid var(--rw-line);border-radius:10px;background:#111216
  }
  .rw-opening-skill-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
  .rw-opening-skill-head strong{color:#d5d1c9;font-size:11px}
  .rw-opening-skill-head small{color:#706d67;font-size:9px}

  .rw-code-input{
    min-height:112px;font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;
    tab-size:2;white-space:pre
  }
  .rw-store-input{min-height:145px}
  .rw-local-note{
    margin:-3px 0 12px;padding:9px 11px;border:1px solid var(--rw-line);border-radius:10px;
    background:rgba(255,255,255,.018);color:var(--rw-muted);font-size:11px;line-height:1.55
  }
  .rw-local-grid{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
  .rw-local-card{overflow:visible;gap:11px}
  .rw-local-cover{height:92px;aspect-ratio:auto;object-fit:cover}
  .rw-local-visual{
    height:78px;margin:-13px -13px 0;padding:15px 14px;display:grid;align-content:end;gap:3px;
    border-bottom:1px solid var(--rw-line);border-radius:12px 12px 0 0;
    background:
      radial-gradient(circle at 82% 20%,rgba(162,139,107,.13),transparent 32%),
      linear-gradient(145deg,#1b1c20,#121316);
  }
  .rw-local-visual--character{background:
    radial-gradient(circle at 82% 20%,rgba(139,111,162,.14),transparent 32%),
    linear-gradient(145deg,#1b1b20,#121316)}
  .rw-local-visual strong{color:#c9c6bf;font-size:13px}
  .rw-local-visual span{color:#6f6d68;font-size:10px}
  .rw-local-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
  .rw-local-titlebox{min-width:0;display:grid;gap:3px}
  .rw-local-titlebox h3{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rw-local-state{
    flex:none;padding:4px 7px;border:1px solid var(--rw-line);border-radius:999px;
    color:var(--rw-muted);background:rgba(255,255,255,.02);font-size:9px;font-weight:800
  }
  .rw-local-state--installed{border-color:rgba(111,168,132,.22);color:#9bcaaa;background:rgba(111,168,132,.07)}
  .rw-local-state--cached{color:#aaa8a3}
  .rw-local-state--update{border-color:rgba(214,173,104,.24);color:#dfbb7f;background:rgba(214,173,104,.07)}
  .rw-local-state--bad{border-color:rgba(216,123,120,.25);color:#e59a96;background:rgba(216,123,120,.07)}
  .rw-local-actions{display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:9px;border-top:1px solid var(--rw-line)}
  .rw-local-primary{flex:1}
  .rw-local-menu{position:relative;margin-left:auto;right:auto;top:auto}
  .rw-local-menu .rw-card-menu-dropdown{right:0;top:40px;z-index:25}

  @media(max-width:760px){
    .rw-resource-state-row-main{grid-template-columns:1fr}
    .rw-resource-state-choices{grid-template-columns:repeat(3,minmax(0,1fr))}
    .rw-resource-state-toolbar{grid-template-columns:1fr}
    .rw-resource-state-count{white-space:normal}
    .rw-resource-state-body{min-height:300px;height:300px;max-height:300px}
    .rw-overlay{padding:0;align-items:stretch}
    .rw-panel{
      width:100vw;height:100dvh;border:0;border-radius:0;
      grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto
    }
    .rw-head{grid-column:1;grid-row:1;display:grid;grid-template-columns:minmax(0,1fr) auto;
      padding:calc(8px + env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) 8px max(10px,env(safe-area-inset-left));background:rgba(20,21,24,.96)}
    .rw-title{min-width:0;font-size:12px}
    .rw-head-actions{grid-column:2;grid-row:1}
    .rw-head-actions{margin-left:auto;gap:6px;flex:none}
    .rw-version{display:none}
    .rw-health-chip{display:none}
    .rw-head-discover-tools{min-width:0;grid-column:1/-1;grid-row:2;display:flex;flex-wrap:wrap}
    .rw-head-discover-tools .rw-input.grow{min-width:0;width:0;flex:1 1 110px}
    .rw-head-discover-tools .rw-select{display:block;min-width:90px;max-width:110px}
    .rw-head-discover-tools .rw-button{display:inline-flex}
    .rw-account{max-width:88px;min-height:36px;padding:0 7px}
    .rw-account-dropdown{right:0;top:40px}
    .rw-head .rw-button[data-action="maintenance"]{
      width:44px;min-height:44px;overflow:hidden;padding:0;font-size:0
    }
    .rw-head .rw-button[data-action="maintenance"]::before{content:"修复";font-size:10px}
    .rw-head .rw-button[data-action="login"]{min-height:36px;padding:0 8px;font-size:10px}
    .rw-close{min-height:36px;padding:0 9px}
    .rw-tabs{
      grid-column:1;grid-row:3;position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;
      gap:2px;padding:6px max(6px,env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left));
      border:0;border-top:1px solid var(--rw-line);background:rgba(20,21,24,.97);overflow-x:auto
    }
    .rw-tabs::before,.rw-tabs::after,.rw-nav-label,.rw-nav-divider,.rw-nav-connection{display:none}
    .rw-tab{min-width:0;min-height:46px;justify-content:center;padding:0 4px;border-radius:9px;text-align:center;font-size:11px}
    .rw-nav-filter.is-filter-active::after{margin-left:5px}
    .rw-tab.is-active::before{display:none}
    .rw-body{grid-column:1;grid-row:2;padding:12px 12px 20px}
    .rw-toolbar{padding:8px}
    .rw-input.grow{min-width:100%;flex-basis:100%}
    .rw-grid{grid-template-columns:1fr}
    .rw-page-head{align-items:flex-start;flex-wrap:wrap}
    .rw-page-actions{width:100%;justify-content:flex-start}
    .rw-maintenance-section-head{align-items:flex-start;flex-direction:column}
    .rw-admin-tabs{overflow-x:auto}
    .rw-admin-tabs .rw-tab{flex:1;min-width:90px}
    .rw-admin-facts{grid-template-columns:1fr}
    .rw-create-form{box-sizing:border-box;width:100%;max-height:100dvh;height:100dvh;border:0;border-radius:0;
      display:flex;flex-direction:column;padding-top:env(safe-area-inset-top)}
    .rw-publish-form-head,.rw-publish-footer{flex-shrink:0}
    .rw-publish-grid{grid-template-columns:minmax(0,1fr);max-height:none;flex:1;overscroll-behavior:contain}
    .rw-publish-column{padding:18px 14px}
    .rw-publish-column+.rw-publish-column{border-left:0;border-top:1px solid var(--rw-line)}
    .rw-publish-footer{align-items:flex-start;flex-direction:column}
    .rw-publish-footer .rw-row{width:100%;justify-content:flex-end}
    .rw-publish-upload-slots{grid-template-columns:1fr}
    .rw-special-grid,.rw-special-json-grid{grid-template-columns:1fr}
    .rw-store-attr-grid,.rw-opening-attr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    .rw-point-grid{grid-template-columns:1fr}
    .rw-effect-row{grid-template-columns:1fr}
    .rw-effect-remove{justify-self:start}
    .rw-store-entry-head{align-items:stretch}
    .rw-store-entry-head .rw-select{max-width:none;flex:1}
    .rw-special-editor{padding:12px}
    .rw-smart-dropzone--compact{min-height:82px}
    .rw-smart-artifact-row{grid-template-columns:30px minmax(0,1fr)}
    .rw-smart-artifact-controls{grid-column:1/-1;justify-content:flex-end;flex-wrap:wrap}
    .rw-smart-kind,.rw-smart-scope{flex:1}
    .rw-discover-subtools{justify-content:flex-start;flex-wrap:wrap}
    .rw-tag-input{max-width:none;flex:1}
    .rw-hot-update-card{padding:16px;gap:15px}
    .rw-hot-update-heading{grid-template-columns:40px minmax(0,1fr);gap:10px}
    .rw-hot-update-mark{width:38px;height:38px;font-size:20px}
    .rw-hot-update-title-copy>strong{font-size:16px}
    .rw-hot-update-version{padding:11px 12px;gap:8px}
    .rw-hot-update-version-item>strong{font-size:14px}
    .rw-hot-update-promises{display:grid;grid-template-columns:1fr}
    .rw-hot-update-actions{grid-template-columns:1fr}
    .rw-hot-update-primary{grid-row:1}
    .rw-hot-update-later{grid-row:2}
        .rw-modal--xl{width:100%;max-height:none;height:100%}
    .rw-workshop-detail-header{position:relative;padding:12px;flex-direction:column}
    .rw-workshop-detail-header>.rw-meta{max-width:none;justify-content:flex-start}
    .rw-workshop-detail-grid{grid-template-columns:1fr}
    .rw-workshop-reading{padding:12px 12px 20px;border-right:0;order:2}
    .rw-workshop-rail{position:relative;top:auto;padding:12px;border-bottom:1px solid var(--rw-line);order:1}
    .rw-workshop-action-panel{order:-3}
    .rw-workshop-hero{max-height:260px}
    .rw-content-workspace{grid-template-columns:1fr;min-height:0}
    .rw-content-nav{
      max-height:none;display:flex;overflow-x:auto;padding:5px;border-right:0;border-bottom:1px solid var(--rw-line)
    }
    .rw-content-nav-item{flex:0 0 150px}
    .rw-content-reader{min-height:0;max-height:none}
    .rw-content-keywords{grid-template-columns:1fr}
    .rw-version-history-row{grid-template-columns:auto 1fr}
    .rw-version-history-row div{grid-column:1/-1}
    .rw-change-row{grid-template-columns:auto minmax(0,1fr)}
    .rw-change-row small{grid-column:2;max-width:none}
        .rw-detail-heading{align-items:flex-start;flex-direction:column}
    .rw-local-grid{grid-template-columns:1fr}
    .rw-modal-backdrop{padding:0;align-items:stretch}
    .rw-modal,.rw-modal--wide{width:100%;max-height:none;height:100%;border:0;border-radius:0}
    .rw-modal-body{padding:12px 12px calc(18px + env(safe-area-inset-bottom))}
    .rw-modal-head{padding-top:calc(12px + env(safe-area-inset-top))}
    .rw-create-form{height:100%;max-height:none;grid-template-rows:auto minmax(0,1fr) auto}
    .rw-publish-footer{padding-bottom:calc(12px + env(safe-area-inset-bottom));align-items:flex-start;flex-direction:column}
    .rw-publish-footer>.rw-row{width:100%;justify-content:stretch}
    .rw-publish-footer>.rw-row .rw-button{flex:1}
    .rw-panel,.rw-create-form,.rw-modal{overflow-wrap:anywhere}
    .rw-overlay input,.rw-overlay select,.rw-overlay textarea{font-size:16px;box-sizing:border-box;max-width:100%}
    .rw-overlay .rw-button,.rw-overlay .rw-close,.rw-overlay .rw-account,
    .rw-overlay .rw-resource-state-choice,.rw-overlay .rw-account-dropdown button{min-height:44px}
    .rw-overlay .rw-modal-close{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important}
    .rw-launcher{right:max(12px,env(safe-area-inset-right));bottom:calc(80px + env(safe-area-inset-bottom))}
  }

  @media(max-width:420px){
    .rw-title{font-size:13px}
    .rw-body{padding:10px}
    .rw-card{padding:12px}
    .rw-cover{width:calc(100% + 24px);margin:-12px -12px 1px}
  }

  @media(max-width:1180px){.rw-showcase-row{grid-template-columns:repeat(4,minmax(0,1fr))}.rw-showcase-card:nth-child(n+5){display:none}}
  @media(max-width:760px){.rw-showcase-row{display:flex;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:6px}.rw-showcase-card{flex:0 0 46%;scroll-snap-align:start}.rw-showcase-card:nth-child(n){display:block}.rw-discover-home{gap:26px}}


  /* Reference-aligned browse hierarchy: creator, two-line title, media, metadata. */
  .rw-project-card{padding:0!important;gap:0!important;overflow:hidden}
  .rw-project-author-head{height:32px;display:flex;align-items:center;padding:0 10px;border-bottom:1px solid var(--rw-line);color:#9a9892;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rw-project-title-row{min-height:54px;display:flex;align-items:flex-start;gap:6px;padding:9px 10px 8px;border-bottom:1px solid var(--rw-line);background:#1b1c1f}
  .rw-title-type{flex:none;margin-top:2px;padding:3px 5px;border:1px solid rgba(212,173,104,.26);border-radius:5px;background:rgba(180,132,58,.11);color:#d7b26f;font-size:8px;font-weight:820;line-height:1}
  .rw-title-type--character{border-color:rgba(198,160,217,.26);background:rgba(151,100,174,.11);color:#d1a9df}
  .rw-project-title-text{min-width:0;margin:0!important;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;word-break:break-word;overflow-wrap:anywhere;color:#e0ddd6;font-size:12px!important;line-height:1.45}
  .rw-project-media{position:relative;overflow:hidden;background:#111216;border-bottom:1px solid var(--rw-line)}
  .rw-project-media .rw-cover{width:100%;aspect-ratio:1.22/1;display:block;object-fit:cover;border:0!important;border-radius:0!important}
  .rw-project-card>.rw-meta,.rw-project-card>.rw-project-summary,.rw-project-card>.rw-project-footer{margin-left:10px;margin-right:10px}
  .rw-project-card>.rw-meta{margin-top:9px}
  .rw-project-card>.rw-project-summary{margin-top:7px}
  .rw-project-card>.rw-project-footer{margin-bottom:9px}
  .rw-showcase-more-card{-webkit-appearance:none!important;appearance:none!important;width:auto!important;height:auto!important;padding:0!important;border:1px dashed rgba(162,139,107,.22)!important;border-radius:9px!important;background:#141518!important;color:#9d8b70!important;box-shadow:none!important}
  .rw-showcase-more-card:hover{background:rgba(162,139,107,.045)!important;color:#d3b98f!important}
`;
