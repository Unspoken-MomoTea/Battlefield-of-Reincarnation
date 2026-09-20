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
    background:rgba(24,25,28,.94);color:var(--rw-accent-text);cursor:pointer;
    box-shadow:0 12px 34px rgba(0,0,0,.30);backdrop-filter:blur(16px);
    font:800 18px/1 "LXGW WenKai Lite","Microsoft YaHei",sans-serif;
    transition:transform .15s ease,background .15s ease,border-color .15s ease;
  }
  .rw-launcher:hover{transform:translateY(-2px);background:#202126;border-color:rgba(162,139,107,.45)}
  .rw-overlay{
    position:fixed;inset:0;z-index:2147483390;display:none;align-items:center;justify-content:center;
    padding:16px;background:rgba(5,6,8,.74);backdrop-filter:blur(8px);
    font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;color:var(--rw-text);
    box-sizing:border-box;
  }
  .rw-overlay.is-open{display:flex}
  .rw-panel{
    width:min(1460px,96vw);height:min(900px,95vh);overflow:hidden;
    display:grid;grid-template-columns:208px minmax(0,1fr);grid-template-rows:64px minmax(0,1fr);
    border:1px solid var(--rw-line);border-radius:18px;background:var(--rw-bg);
    box-shadow:0 28px 90px rgba(0,0,0,.55);
  }

  .rw-head{
    grid-column:2;grid-row:1;display:flex;align-items:center;gap:8px;min-width:0;
    padding:10px 12px;border-bottom:1px solid var(--rw-line);background:rgba(24,25,28,.93);
  }
  .rw-title{
    min-width:0;flex:1;font-family:"LXGW WenKai Lite","Microsoft YaHei",sans-serif;
    font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  .rw-account{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--rw-muted);font-size:12px}
  .rw-version{color:var(--rw-faint);font-size:11px}
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
    padding:78px 10px 12px;border-right:1px solid var(--rw-line);background:rgba(24,25,28,.96);
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

  .rw-body{
    grid-column:2;grid-row:2;min-width:0;min-height:0;overflow:auto;padding:16px 18px 28px;
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

  .rw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;align-items:start}
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
    display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:55px
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

  .rw-editor,.rw-upload-box,.rw-danger-zone{
    display:grid;gap:9px;padding:11px;border:1px solid var(--rw-line);border-radius:10px;background:#141518
  }
  .rw-editor[hidden],.rw-upload-box[hidden],.rw-danger-zone[hidden]{display:none!important}
  .rw-field{display:grid;gap:5px}.rw-field>span{color:var(--rw-muted);font-size:11px;font-weight:650}
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
    position:fixed;left:50%;top:50%;z-index:2147483500;transform:translate(-50%,-50%);
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
    border-radius:9px!important;font-size:20px!important;line-height:1!important
  }
  .rw-card-menu-dropdown{
    position:absolute;right:0;top:40px;width:170px;display:grid;gap:4px;padding:6px;
    border:1px solid var(--rw-line-strong);border-radius:10px;background:#202126;
    box-shadow:0 16px 40px rgba(0,0,0,.35)
  }
  .rw-card-menu-dropdown[hidden]{display:none!important}
  .rw-card-menu-dropdown .rw-button{justify-content:flex-start;width:100%;text-align:left;background:transparent;border-color:transparent}

  .rw-modal-backdrop{
    position:absolute;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;
    padding:18px;background:rgba(5,6,8,.74);backdrop-filter:blur(8px);box-sizing:border-box
  }
  .rw-modal{
    width:min(620px,96%);max-height:min(760px,92%);display:flex;flex-direction:column;overflow:hidden;
    border:1px solid var(--rw-line-strong);border-radius:14px;background:#1a1b1f;
    box-shadow:0 24px 70px rgba(0,0,0,.55)
  }
  .rw-modal--wide{width:min(920px,96%)}
  .rw-modal-head{
    flex:none;display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--rw-line);
    background:#1d1e22
  }
  .rw-modal-head h2{min-width:0;flex:1;margin:0;color:var(--rw-text);font-size:16px;font-weight:800}
  .rw-modal-close{
    width:36px!important;min-width:36px!important;height:36px!important;min-height:36px!important;padding:0!important;
    display:grid!important;place-items:center;font-size:22px!important;line-height:1!important
  }
  .rw-modal-body{min-height:0;overflow:auto;padding:14px;display:grid;gap:12px}
  .rw-modal-body>.rw-editor,.rw-modal-body>.rw-upload-box,.rw-modal-body>.rw-danger-zone{background:#151619}
  .rw-publish-review{display:grid;gap:12px}
  .rw-publish-review h3{margin:0;color:var(--rw-text);font-size:18px}
  .rw-publish-review-facts{
    display:grid;gap:6px;padding:11px;border:1px solid var(--rw-line);border-radius:10px;background:#141518;
    color:#aaa8a3;font-size:12px;line-height:1.45
  }

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

  .rw-category-switch{
    display:grid;grid-template-columns:minmax(90px,.72fr) repeat(2,minmax(170px,1fr));gap:9px;margin-bottom:10px
  }
  .rw-category-choice{
    min-height:62px;display:grid;align-content:center;gap:3px;padding:10px 13px;text-align:left;
    border:1px solid var(--rw-line);border-radius:11px;background:var(--rw-surface);color:var(--rw-muted);
    cursor:pointer;font-family:inherit;transition:border-color .14s ease,background .14s ease,color .14s ease,transform .14s ease
  }
  .rw-category-choice:hover{border-color:var(--rw-line-strong);background:#1c1d21;color:#d3d1ca;transform:translateY(-1px)}
  .rw-category-choice strong{color:inherit;font-size:13px}
  .rw-category-choice span{color:var(--rw-faint);font-size:10px;line-height:1.35}
  .rw-category-choice.is-active{
    border-color:rgba(162,139,107,.34);background:linear-gradient(145deg,rgba(162,139,107,.14),rgba(162,139,107,.055));
    color:var(--rw-accent-text);box-shadow:inset 0 0 0 1px rgba(162,139,107,.05)
  }
  .rw-discover-toolbar{position:sticky;top:-16px;z-index:9;backdrop-filter:blur(15px);background:rgba(24,25,28,.92)}
  .rw-tag-input{max-width:170px}
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

  .rw-detail-titlebox{min-width:0;display:grid;gap:4px}
  .rw-detail-stats{display:flex;align-items:center;gap:10px;color:#85837d;font-size:10px;white-space:nowrap}
  .rw-engagement-button.is-active{
    border-color:rgba(162,139,107,.40);background:rgba(162,139,107,.14);color:var(--rw-accent-text)
  }
  .rw-secondary-action{color:#8d8b85}

  .rw-local-note{
    margin:-3px 0 12px;padding:9px 11px;border:1px solid var(--rw-line);border-radius:10px;
    background:rgba(255,255,255,.018);color:var(--rw-muted);font-size:11px;line-height:1.55
  }
  .rw-local-grid{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
  .rw-local-card{overflow:visible;gap:11px}
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
    .rw-overlay{padding:0;align-items:stretch}
    .rw-panel{
      width:100vw;height:100dvh;border:0;border-radius:0;
      grid-template-columns:1fr;grid-template-rows:58px minmax(0,1fr) 64px
    }
    .rw-head{grid-column:1;grid-row:1;padding:8px 10px;background:rgba(20,21,24,.96)}
    .rw-title{font-size:14px}
    .rw-version{display:none}
    .rw-account{max-width:120px}
    .rw-health-chip{display:none}
    .rw-head .rw-button[data-action="login"],.rw-head .rw-button[data-action="logout"]{min-height:36px;padding:0 9px}
    .rw-close{min-height:36px;padding:0 9px}
    .rw-tabs{
      grid-column:1;grid-row:3;position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;
      gap:2px;padding:6px max(6px,env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left));
      border:0;border-top:1px solid var(--rw-line);background:rgba(20,21,24,.97);overflow-x:auto
    }
    .rw-tabs::before,.rw-tabs::after{display:none}
    .rw-tab{min-width:76px;min-height:46px;justify-content:center;padding:0 8px;border-radius:9px;text-align:center;font-size:11px}
    .rw-tab.is-active::before{display:none}
    .rw-body{grid-column:1;grid-row:2;padding:12px 12px 20px}
    .rw-toolbar{padding:8px}
    .rw-input.grow{min-width:100%;flex-basis:100%}
    .rw-grid{grid-template-columns:1fr}
    .rw-page-head{align-items:flex-start;flex-wrap:wrap}
    .rw-page-actions{width:100%;justify-content:flex-start}
    .rw-category-switch{grid-template-columns:1fr 1fr}
    .rw-category-choice:first-child{grid-column:1/-1;min-height:42px}
    .rw-discover-toolbar{top:-12px}
    .rw-tag-input{max-width:none;flex:1}
    .rw-detail-heading{align-items:flex-start;flex-direction:column}
    .rw-local-grid{grid-template-columns:1fr}
    .rw-create-form{width:calc(100vw - 20px);max-height:calc(100dvh - 28px);padding:14px}
    .rw-create-assets{grid-template-columns:1fr}
    .rw-create-assets>.rw-field[data-role="create-artifact-kind"],
    .rw-create-assets>.rw-field[data-role="create-original-conflicts"],.rw-review-toggle{grid-column:1}
    .rw-file-drop-button{min-width:100%}
    .rw-modal-backdrop{padding:0;align-items:stretch}
    .rw-modal,.rw-modal--wide{width:100%;max-height:none;height:100%;border:0;border-radius:0}
    .rw-modal-body{padding:12px 12px calc(18px + env(safe-area-inset-bottom))}
  }

  @media(max-width:420px){
    .rw-account{display:none}
    .rw-title{font-size:13px}
    .rw-body{padding:10px}
    .rw-card{padding:12px}
    .rw-cover{width:calc(100% + 24px);margin:-12px -12px 1px}
  }
`;
