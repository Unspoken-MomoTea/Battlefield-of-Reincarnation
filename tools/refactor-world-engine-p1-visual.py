from pathlib import Path
import re

path = Path('script/世界推进系统.js')
text = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 exact match, got {count}')
    text = text.replace(old, new, 1)


def sub_once(pattern, replacement, label, flags=0):
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 regex match, got {count}')

old_registry = """    const STATUS_THEME_CONFIG = 'samsara_theme_v2';
    const WORLD_TONE_KEYS = new Set(['night','crimson','indigo','parchment','sakura','matcha']);
    const WORLD_FONT_SCALES = {
        standard:{name:'标准',size:'16px',desc:'正文约14px，辅助字不低于12px'},
        large:{name:'大字',size:'18px',desc:'正文约16px，适合高分屏'},
        xlarge:{name:'特大',size:'20px',desc:'正文约17px，远距离阅读'}
    };
"""
new_registry = """    const STATUS_THEME_CONFIG = 'samsara_theme_v2';
    // 六主题只在这里维护色值。CSS 只消费语义 token，避免羊皮/樱白等主题再堆局部补丁。
    const WORLD_UI_THEMES = Object.freeze({
        night:Object.freeze({scheme:'dark',shell:'#0e1320',main:'#101824',surface:'#151e2c',card:'#1b2636',cardHover:'#213044',input:'#111a27',line:'#344357',ink:'#edf3f8',sub:'#bac6d4',accent:'#9aa8ff',accentSoft:'#9aa8ff24',gold:'#d9b978',mint:'#7dcbbb',head:'#111a27',nav:'#0c1420',notice:'#251f18',action:'#9aa8ff',actionInk:'#111827'}),
        crimson:Object.freeze({scheme:'dark',shell:'#170d12',main:'#1b1016',surface:'#24131a',card:'#301923',cardHover:'#3a1f2b',input:'#180d13',line:'#5b2f3a',ink:'#fff2f5',sub:'#d8b8c0',accent:'#ff7670',accentSoft:'#ff767024',gold:'#ffb347',mint:'#e49aac',head:'#230f16',nav:'#180a10',notice:'#2d1b13',action:'#ff7670',actionInk:'#2a0e13'}),
        indigo:Object.freeze({scheme:'dark',shell:'#0d1024',main:'#11152d',surface:'#171b39',card:'#20254a',cardHover:'#292f5a',input:'#0e1229',line:'#373d72',ink:'#f0f2ff',sub:'#bec3e8',accent:'#8b78ff',accentSoft:'#8b78ff25',gold:'#ffd166',mint:'#65c9c3',head:'#11162f',nav:'#0a0d20',notice:'#29231a',action:'#8b78ff',actionInk:'#101426'}),
        parchment:Object.freeze({scheme:'light',shell:'#e8dcc3',main:'#f1e7d2',surface:'#fff7e7',card:'#f4e6ca',cardHover:'#eddcbc',input:'#fffaf0',line:'#c9ad79',ink:'#392b18',sub:'#6c5432',accent:'#855a16',accentSoft:'#855a1620',gold:'#7a5215',mint:'#4f6f3d',head:'#5c4325',nav:'#6b5030',notice:'#f2dfb9',action:'#d9a441',actionInk:'#2b1a08'}),
        sakura:Object.freeze({scheme:'light',shell:'#f4dce4',main:'#fff0f5',surface:'#fff9fb',card:'#fbe3eb',cardHover:'#f6d8e3',input:'#fffafd',line:'#ddb6c5',ink:'#432532',sub:'#765466',accent:'#a63f69',accentSoft:'#a63f6922',gold:'#8a5624',mint:'#446f62',head:'#6c3148',nav:'#7b3d55',notice:'#f7e2d3',action:'#ee8eb3',actionInk:'#3b1e2a'}),
        matcha:Object.freeze({scheme:'light',shell:'#dcebd4',main:'#eef5e8',surface:'#fbfdf8',card:'#e3efd9',cardHover:'#d8e8cc',input:'#fbfff7',line:'#b7cbaa',ink:'#263823',sub:'#53694f',accent:'#3e7746',accentSoft:'#3e774622',gold:'#73591f',mint:'#39725f',head:'#31563a',nav:'#284630',notice:'#edf0ce',action:'#79b77e',actionInk:'#17311f'})
    });
    const WORLD_TONE_KEYS = new Set(Object.keys(WORLD_UI_THEMES));
    const WORLD_UI_THEME_CSS = Object.entries(WORLD_UI_THEMES).map(([tone,theme])=>{
        const vars=Object.entries(theme).filter(([key])=>key!=='scheme').map(([key,value])=>'--we-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+':'+value).join(';');
        return '#sam-world-engine[data-tone="'+tone+'"]{'+vars+';color-scheme:'+theme.scheme+'}';
    }).join('\\n');
    const WORLD_FONT_SCALES = {
        standard:{name:'标准',size:'16px',desc:'正文约15px，辅助字不低于13px'},
        large:{name:'大字',size:'18px',desc:'正文约17px，辅助字约14-15px'},
        xlarge:{name:'特大',size:'20px',desc:'正文约19px，远距离阅读'}
    };
"""
replace_once(old_registry, new_registry, 'theme registry')

old_theme_lines = """                #sam-world-engine[data-tone=\"night\"]{--we-shell:#0e1320;--we-main:#101824;--we-surface:#151e2c;--we-card:#1b2636;--we-card-hover:#213044;--we-input:#111a27;--we-line:#344357;--we-ink:#edf3f8;--we-sub:#bac6d4;--we-accent:#8f9fff;--we-accent-soft:#8f9fff24;--we-gold:#d9b978;--we-mint:#7dcbbb;--we-head:#111a27;--we-nav:#0c1420;--we-notice:#251f18}
                #sam-world-engine[data-tone=\"crimson\"]{--we-shell:#170d12;--we-main:#1b1016;--we-surface:#24131a;--we-card:#301923;--we-card-hover:#3a1f2b;--we-input:#180d13;--we-line:#5b2f3a;--we-ink:#fff2f5;--we-sub:#d8b8c0;--we-accent:#ff5f57;--we-accent-soft:#ff5f5724;--we-gold:#ffa502;--we-mint:#d8849a;--we-head:#230f16;--we-nav:#180a10;--we-notice:#2d1b13}
                #sam-world-engine[data-tone=\"indigo\"]{--we-shell:#0d1024;--we-main:#11152d;--we-surface:#171b39;--we-card:#20254a;--we-card-hover:#292f5a;--we-input:#0e1229;--we-line:#373d72;--we-ink:#f0f2ff;--we-sub:#bec3e8;--we-accent:#7c5cff;--we-accent-soft:#7c5cff25;--we-gold:#ffd166;--we-mint:#65c9c3;--we-head:#11162f;--we-nav:#0a0d20;--we-notice:#29231a}
                #sam-world-engine[data-tone=\"parchment\"]{--we-shell:#e8dcc3;--we-main:#f1e7d2;--we-surface:#fff7e7;--we-card:#f4e6ca;--we-card-hover:#eddcbc;--we-input:#fffaf0;--we-line:#c9ad79;--we-ink:#392b18;--we-sub:#765f3c;--we-accent:#a8761e;--we-accent-soft:#a8761e20;--we-gold:#a8761e;--we-mint:#6d8a52;--we-head:#5c4325;--we-nav:#6b5030;--we-notice:#f2dfb9}
                #sam-world-engine[data-tone=\"sakura\"]{--we-shell:#f4dce4;--we-main:#fff0f5;--we-surface:#fff9fb;--we-card:#fbe3eb;--we-card-hover:#f6d8e3;--we-input:#fffafd;--we-line:#ddb6c5;--we-ink:#432532;--we-sub:#876373;--we-accent:#e86998;--we-accent-soft:#ff80ab22;--we-gold:#bd7a3b;--we-mint:#6e9f8c;--we-head:#6c3148;--we-nav:#7b3d55;--we-notice:#f7e2d3}
                #sam-world-engine[data-tone=\"matcha\"]{--we-shell:#dcebd4;--we-main:#eef5e8;--we-surface:#fbfdf8;--we-card:#e3efd9;--we-card-hover:#d8e8cc;--we-input:#fbfff7;--we-line:#b7cbaa;--we-ink:#263823;--we-sub:#61735c;--we-accent:#579b5d;--we-accent-soft:#66bb6a22;--we-gold:#99782f;--we-mint:#4d8f77;--we-head:#31563a;--we-nav:#284630;--we-notice:#edf0ce}
"""
replace_once(old_theme_lines, '                ${WORLD_UI_THEME_CSS}\n', 'inline theme values')

replace_once(
"""                    --ink:var(--we-ink);--sub:var(--we-sub);--line:var(--we-line);--gold:var(--we-gold);--mint:var(--we-mint);
                    --we-fs-root:16px;--we-fs-body:14px;--we-fs-small:13px;--we-fs-tiny:12px;--we-fs-control:14px;
                    --we-fs-h1:28px;--we-fs-h2:19px;--we-fs-h3:16px;--we-fs-metric:25px;--we-fs-hero:32px;
""",
"""                    --ink:var(--we-ink);--sub:var(--we-sub);--line:var(--we-line);--gold:var(--we-gold);--mint:var(--we-mint);
                    --we-chrome-ink:#f7fbff;--we-chrome-sub:#c9d3dd;--we-nav-ink:#d6dee7;
                    --we-chrome-control:#ffffff0d;--we-chrome-control-hover:#ffffff18;--we-chrome-border:#ffffff2d;
                    --we-fs-root:16px;--we-fs-body:15px;--we-fs-small:13px;--we-fs-tiny:13px;--we-fs-control:14px;
                    --we-fs-h1:29px;--we-fs-h2:19px;--we-fs-h3:16px;--we-fs-metric:26px;--we-fs-hero:32px;
""",
'base typography and chrome tokens')

replace_once(
"""                #sam-world-engine[data-font-scale=\"large\"]{
                    --we-fs-root:18px;--we-fs-body:16px;--we-fs-small:14px;--we-fs-tiny:13px;--we-fs-control:16px;
                    --we-fs-h1:31px;--we-fs-h2:21px;--we-fs-h3:18px;--we-fs-metric:28px;--we-fs-hero:35px
                }
                #sam-world-engine[data-font-scale=\"xlarge\"]{
                    --we-fs-root:20px;--we-fs-body:17px;--we-fs-small:15px;--we-fs-tiny:14px;--we-fs-control:17px;
                    --we-fs-h1:34px;--we-fs-h2:23px;--we-fs-h3:19px;--we-fs-metric:31px;--we-fs-hero:38px
                }
""",
"""                #sam-world-engine[data-font-scale=\"large\"]{
                    --we-fs-root:18px;--we-fs-body:17px;--we-fs-small:15px;--we-fs-tiny:14px;--we-fs-control:16px;
                    --we-fs-h1:33px;--we-fs-h2:22px;--we-fs-h3:18px;--we-fs-metric:30px;--we-fs-hero:35px
                }
                #sam-world-engine[data-font-scale=\"xlarge\"]{
                    --we-fs-root:20px;--we-fs-body:19px;--we-fs-small:17px;--we-fs-tiny:15px;--we-fs-control:18px;
                    --we-fs-h1:36px;--we-fs-h2:24px;--we-fs-h3:20px;--we-fs-metric:34px;--we-fs-hero:39px
                }
""",
'large typography tokens')

old_chrome = """                #sam-world-engine[data-tone] header{background:linear-gradient(120deg,var(--we-head),var(--we-nav))!important;color:var(--we-ink)!important}
                #sam-world-engine[data-tone] nav{background:var(--we-nav)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] nav button{color:var(--we-sub)!important;font-size:.86em!important}
                #sam-world-engine[data-tone] nav button[aria-selected=true]{background:var(--we-accent)!important;border-color:var(--we-accent)!important;color:#fff!important}
"""
new_chrome = """                #sam-world-engine[data-tone] header{background:linear-gradient(120deg,var(--we-head),var(--we-nav))!important;color:var(--we-chrome-ink)!important}
                #sam-world-engine[data-tone] .we-brand i{color:var(--we-action)!important}
                #sam-world-engine[data-tone] .we-brand small{color:var(--we-chrome-sub)!important}
                #sam-world-engine[data-tone] header button.we-btn{background:var(--we-chrome-control)!important;border-color:var(--we-chrome-border)!important;color:var(--we-chrome-ink)!important}
                #sam-world-engine[data-tone] header button.we-btn:hover{background:var(--we-chrome-control-hover)!important;border-color:var(--we-chrome-sub)!important}
                #sam-world-engine[data-tone] header button.we-primary{background:var(--we-action)!important;border-color:var(--we-action)!important;color:var(--we-action-ink)!important}
                #sam-world-engine[data-tone] nav{background:var(--we-nav)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] nav button{color:var(--we-nav-ink)!important}
                #sam-world-engine[data-tone] nav button:hover{background:var(--we-chrome-control-hover)!important;color:var(--we-chrome-ink)!important}
                #sam-world-engine[data-tone] nav button[aria-selected=true]{background:var(--we-action)!important;border-color:var(--we-action)!important;color:var(--we-action-ink)!important}
"""
replace_once(old_chrome, new_chrome, 'generic chrome rules')

sub_once(
    r"\n                /\* 可读性：旧版 9/10px 文本整体提升 \*/.*?\n                /\* 全面字号系统：字号设置必须作用于整个面板，而不是只影响继承 root 字号的按钮 \*/",
    "\n                /* 全面字号系统：字号设置必须作用于整个面板，而不是只影响继承 root 字号的按钮 */",
    'obsolete fixed readability block',
    re.S,
)

old_font_start = """                #sam-world-engine[data-tone] main{font-size:var(--we-fs-body)!important}
                #sam-world-engine[data-tone] header button,
                #sam-world-engine[data-tone] nav button,
                #sam-world-engine[data-tone] main button,
                #sam-world-engine[data-tone] main input,
                #sam-world-engine[data-tone] main select,
                #sam-world-engine[data-tone] main textarea{font-size:var(--we-fs-control)!important}
"""
new_font_start = """                #sam-world-engine[data-tone] main{font-size:var(--we-fs-body)!important}
                #sam-world-engine[data-tone] .we-brand{font-size:var(--we-fs-h3)!important;line-height:1.2!important}
                #sam-world-engine[data-tone] .we-hero .we-date{font-size:var(--we-fs-h3)!important;line-height:1.45!important}
                #sam-world-engine[data-tone] .we-world-ranks{font-size:var(--we-fs-small)!important}
                #sam-world-engine[data-tone] header button,
                #sam-world-engine[data-tone] nav button,
                #sam-world-engine[data-tone] main button,
                #sam-world-engine[data-tone] main input,
                #sam-world-engine[data-tone] main select,
                #sam-world-engine[data-tone] main textarea{font-size:var(--we-fs-control)!important}
"""
replace_once(old_font_start, new_font_start, 'font coverage')

# Heading/field labels should scale with content rather than remain at old fixed 14px.
replace_once(
"""                #sam-world-engine[data-tone] textarea.we-raw{font-size:var(--we-fs-small)!important}
                #sam-world-engine[data-tone] .we-person strong{font-size:var(--we-fs-body)!important}
""",
"""                #sam-world-engine[data-tone] textarea.we-raw{font-size:var(--we-fs-small)!important}
                #sam-world-engine[data-tone] .we-person strong,
                #sam-world-engine[data-tone] .we-preset-toolbar b,
                #sam-world-engine[data-tone] .we-setting-copy b{font-size:var(--we-fs-body)!important}
""",
'body label font coverage')

# Remove setting-copy b from the small-font selector; it now follows body size.
replace_once(
"""                #sam-world-engine[data-tone] .we-segment-toolbar,
                #sam-world-engine[data-tone] .we-setting-copy b{font-size:var(--we-fs-small)!important}
""",
"""                #sam-world-engine[data-tone] .we-segment-toolbar{font-size:var(--we-fs-small)!important}
""",
'setting label duplicate font selector')

sub_once(
    r"\n                /\* 浅色正文主题仍使用深色顶部铬层：正文 ink/sub 不能直接叠到 header/nav 上 \*/.*?\n                /\* 设置页 \*/",
    "\n                /* 设置页 */",
    'light theme chrome exceptions',
    re.S,
)

old_mobile_tail = """                    #sam-world-engine .we-section{padding:13px}
                    #sam-world-engine footer{padding:7px max(10px,var(--we-safe-right)) calc(7px + var(--we-safe-bottom)) max(10px,var(--we-safe-left))}
                    #sam-world-engine footer small{display:none}
                }
                    #sam-world-engine .we-setting-row{grid-template-columns:1fr}
                    #sam-world-engine .we-setting-actions{justify-content:flex-start}
                    #sam-world-engine .we-api-grid{grid-template-columns:1fr}
                    #sam-world-engine .we-api-grid label.wide{grid-column:auto}
                @media(max-height:400px){
"""
new_mobile_tail = """                    #sam-world-engine .we-section{padding:13px}
                    #sam-world-engine footer{padding:7px max(10px,var(--we-safe-right)) calc(7px + var(--we-safe-bottom)) max(10px,var(--we-safe-left))}
                    #sam-world-engine footer small{display:none}
                    #sam-world-engine .we-setting-row{grid-template-columns:1fr}
                    #sam-world-engine .we-setting-actions{justify-content:flex-start}
                    #sam-world-engine .we-api-grid{grid-template-columns:1fr}
                    #sam-world-engine .we-api-grid label.wide{grid-column:auto}
                }
                @media(max-height:400px){
"""
replace_once(old_mobile_tail, new_mobile_tail, 'mobile settings scope')

old_export = """    if (typeof module !== 'undefined' && module.exports) { module.exports = {SamsaraWorldEngine,applyPatches,parseReply,emptyState,RECORDS,compileWorldResult,normalizeWorldResult,mergeWorldResults,WORLD_RESULT_SCHEMA,projectWorldContext,compactWorldLifecycle,calendarDate,repairExplorationGranularity,sortWorldEvents,eventScheduleLabel,staleActiveEvents,temporalAnomalies,activeAlienActivityRequirements,pruneDeadAlienPeople,extractWorldProse,derivePersonWorldContext,projectHotWorldPeople}; return; }
"""
new_export = """    if (typeof module !== 'undefined' && module.exports) { module.exports = {SamsaraWorldEngine,applyPatches,parseReply,emptyState,RECORDS,compileWorldResult,normalizeWorldResult,mergeWorldResults,WORLD_RESULT_SCHEMA,projectWorldContext,compactWorldLifecycle,calendarDate,repairExplorationGranularity,sortWorldEvents,eventScheduleLabel,staleActiveEvents,temporalAnomalies,activeAlienActivityRequirements,pruneDeadAlienPeople,extractWorldProse,derivePersonWorldContext,projectHotWorldPeople,WORLD_UI_THEMES,WORLD_FONT_SCALES}; return; }
"""
replace_once(old_export, new_export, 'CommonJS theme exports')

path.write_text(text, encoding='utf-8')
print('P1 visual source refactor staged')
