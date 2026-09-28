    // 世界引擎基础样式资源：保持视觉不变，只把大块 CSS 从 UI 类方法中移出。
    function worldEngineBaseStyleText() {
        let css = [
                '#sam-world-engine .we-event-tasks{margin:14px 0;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--we-surface,transparent)}#sam-world-engine .we-event-task{margin-top:8px;border-top:1px solid var(--line);padding-top:8px}#sam-world-engine .we-event-task summary{display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none}#sam-world-engine .we-event-task summary:before{content:"▸";color:var(--sub)}#sam-world-engine .we-event-task[open] summary:before{content:"▾"}#sam-world-engine .we-task-name{flex:1;min-width:0;overflow-wrap:anywhere;font-weight:600}#sam-world-engine .we-event-task summary .we-pill{flex-shrink:0}#sam-world-engine .we-event-task p{overflow-wrap:anywhere}',
                '#sam-world-engine[hidden]{display:none!important}',
                '#sam-world-engine{--ink:#dce5ef;--sub:#8897aa;--line:#ffffff12;--gold:#d9b978;--mint:#7dcbbb;position:fixed;inset:4vh max(2vw,calc((100vw - 1440px)/2));z-index:999999;background:#101720;color:var(--ink);border:1px solid #53606a;border-radius:14px;box-shadow:0 30px 120px #000b;display:flex;flex-direction:column;overflow:hidden;font:14px/1.65 system-ui,"Microsoft YaHei",sans-serif}',
                '#sam-world-engine *{box-sizing:border-box}#sam-world-engine button,#sam-world-engine input,#sam-world-engine textarea{font:inherit}#sam-world-engine button{cursor:pointer;color:inherit}#sam-world-engine button:focus-visible,#sam-world-engine input:focus-visible{outline:2px solid var(--gold);outline-offset:2px}#sam-world-engine button:disabled{opacity:.4;cursor:default}',
                '#sam-world-engine header{height:62px;flex-shrink:0;display:flex;align-items:center;gap:12px;padding:0 25px;border-bottom:1px solid var(--line);background:#131c27}#sam-world-engine .we-brand{font-size:16px;letter-spacing:3px;font-weight:650;flex:1}#sam-world-engine .we-brand i{color:var(--gold);font-style:normal;margin-right:12px}#sam-world-engine .we-brand small{font-size:10px;color:var(--sub);letter-spacing:2px;margin-left:16px}',
                '#sam-world-engine button.we-btn{border:1px solid #ffffff23;border-radius:6px;background:#ffffff05;padding:7px 13px;font-size:12px}#sam-world-engine button.we-primary{background:var(--gold);border-color:var(--gold);color:#20232a;font-weight:700}#sam-world-engine .we-layout{display:flex;min-height:0;flex:1}#sam-world-engine nav{width:173px;flex-shrink:0;padding:22px 12px;background:#121a24;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:5px}#sam-world-engine nav .we-navtitle{font-size:10px;color:var(--sub);letter-spacing:3px;padding:0 13px 15px}#sam-world-engine nav button{display:flex;align-items:center;gap:11px;padding:11px 13px;border:1px solid transparent;border-radius:6px;text-align:left;background:none;color:var(--sub);font-size:13px}#sam-world-engine nav button .we-tab-icon{display:inline-flex;flex:0 0 20px;width:20px;height:20px;align-items:center;justify-content:center;font:400 16px/1 "Segoe UI Symbol","Noto Sans Symbols 2",system-ui,sans-serif;transform:none!important}#sam-world-engine nav button[aria-selected=true]{background:#d9b97812;color:var(--gold);border-color:#d9b97824}#sam-world-engine nav button:hover{background:#ffffff08;color:var(--ink)}',
                '#sam-world-engine main{flex:1;min-width:0;overflow:auto;padding:27px 30px 36px;scrollbar-width:thin;scrollbar-color:#526070 transparent}#sam-world-engine .we-eyebrow{font-size:10px;letter-spacing:3px;color:var(--gold);margin-bottom:7px}#sam-world-engine h1{font-size:30px;letter-spacing:2px;margin:0 0 8px;font-weight:600}#sam-world-engine h2{font-size:14px;font-weight:600;margin:0;letter-spacing:1px}#sam-world-engine h3{font-size:14px;margin:0 0 7px}#sam-world-engine p{margin:7px 0;white-space:pre-wrap;overflow-wrap:anywhere}#sam-world-engine .we-muted{color:var(--sub);font-size:12px}#sam-world-engine .we-hero{display:flex;gap:25px;justify-content:space-between;align-items:center;padding:0 0 23px;border-bottom:1px solid var(--line)}#sam-world-engine .we-hero .we-date{min-width:180px;text-align:right;color:var(--gold);font-size:16px}#sam-world-engine .we-hero .we-date small{display:block;color:var(--sub);font-size:11px;margin-top:5px}',
                '#sam-world-engine .we-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:18px 0 25px;background:linear-gradient(100deg,#1a2634,#141f2b);border:1px solid var(--line);border-radius:9px}#sam-world-engine .we-metric{padding:15px 20px;border-right:1px solid var(--line)}#sam-world-engine .we-metric:last-child{border:0}#sam-world-engine .we-metric strong{display:block;font-size:25px;font-weight:500;color:var(--ink);line-height:1.4}#sam-world-engine .we-metric small{color:var(--sub);font-size:11px;letter-spacing:1px}',
                '#sam-world-engine .we-columns{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(245px,1fr);gap:23px;align-items:start}#sam-world-engine .we-section{margin-bottom:23px;min-width:0}#sam-world-engine .we-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}#sam-world-engine .we-section-head small{color:var(--sub);font-size:11px}#sam-world-engine .we-card{border:1px solid var(--line);border-radius:8px;background:#18222f;padding:16px 18px;margin:9px 0;overflow:hidden}#sam-world-engine .we-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px}#sam-world-engine .we-card-top h3{margin:0}#sam-world-engine .we-card p{font-size:13px;color:#b8c4d3}#sam-world-engine .we-pill{display:inline-block;font-size:10px;line-height:1.6;padding:2px 7px;border:1px solid #7dcbbb30;border-radius:4px;color:var(--mint);background:#7dcbbb09;white-space:nowrap}#sam-world-engine .we-pill.future{color:var(--gold);border-color:#d9b97830;background:#d9b97809}#sam-world-engine .we-pill.dim{color:var(--sub);border-color:var(--line);background:transparent}#sam-world-engine .we-meta{display:flex;gap:8px 15px;flex-wrap:wrap;color:var(--sub);font-size:11px;margin-top:9px}#sam-world-engine .we-chips{display:flex;flex-wrap:wrap;gap:5px}',
                '#sam-world-engine .we-timeline{border-left:1px solid #d9b97838;margin-left:5px;padding-left:20px}#sam-world-engine .we-timeline .we-card{position:relative;overflow:visible}#sam-world-engine .we-timeline .we-card:before{content:"";position:absolute;left:-26px;top:20px;width:9px;height:9px;background:var(--gold);border:2px solid #101720;border-radius:50%}#sam-world-engine .we-avatar{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#496575,#243440);color:#c1dedc;font-size:15px;flex-shrink:0}#sam-world-engine .we-person{display:flex;gap:12px;padding:13px 0;border-bottom:1px solid var(--line)}#sam-world-engine .we-person:last-child{border:0}#sam-world-engine .we-person>div:last-child{flex:1;min-width:0}#sam-world-engine .we-person strong{font-size:13px}#sam-world-engine .we-person p{font-size:12px;color:#acb8c8;margin:3px 0}',
                '#sam-world-engine .we-context-list{display:grid;gap:8px}#sam-world-engine .we-context-row{width:100%;display:grid;grid-template-columns:minmax(56px,auto) minmax(0,1fr);align-items:start;gap:10px;padding:11px 12px;border:1px solid var(--we-line,var(--line));border-radius:9px;background:var(--we-card,#18222f);text-align:left;color:var(--we-ink,var(--ink))}#sam-world-engine button.we-context-row:hover{background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-context-kind{color:var(--we-accent,var(--gold));font-size:var(--we-fs-tiny,11px);font-weight:700;letter-spacing:.06em}#sam-world-engine .we-context-copy{min-width:0}#sam-world-engine .we-context-copy b{display:block;font-size:var(--we-fs-body,13px);overflow-wrap:anywhere}#sam-world-engine .we-context-copy small{display:block;margin-top:2px;color:var(--we-sub,var(--sub));font-size:var(--we-fs-small,12px)}#sam-world-engine .we-scene-hero{padding:14px 16px;border:1px solid var(--we-line,var(--line));border-radius:11px;background:var(--we-card,#18222f)}#sam-world-engine .we-scene-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}#sam-world-engine .we-scene-head h3{margin:0}#sam-world-engine .we-scene-head small{color:var(--we-sub,var(--sub))}#sam-world-engine .we-scene-hero>p{margin:8px 0 0;color:var(--we-sub,var(--sub))}#sam-world-engine .we-scene-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:11px}#sam-world-engine .we-scene-lane{min-width:0;border:1px solid var(--we-line,var(--line));border-radius:10px;background:var(--we-card,#18222f);padding:11px}#sam-world-engine .we-scene-lane-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}#sam-world-engine .we-scene-lane-head b{font-size:var(--we-fs-small,12px)}#sam-world-engine .we-scene-lane-head span{color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-scene-item{display:block;width:100%;padding:9px 8px;border:0;border-top:1px solid var(--we-line,var(--line));background:transparent;text-align:left;color:var(--we-ink,var(--ink))}#sam-world-engine .we-scene-item:first-of-type{border-top:0}#sam-world-engine button.we-scene-item:hover{background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-scene-item b{display:block;font-size:var(--we-fs-body,13px);overflow-wrap:anywhere}#sam-world-engine .we-scene-item small{display:block;color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px);margin-top:2px}#sam-world-engine .we-scene-item p{margin:4px 0 0!important;color:var(--we-sub,var(--sub))!important;font-size:var(--we-fs-small,12px)!important;line-height:1.5!important}#sam-world-engine .we-scene-label,#sam-world-engine .we-person-label{cursor:default}#sam-world-engine .we-roster-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#sam-world-engine .we-roster-person{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start;width:100%;min-width:0;padding:11px 12px;border:1px solid var(--we-line,var(--line));border-radius:10px;background:var(--we-card,#18222f);text-align:left;color:var(--we-ink,var(--ink))}#sam-world-engine .we-roster-person:hover{background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-roster-person.active{border-color:var(--we-accent,var(--gold));box-shadow:0 0 0 2px color-mix(in srgb,var(--we-accent,var(--gold)) 18%,transparent)}#sam-world-engine .we-roster-copy{min-width:0}#sam-world-engine .we-roster-copy b{display:block;font-size:var(--we-fs-body,13px);overflow-wrap:anywhere}#sam-world-engine .we-roster-copy small{display:block;margin-top:2px;color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-roster-copy em{display:block;margin-top:5px;color:var(--we-sub,var(--sub));font-size:var(--we-fs-small,12px);font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#sam-world-engine .we-area-scene-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}#sam-world-engine .we-area-detail{display:grid;gap:14px}#sam-world-engine .we-area-facts{min-width:0;padding:14px 16px;border:1px solid var(--we-line,var(--line));border-radius:11px;background:var(--we-card,#18222f)}#sam-world-engine .we-area-archive{padding:0 2px}#sam-world-engine .we-explore-index{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}@media(max-width:900px){#sam-world-engine .we-roster-list,#sam-world-engine .we-scene-grid,#sam-world-engine .we-area-scene-grid{grid-template-columns:1fr}}',
                '#sam-world-engine .we-change{display:grid;grid-template-columns:62px 1fr;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);font-size:12px}#sam-world-engine .we-change time{color:var(--gold);font-size:10px}#sam-world-engine .we-change p{margin:2px 0;color:var(--sub)}#sam-world-engine .we-progress{height:4px;background:#ffffff0a;border-radius:4px;margin:10px 0 6px;overflow:hidden}#sam-world-engine .we-progress>i{display:block;height:100%;background:var(--mint);border-radius:4px}#sam-world-engine .we-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 18px;align-items:start}#sam-world-engine dl{margin:12px 0;display:grid;grid-template-columns:85px minmax(0,1fr);gap:8px 14px;font-size:12px}#sam-world-engine dt{color:var(--sub)}#sam-world-engine dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}#sam-world-engine details{border-top:1px solid var(--line);margin-top:12px;padding-top:8px}#sam-world-engine summary{cursor:pointer;color:var(--gold);font-size:11px;list-style:none}#sam-world-engine summary:before{content:"＋ ";}#sam-world-engine details[open]>summary:before{content:"− ";}',
                '#sam-world-engine .we-calendar{background:#18222f;border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:20px}#sam-world-engine .we-calhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}#sam-world-engine .we-days{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center}#sam-world-engine .we-days span{color:var(--sub);font-size:10px;padding:4px}#sam-world-engine .we-days button{position:relative;padding:7px 0;border:1px solid transparent;border-radius:5px;background:none;font-size:11px;min-width:0}#sam-world-engine .we-days button.today{border-color:var(--gold);color:var(--gold)}#sam-world-engine .we-days button.selected{background:#d9b97824}#sam-world-engine .we-days button.has-event:after{content:"";position:absolute;bottom:2px;left:calc(50% - 2px);width:4px;height:4px;background:var(--mint);border-radius:50%}#sam-world-engine .we-days button:hover{background:#ffffff0b}',
                '#sam-world-engine .we-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:18px 0}#sam-world-engine .we-tools input{min-width:150px;flex:1;background:#17212d;border:1px solid var(--line);border-radius:6px;color:var(--ink);padding:8px 12px;font-size:12px}#sam-world-engine .we-tools button{border:1px solid var(--line);background:none;border-radius:5px;padding:6px 10px;font-size:11px}#sam-world-engine .we-tools button.active{border-color:var(--gold);color:var(--gold)}#sam-world-engine .we-empty{padding:24px 15px;text-align:center;border:1px dashed #ffffff19;border-radius:8px;color:var(--sub);font-size:12px}#sam-world-engine .we-empty b{display:block;color:#bec9d6;margin-bottom:5px;font-weight:500}#sam-world-engine .we-notice{padding:12px 16px;border-left:2px solid var(--gold);background:#d9b97808;margin:15px 0;color:#d4c4a6;font-size:12px}#sam-world-engine textarea{width:100%;min-height:48vh;background:#121b26;color:var(--ink);border:1px solid #ffffff24;border-radius:8px;padding:18px;line-height:1.9;resize:vertical}#sam-world-engine footer{padding:8px 24px;border-top:1px solid var(--line);font-size:10px;color:var(--sub);display:flex;justify-content:space-between;gap:15px}#sam-world-engine footer span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
                '@media(max-width:1000px){#sam-world-engine .we-columns{grid-template-columns:1fr}#sam-world-engine nav{width:145px}#sam-world-engine main{padding:20px}#sam-world-engine .we-calendar{max-width:400px}}@media(max-width:640px){#sam-world-engine{inset:0;border-radius:0}#sam-world-engine header{padding:0 12px;height:58px;gap:6px}#sam-world-engine .we-brand{font-size:13px;letter-spacing:1px}#sam-world-engine .we-brand small{display:none}#sam-world-engine .we-layout{flex-direction:column}#sam-world-engine nav{width:100%;flex-direction:row;overflow-x:auto;padding:8px;gap:3px;border-right:0;border-bottom:1px solid var(--line)}#sam-world-engine nav .we-navtitle{display:none}#sam-world-engine nav button{white-space:nowrap;padding:7px 10px;font-size:11px}#sam-world-engine nav button .we-tab-icon{display:none}#sam-world-engine main{padding:18px 14px}#sam-world-engine .we-hero{gap:12px;align-items:flex-start}#sam-world-engine h1{font-size:23px}#sam-world-engine .we-hero .we-date{min-width:110px;font-size:12px}#sam-world-engine .we-metric{padding:10px}#sam-world-engine .we-metric strong{font-size:20px}#sam-world-engine .we-grid{grid-template-columns:1fr}#sam-world-engine footer{padding:8px 12px}#sam-world-engine footer small{display:none}}'
            ].join('\n');
        css += `
                #sam-world-engine{
                    top:2vh!important;bottom:auto!important;height:96vh!important;height:96dvh!important;max-height:none!important;min-height:0!important;
                    --ink:#243248;--sub:#6f7b8c;--line:#dfe4e7;--gold:#b28a4a;--mint:#4f7d6d;
                    background:#e8ece9;color:var(--ink);border-color:#344554;border-radius:18px;box-shadow:0 28px 90px #17212d55
                }
                #sam-world-engine header{
                    height:64px;background:linear-gradient(120deg,#1d2a39,#273d4c);color:#f7f3e8;border-bottom:0;padding:0 24px
                }
                #sam-world-engine .we-brand i{color:#d7b46d}
                #sam-world-engine .we-brand small{color:#aebbc5}
                #sam-world-engine button.we-btn{border-color:#ffffff28;background:#ffffff0a}
                #sam-world-engine button.we-primary{background:#d5b06b;border-color:#d5b06b;color:#22303e}
                #sam-world-engine .we-layout{display:grid!important;grid-template-rows:auto minmax(0,1fr);min-height:0!important;flex:1 1 0!important;overflow:hidden}
                #sam-world-engine nav{
                    width:100%!important;flex-direction:row!important;align-items:center;gap:6px;padding:9px 20px;background:#223342;border-right:0;border-bottom:1px solid #ffffff12;overflow-x:auto;min-height:51px
                }
                #sam-world-engine nav .we-navtitle{display:none}
                #sam-world-engine nav button{
                    flex:0 0 auto;padding:8px 13px;border-radius:999px;background:transparent;color:#aeb9c2;border-color:transparent;font-size:12px
                }
                #sam-world-engine nav button span{width:auto;font-size:13px}
                #sam-world-engine nav button:hover{background:#ffffff0c;color:#fff}
                #sam-world-engine nav button[aria-selected=true]{background:#d5b06b;color:#21303d;border-color:#d5b06b;font-weight:700}
                #sam-world-engine main{
                    display:block!important;height:auto!important;min-height:0!important;flex:1 1 0!important;overflow:auto!important;
                    padding:20px clamp(16px,2.2vw,30px) 34px;background:
                    radial-gradient(circle at 88% 0,#f6eee1 0,transparent 34%),
                    linear-gradient(135deg,#edf1ee,#e8ece9 55%,#f3f0e8)
                }
                #sam-world-engine .we-hero{
                    padding:18px 20px;margin-bottom:12px;border:1px solid #dbe1e2;border-left:4px solid var(--gold);border-radius:16px;background:#fbfaf6;box-shadow:0 7px 24px #2535460b
                }
                #sam-world-engine .we-eyebrow{color:#87662f}
                #sam-world-engine h1{font-family:Georgia,"SimSun",serif;font-size:27px;letter-spacing:1px}
                #sam-world-engine h2{font-family:Georgia,"SimSun",serif;font-size:17px;letter-spacing:.5px}
                #sam-world-engine .we-hero .we-date{color:#80612e}
                #sam-world-engine .we-section{
                    margin-bottom:14px;padding:16px;border:1px solid #dfe4e5;border-radius:15px;background:#fffdf8;box-shadow:0 7px 22px #22314209
                }
                #sam-world-engine .we-section-head{margin-bottom:12px;padding-bottom:9px;border-bottom:1px solid #ecefed}
                #sam-world-engine .we-section-head h2{display:flex;align-items:center;gap:8px}
                #sam-world-engine .we-section-head h2:before{content:"";width:3px;height:16px;border-radius:3px;background:var(--gold);flex:none}
                #sam-world-engine .we-card{background:#f6f8f7;border:0;border-radius:10px;padding:13px 15px;margin:7px 0;box-shadow:none;transition:background .15s ease,transform .15s ease}
                #sam-world-engine button.we-card:hover,#sam-world-engine .we-card:hover{background:#f1f4f2}
                #sam-world-engine .we-section .we-card details{border-top:1px solid #e4e8e7}
                #sam-world-engine .we-card p,#sam-world-engine .we-person p{color:#657185}
                #sam-world-engine .we-card-tags{display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end}
                #sam-world-engine .we-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 14px}
                #sam-world-engine .we-kpi{min-width:0;padding:13px 15px;border:1px solid #dce2e3;border-radius:13px;background:#f9f8f3}
                #sam-world-engine .we-kpi small{display:block;color:#7e8793;font-size:10px;letter-spacing:1px}
                #sam-world-engine .we-kpi strong{display:block;margin:3px 0 1px;font:600 24px/1.1 Georgia,serif;color:#31445d}
                #sam-world-engine .we-kpi span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7b8491;font-size:10px}
                #sam-world-engine .we-dashboard{display:grid;grid-template-columns:minmax(0,1fr) minmax(270px,310px);gap:14px;align-items:start}
                #sam-world-engine .we-command-main,#sam-world-engine .we-command-side{min-width:0}
                #sam-world-engine .we-command-side{position:sticky;top:0}
                #sam-world-engine .we-pulse{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start}
                #sam-world-engine .we-pulse p{margin:0;color:#4f5f70;font-size:13px;line-height:1.8}
                #sam-world-engine .we-pulse-mark{margin-top:2px;padding:2px 6px;border-radius:4px;background:#4f7d6d;color:#fff;font:700 9px/1.5 system-ui;letter-spacing:1px}
                #sam-world-engine .we-calendar-layout{display:grid;grid-template-columns:minmax(235px,275px) minmax(0,1fr);gap:18px;align-items:start}
                #sam-world-engine .we-calendar{margin:0;background:transparent;border:0;border-radius:0;padding:4px 2px}
                #sam-world-engine .we-calendar-slot{position:sticky;top:0}
                #sam-world-engine .we-timeline-slot{min-width:0}
                #sam-world-engine .we-timeline-slot>.we-tools{margin:0 0 10px}
                #sam-world-engine .we-timeline{margin-left:4px;padding-left:15px}
                #sam-world-engine .we-timeline .we-card{padding:11px 13px}
                #sam-world-engine .we-timeline .we-card:before{left:-21px;top:17px;width:7px;height:7px;border-color:#fffdf8}
                #sam-world-engine .we-timeline-group{margin:0 0 14px}
                #sam-world-engine .we-timeline-group-title{display:flex;align-items:center;gap:7px;margin:8px 0 6px;color:#6f7b8c;font-size:10px;font-weight:700;letter-spacing:1.2px}
                #sam-world-engine .we-timeline-group-title:after{content:"";height:1px;background:#e2e6e4;flex:1}
                #sam-world-engine .we-timeline-group-title small{order:2;padding:1px 5px;border-radius:999px;background:#ecefea;color:#87909a;font-size:9px;letter-spacing:0}
                #sam-world-engine .we-date-filter{font-size:11px;color:var(--sub)}
                #sam-world-engine .we-next-node{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px}
                #sam-world-engine button.we-next-node{width:100%;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;border-radius:9px;transition:background .15s ease,transform .15s ease}
                #sam-world-engine button.we-next-node:hover{background:#f4f1e9;transform:translateX(2px)}
                #sam-world-engine .we-card.is-jump{outline:2px solid #c49a50;outline-offset:2px;background:#fbf4e5}
                #sam-world-engine .we-next-node>span{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#d5b06b;color:#21303d;font-weight:800}
                #sam-world-engine .we-next-node h3{margin:1px 0 4px}
                #sam-world-engine .we-next-node p{font-size:12px;color:#657185}
                #sam-world-engine .we-next-node small{color:#94753d;font-size:10px}
                #sam-world-engine .we-brief-row{display:grid;width:100%;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;text-align:left;border:0;border-bottom:1px solid #e7e9e7;background:transparent;padding:9px 2px}
                #sam-world-engine .we-brief-row:last-child{border-bottom:0}
                #sam-world-engine .we-brief-row{transition:background .15s ease,padding-left .15s ease}
                #sam-world-engine .we-brief-row:hover{padding-left:7px}
                #sam-world-engine .we-brief-row>b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
                #sam-world-engine .we-brief-row>span:last-child{grid-column:1/-1;color:#707b89;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                #sam-world-engine .we-brief-row:hover{background:#f4f5f1}
                #sam-world-engine .we-people-strip{display:grid;gap:5px}
                #sam-world-engine .we-person-compact{display:grid;grid-template-columns:32px minmax(0,1fr);gap:9px;align-items:center;width:100%;padding:7px;border:0;border-radius:9px;background:transparent;text-align:left}
                #sam-world-engine .we-person-compact{transition:background .15s ease,transform .15s ease}
                #sam-world-engine .we-person-compact:hover{background:#f3f5f1;transform:translateX(2px)}
                #sam-world-engine .we-person-compact .we-avatar{width:32px;height:32px;background:linear-gradient(145deg,#526c7c,#314656)}
                #sam-world-engine .we-person-copy{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 7px;min-width:0}
                #sam-world-engine .we-person-copy strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                #sam-world-engine .we-person-copy small{font-size:9px;color:#94753d;white-space:nowrap}
                #sam-world-engine .we-person-copy em{grid-column:1/-1;font-style:normal;font-size:10px;color:#75808d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                #sam-world-engine .we-link-btn{width:100%;margin-top:8px;border:0;background:transparent;color:#8b6a33;text-align:right;font-size:10px;padding:4px}
                #sam-world-engine .we-link-btn:hover{text-decoration:underline}
                #sam-world-engine .we-change{grid-template-columns:58px 1fr;padding:8px 0}
                #sam-world-engine .we-tools{margin:12px 0;gap:6px}
                #sam-world-engine .we-tools input{background:#f7f8f5;color:var(--ink);border-color:#d8dfdf;border-radius:9px}
                #sam-world-engine .we-tools button{border-color:#d9dfdf;background:#f8f9f6;border-radius:999px}
                #sam-world-engine .we-tools button.active{border-color:#b28a4a;background:#f4ead8;color:#795b2b}
                #sam-world-engine dl{grid-template-columns:92px minmax(0,1fr)}
                #sam-world-engine .we-empty{border-color:#dde2e1;background:#fafaf7}
                #sam-world-engine .we-empty b{color:#6f7b8c}
                #sam-world-engine .we-notice{color:#725f3d;background:#f7edda;border-left-color:#b28a4a;border-radius:0 10px 10px 0}
                #sam-world-engine textarea{background:#fbfaf6;color:var(--ink);border-color:#d8deda}
                #sam-world-engine footer{flex-shrink:0;background:#1f2d3a;color:#9eabb6;border-top:0;padding:7px 20px}
                #sam-world-engine .we-config-row{display:flex;flex-wrap:wrap;gap:18px;align-items:center}
                #sam-world-engine .we-config-row input{width:70px}
                #sam-world-engine select,#sam-world-engine .we-config-row input{font:inherit;padding:7px;border:1px solid #d8ddd8;border-radius:7px;background:#fff;color:var(--ink)}
                #sam-world-engine .we-book{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fffdf8}
                #sam-world-engine .we-book-list{max-height:320px;overflow:auto;margin-top:10px}
                #sam-world-engine .we-book-row{display:flex;gap:10px;align-items:center;padding:11px 4px;border-bottom:1px solid var(--line);cursor:pointer}
                #sam-world-engine .we-book-title{flex:1;min-width:0;overflow-wrap:anywhere}
                #sam-world-engine .we-book-title small{display:block;color:var(--sub);font-size:11px}
                #sam-world-engine .we-read-state{max-width:135px;color:var(--sub);font-size:11px}
                #sam-world-engine .we-lamp{width:9px;height:9px;border-radius:50%;flex-shrink:0}
                #sam-world-engine .we-lamp.blue{background:#5794dd;box-shadow:0 0 0 4px #5794dd16}
                #sam-world-engine .we-lamp.green{background:#58a879;box-shadow:0 0 0 4px #58a87916}
                #sam-world-engine .we-lamp.gray{background:#a1a6ad}
                #sam-world-engine .we-request-summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
                #sam-world-engine .we-inspect-body{max-height:440px;overflow:auto;padding:10px 3px;overscroll-behavior:contain}
                #sam-world-engine .we-prose{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}
                #sam-world-engine textarea.we-raw{min-height:180px;height:280px;max-height:400px;font:12px/1.8 monospace;white-space:pre-wrap}
                #sam-world-engine [data-segment]{min-height:180px;height:240px}
                #sam-world-engine summary{font-size:12px;line-height:1.7;transition:color .15s ease}
                #sam-world-engine summary:hover{color:#7d5f2d}
                #sam-world-engine .we-world-ranks{display:flex;flex-wrap:wrap;gap:8px 20px;margin:0 0 10px;color:var(--sub);font-size:13px}
                #sam-world-engine .we-world-ranks b{color:var(--we-ink,var(--ink));font-weight:600;margin-left:6px}
                #sam-world-engine .we-hero>div:first-child{min-width:0}
                #sam-world-engine .we-reading-section summary{cursor:pointer;display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-weight:600}
                #sam-world-engine .we-reading-section summary small{font-weight:400;color:var(--sub)}
                #sam-world-engine .we-reading{max-width:80ch;margin:18px auto 4px;line-height:1.85;min-width:0}
                #sam-world-engine .we-reading article+article{border-top:1px solid var(--line);padding-top:18px;margin-top:18px}
                #sam-world-engine .we-reading article>small{color:var(--sub)}
                #sam-world-engine .we-reading p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.85}
                #sam-world-engine .we-world-laws{margin:0;line-height:1.6}
                #sam-world-engine .we-world-laws article+article{padding-top:8px;margin-top:8px}
                #sam-world-engine .we-world-laws p{margin:0;font-size:13px;line-height:1.6}
                #sam-world-engine .we-alien-count{margin:0 0 14px;align-items:center}
                #sam-world-engine .we-world-focus{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(285px,.75fr);gap:12px;margin-bottom:12px}
                #sam-world-engine .we-world-focus .we-section{height:100%;margin:0;border-color:#cfd9db;background:#fff;box-shadow:0 4px 14px #2231420b}
                #sam-world-engine .we-world-focus-main .we-section{border-left:4px solid #4f7d6d}
                #sam-world-engine .we-world-focus-next .we-section{border-left:4px solid #b28a4a}
                #sam-world-engine .we-kpi-compact{margin-bottom:12px}
                #sam-world-engine .we-kpi-compact .we-kpi{background:#fff;border-color:#cfd9db;box-shadow:0 3px 12px #22314208}
                #sam-world-engine .we-dashboard{grid-template-columns:minmax(0,1fr) minmax(285px,325px)}
                #sam-world-engine .we-dashboard .we-section{border-color:#d2dcdd;background:#fff}
                #sam-world-engine .we-timeline-board{box-shadow:none}
                #sam-world-engine .we-explore-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,330px);gap:12px;align-items:start}
                #sam-world-engine .we-explore-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
                #sam-world-engine .we-explore-card{display:block;width:100%;min-width:0;padding:13px;border:1px solid #d6dfe0;border-radius:12px;background:#fff;text-align:left;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}
                #sam-world-engine .we-explore-card:hover{border-color:#b9c9c7;box-shadow:0 5px 16px #22314210;transform:translateY(-1px)}
                #sam-world-engine .we-explore-card.active{border-color:#b28a4a;box-shadow:0 0 0 2px #d9b97825}
                #sam-world-engine .we-explore-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
                #sam-world-engine .we-explore-head>div{min-width:0}
                #sam-world-engine .we-explore-head small{display:block;color:#8b949d;font-size:9px}
                #sam-world-engine .we-explore-head h3{margin:2px 0 0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                #sam-world-engine .we-risk-badge{flex:0 0 auto;padding:2px 7px;border:1px solid #d7dfe0;border-radius:999px;background:#f7f8f5;color:#536476;font-size:9px}
                #sam-world-engine .we-explore-score{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin:11px 0 5px}
                #sam-world-engine .we-explore-score strong{font:600 23px/1 Georgia,serif;color:#31475f}
                #sam-world-engine .we-explore-score strong small{display:inline;font:500 10px/1 system-ui;color:#7b8793}
                #sam-world-engine .we-explore-score span{font-size:10px;color:#8b6a33}
                #sam-world-engine .we-explore-bar{height:6px;overflow:hidden;border-radius:999px;background:#e8eceb}
                #sam-world-engine .we-explore-bar>i{display:block;height:100%;border-radius:999px;background:#6f9d8c}
                #sam-world-engine .we-explore-meta{display:flex;flex-wrap:wrap;gap:5px 9px;margin-top:9px;color:#788491;font-size:9px}
                #sam-world-engine .we-explore-card p{margin:8px 0 0;color:#657185;font-size:10px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
                #sam-world-engine .we-area-side{position:sticky;top:0}
                #sam-world-engine .we-area-hero{padding:2px 0 10px;border-bottom:1px solid #e2e7e6}
                #sam-world-engine .we-area-hero small{color:#8a939d;font-size:9px}
                #sam-world-engine .we-area-hero h3{margin:2px 0 8px;font-size:17px}
                #sam-world-engine .we-area-progress{display:grid;grid-template-columns:auto minmax(0,1fr);gap:11px;align-items:center}
                #sam-world-engine .we-area-progress>strong{font:600 31px/1 Georgia,serif;color:#30465f}
                #sam-world-engine .we-area-progress>div>span{display:flex;justify-content:space-between;color:#7b8791;font-size:9px;margin-bottom:5px}
                #sam-world-engine .we-area-progress em{font-style:normal;color:#8b6a33}
                #sam-world-engine .we-area-note{margin-top:10px;padding:9px 10px;border-radius:9px;background:#f5f7f3;color:#647180;font-size:10px;line-height:1.6}
                #sam-world-engine .we-faction-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
                #sam-world-engine .we-faction-card{display:block;width:100%;padding:12px 13px;border:1px solid #d6dfe0;border-radius:11px;background:#fff;text-align:left}
                #sam-world-engine .we-faction-card.active{border-color:#b28a4a;box-shadow:0 0 0 2px #d9b97822}
                #sam-world-engine .we-faction-card .we-card-top h3{font-size:13px}
                #sam-world-engine .we-rep{display:flex;justify-content:space-between;gap:8px;margin:8px 0 4px;font-size:10px;color:#788491}
                #sam-world-engine .we-rep b{color:#8b6a33}
                #sam-world-engine .we-preset-toolbar{position:sticky;top:-1px;z-index:8;display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 0 14px;padding:12px 14px;border:1px solid #c7d2d4;border-radius:13px;background:#fffdf9f2;backdrop-filter:blur(10px);box-shadow:0 8px 22px #22314212}
                #sam-world-engine .we-preset-toolbar>div:first-child{display:flex;flex-direction:column;min-width:0}
                #sam-world-engine .we-preset-toolbar b{font-size:14px;color:#2c3e50}
                #sam-world-engine .we-preset-toolbar small{font-size:10px;color:var(--sub)}
                #sam-world-engine .we-preset-toolbar>div:last-child{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
                #sam-world-engine .we-doc-create{display:grid;grid-template-columns:minmax(180px,1fr) auto auto;gap:8px;margin-bottom:10px}
                #sam-world-engine .we-doc-create input{min-width:0;padding:8px 10px;border:1px solid #d4dcdd;border-radius:9px;background:#fff;color:var(--ink)}
                #sam-world-engine .we-doc-list{display:grid;gap:7px}
                #sam-world-engine .we-doc-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 11px;border:1px solid #d9e1e1;border-radius:10px;background:#fafbf8}
                #sam-world-engine .we-doc-row>div{min-width:0}
                #sam-world-engine .we-doc-row b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                #sam-world-engine .we-doc-row small{display:block;color:var(--sub);font-size:10px;margin-top:2px}
                #sam-world-engine .we-doc-badge{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;background:#e8f1ec;color:#4f7d6d;font:700 9px/1.6 system-ui}
                #sam-world-engine .we-doc-actions{display:flex;gap:5px}
                #sam-world-engine .we-doc-actions button,#sam-world-engine .we-segment-actions button{border:1px solid #d2dbdc;border-radius:7px;background:#fff;padding:5px 8px;color:#556579;font-size:10px}
                #sam-world-engine .we-doc-actions button:hover,#sam-world-engine .we-segment-actions button:hover{border-color:#b28a4a;color:#76592b;background:#fbf4e8}
                #sam-world-engine .we-segment-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;color:var(--sub);font-size:11px}
                #sam-world-engine .we-segment-list{display:grid;gap:10px}
                #sam-world-engine .we-segment{border:1px solid #d3dddd;border-radius:12px;background:#fbfcf9;overflow:hidden}
                #sam-world-engine .we-segment-head{display:grid;grid-template-columns:minmax(140px,1fr) auto auto;gap:8px;align-items:center;padding:9px 10px;border-bottom:1px solid #dce4e4;background:#f1f5f2}
                #sam-world-engine .we-segment-head input{min-width:0;border:0;border-bottom:1px solid #c6d1d2;background:transparent;padding:4px 2px;font-weight:700;color:#31445d}
                #sam-world-engine .we-segment-head input:focus{outline:none;border-bottom-color:#b28a4a}
                #sam-world-engine .we-segment-head small{color:var(--sub);font-size:10px}
                #sam-world-engine .we-segment-actions{display:flex;gap:4px}
                #sam-world-engine .we-segment>summary{padding:12px;cursor:pointer;color:var(--we-ink)}
                #sam-world-engine .we-segment textarea{display:block;width:100%;min-height:170px;height:210px;border:0;border-radius:0;background:#fff;padding:12px 13px;resize:vertical}
                /* ===== 世界引擎独立外观：跟随主神终端六色调；未设置时回退暗夜 ===== */
                ${WORLD_UI_THEME_CSS}
                #sam-world-engine[data-tone]{
                    --ink:var(--we-ink);--sub:var(--we-sub);--line:var(--we-line);--gold:var(--we-gold);--mint:var(--we-mint);
                    --we-chrome-ink:#f7fbff;--we-chrome-sub:#c9d3dd;--we-nav-ink:#d6dee7;
                    --we-chrome-control:#ffffff0d;--we-chrome-control-hover:#ffffff18;--we-chrome-border:#ffffff2d;
                    --we-fs-root:16px;--we-fs-body:15px;--we-fs-small:13px;--we-fs-tiny:13px;--we-fs-control:14px;
                    --we-fs-h1:29px;--we-fs-h2:19px;--we-fs-h3:16px;--we-fs-metric:26px;--we-fs-hero:32px;
                    background:var(--we-shell)!important;color:var(--we-ink)!important;border-color:var(--we-line)!important;
                    font-size:var(--we-fs-root)!important;line-height:1.72!important;text-rendering:optimizeLegibility;-webkit-font-smoothing:auto
                }
                #sam-world-engine[data-font-scale="large"]{
                    --we-fs-root:18px;--we-fs-body:17px;--we-fs-small:15px;--we-fs-tiny:14px;--we-fs-control:16px;
                    --we-fs-h1:33px;--we-fs-h2:22px;--we-fs-h3:18px;--we-fs-metric:30px;--we-fs-hero:35px
                }
                #sam-world-engine[data-font-scale="xlarge"]{
                    --we-fs-root:20px;--we-fs-body:19px;--we-fs-small:17px;--we-fs-tiny:15px;--we-fs-control:18px;
                    --we-fs-h1:36px;--we-fs-h2:24px;--we-fs-h3:20px;--we-fs-metric:34px;--we-fs-hero:39px
                }
                .we-causal{min-width:0;overflow-wrap:anywhere}
                .we-stability{display:flex;align-items:center;justify-content:space-between;gap:12px}
                .we-stability strong{display:block;font-size:var(--we-fs-hero);line-height:1.3;color:var(--we-ink)}
                .we-stability>span{font-size:var(--we-fs-small);color:var(--we-sub);text-align:right}
                .we-causal meter{display:block;width:100%;height:14px;margin:12px 0;accent-color:var(--we-mint)}
                .we-causal meter::-webkit-meter-bar{background:var(--we-card);border:1px solid var(--we-line);border-radius:9px}
                .we-causal meter::-webkit-meter-optimum-value{background:var(--we-mint)}
                .we-offset-heading,.we-offset-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
                .we-offset-heading{margin-top:16px;font-weight:600}
                .we-offset-heading span,.we-offset small{color:var(--we-sub);font-size:var(--we-fs-small)}
                .we-offset{margin-top:10px;padding:12px;border:1px solid var(--we-line);border-radius:12px;background:var(--we-card)}
                .we-offset-head span{flex-shrink:0;font-weight:700;color:var(--we-ink)}
                .we-offset p{margin:8px 0;font-size:var(--we-fs-body)}
                .we-offset-more summary{cursor:pointer;margin-top:12px;color:var(--we-ink)}
                #sam-world-engine[data-tone] header{background:linear-gradient(120deg,var(--we-head),var(--we-nav))!important;color:var(--we-chrome-ink)!important}
                #sam-world-engine[data-tone] .we-brand i{color:var(--we-action)!important}
                #sam-world-engine[data-tone] .we-brand small{color:var(--we-chrome-sub)!important}
                #sam-world-engine[data-tone] header button.we-btn{background:var(--we-chrome-control)!important;border-color:var(--we-chrome-border)!important;color:var(--we-chrome-ink)!important}
                #sam-world-engine[data-tone] header button.we-btn:hover{background:var(--we-chrome-control-hover)!important;border-color:var(--we-chrome-sub)!important}
                #sam-world-engine[data-tone] header button.we-primary{background:var(--we-action)!important;border-color:var(--we-action)!important;color:var(--we-action-ink)!important}
                #sam-world-engine[data-tone] nav{background:var(--we-nav)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] nav button{color:var(--we-nav-ink)!important}
                #sam-world-engine[data-tone] nav button:hover{background:var(--we-chrome-control-hover)!important;color:var(--we-chrome-ink)!important}
                #sam-world-engine[data-tone] nav button[aria-selected=true]{background:var(--we-action)!important;border-color:var(--we-action)!important;color:var(--we-action-ink)!important}
                #sam-world-engine[data-tone] main{background:var(--we-main)!important;color:var(--we-ink)!important}
                #sam-world-engine[data-tone] .we-hero,
                #sam-world-engine[data-tone] .we-section,
                #sam-world-engine[data-tone] .we-world-focus .we-section,
                #sam-world-engine[data-tone] .we-dashboard .we-section{background:var(--we-surface)!important;border-color:var(--we-line)!important;box-shadow:none!important}
                #sam-world-engine[data-tone] .we-card,
                #sam-world-engine[data-tone] .we-kpi,
                #sam-world-engine[data-tone] .we-kpi-compact .we-kpi,
                #sam-world-engine[data-tone] .we-explore-card,
                #sam-world-engine[data-tone] .we-faction-card,
                #sam-world-engine[data-tone] .we-doc-row,
                #sam-world-engine[data-tone] .we-segment,
                #sam-world-engine[data-tone] .we-book{background:var(--we-card)!important;border-color:var(--we-line)!important;color:var(--we-ink)!important}
                #sam-world-engine[data-tone] .we-card:hover,
                #sam-world-engine[data-tone] button.we-card:hover,
                #sam-world-engine[data-tone] .we-explore-card:hover,
                #sam-world-engine[data-tone] .we-faction-card:hover,
                #sam-world-engine[data-tone] .we-brief-row:hover,
                #sam-world-engine[data-tone] .we-person-compact:hover{background:var(--we-card-hover)!important}
                #sam-world-engine[data-tone] .we-card p,
                #sam-world-engine[data-tone] .we-person p,
                #sam-world-engine[data-tone] .we-pulse p,
                #sam-world-engine[data-tone] .we-next-node p,
                #sam-world-engine[data-tone] .we-explore-card p{color:var(--we-sub)!important}
                #sam-world-engine[data-tone] .we-kpi strong,
                #sam-world-engine[data-tone] .we-explore-score strong,
                #sam-world-engine[data-tone] .we-area-progress>strong{color:var(--we-ink)!important}
                #sam-world-engine[data-tone] .we-kpi small,
                #sam-world-engine[data-tone] .we-kpi span,
                #sam-world-engine[data-tone] .we-explore-head small,
                #sam-world-engine[data-tone] .we-explore-meta,
                #sam-world-engine[data-tone] .we-area-hero small{color:var(--we-sub)!important}
                #sam-world-engine[data-tone] .we-tools input,
                #sam-world-engine[data-tone] select,
                #sam-world-engine[data-tone] .we-config-row input,
                #sam-world-engine[data-tone] .we-doc-create input,
                #sam-world-engine[data-tone] .we-segment-head input,
                #sam-world-engine[data-tone] textarea,
                #sam-world-engine[data-tone] .we-setting-input{background:var(--we-input)!important;color:var(--we-ink)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-tools button,
                #sam-world-engine[data-tone] .we-doc-actions button,
                #sam-world-engine[data-tone] .we-segment-actions button,
                #sam-world-engine[data-tone] .we-setting-btn{background:var(--we-card)!important;color:var(--we-ink)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-tools button.active,
                #sam-world-engine[data-tone] .we-setting-btn.active{border-color:var(--we-accent)!important;color:var(--we-accent)!important;background:var(--we-accent-soft)!important}
                #sam-world-engine[data-tone] .we-empty{background:var(--we-card)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-empty b{color:var(--we-ink)!important}
                #sam-world-engine[data-tone] .we-notice{background:var(--we-notice)!important;color:var(--we-ink)!important;border-left-color:var(--we-gold)!important}
                #sam-world-engine[data-tone] footer{background:var(--we-nav)!important;color:var(--we-chrome-sub)!important}
                #sam-world-engine[data-tone] .we-timeline .we-card:before{border-color:var(--we-surface)!important}
                #sam-world-engine[data-tone] .we-timeline-group-title:after{background:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-explore-bar{background:color-mix(in srgb,var(--we-line) 70%,transparent)!important}
                #sam-world-engine[data-tone] .we-explore-bar>i{background:var(--we-mint)!important}
                #sam-world-engine[data-tone] .we-risk-badge{background:var(--we-input)!important;color:var(--we-sub)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-preset-toolbar{background:var(--we-surface)!important;border-color:var(--we-line)!important;box-shadow:none!important}
                #sam-world-engine[data-tone] .we-segment-head{background:var(--we-card)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-book-row,
                #sam-world-engine[data-tone] .we-brief-row,
                #sam-world-engine[data-tone] .we-section-head,
                #sam-world-engine[data-tone] .we-area-hero{border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-next-node>span{background:var(--we-action)!important;color:var(--we-action-ink)!important}
                #sam-world-engine[data-tone] button.we-next-node:hover{background:var(--we-card-hover)!important}
                #sam-world-engine[data-tone] .we-next-node small,
                #sam-world-engine[data-tone] .we-person-copy small,
                #sam-world-engine[data-tone] .we-link-btn,
                #sam-world-engine[data-tone] .we-explore-score span,
                #sam-world-engine[data-tone] .we-area-progress em,
                #sam-world-engine[data-tone] .we-rep b{color:var(--we-gold)!important}
                #sam-world-engine[data-tone] .we-timeline-group-title,
                #sam-world-engine[data-tone] .we-timeline-group-title small,
                #sam-world-engine[data-tone] .we-brief-row>span:last-child,
                #sam-world-engine[data-tone] .we-person-copy em,
                #sam-world-engine[data-tone] .we-area-progress>div>span{color:var(--we-sub)!important}
                #sam-world-engine[data-tone] .we-timeline-group-title small{background:var(--we-card)!important}
                #sam-world-engine[data-tone] .we-preset-toolbar b{color:var(--we-ink)!important}
                #sam-world-engine[data-tone] summary:hover{color:var(--we-accent)!important}
                #sam-world-engine[data-tone] .we-card.is-jump{outline-color:var(--we-action)!important;background:var(--we-accent-soft)!important}
                /* 全面字号系统：字号设置必须作用于整个面板，而不是只影响继承 root 字号的按钮 */
                #sam-world-engine[data-tone] main{font-size:var(--we-fs-body)!important}
                #sam-world-engine[data-tone] .we-brand{font-size:var(--we-fs-h3)!important;line-height:1.2!important}
                #sam-world-engine[data-tone] .we-hero .we-date{font-size:var(--we-fs-h3)!important;line-height:1.45!important}
                #sam-world-engine[data-tone] .we-world-ranks{font-size:var(--we-fs-small)!important}
                #sam-world-engine[data-tone] header button,
                #sam-world-engine[data-tone] nav button,
                #sam-world-engine[data-tone] main button,
                #sam-world-engine[data-tone] main input,
                #sam-world-engine[data-tone] main select,
                #sam-world-engine[data-tone] main textarea{font-size:var(--we-fs-control)!important}
                #sam-world-engine[data-tone] h1{font-size:var(--we-fs-h1)!important;line-height:1.28!important}
                #sam-world-engine[data-tone] h2{font-size:var(--we-fs-h2)!important;line-height:1.35!important}
                #sam-world-engine[data-tone] h3,
                #sam-world-engine[data-tone] .we-explore-head h3,
                #sam-world-engine[data-tone] .we-faction-card .we-card-top h3,
                #sam-world-engine[data-tone] .we-area-hero h3{font-size:var(--we-fs-h3)!important;line-height:1.4!important}
                #sam-world-engine[data-tone] main p,
                #sam-world-engine[data-tone] .we-card p,
                #sam-world-engine[data-tone] .we-person p,
                #sam-world-engine[data-tone] .we-pulse p,
                #sam-world-engine[data-tone] .we-next-node p,
                #sam-world-engine[data-tone] .we-explore-card p,
                #sam-world-engine[data-tone] .we-prose,
                #sam-world-engine[data-tone] .we-area-note,
                #sam-world-engine[data-tone] .we-rep{font-size:var(--we-fs-body)!important;line-height:1.68!important}
                #sam-world-engine[data-tone] .we-muted,
                #sam-world-engine[data-tone] dl,
                #sam-world-engine[data-tone] summary,
                #sam-world-engine[data-tone] .we-meta,
                #sam-world-engine[data-tone] .we-hero .we-date small,
                #sam-world-engine[data-tone] .we-metric small,
                #sam-world-engine[data-tone] .we-section-head small,
                #sam-world-engine[data-tone] .we-date-filter,
                #sam-world-engine[data-tone] .we-brief-row>b,
                #sam-world-engine[data-tone] .we-person-copy strong,
                #sam-world-engine[data-tone] .we-book-title small,
                #sam-world-engine[data-tone] .we-read-state,
                #sam-world-engine[data-tone] .we-segment-toolbar{font-size:var(--we-fs-small)!important}
                #sam-world-engine[data-tone] small,
                #sam-world-engine[data-tone] footer,
                #sam-world-engine[data-tone] .we-brand small,
                #sam-world-engine[data-tone] nav .we-navtitle,
                #sam-world-engine[data-tone] .we-eyebrow,
                #sam-world-engine[data-tone] .we-pill,
                #sam-world-engine[data-tone] .we-change time,
                #sam-world-engine[data-tone] .we-days span,
                #sam-world-engine[data-tone] .we-pulse-mark,
                #sam-world-engine[data-tone] .we-timeline-group-title,
                #sam-world-engine[data-tone] .we-timeline-group-title small,
                #sam-world-engine[data-tone] .we-next-node small,
                #sam-world-engine[data-tone] .we-brief-row>span:last-child,
                #sam-world-engine[data-tone] .we-person-copy small,
                #sam-world-engine[data-tone] .we-person-copy em,
                #sam-world-engine[data-tone] .we-link-btn,
                #sam-world-engine[data-tone] .we-explore-head small,
                #sam-world-engine[data-tone] .we-risk-badge,
                #sam-world-engine[data-tone] .we-explore-score strong small,
                #sam-world-engine[data-tone] .we-explore-score span,
                #sam-world-engine[data-tone] .we-explore-meta,
                #sam-world-engine[data-tone] .we-area-hero small,
                #sam-world-engine[data-tone] .we-area-progress>div>span,
                #sam-world-engine[data-tone] .we-preset-toolbar small,
                #sam-world-engine[data-tone] .we-doc-row small,
                #sam-world-engine[data-tone] .we-doc-badge,
                #sam-world-engine[data-tone] .we-segment-head small,
                #sam-world-engine[data-tone] .we-setting-copy small,
                #sam-world-engine[data-tone] .we-api-grid label,
                #sam-world-engine[data-tone] .we-source-badge{font-size:var(--we-fs-tiny)!important;line-height:1.55!important}
                #sam-world-engine[data-tone] .we-kpi strong,
                #sam-world-engine[data-tone] .we-explore-score strong{font-size:var(--we-fs-metric)!important}
                #sam-world-engine[data-tone] .we-area-progress>strong{font-size:var(--we-fs-hero)!important}
                #sam-world-engine[data-tone] textarea.we-raw{font-size:var(--we-fs-small)!important}
                #sam-world-engine[data-tone] .we-person strong,
                #sam-world-engine[data-tone] .we-preset-toolbar b,
                #sam-world-engine[data-tone] .we-setting-copy b{font-size:var(--we-fs-body)!important}
                #sam-world-engine[data-tone] .we-doc-actions button,
                #sam-world-engine[data-tone] .we-segment-actions button{font-size:var(--we-fs-tiny)!important}
                /* 区域档案说明卡跟随主题，避免暗色下出现刺眼白框和灰字 */
                #sam-world-engine[data-tone] .we-area-note{
                    background:var(--we-input)!important;color:var(--we-ink)!important;border:1px solid var(--we-line)!important;
                    font-weight:500!important
                }
                /* 设置页 */
                #sam-world-engine .we-setting-row{display:grid;grid-template-columns:minmax(150px,1fr) minmax(220px,1.2fr);gap:16px;align-items:center;padding:12px 0;border-bottom:1px solid var(--we-line,var(--line))}
                #sam-world-engine .we-setting-row:last-child{border-bottom:0}
                #sam-world-engine .we-setting-copy b{display:block;font-size:14px}
                #sam-world-engine .we-setting-copy small{display:block;color:var(--we-sub,var(--sub));font-size:11px;margin-top:3px}
                #sam-world-engine .we-setting-actions{display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap}
                #sam-world-engine .we-setting-btn{border:1px solid var(--we-line,var(--line));border-radius:8px;padding:7px 10px}
                #sam-world-engine .we-api-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}
                #sam-world-engine .we-api-grid label{display:flex;flex-direction:column;gap:5px;color:var(--we-sub,var(--sub));font-size:11px}
                #sam-world-engine .we-api-grid label.wide{grid-column:1/-1}
                #sam-world-engine .we-setting-input{width:100%;min-width:0;padding:9px 10px;border:1px solid var(--we-line,var(--line));border-radius:8px}
                #sam-world-engine .we-api-toolbar{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:10px 0}
                #sam-world-engine .we-api-toolbar select,#sam-world-engine .we-api-toolbar input{min-width:160px;flex:1}
                #sam-world-engine .we-source-badge{display:inline-flex;align-items:center;gap:7px;padding:5px 9px;border-radius:999px;border:1px solid var(--we-line,var(--line));background:var(--we-card,#fff);font-size:11px}
                #sam-world-engine .we-source-badge:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--we-mint,var(--mint))}
                #sam-world-engine .we-switch{display:inline-flex;align-items:center;gap:8px}
                #sam-world-engine .we-switch-track{width:42px;height:23px;border-radius:999px;background:var(--we-line,var(--line));padding:3px;transition:background .15s}
                #sam-world-engine .we-switch-track i{display:block;width:17px;height:17px;border-radius:50%;background:#fff;transition:transform .15s}
                #sam-world-engine .we-switch.on .we-switch-track{background:var(--we-accent,var(--gold))}
                #sam-world-engine .we-switch.on .we-switch-track i{transform:translateX(19px)}
                @media(max-width:1100px){
                    #sam-world-engine .we-world-focus{grid-template-columns:1fr}
                    #sam-world-engine .we-dashboard{grid-template-columns:1fr}
                    #sam-world-engine .we-explore-layout{grid-template-columns:1fr}
                    #sam-world-engine .we-area-side{position:static}
                    #sam-world-engine .we-command-side{position:static;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
                    #sam-world-engine .we-command-side>.we-section{margin-bottom:0}
                    #sam-world-engine .we-calendar-layout{grid-template-columns:minmax(220px,260px) minmax(0,1fr)}
                }
                @media(max-width:760px){
                    #sam-world-engine{--we-safe-top:max(env(safe-area-inset-top,0px),24px);--we-safe-right:env(safe-area-inset-right,0px);--we-safe-bottom:env(safe-area-inset-bottom,0px);--we-safe-left:env(safe-area-inset-left,0px);inset:0!important;height:100vh!important;height:100dvh!important;border-radius:0}
                    #sam-world-engine header{padding:var(--we-safe-top) max(12px,var(--we-safe-right)) 0 max(12px,var(--we-safe-left));height:calc(56px + var(--we-safe-top));min-height:calc(56px + var(--we-safe-top));gap:6px}
                    #sam-world-engine .we-brand{font-size:13px;letter-spacing:1px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
                    #sam-world-engine .we-brand small{display:none}
                    #sam-world-engine nav{padding:7px max(9px,var(--we-safe-right)) 7px max(9px,var(--we-safe-left));min-height:46px}
                    #sam-world-engine nav button{padding:7px 10px}
                    #sam-world-engine nav button .we-tab-icon{display:none}
                    #sam-world-engine main{padding:12px max(10px,var(--we-safe-right)) calc(24px + var(--we-safe-bottom)) max(10px,var(--we-safe-left))}
                    #sam-world-engine .we-hero{align-items:flex-start;padding:14px}
                    #sam-world-engine h1{font-size:21px}
                    #sam-world-engine .we-hero .we-date{min-width:105px;font-size:11px}
                    #sam-world-engine .we-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
                    #sam-world-engine .we-explore-grid,#sam-world-engine .we-faction-grid{grid-template-columns:1fr}
                    #sam-world-engine .we-preset-toolbar{align-items:flex-start}
                    #sam-world-engine .we-doc-create{grid-template-columns:1fr 1fr}
                    #sam-world-engine .we-doc-create input{grid-column:1/-1}
                    #sam-world-engine .we-doc-row{grid-template-columns:1fr}
                    #sam-world-engine .we-doc-actions{flex-wrap:wrap}
                    #sam-world-engine .we-segment-head{grid-template-columns:1fr auto}
                    #sam-world-engine .we-segment-head small{display:none}
                    #sam-world-engine .we-segment-actions{grid-column:1/-1}
                    #sam-world-engine .we-command-side{display:block}
                    #sam-world-engine .we-command-side>.we-section{margin-bottom:10px}
                    #sam-world-engine .we-calendar-layout{grid-template-columns:1fr}
                    #sam-world-engine .we-calendar-slot{position:static}
                    #sam-world-engine .we-grid{grid-template-columns:1fr}
                    #sam-world-engine .we-section{padding:13px}
                    #sam-world-engine footer{padding:7px max(10px,var(--we-safe-right)) calc(7px + var(--we-safe-bottom)) max(10px,var(--we-safe-left))}
                    #sam-world-engine footer small{display:none}
                    #sam-world-engine .we-setting-row{grid-template-columns:1fr}
                    #sam-world-engine .we-setting-actions{justify-content:flex-start}
                    #sam-world-engine .we-api-grid{grid-template-columns:1fr}
                    #sam-world-engine .we-api-grid label.wide{grid-column:auto}
                }
                @media(max-height:400px){
                    #sam-world-engine header{height:calc(40px + var(--we-safe-top,0px));min-height:calc(40px + var(--we-safe-top,0px))}
                    #sam-world-engine nav{padding:3px 8px;min-height:36px}
                    #sam-world-engine footer{padding:2px 12px}
                    #sam-world-engine main{padding:8px}
                }
            `;
        return css;
    }
