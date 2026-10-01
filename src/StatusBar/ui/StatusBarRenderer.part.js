/* ===== 16. 路径解析(读) ===== */
    function resolvePath(obj, path) {
        if (!path) return obj;
        try {
            if (_ && _.get) return _.get(obj, path);
        } catch(e){}
        return path.split('.').reduce(function(o, k) { return (o == null) ? undefined : o[k]; }, obj);
    }

    /* ===== 17. 主渲染入口 ===== */
    function renderAll() {
        refreshPlayerName();
        // 重建前失焦面板内输入框, 防止ST AutoComplete绑定已移除的输入框报错(getBoundingClientRect on null)
        try {
            var _ae = document.activeElement;
            if (_ae && (_ae.tagName === 'INPUT' || _ae.tagName === 'TEXTAREA')) {
                var _pn = document.getElementById('samsara-panel');
                if (_pn && _pn.contains(_ae)) _ae.blur();
            }
        } catch(_e) {}
        var statData = getStatData();
        var $panel = $('#samsara-panel');
        if (!statData || !statData.角色) {
            // 终端未响应: 顶栏仍提供 刷新/关闭 按钮(刷新复用.sam-icon-btn.refresh, 事件已在bindUIEvents委托)
            $panel.html('<div class="sam-topbar"><div class="tl-info"><div class="tl-time" style="color:var(--sam-sub);">终端未响应</div></div><div class="tl-actions"><div class="sam-icon-btn refresh" title="刷新数据">🔄</div><div class="sam-icon-btn close" title="关闭">✕</div></div></div><div class="sam-empty"><div style="font-size:36px;opacity:0.6;animation:samPulse 2s infinite;">📡</div><div style="margin-top:10px;">因果链尚未接入...</div><div style="font-size:11px;opacity:0.6;">(请等待新剧本初始化或推进时间, 或点右上🔄刷新)</div></div>');
            $('#samsara-ball').removeClass('combat-mode');
            // 仅在"终端未响应"时启动5秒自动刷新定时器; 收到数据正常渲染后由下方清除
            if (!window.samsaraRefreshTimer) {
                window.samsaraRefreshTimer = setInterval(function() {
                    try { if ($('#samsara-panel').hasClass('open') && !isEditMode()) renderAll(); } catch (e) {}
                }, 5000);
            }
            return;
        }
        // 已收到数据: 清除"终端未响应"自动刷新定时器, 避免影响用户滚动/操作与无谓性能消耗
        if (window.samsaraRefreshTimer) { clearInterval(window.samsaraRefreshTimer); window.samsaraRefreshTimer = null; }
        var p = statData.角色;
        var sys = statData.系统状态 || {};
        var world = statData.世界 || {};
        // 新开局检测: 种族为空 + 身份为空数组 + 空间币为0 (已获取信息后判定)
        // → 清除角色立绘 + 所有NPC立绘(避免上一局头像残留到新角色)
        try {
            var raceStr = safeStr(p.种族, '');
            var idArr = Array.isArray(p.身份) ? p.身份 : [];
            var coin = safeNum(p.空间币, 0);
            var freshSig = (raceStr === '' && idArr.length === 0 && coin === 0) ? 'FRESH' : 'PLAY';
            if (freshSig === 'FRESH' && lastReincarnatorSig !== 'FRESH') {
                clearAllPortraits();
            }
            lastReincarnatorSig = freshSig;
        } catch(e) {}
        var isCombat = sys.是否战斗中 === true;
        if (isCombat) $('#samsara-ball').addClass('combat-mode');
        else $('#samsara-ball').removeClass('combat-mode');

        var editMode = isEditMode();
        var html = '';
        // 顶栏
        html += renderTopbar(world, sys, editMode, statData);
        // 中部角色条
        html += renderReincarnatorBar(p, sys, editMode);
        // 底部状态图标条
        html += renderBuffRail(p, editMode);
        // Tab主体
        html += '<div class="sam-main">';
        html += renderTabRail(getCurrentTab());
        html += '<div class="sam-tab-content" id="sam-tab-content"></div>';
        html += '</div>';
        // 编辑模式额外UI
        if (editMode) {
            html += '<div class="sam-edit-badge">编辑模式 · 点击数值就地修改,失焦自动暂存</div>';
            html += '<button class="sam-save-btn">💾 保存</button>';
        }
        // 刷新前保存滚动位置(整个panel重建会丢失容器scrollTop)
        var $oldContent = $('#sam-tab-content');
        var savedScrollTop = ($oldContent.length ? ($oldContent[0].scrollTop || 0) : 0);
        $panel.html(html);
        renderTabContent(getCurrentTab());
        // 同Tab刷新: 同步恢复滚动位置(避免重建后先渲染顶部再跳回中间的抖动)
        // 注: renderTabContent 内读到的 scrollTop 是新空容器的0, 故须用此处的 savedScrollTop
        if (savedScrollTop > 0) {
            var $newContent = $('#sam-tab-content');
            if ($newContent.length) {
                // 同步设置(内容已填入, 高度通常已定型); rAF兜底确保布局完成后再校正一次
                try { $newContent[0].scrollTop = savedScrollTop; } catch(e){}
                var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
                if (raf) raf(function(){ try { $newContent[0].scrollTop = savedScrollTop; } catch(e){} });
            }
        }
    }

    function shouldShowSettlementButton(sd) {
        var sys = (sd && sd.系统状态) || {};
        return sys.是否在主神空间 === false && sys.是否战斗中 !== true;
    }

    /* ===== 18. 顶栏 ===== */
    function renderTopbar(world, sys, editMode, sd) {
        var time = safeStr(world.时间, '未知时间');
        var place = safeStr(world.地点, '未知地点');
        if (editMode) {
            time = editInput('世界.时间', time, 'text');
            place = editInput('世界.地点', place, 'text');
        }
        // 主神空间显示“选择世界”；副本内非战斗时常驻显示“结算任务”，不判断任务是否完成。
        var worldBtn = '';
        if (sys && sys.是否在主神空间 === true && sys.是否战斗中 !== true) {
            worldBtn = '<div class="sam-icon-btn choose-world" title="选择世界" data-choose-world>🌐选择世界</div>';
        }
        var settlementBtn = '';
        if (shouldShowSettlementButton(sd)) {
            settlementBtn = '<div class="sam-icon-btn choose-world mission-settle" title="结算任务" data-mission-settle>📋结算任务</div>';
        }
        return '<div class="sam-topbar">'
            + '<div class="tl-info"><div class="tl-time">🕒 '+time+'</div><div class="tl-place">📍 '+place+'</div></div>'
            + '<div class="tl-actions">'
            + worldBtn
            + settlementBtn
            + '<div class="sam-icon-btn refresh" title="刷新">🔄</div>'
            + '<div class="sam-icon-btn settings '+(editMode?'edit-on':'')+'" title="设置">⚙️</div>'
            + '<div class="sam-icon-btn close" title="关闭">✕</div>'
            + '</div></div>';
    }

    /* ===== 19. 角色条(左头像列+层级/种族/形态 / 右HP+EP+THP三栏 纯色) ===== */
    var SAM_PORTRAIT_KEY = 'samsara_reincarnator_portrait';
    var SAM_NPC_PORTRAIT_PREFIX = 'samsara_npc_portrait_';
    // 角色签名: 用于检测新开局(种族空+身份空+空间币0)→清除旧立绘
    var lastReincarnatorSig = null;
    // <details>折叠状态记忆: key=summary纯文本, value=true(展开)/false(折叠); 跨刷新保持
    var detailsOpenState = {};
    // 清除角色立绘 + 所有NPC立绘(localStorage中以SAM_NPC_PORTRAIT_PREFIX开头的键)
    function clearAllPortraits() {
        try {
            localStorage.removeItem(SAM_PORTRAIT_KEY);
            var keysToRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf(SAM_NPC_PORTRAIT_PREFIX) === 0) keysToRemove.push(k);
            }
            keysToRemove.forEach(function(k){ try { localStorage.removeItem(k); } catch(e){} });
            try { console.log('%c[主神终端] 🧹 检测到新开局, 已清除全部旧立绘 ('+(1+keysToRemove.length)+'个)', 'color:#fbbf24'); } catch(e){}
        } catch(e) { try { console.warn('[主神终端] 清除立绘失败:', e.message); } catch(x){} }
    }
    function getReincarnatorPortrait() {
        try { return localStorage.getItem(SAM_PORTRAIT_KEY) || ''; } catch(e) { return ''; }
    }
    function saveReincarnatorPortrait(dataUrl) {
        try {
            if (dataUrl) localStorage.setItem(SAM_PORTRAIT_KEY, dataUrl);
            else localStorage.removeItem(SAM_PORTRAIT_KEY);
        } catch(e) { try { console.warn('[主神终端] 立绘存储失败:', e.message); } catch(x){} }
        closeModal();
        renderAll();
    }
    // NPC立绘(localStorage, 以名称为键; 独立于角色)
    function getNpcPortrait(name) {
        if (!name) return '';
        try { return localStorage.getItem(SAM_NPC_PORTRAIT_PREFIX + name) || ''; } catch(e) { return ''; }
    }
    function saveNpcPortrait(name, dataUrl) {
        if (!name) return;
        try {
            if (dataUrl) localStorage.setItem(SAM_NPC_PORTRAIT_PREFIX + name, dataUrl);
            else localStorage.removeItem(SAM_NPC_PORTRAIT_PREFIX + name);
        } catch(e) { try { console.warn('[主神终端] NPC立绘存储失败:', e.message); } catch(x){} }
        closeModal();
        renderAll();
    }
    // 立绘放大查看器
    function showPortraitViewer(url, label) {
        var pv = document.getElementById('samsara-portrait-viewer');
        if (!pv || !url) return;
        var img = document.getElementById('sam-pv-img');
        var lbl = document.getElementById('sam-pv-label');
        if (img) img.src = url;
        if (lbl) lbl.textContent = label || '';
        pv.classList.add('show');
    }
    // 自定义立绘上传弹窗(角色/NPC通用; name为角色时存SAM_PORTRAIT_KEY, 否则存NPC键)
    function openPortraitUpload(name) {
        var isReincarnator = (!name || name === '角色');
        var title = isReincarnator ? '自定义角色立绘' : ('自定义立绘 · ' + name);
        var body = '<div style="display:flex;gap:8px;margin-bottom:10px;">'
            + '<input type="text" id="sam-portrait-url" placeholder="粘贴图片URL..." style="flex:1;font-size:13px;padding:8px;background:var(--sam-input-bg);color:var(--sam-text);border:1px solid var(--sam-border);border-radius:3px;">'
            + '</div>'
            + '<div style="display:flex;gap:8px;">'
            + '<button type="button" id="sam-portrait-url-btn" style="flex:1;padding:8px;cursor:pointer;background:var(--sam-accent);color:#fff;border:none;border-radius:3px;font-weight:bold;">📥 载入链接</button>'
            + '<button type="button" id="sam-portrait-file-btn" style="flex:1;padding:8px;cursor:pointer;background:var(--sam-accent);color:#fff;border:none;border-radius:3px;font-weight:bold;">📂 选择文件</button>'
            + '</div>'
            + '<input type="file" id="sam-portrait-file" accept="image/*" style="display:none;">'
            + '<div style="margin-top:10px;"><button type="button" id="sam-portrait-clear-btn" style="width:100%;padding:8px;cursor:pointer;background:rgba(40,15,10,0.6);color:var(--sam-hp);border:1px solid var(--sam-border);border-radius:3px;font-weight:bold;">🗑️ 清除自定义立绘</button></div>'
            + '<div style="margin-top:8px;font-size:11px;color:var(--sam-sub);">本地图片不做大小限制(仅受浏览器存储上限约束)。</div>';
        showModal(title, body);
        var doSave = function(u) { isReincarnator ? saveReincarnatorPortrait(u) : saveNpcPortrait(name, u); };
        $('#sam-portrait-url-btn').off('click.samPt').on('click.samPt', function() {
            var u = ($('#sam-portrait-url').val() || '').trim();
            if (!u) return;
            doSave(u);
        });
        $('#sam-portrait-file-btn').off('click.samPt').on('click.samPt', function() { $('#sam-portrait-file').click(); });
        $('#sam-portrait-file').off('change.samPt').on('change.samPt', function() {
            var f = this.files && this.files[0];
            if (!f) return;
            var rd = new FileReader();
            rd.onload = function(ev) { doSave(ev.target.result); };
            rd.readAsDataURL(f);
        });
        $('#sam-portrait-clear-btn').off('click.samPt').on('click.samPt', function() { doSave(''); });
    }
    function openReincarnatorPortraitUp() { openPortraitUpload('角色'); }
    function renderReincarnatorBar(p, sys, editMode) {
        var maxHp = safeNum(p.HP_MAX, 1), curHp = safeNum(p.HP, 0), curThp = safeNum(p.THP, 0);
        var maxEp = safeNum(p.EP_MAX, 1), curEp = safeNum(p.EP, 0);
        var hpPct = Math.min(100, Math.max(0, (curHp/maxHp)*100));
        var epPct = Math.min(100, Math.max(0, (curEp/maxEp)*100));
        // 注: THP 是临时护盾/额外生命值, 无上限概念, 不渲染进度条, 仅显示纯数值
        // 层级显示: 形态激活且形态层级>自身时显示形态层级(仅显示); 编辑框仍绑定真实自身层级避免写回污染
        var dispRaw = displayTierRaw(p);
        var tier = tierRomanOf(dispRaw); var tierQ = tierQOfClass(dispRaw);
        var ownTier = tierRomanOf(p.层级);   // 编辑模式输入框用真实自身层级
        var race = safeStr(p.种族, '人类');
        var cf = p.当前形态 || {};
        var formActive = (cf.激活 === true && safeStr(cf.名称));
        // 战斗状态徽章: 平时隐藏, 进入战斗(系统状态.是否战斗中)时显示, 附当前轮次
        var combatBadge = '';
        if (sys && sys.是否战斗中 === true) {
            var combatRound = safeNum(sys.当前轮次, 0);
            combatBadge = '<div class="sam-reincarnator-combat">⚔️ 战斗中'+(combatRound > 0 ? ' · 第'+combatRound+'轮' : '')+'</div>';
        }
        // 顶部排版: 竖排四行 战斗徽章(战斗时) / 层级 / 种族 / 形态标签(激活时)
        var tierField = (editMode && !isReadonlyPath('角色.层级')) ? editInput('角色.层级', ownTier, 'text') : '<span class="sam-reincarnator-tier-num">'+esc(tier)+'</span><span class="sam-reincarnator-tier-suf">级</span>';
        var raceField = editMode ? editInput('角色.种族', race, 'text') : esc(race);
        var formField = '';
        if (formActive) {
            // 当前形态由能力面板"激活按钮"统一管理, 修改模式下也不可手动编辑名称
            formField = '<div class="sam-reincarnator-form">🌀 <span class="sam-reincarnator-form-name">'+esc(safeStr(cf.名称))+'</span></div>';
        }
        // 头像: 自定义立绘优先, 否则占位符; 不管有无图, 点击框体均弹自定义立绘框
        var portraitUrl = getReincarnatorPortrait();
        if (portraitUrl) {
            var avatarHtml = '<div class="sam-avatar" data-portrait="'+esc(portraitUrl)+'">'
                + '<img src="'+esc(portraitUrl)+'" alt="立绘">'
                + '</div>';
        } else {
            var avatarHtml = '<div class="sam-avatar empty">'
                + '<div class="sam-ava-ph"><span class="sam-ava-ico">📷</span><span class="sam-ava-hint">点击设置<br>立绘</span></div>'
                + '</div>';
        }
        // HP/EP/THP 三栏(编辑模式下数字可改,HP_MAX/EP_MAX只读)
        var hpNum = editMode ? editInput('角色.HP', curHp, 'number') : (curHp + ' / ' + maxHp);
        var epNum = editMode ? editInput('角色.EP', curEp, 'number') : (curEp + ' / ' + maxEp);
        var thpNum = editMode ? editInput('角色.THP', curThp, 'number') : curThp;
        return '<div class="sam-reincarnator">'
            + '<div class="sam-reincarnator-left">'+avatarHtml
            + '<div class="sam-reincarnator-text">'+combatBadge
            + '<div class="sam-reincarnator-tier q-'+tierQ+'">'+tierField+'</div>'
            + '<div class="sam-reincarnator-race">'+raceField+'</div>'
            + formField+'</div></div>'
            + '<div class="sam-reincarnator-bars">'
            + '<div class="stat-bar-box"><div class="stat-labels"><span style="color:var(--sam-hp)">HP</span><span>'+hpNum+'</span></div><div class="bar-track"><div class="bar-fill fill-hp" style="width:'+hpPct+'%;"></div></div></div>'
            + '<div class="stat-bar-box"><div class="stat-labels"><span style="color:var(--sam-ep)">EP</span><span>'+epNum+'</span></div><div class="bar-track"><div class="bar-fill fill-ep" style="width:'+epPct+'%;"></div></div></div>'
            + '<div class="sam-thp-row"><div class="stat-labels"><span style="color:var(--sam-thp)">THP (临时护盾/额外生命值)</span><span>'+thpNum+'</span></div></div>'
            + '</div></div>';
    }

    /* ===== 20. 状态按钮条(状态名+持续时间, 点击弹二级详情) ===== */
    function renderBuffRail(p, editMode) {
        var buffs = p.状态 || {};
        var keys = Object.keys(buffs);
        // 无状态时不渲染任何占位,直接返回空
        if (keys.length === 0) return '';
        var chips = '';
        keys.forEach(function(k) {
            var b = buffs[k] || {};
            var type = safeStr(b.类型, '增益');
            var dur = safeStr(b.持续, '');
            var path = '角色.状态.'+k;
            // 按钮显示: 状态名 + 持续时间(若有)
            var durHtml = dur ? '<span class="sam-buff-dur">⏳ '+esc(dur)+'</span>' : '';
            var label = (editMode ? '📝 ' : '') + esc(k);
            // 编辑模式: 追加删除按钮(复用sam-fc-del-btn事件 → 二级确认 → 写回MVU删除 → 刷新; stopPropagation防误触详情弹窗)
            var delBtn = editMode ? '<button type="button" class="sam-fc-del-btn sam-buff-del" data-del-path="'+esc(path)+'" title="删除该状态">✕</button>' : '';
            chips += '<div class="sam-buff-chip '+esc(type)+(editMode?' is-edit':'')+'" data-path="'+esc(path)+'" data-name="'+esc(k)+'">'
                + '<span class="sam-buff-name">'+label+'</span>'+durHtml+delBtn+'</div>';
        });
        return '<div class="sam-buff-rail">'+chips+'</div>';
    }

    /* ===== 21. Tab导航 ===== */
    function renderTabRail(curTab) {
        var tabs = [
            {key:'mission', label:'任务', icon:'📜'},
            {key:'info', label:'信息', icon:'📋'},
            {key:'hold', label:'持有', icon:'🎒'},
            {key:'blood', label:'能力', icon:'🧬'},
            {key:'relation', label:'关系', icon:'👥'},
            {key:'asset', label:'经营', icon:'🏗️'},
            {key:'rumor', label:'传闻', icon:'📰'},
            {key:'world', label:'世界', icon:'🌍'},
            {key:'shop', label:'商城', icon:'🛒'}
        ];
        var html = '<div class="sam-tab-rail">';
        tabs.forEach(function(t) {
            html += '<div class="sam-tab-btn '+(t.key===curTab?'active':'')+'" data-tab="'+t.key+'">'+t.icon+'<br>'+t.label+'</div>';
        });
        html += '</div>';
        return html;
    }

    /* ===== 22. Tab内容路由 =====
       同一Tab刷新(非切换)时保持滚动位置; 切换Tab时回到顶部 */
    var lastRenderedTab = null;
    function renderTabContent(tab) {
        var $c = $('#sam-tab-content');
        if (!$c.length) return;
        var sameTab = (tab === lastRenderedTab);
        var savedScroll = sameTab ? ($c[0].scrollTop || 0) : 0;
        var sd = getStatData();
        if (!sd) { $c.html('<div class="sam-empty">无数据</div>'); lastRenderedTab = tab; return; }
        var html = '';
        switch (tab) {
            case 'mission': html = renderMissionTab(sd); break;
            case 'info': html = renderInfoTab(sd); break;
            case 'hold': html = renderHoldTab(sd); break;
            case 'blood': html = renderBloodTab(sd); break;
            case 'relation': html = renderRelationTab(sd); break;
            case 'asset': html = renderAssetTab(sd); break;
            case 'rumor': html = renderRumorTab(sd); break;
            case 'world':
                var activeWorldEngine = GS_PARENT.Samsara && GS_PARENT.Samsara.worldEngine;
                html = (activeWorldEngine && typeof activeWorldEngine.isConfigured === 'function' && activeWorldEngine.isConfigured())
                    ? '<div class="sam-empty">世界推进已开启，请点击左侧「世界」进入独立世界引擎。</div>'
                    : renderWorldTab(sd);
                break;
            case 'shop': html = renderShopTab(sd); break;
            default: html = '<div class="sam-empty">未知Tab</div>';
        }
        $c.html(html);
        // 还原<details>折叠状态: 按summary文本(剥离数量括号)查detailsOpenState, 覆盖默认open
        // 必须同步执行(在滚动恢复前), 因open属性不依赖reflow时序
        if (Object.keys(detailsOpenState).length) {
            $c.find('details').each(function() {
                var $d = $(this);
                var raw = $d.children('summary').first().text().trim();
                var key = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
                if (key && Object.prototype.hasOwnProperty.call(detailsOpenState, key)) {
                    $d.prop('open', !!detailsOpenState[key]);
                }
            });
        }
        // 同Tab刷新: 同步恢复滚动位置(切Tab时sameTab=false, 天然保持顶部)
        // 注: renderAll路径下此处savedScroll=0(新空容器), 恢复由renderAll用savedScrollTop处理
        if (sameTab && savedScroll > 0) {
            try { $c[0].scrollTop = savedScroll; } catch(e){}
        }
        lastRenderedTab = tab;
    }

    /* ===== 23. Tab: 任务 ===== */
    /* 副本成就难度: 写死1~6星, 任何值强制归一为★数(数字1~6 或 数★个数, 越界截断, 无★默认1星) */
    function achDiffStars(v) {
        var s = safeStr(v, '').trim();
        var n = /^[1-6]$/.test(s) ? parseInt(s, 10) : (s.match(/★/g) || []).length;
        if (n < 1) n = 1;
        if (n > 6) n = 6;
        return '★★★★★★'.slice(0, n);
    }
    function renderMissionTab(sd) {
        var m = sd.任务 || {};
        var list = m.列表 || {};
        var kills = m.击杀 || {};
        var isSingleWorld = (sd.设置 && sd.设置.单一世界 === true);
        var editMode = isEditMode();
        var html = '';
        // 任务列表
        var tHtml = '';
        var listKeys = Object.keys(list);
        var taskDoneCnt = 0;   // 可交付/可结算 计为完成
        var taskFailCnt = 0;   // 失败 单独计数
        if (listKeys.length === 0) tHtml += '<div class="sam-empty">[无任务]</div>';
        else {
            tHtml += '<div class="sam-list-1col">';
            listKeys.forEach(function(k) {
                var q = list[k] || {};
                var path = '任务.列表.'+k;
                // 难度徽章(任务卡标题最右显示): 用品质色板, 复用 sam-fc-q 样式; 无难度时不渲染
                var diffRaw = safeStr(q.难度, '');
                var diffQ = parseRarity(diffRaw);
                var diffBadge = diffRaw ? '<div class="sam-fc-q q-'+diffQ+'" title="难度">'+esc(diffQ)+'</div>' : '';
                // 编辑模式: 标题区追加删除按钮(挂 data-del-path, 复用通用删除事件)
                var delBtn = editMode ? samDelBtn(path, editMode, '删除该任务') : '';
                var headExtra = delBtn + diffBadge;
                // 状态行: editSelect/editInput 返回 HTML, 不能再走 fcRow(会二次转义导致乱码)
                var statusVal = safeStr(q.状态, '进行中');
                if (statusVal === '可交付' || statusVal === '可结算') taskDoneCnt++;
                else if (statusVal === '失败') taskFailCnt++;
                var statusCell = editMode
                    ? editSelect(path+'.状态', ['进行中','可交付','可结算','失败'], statusVal)
                    : esc(statusVal);
                var statusRow = '<div class="sam-row"><span class="k">状态</span><span class="v">'+statusCell+'</span></div>';
                var rows = '';
                rows += fcRow('委托方', q.委托方, path+'.委托方', editMode);
                rows += statusRow;
                rows += fcRow('目标', q.目标, path+'.目标', editMode);
                rows += fcRow('奖励', q.奖励, path+'.奖励', editMode);
                rows += fcRow('交付', q.交付, path+'.交付', editMode);
                var body = fcRow('惩罚', q.惩罚, path+'.惩罚', editMode);
                tHtml += fullCard('', k, rows, body, headExtra);
            });
            tHtml += '</div>';
        }
        var taskTitle = '📜 任务列表 (完成 '+taskDoneCnt+'/'+listKeys.length+')';
        if (taskFailCnt > 0) taskTitle += ' · 失败 '+taskFailCnt;
        html += secBlock(taskTitle, tHtml, listKeys.length > 0);
        // 单一世界完全隐藏副本成就；多世界模式照常显示并即时发放首次达成奖励
        if (!isSingleWorld) {
            var ach = m.副本成就 || {};
            var achKeys = Object.keys(ach);
            var achDoneCnt = 0;
            achKeys.forEach(function(k) {
                var st = safeStr(ach[k] && ach[k].状态);
                if (st === '已达成') achDoneCnt++;
            });
            var aHtml = '';
            if (achKeys.length === 0) {
                aHtml += '<div class="sam-empty">[无副本成就]</div>';
            } else {
                aHtml += '<div class="sam-list-1col">';
                achKeys.forEach(function(k) {
                    var a = ach[k] || {};
                    var path = '任务.副本成就.'+k;
                    var statusVal = safeStr(a.状态, '未达成') || '未达成';
                    var done = statusVal === '已达成';
                    // 编辑模式: 标题区追加删除按钮(挂 data-del-path, 复用通用删除事件)
                    var delBtn = editMode ? samDelBtn(path, editMode, '删除该成就') : '';
                    // 已达成: 头部金色✓徽章 + 卡片金色描边(一眼区分达成进度)
                    var doneChip = done ? '<span class="sam-ach-done-chip">✓ '+esc(statusVal)+'</span>' : '';
                    var headExtra = delBtn + doneChip;
                    // 状态行: editSelect 返回 HTML, 不能再走 fcRow(会二次转义导致乱码)
                    var statusCell = editMode
                        ? editSelect(path+'.状态', ['未达成','已达成'], statusVal)
                        : esc(statusVal);
                    var statusRow = '<div class="sam-row"><span class="k">状态</span><span class="v">'+statusCell+'</span></div>';
                    var rows = '';
                    rows += statusRow;
                    // 难度: 写死★~★★★★★★ 六档下拉(编辑写回★数), 显示态强制★数
                    var diffVal = achDiffStars(a.难度);
                    var diffCell = editMode
                        ? editSelect(path+'.难度', ['★','★★','★★★','★★★★','★★★★★','★★★★★★'], diffVal)
                        : esc(diffVal);
                    rows += '<div class="sam-row"><span class="k">难度</span><span class="v">'+diffCell+'</span></div>';
                    rows += fcRow('奖励', a.奖励, path+'.奖励', editMode);
                    var body = fcRow('说明', a.说明, path+'.说明', editMode);
                    aHtml += '<div class="sam-ach-item'+(done?' done':'')+'">'+fullCard('', k, rows, body, headExtra)+'</div>';
                });
                aHtml += '</div>';
            }
            html += secBlock('🏅 副本成就 (达成 '+achDoneCnt+'/'+achKeys.length+')', aHtml, achKeys.length > 0);
        }
        // 击杀统计(键用罗马数字Ⅰ~Ⅸ读取MVU数据库; CSS着色类用对应品质字母F~SSS)
        var kHtml = '<div class="sam-grid">';
        ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'].forEach(function(q) {
            var v = safeNum(kills[q], 0);
            var path = '任务.击杀.'+q;
            var qc = tierQOfClass(q);       // 罗马数字→品质字母(F~SSS)用于CSS着色类
            kHtml += '<div class="sam-card q-'+qc+'"><div class="sam-card-title">'+q+'</div><div class="sam-card-meta">'+(editMode ? editInput(path, v, 'number') : v)+' 击杀</div></div>';
        });
        kHtml += '</div>';
        // 击杀奖励说明(参考衍生属性减伤率说明面板样式)
        kHtml += '<div style="margin-top:8px;padding:8px 10px;background:var(--sam-hover);border:1px solid var(--sam-border);border-left:3px solid var(--sam-accent);border-radius:6px;font-size:11px;line-height:1.7;color:var(--sam-sub);">'
            + '<div style="color:var(--sam-accent);font-weight:bold;margin-bottom:3px;">💰 击杀奖励说明</div>'
            + '<div>目标低于自身层级 <b style="color:var(--sam-text);">-2级</b> 的击杀不予记录</div>'
            + '<div style="margin-top:3px;">各阶位击杀单价（空间币）：</div>'
            + '<div style="color:var(--sam-text);margin-top:2px;letter-spacing:0.3px;">Ⅰ:10　Ⅱ:50　Ⅲ:250　Ⅳ:1200　Ⅴ:5000　Ⅵ:2万　Ⅶ:8万　Ⅷ:32万　Ⅸ:128万</div>'
            + '<div style="margin-top:3px;">击杀奖励 = Σ(单价 × 击杀数)，上限为任务基础收益 × 10</div>'
            + (!isSingleWorld ? '<div style="margin-top:3px;">跨世界额外收益：<b style="color:var(--sam-text);">世界探索</b>(上限×300%) 与 <b style="color:var(--sam-text);">势力羁绊</b>(上限×300%) 附加收益通常高于击杀奖励</div>' : '')
            + '</div>';
        html += secBlock('⚔️ 击杀统计', kHtml);
        return html;
    }

    /* 层级进度条: 普升只读取角色自身层级；段位累计≥24后可走试炼或源力灌注两条路径。 */
    function validateTrialAdvancement(sd, expectedNext) {
        if (!sd || !sd.角色) return {error:'角色数据未就绪'};
        var sys = sd.系统状态 || {};
        if (sys.是否战斗中 === true) return {error:'战斗中不能晋升'};
        if (sys.试炼已完成 !== true) return {error:'试炼尚未结算完成，或本次晋升资格已经使用'};
        var current = normalizeLifeTier(sd.角色.层级);
        var index = TIER_ROMAN.indexOf(current);
        if (index < 0 || index >= TIER_ROMAN.length - 1) return {error:'当前层级无法继续晋升'};
        var next = TIER_ROMAN[index + 1];
        if (expectedNext && expectedNext !== next) return {error:'层级已变化，请刷新后重试'};
        return {currentTier:current,nextTier:next};
    }
    function renderTierProgressBar(p, fa, sys) {
        var lifeTier = normalizeLifeTier(p && p.层级);
        var curTier = tierQOfClass(lifeTier);
        var attrs = fa || p.最终属性 || {};
        var score = calcTrialScore(attrs, lifeTier);
        var idx = TIER_ROMAN.indexOf(lifeTier);
        if (idx < 0) idx = 0;
        var isMax = (idx >= TIER_ROMAN.length - 1);
        var pct = isMax ? 100 : Math.max(0, Math.min(100, Math.floor((score / TRIAL_SCORE_THRESHOLD) * 100)));
        var advBtnHtml = '';
        var st = sys || {};
        var canTrial = (st.是否可试炼 === true);
        var trialDone = (st.试炼已完成 === true);
        if (!isMax && trialDone) {
            advBtnHtml = '<button type="button" class="sam-tier-adv-btn start" data-tier-act="start" data-tier-next="'+esc(TIER_ROMAN[idx+1])+'">✦ 开始进阶</button>';
        } else if (!isMax && canTrial) {
            advBtnHtml = '<div class="sam-tier-actions">'
                + '<button type="button" class="sam-tier-adv-btn apply" data-tier-act="apply" data-tier-next="'+esc(TIER_ROMAN[idx+1])+'">☠ 申请进阶</button>'
                + '<button type="button" class="sam-tier-infuse-btn" data-tier-target="角色">✧ 源力灌注</button>'
                + '</div>';
        }
        var leftHtml = '<div class="sam-tier-side q-'+curTier+'">'+esc(TIER_ROMAN[idx])+'</div>';
        var rightHtml = isMax
            ? '<div class="sam-tier-side max">MAX</div>'
            : '<div class="sam-tier-side next q-'+TIER_QUALITY[idx+1]+'">'+esc(TIER_ROMAN[idx+1])+'</div>';
        var midHtml = '<div class="sam-tier-mid">'
            + '<div class="sam-tier-sum"><span>段位累计</span><span class="v">'+score+' / '+TRIAL_SCORE_THRESHOLD+'</span></div>'
            + '<div class="sam-tier-bar"><div class="bar-fill" style="width:'+pct+'%;"></div></div>'
            + advBtnHtml
            + '</div>';
        return '<div class="sam-tier-prog">'+leftHtml+midHtml+rightHtml+'</div>';
    }

    /* 队友段位累计：满24点时提供源力灌注，不建立NPC专属试炼状态。 */
    function renderNpcTierProgressBar(n, name) {
        if (!n || n.是否队友 !== true) return '';
        var lifeTier = normalizeLifeTier(n.层级);
        var idx = TIER_ROMAN.indexOf(lifeTier);
        if (idx < 0) idx = 0;
        var isMax = (idx >= TIER_ROMAN.length - 1);
        var score = calcTrialScore(n.最终属性 || {}, lifeTier);
        var pct = isMax ? 100 : Math.max(0, Math.min(100, Math.floor((score / TRIAL_SCORE_THRESHOLD) * 100)));
        var btn = (!isMax && score >= TRIAL_SCORE_THRESHOLD)
            ? '<button type="button" class="sam-tier-infuse-btn" data-tier-target="'+esc(name)+'">✧ 源力灌注</button>'
            : '';
        var left = '<div class="sam-tier-side q-'+TIER_QUALITY[idx]+'">'+esc(lifeTier)+'</div>';
        var right = isMax
            ? '<div class="sam-tier-side max">MAX</div>'
            : '<div class="sam-tier-side next q-'+TIER_QUALITY[idx+1]+'">'+esc(TIER_ROMAN[idx+1])+'</div>';
        var mid = '<div class="sam-tier-mid">'
            + '<div class="sam-tier-sum"><span>段位累计</span><span class="v">'+score+' / '+TRIAL_SCORE_THRESHOLD+'</span></div>'
            + '<div class="sam-tier-bar"><div class="bar-fill" style="width:'+pct+'%;"></div></div>'
            + (btn ? '<div class="sam-tier-actions">'+btn+'</div>' : '')
            + '</div>';
        return '<div class="sam-tier-prog npc">'+left+mid+right+'</div>';
    }

    /* ===== 24. Tab: 信息(角色详情) ===== */
    function renderInfoTab(sd) {
        var p = sd.角色 || {};
        var editMode = isEditMode();
        var html = '';
        // 角色信息
        var infoHtml = '';
        var fields = [
            {k:'身份', path:'角色.身份', type:'text', arr:true}
        ];
        fields.forEach(function(f) {
            var v = resolvePath(sd, f.path);
            var display;
            if (f.readonly || isReadonlyPath(f.path)) {
                display = '<span class="sam-edit-readonly">'+esc(Array.isArray(v)?v.join('/'):v)+'</span>';
            } else if (editMode) {
                var val = f.arr ? (Array.isArray(v) ? v.join(',') : safeStr(v)) : v;
                display = editInput(f.path, val, f.type);
            } else {
                display = esc(Array.isArray(v) ? v.join(' / ') : safeStr(v));
            }
            infoHtml += '<div class="sam-row"><span class="k">'+esc(f.k)+'</span><span class="v">'+display+'</span></div>';
        });
        // ★ 职业: 已改为记录对象 {职业名:{类型,特性[],来源}}; 显示态折叠面板, 编辑态结构化编辑器
        html += secBlock('📋 角色信息', infoHtml);
        {
            var occ = resolvePath(sd, '角色.职业');
            if (editMode && !isReadonlyPath('角色.职业')) {
                html += secBlock('🎖 职业', occupationEditHtml(occ, '角色.职业'));
            } else if (occupationNames(occ).length) {
                html += occupationCardsHtml(occ);
            }
        }
        // 最终属性 - 拆分为基础属性/修正值/衍生属性三个面板(只读,系统计算)
        var fa = p.最终属性 || {};
        var lifeTier = displayTierRaw(p); // 段位显示层级: 形态激活且层级更高时取形态层级, 否则取自身层级
        // 1.基础属性(6项) - 每项数值右侧追加当前层级段位徽章(F~SSS, 按当前层级范围9等分判定)
        var baseHtml = '<div class="sam-grid-2">';
        ['力量','敏捷','体质','精神','魅力'].forEach(function(an) {
            var v = safeNum(fa[an], 0);
            var path = '角色.最终属性.'+an;
            var valCell = (editMode && !isReadonlyPath(path) ? editInput(path, v, 'number') : '<span class="sam-edit-readonly">'+v+'</span>');
            // 段位徽章: 取当前层级下单维属性值对应的段位分→品质字母(F~SSS), 复用 sam-fc-q 着色样式
            var score = attrTierScore(v, lifeTier);
            var q = scoreToQuality(score);
            var tierBadge = '<span class="sam-fc-q q-'+q+'" title="当前层级段位" style="margin-left:6px;">'+esc(q)+'</span>';
            baseHtml += '<div class="sam-row"><span class="k">'+esc(an)+'</span><span class="v">'+valCell+tierBadge+'</span></div>';
        });
        baseHtml += '</div>';
        // 层级进度条: 当前层级(取自角色.层级,只读) → 下一层级; 中间显示基础属性总点数与进度
        html += renderTierProgressBar(p, fa, sd.系统状态 || {});
        html += secBlock('💪 基础属性', baseHtml);
        // 2.修正值(6项)
        var modHtml = '<div class="sam-grid-2">';
        ['力量修正','敏捷修正','体质修正','精神修正','魅力修正'].forEach(function(an) {
            var v = safeNum(fa[an], 0);
            var path = '角色.最终属性.'+an;
            modHtml += '<div class="sam-row"><span class="k">'+esc(an)+'</span><span class="v">'+(editMode && !isReadonlyPath(path) ? editInput(path, v, 'number') : '<span class="sam-edit-readonly">'+v+'</span>')+'</span></div>';
        });
        modHtml += '</div>';
        html += secBlock('✨ 修正值', modHtml);
        // 3.衍生属性
        var derHtml = '<div class="sam-grid-2">';
        // 衍生属性: 数据键(key, 与辅助计算脚本写入字段一致) + 显示名(label, 带中文后缀)
        var derList = [
            {key:'DEF', label:'DEF(物防)'},
            {key:'MDEF', label:'MDEF(术防)'},
            {key:'物理减伤率', label:'物理减伤率'},
            {key:'魔法减伤率', label:'魔法减伤率'},
            {key:'AP', label:'AP(法术增幅)'},
            {key:'先攻DC', label:'先攻DC'},
            {key:'防御DC', label:'防御DC'}
        ];
        derList.forEach(function(item) {
            var key = item.key, label = item.label;
            var v = safeNum(fa[key], 0);
            var unit = (key === 'AP' || key.indexOf('减伤率')>=0) ? '%' : '';
            var path = '角色.最终属性.'+key;
            derHtml += '<div class="sam-row"><span class="k">'+esc(label)+'</span><span class="v">'+(editMode && !isReadonlyPath(path) ? editInput(path, v, 'number') : '<span class="sam-edit-readonly">'+v+unit+'</span>')+'</span></div>';
        });
        derHtml += '</div>';
        // 3b. 武器攻击(并入衍生属性, 减伤说明上方; 无武装常驻+已装备武器; ATK/MATK分两排)
        var wpn = fa.武器 || {};
        derHtml += '<div class="sam-wpn-divider">⚔ 武器攻击</div>';
        derHtml += '<div class="sam-wpn-list">';
        derHtml += '<div class="sam-wpn-row base"><div class="sam-wpn-name">无武装</div><div class="sam-wpn-stat atk">ATK(物攻) <b>'+safeNum(wpn.无武装 && wpn.无武装.ATK, 0)+'</b></div><div class="sam-wpn-stat matk">MATK(术攻) <b>'+safeNum(wpn.无武装 && wpn.无武装.MATK, 0)+'</b></div></div>';
        Object.keys(wpn).forEach(function(name) {
            if (name === '无武装') return;
            var w = wpn[name] || {};
            derHtml += '<div class="sam-wpn-row"><div class="sam-wpn-name">⚔ '+esc(name)+'</div><div class="sam-wpn-stat atk">ATK(物攻) <b>'+safeNum(w.ATK, 0)+'</b></div><div class="sam-wpn-stat matk">MATK(术攻) <b>'+safeNum(w.MATK, 0)+'</b></div></div>';
        });
        derHtml += '</div>';
        // 减伤率说明标签: 上限与各阶位满防基准
        derHtml += '<div style="margin-top:8px;padding:8px 10px;background:var(--sam-hover);border:1px solid var(--sam-border);border-left:3px solid var(--sam-accent);border-radius:6px;font-size:11px;line-height:1.7;color:var(--sam-sub);">'
            + '<div style="color:var(--sam-accent);font-weight:bold;margin-bottom:3px;">🛡️ 减伤率说明</div>'
            + '<div>减伤率上限：<b style="color:var(--sam-text);">75%</b>（超过不再叠加）</div>'
            + '<div>各阶位满防基准（DEF/MDEF 达到对应值即满减伤）：</div>'
            + '<div style="color:var(--sam-text);margin-top:2px;letter-spacing:0.3px;">Ⅰ:70　Ⅱ:200　Ⅲ:480　Ⅳ:1280　Ⅴ:3300　Ⅵ:9200　Ⅶ:24000　Ⅷ:70000　Ⅸ:150000</div>'
            + '</div>';
        html += secBlock('⚡ 衍生属性', derHtml);
        // 注: "当前形态"栏已移除 — 顶部头像旁已显示形态名, 由能力面板激活按钮统一管理
        return html;
    }

    /* 战术栏穿戴槽位信息栏: 统计装备(status=1)各类型穿戴数 + 道具(status=1)数, 显示 当前/上限
       超限(当前>上限)标红; 满(当前==上限且上限>0)标蓝; 特殊(类型8)无上限显示 当前/X */
    function renderEquipSlotsBar(p) {
        var equips = p.装备 || {};
        var items = p.道具 || {};
        // 装备类型与上限来自模块级常量 EQUIP_SLOTS; 道具上限来自 ITEM_SLOT_CAP
        // 统计各类型已穿戴数
        var counts = {};
        Object.keys(equips).forEach(function(k) {
            var e = equips[k] || {};
            if (Number(e.状态) === 1) {
                var t = Number(e.类型);
                counts[t] = (counts[t] || 0) + 1;
            }
        });
        // 道具已穿戴数
        var itemCount = 0;
        Object.keys(items).forEach(function(k) {
            if (Number(items[k].状态) === 1) itemCount++;
        });
        var html = '<div class="sam-slots-bar">';
        EQUIP_SLOTS.forEach(function(s) {
            var cur = counts[s.type] || 0;
            var cls = 'sam-slot-chip';
            var right;
            if (s.cap === 0) {
                // 特殊: 无上限, 显示 cur/X (X=cur自身, 表示当前穿戴数)
                right = cur+'/X';
            } else {
                right = cur+'/'+s.cap;
                if (cur > s.cap) cls += ' over';      // 超限标红
                else if (cur === s.cap) cls += ' full'; // 满标蓝
            }
            html += '<span class="'+cls+'">'+s.label+' <span class="n">'+right+'</span></span>';
        });
        // 道具槽 (上限来自 ITEM_SLOT_CAP)
        var iCls = 'sam-slot-chip';
        if (itemCount > ITEM_SLOT_CAP) iCls += ' over';
        else if (itemCount === ITEM_SLOT_CAP) iCls += ' full';
        html += '<span class="'+iCls+'">道具 <span class="n">'+itemCount+'/'+ITEM_SLOT_CAP+'</span></span>';
        html += '</div>';
        return html;
    }

    /* ===== 25. Tab: 持有(战术栏/装备/道具/仓库) =====
       改版: 装备背包/道具背包/仓库 由折叠栏改为顶部子Tab(战术栏 + 三仓)
       - 顶部常驻穿戴槽位信息栏 + 4个子Tab(带数量角标)
       - 子Tab选择存于模块级 holdActiveTab, 切聊天/重渲染保持
       - 内容区按当前子Tab渲染对应状态的卡片列表, 附战斗可见性提示 */
    var holdActiveTab = 'tactical';   // 持有子Tab: tactical|equip|item|storage
    var holdTypeFilter = '';          // 当前子Tab下的类型筛选(空='全部'; 切换子Tab时重置)
    /* 取条目分类标签: 装备用类型数字→槽位名(EQUIP_SLOTS); 道具用字符串类型字段(空→未分类) */
    function holdEntryTypeLabel(val, isEquip) {
        if (isEquip) {
            var t = Number(val && val.类型);
            for (var i = 0; i < EQUIP_SLOTS.length; i++) { if (EQUIP_SLOTS[i].type === t) return EQUIP_SLOTS[i].label; }
            return '未知';
        }
        var s = safeStr(val && val.类型).trim();
        return s || '未分类';
    }
    /* 收集当前子Tab下已有条目的类型计数(按该Tab对应状态过滤)
       返回 {counts:{类型:条目数}, order:[类型...]} —— 装备类型按 EQUIP_SLOTS 顺序在前, 道具类型按首次出现顺序在后 */
    function holdCollectTypes(sd) {
        var p = sd.角色 || {};
        var equips = p.装备 || {}, items = p.道具 || {};
        var statuses, useEquip, useItem;
        if (holdActiveTab === 'tactical')      { statuses = [1]; useEquip = true;  useItem = true;  }
        else if (holdActiveTab === 'equip')    { statuses = [0]; useEquip = true;  useItem = false; }
        else if (holdActiveTab === 'item')     { statuses = [0]; useEquip = false; useItem = true;  }
        else                                   { statuses = [2]; useEquip = true;  useItem = true;  }
        var seen = {};
        function add(label, w) {
            if (!seen[label]) seen[label] = { cnt: 0, w: w };
            seen[label].cnt++;
        }
        if (useEquip) Object.keys(equips).forEach(function(k) {
            var e = equips[k] || {};
            if (statuses.indexOf(Number(e.状态)) < 0) return;
            var label = holdEntryTypeLabel(e, true), w = 99;
            for (var i = 0; i < EQUIP_SLOTS.length; i++) { if (EQUIP_SLOTS[i].label === label) { w = i; break; } }
            add(label, w);
        });
        if (useItem) Object.keys(items).forEach(function(k) {
            var it = items[k] || {};
            if (statuses.indexOf(Number(it.状态)) < 0) return;
            add(holdEntryTypeLabel(it, false), 1000 + Object.keys(seen).length);
        });
        var order = Object.keys(seen).sort(function(a, b) { return seen[a].w - seen[b].w; });
        return { counts: seen, order: order };
    }
    /* 类型筛选行HTML: [全部 N] + 各已有类型(带计数); 该子Tab无任何条目 → 整行不渲染(背包为空不显示)
       含副作用: 筛选值已失效(该类型条目被清空)时自动回落'全部' */
    function renderHoldTypeRow(sd) {
        var info = holdCollectTypes(sd);
        var total = 0;
        info.order.forEach(function(l) { total += info.counts[l].cnt; });
        if (total === 0) return '';
        if (holdTypeFilter && !(holdTypeFilter in info.counts)) holdTypeFilter = '';
        var html = '<div class="sam-hold-types">'
            + '<button type="button" class="sam-hold-type'+(holdTypeFilter === '' ? ' active' : '')+'" data-hold-type="">全部 <span class="sam-hold-type-cnt">'+total+'</span></button>';
        info.order.forEach(function(l) {
            html += '<button type="button" class="sam-hold-type'+(holdTypeFilter === l ? ' active' : '')+'" data-hold-type="'+esc(l)+'">'+esc(l)+' <span class="sam-hold-type-cnt">'+info.counts[l].cnt+'</span></button>';
        });
        html += '</div>';
        return html;
    }
    /* 类型筛选字典: holdTypeFilter 为空时原样返回; 否则生成仅含匹配类型条目的浅拷贝字典 */
    function holdFilterByType(dict, isEquip) {
        if (!holdTypeFilter) return dict;
        var out = {};
        Object.keys(dict || {}).forEach(function(k) {
            var v = dict[k] || {};
            if (holdEntryTypeLabel(v, isEquip) === holdTypeFilter) out[k] = v;
        });
        return out;
    }
    function renderHoldTab(sd) {
        var p = sd.角色 || {};
        var editMode = isEditMode();
        var equips = p.装备 || {};
        var items = p.道具 || {};
        // 统计字典中 状态 命中 statuses 的条目数(用于子Tab角标计数)
        function countByStatus(dict, statuses) {
            var n = 0;
            Object.keys(dict || {}).forEach(function(k) {
                var st = Number((dict[k] || {}).状态);
                if (statuses.indexOf(st) >= 0) n++;
            });
            return n;
        }
        // 各子Tab条目数(供角标)
        var tCount = countByStatus(equips, [1]) + countByStatus(items, [1]);
        var eCount = countByStatus(equips, [0]);
        var iCount = countByStatus(items, [0]);
        var wCount = countByStatus(equips, [2]) + countByStatus(items, [2]);
        var tabs = [
            {key:'tactical', icon:'🎯', label:'战术栏', cnt:tCount},
            {key:'equip',    icon:'⚔️', label:'装备背包', cnt:eCount},
            {key:'item',     icon:'🎒', label:'道具背包', cnt:iCount},
            {key:'storage',  icon:'📦', label:'仓库', cnt:wCount}
        ];
        // 校验当前激活子Tab有效(防脏值)
        var validKeys = tabs.map(function(t){ return t.key; });
        if (validKeys.indexOf(holdActiveTab) < 0) holdActiveTab = 'tactical';
        var html = '';
        // 穿戴槽位信息栏(各类装备/道具 当前穿戴数/上限, 常驻顶部)
        html += renderEquipSlotsBar(p);
        // 子Tab条
        html += '<div class="sam-hold-tabs">';
        tabs.forEach(function(t) {
            var active = (t.key === holdActiveTab);
            html += '<button type="button" class="sam-hold-tab'+(active?' active':'')+'" data-hold-tab="'+t.key+'">'
                + '<span class="sam-hold-tab-ico">'+t.icon+'</span>'
                + '<span class="sam-hold-tab-lbl">'+t.label+'</span>'
                + '<span class="sam-hold-tab-cnt'+(t.cnt?'':' zero')+'">'+t.cnt+'</span>'
                + '</button>';
        });
        html += '</div>';
        // 专属分类行: 常驻外层容器(保证子Tab切换时可回填), 内部按已有条目类型细分; 该Tab为空则内容为空不占位
        html += '<div class="sam-hold-types-wrap" id="sam-hold-types-wrap">'+renderHoldTypeRow(sd)+'</div>';
        // 内容区: 独立容器, 切Tab时仅替换其内容(不重建Tab条, 避免整排抖动/错位)
        html += '<div class="sam-hold-content" id="sam-hold-body">'+renderHoldBody(sd)+'</div>';
        return html;
    }
    /* 持有面板内容区: 按当前 holdActiveTab 渲染对应状态卡片列表 + 战斗可见性提示
       独立于Tab条, 供子Tab切换时局部刷新(不触发Tab条DOM重建, 消除抖动) */
    function renderHoldBody(sd) {
        var p = sd.角色 || {};
        var editMode = isEditMode();
        // 类型筛选: holdTypeFilter 非空时仅保留匹配类型的条目(在原字典上做浅拷贝过滤)
        var equips = holdFilterByType(p.装备 || {}, true);
        var items = holdFilterByType(p.道具 || {}, false);
        // 剥离[无]占位, 仅保留真实卡片HTML(避免空占位被grid当作单格占位导致视觉空格)
        function stripEmpty(s){ return (s||'').replace(/<div class="sam-empty">\[无\]<\/div>/g,'').trim(); }
        function mergeList(htmlA, htmlB, emptyMsg){
            var cards = stripEmpty(htmlA) + stripEmpty(htmlB);
            if (cards === '') return '<div class="sam-empty">'+emptyMsg+'</div>';
            // 持有面板卡片一律单列(一行一个), 不与其他面板共用的 sam-card-list 两列布局
            return '<div class="sam-card-list sam-card-list-1col">'+cards+'</div>';
        }
        var content = '', hint = '';
        if (holdActiveTab === 'tactical') {
            // 战术栏: 已装备的装备(status=1) + 已装备的道具(status=1)
            content = mergeList(
                renderEquipFullList(equips, '角色.装备', editMode, [1]),
                renderItemFullList(items, '角色.道具', editMode, [1]),
                '尚未装备任何战术项'
            );
        } else if (holdActiveTab === 'equip') {
            // 装备背包: status=0
            content = mergeList(
                renderEquipFullList(equips, '角色.装备', editMode, [0]),
                '', '装备背包空空如也'
            );
            hint = '战斗时 AI 不可见';
        } else if (holdActiveTab === 'item') {
            // 道具背包: status=0
            content = mergeList(
                renderItemFullList(items, '角色.道具', editMode, [0]),
                '', '道具背包空空如也'
            );
            hint = '战斗时 AI 不可见';
        } else {
            // 仓库: 装备status=2 + 道具status=2
            content = mergeList(
                renderEquipFullList(equips, '角色.装备', editMode, [2]),
                renderItemFullList(items, '角色.道具', editMode, [2]),
                '仓库中没有存放任何物品'
            );
            hint = 'AI 不可见';
        }
        var hintHtml = hint ? '<div class="sam-hold-hint">🔒 '+hint+'</div>' : '';
        return hintHtml + content;
    }
    /* 装备完整资料卡片列表(内联展示, 不用弹窗; 品质仅在标题右侧徽章展示) */
    function renderEquipFullList(equips, basePath, editMode, statuses) {
        var filtered = [];
        Object.keys(equips).forEach(function(k) {
            var e = equips[k] || {};
            var st = Number(e.状态);
            if (statuses.indexOf(st) >= 0) filtered.push({key:k, val:e});
        });
        if (filtered.length === 0) return '<div class="sam-empty">[无]</div>';
        var typeMap = ['武器','手套','头部','胸部','腿部','鞋子','披风','饰品','世界遗物'];
        var html = '';
        filtered.forEach(function(it) {
            var e = it.val;
            var st = Number(e.状态);
            var path = basePath+'.'+it.key;
            var q = parseRarity(e.品质);
            var typeStr = typeMap[e.类型] || '未知';
            var rows = '';
            rows += fcRow('类型', typeStr, path+'.类型', false); // 类型是数字枚举, 不可编辑
            if (!isCostEmpty(e.消耗)) rows += fcRow('消耗', e.消耗, path+'.消耗', editMode);
            var body = '<div class="sam-fc-body">';
            if (editMode || (Array.isArray(e.标签) && e.标签.length > 0)) body += fcBody('标签', formatTags(e.标签, path+'.标签', editMode), 'sam-fc-tags');
            if (e.原始属性 && typeof e.原始属性 === 'object' && Object.keys(e.原始属性).length > 0) {
                body += fcBodyCollapsible('原始属性', formatStatGrid(e.原始属性, 3), 'sam-fc-stats', false);
            }
            body += fcBody('效果', formatEffects(e.效果, path+'.效果', editMode), 'sam-fc-effects');
            var descContent;
            if (editMode && !isReadonlyPath(path+'.描述')) {
                descContent = editInput(path+'.描述', safeStr(e.描述), 'textarea');
            } else {
                descContent = esc(safeStr(e.描述));
            }
            body += fcBody('描述', descContent);
            // 操作按钮(类型8特殊装备无按钮无限制); 删除按钮仅在修改模式显示
            var btns = equipActionButtons(path, st, Number(e.类型), editMode);
            if (btns) body += fcBody('操作', btns, 'sam-fc-actions');
            body += '</div>';
            html += fullCard(q, it.key, rows, body, '');
        });
        return html;
    }
    /* 道具完整资料卡片列表(内联展示, 不用弹窗; 品质仅在标题右侧徽章展示) */
    function renderItemFullList(items, basePath, editMode, statuses) {
        var filtered = [];
        Object.keys(items).forEach(function(k) {
            var it = items[k] || {};
            var st = Number(it.状态);
            if (statuses.indexOf(st) >= 0) filtered.push({key:k, val:it});
        });
        if (filtered.length === 0) return '<div class="sam-empty">[无]</div>';
        var html = '';
        filtered.forEach(function(it) {
            var v = it.val;
            var st = Number(v.状态);
            var path = basePath+'.'+it.key;
            var q = parseRarity(v.品质);
            var qty = safeNum(v.数量, 1);
            var rows = '';
            rows += fcRow('类型', v.类型, path+'.类型', editMode);
            rows += fcRow('数量', qty, path+'.数量', editMode, 'number');
            var body = '<div class="sam-fc-body">';
            if (editMode || (Array.isArray(v.标签) && v.标签.length > 0)) body += fcBody('标签', formatTags(v.标签, path+'.标签', editMode), 'sam-fc-tags');
            body += fcBody('效果', formatEffects(v.效果, path+'.效果', editMode), 'sam-fc-effects');
            var descContent;
            if (editMode && !isReadonlyPath(path+'.描述')) {
                descContent = editInput(path+'.描述', safeStr(v.描述), 'textarea');
            } else {
                descContent = esc(safeStr(v.描述));
            }
            body += fcBody('描述', descContent);
            body += fcBody('操作', itemActionButtons(path, st, editMode), 'sam-fc-actions');
            body += '</div>';
            html += fullCard(q, it.key, rows, body);
        });
        return html;
    }
    /* 技能完整资料卡片列表(用于血统Tab; 品质仅在标题右侧徽章展示)
       主动/被动/特殊 三栏改为可伸缩<details>, 标题显示数量 */
    function renderSkillFullList(skills, basePath, editMode) {
        var cats = [
            {idx:0, label:'主动'},
            {idx:1, label:'被动'},
            {idx:2, label:'特殊'}
        ];
        var html = '';
        cats.forEach(function(cat) {
            var list = [];
            Object.keys(skills).forEach(function(k) {
                var s = skills[k] || {};
                if (Number(s.类型) === cat.idx) list.push({key:k, val:s});
            });
            // ★ 该类别数量为 0 → 整栏隐藏(不渲染空折叠栏), 能力面板/形态卡片/NPC详情 共用此函数
            if (list.length === 0) return;
            // 可伸缩分组, 标题带数量
            html += '<details class="sam-skill-group">';  // 默认折叠; 折叠记忆优先覆盖
            html += '<summary>✨ '+cat.label+'技能 ('+list.length+')</summary>';
            html += '<div class="sam-card-list">';
            list.forEach(function(it) {
                var s = it.val;
                var path = basePath+'.'+it.key;
                var q = parseRarity(s.品质);
                var rows = '';
                if (!isCostEmpty(s.消耗)) rows += fcRow('消耗', s.消耗, path+'.消耗', editMode);
                var body = '<div class="sam-fc-body">';
                if (editMode || (Array.isArray(s.标签) && s.标签.length > 0)) body += fcBody('标签', formatTags(s.标签, path+'.标签', editMode), 'sam-fc-tags');
                body += fcBody('效果', formatEffects(s.效果, path+'.效果', editMode), 'sam-fc-effects');
                var descContent;
                if (editMode && !isReadonlyPath(path+'.描述')) {
                    descContent = editInput(path+'.描述', safeStr(s.描述), 'textarea');
                } else {
                    descContent = esc(safeStr(s.描述));
                }
                body += fcBody('描述', descContent);
                body += '</div>';
                html += fullCard(q, it.key, rows, body, samDelBtn(path, editMode, '删除技能'));
            });
            html += '</div>';
            html += '</details>';
        });
        return html;
    }

    /* ===== 26. Tab: 血统(血统/形态库/技能) ===== */
    function renderBloodTab(sd) {
        var p = sd.角色 || {};
        var bl = p.血统 || {};
        var editMode = isEditMode();
        var keys = Object.keys(bl);
        // 血统数量限制: 取自顶部常量 BLOODLINE_CAP(默认3), 用于栏目标题与商城上限判定
        var bloodLimit = BLOODLINE_CAP;
        var html = '';
        // 血统
        var blHtml = '';
        if (keys.length === 0) blHtml += '<div class="sam-empty">[无血统]</div>';
        else {
            blHtml += '<div class="sam-card-list sam-card-list-1col">';
            keys.forEach(function(k) {
                var b = bl[k] || {};
                var path = '角色.血统.'+k;
                var q = parseRarity(b.品质);
                var rows = '';
                var body = '<div class="sam-fc-body">';
                if (editMode || (Array.isArray(b.标签) && b.标签.length > 0)) body += fcBody('标签', formatTags(b.标签, path+'.标签', editMode), 'sam-fc-tags');
                if (b.原始属性 && typeof b.原始属性 === 'object' && Object.keys(b.原始属性).length > 0) {
                    body += fcBodyCollapsible('原始属性', formatStatGrid(b.原始属性, 3), 'sam-fc-stats', false);
                }
                body += fcBody('效果', formatEffects(b.效果, path+'.效果', editMode), 'sam-fc-effects');
                var descContent;
                if (editMode && !isReadonlyPath(path+'.描述')) {
                    descContent = editInput(path+'.描述', safeStr(b.描述), 'textarea');
                } else {
                    descContent = esc(safeStr(b.描述));
                }
                body += fcBody('描述', descContent);
                body += '</div>';
                blHtml += fullCard(q, k, rows, body, samDelBtn(path, editMode, '删除血统'));
            });
            blHtml += '</div>';
        }
        // ★ 血统融合入口: 仅当玩家实际持有血统数>1时显示(副本/奇遇中额外获得的血统也可在此融合)
        if (keys.length > 1) {
            blHtml += '<div style="display:flex;justify-content:center;margin-top:12px"><button type="button" class="sam-act-btn sam-blood-fusion-open" style="min-width:160px">🧬 血统融合</button></div>';
        }
        html += secBlock('🧬 血统 ('+keys.length+'/'+bloodLimit+')', blHtml, false);  // 默认折叠; 折叠记忆优先覆盖
        // 形态库
        var forms = p.形态库 || {};
        var fkeys = Object.keys(forms);
        var fHtml = '';
        if (fkeys.length === 0) fHtml += '<div class="sam-empty">[无形态]</div>';
        else {
            fHtml += '<div class="sam-card-list sam-card-list-1col">';
            fkeys.forEach(function(k) {
                var f = forms[k] || {};
                var path = '角色.形态库.'+k;
                // 形态走层级(Ⅰ~Ⅸ): 徽章显示罗马数字, 色阶用对应品质字母(q-class); 兼容旧品质字母数据
                var _fTierRaw = f.层级 != null ? f.层级 : f.品质;
                var q = { label: tierRomanOf(_fTierRaw), cls: tierQOfClass(_fTierRaw) };
                var rows = '';
                rows += fcRow('状态', f.状态, path+'.状态', editMode);
                if (!isCostEmpty(f.消耗)) rows += fcRow('消耗', f.消耗, path+'.消耗', editMode);
                // 注: 冷却不再用 fcRow 显示, 由激活按钮(⏳ N回合)统一呈现, 避免重复
                var body = '<div class="sam-fc-body">';
                if (editMode || (Array.isArray(f.标签) && f.标签.length > 0)) body += fcBody('标签', formatTags(f.标签, path+'.标签', editMode), 'sam-fc-tags');
                if (f.原始属性 && typeof f.原始属性 === 'object' && Object.keys(f.原始属性).length > 0) {
                    body += fcBodyCollapsible('原始属性', formatStatGrid(f.原始属性, 3), 'sam-fc-stats', false);
                }
                body += fcBody('效果', formatEffects(f.效果, path+'.效果', editMode), 'sam-fc-effects');
                var descContent;
                if (editMode && !isReadonlyPath(path+'.描述')) {
                    descContent = editInput(path+'.描述', safeStr(f.描述), 'textarea');
                } else {
                    descContent = esc(safeStr(f.描述));
                }
                body += fcBody('描述', descContent);
                // 形态自带技能子表
                var formSkills = f.技能 || {};
                if (formSkills && typeof formSkills === 'object' && Object.keys(formSkills).length > 0) {
                    body += fcBody('技能', renderSkillFullList(formSkills, path+'.技能', editMode), 'sam-fc-skills');
                }
                // 激活/取消按钮: 放在品质徽章左侧(headExtra); 已激活→✕取消(可点), 冷却中→禁用⏳, 归零→⚡激活
                var cf = p.当前形态 || {};
                var isThisActive = (cf.激活 === true && safeStr(cf.名称) === k);
                var cdCur = 0;
                var cdM = safeStr(f.冷却).match(/^(\d+)\s*\/\s*(\d+)/);
                if (cdM) cdCur = parseInt(cdM[1], 10) || 0;
                var actBtnHtml;
                if (isThisActive) {
                    actBtnHtml = '<button class="sam-act-btn" data-act="deactivate" data-form="'+esc(k)+'">✕ 取消</button>';
                } else if (cdCur > 0) {
                    actBtnHtml = '<button class="sam-act-btn" disabled style="opacity:0.6;cursor:not-allowed;">⏳ '+cdCur+'回合</button>';
                } else {
                    actBtnHtml = '<button class="sam-act-btn" data-act="activate" data-form="'+esc(k)+'">⚡ 激活</button>';
                }
                body += '</div>';
                fHtml += fullCard(q, k, rows, body, (actBtnHtml||'') + samDelBtn(path, editMode, '删除形态'));
            });
            fHtml += '</div>';
        }
        // 无形态时整个形态库折叠栏自动隐藏
        if (fkeys.length > 0) {
            html += secBlock('🌀 形态库 ('+fkeys.length+')', fHtml, false);  // 默认折叠; 折叠记忆优先覆盖
        }
        // 技能(直接列出主动/被动/特殊三个折叠栏, 不再套外层"主技能栏"section)
        var skills = p.技能 || {};
        html += renderSkillFullList(skills, '角色.技能', editMode);
        return html;
    }

    /* ===== 27. Tab: 关系 ===== */
    /* 记住关系面板当前激活的子Tab(全部/在场/不在场/小队), 避免 renderAll 后跳回"全部" */
    var relationActiveSub = 'all';
    function renderRelationTab(sd) {
        var rel = sd.关系列表 || {};
        var editMode = isEditMode();
        var all = [], present = [], absent = [], team = [];
        Object.keys(rel).forEach(function(k) {
            var n = rel[k] || {};
            var item = {key:k, val:n};
            all.push(item);
            if (n.在场 === true) present.push(item); else absent.push(item);
            if (n.是否队友 === true) team.push(item);
        });
        // 使用记住的子Tab状态(若无效则回退到'all')
        var activeSub = relationActiveSub;
        var validSubs = ['all','present','absent','team'];
        if (validSubs.indexOf(activeSub) < 0) activeSub = 'all';
        var html = '<div class="sam-subtabs">'
            + '<div class="sam-subtab'+(activeSub==='all'?' active':'')+'" data-sub="all">全部('+all.length+')</div>'
            + '<div class="sam-subtab'+(activeSub==='present'?' active':'')+'" data-sub="present">在场('+present.length+')</div>'
            + '<div class="sam-subtab'+(activeSub==='absent'?' active':'')+'" data-sub="absent">不在场('+absent.length+')</div>'
            + '<div class="sam-subtab'+(activeSub==='team'?' active':'')+'" data-sub="team">小队('+team.length+')</div>'
            + '</div>';
        html += '<div class="sam-subpane'+(activeSub==='all'?' active':'')+'" data-sub="all"'+(activeSub==='all'?'':' style="display:none;"')+'>'+renderNpcList(all, editMode, 'all')+'</div>';
        html += '<div class="sam-subpane'+(activeSub==='present'?' active':'')+'" data-sub="present"'+(activeSub==='present'?'':' style="display:none;"')+'>'+renderNpcList(present, editMode, 'present')+'</div>';
        html += '<div class="sam-subpane'+(activeSub==='absent'?' active':'')+'" data-sub="absent"'+(activeSub==='absent'?'':' style="display:none;"')+'>'+renderNpcList(absent, editMode, 'absent')+'</div>';
        html += '<div class="sam-subpane'+(activeSub==='team'?' active':'')+'" data-sub="team"'+(activeSub==='team'?'':' style="display:none;"')+'>'+renderNpcList(team, editMode, 'present')+'</div>';
        return html;
    }
    /* NPC单列卡片: mode决定字段
       all    -> 名字/在场状态/种族/身份/HP·好感/外貌/态度
       present-> 能显示都显示+伸缩框(性格/着装/喜爱/状态/装备/技能等)
       absent -> 姓名/种族/身份/层级/好感度/外貌/背景故事 */
    /* 仅AI可见的身份关键词: 不在玩家面板显示(只在数据库中给AI看) */
    var HIDDEN_IDENTITY_KEYWORDS = ['守护者', '篡夺者', '织梦者', '残魂', '穿越者'];
    function isHiddenIdentity(s) {
        if (typeof s !== 'string') return false;
        for (var i = 0; i < HIDDEN_IDENTITY_KEYWORDS.length; i++) {
            if (s.indexOf(HIDDEN_IDENTITY_KEYWORDS[i]) >= 0) return true;
        }
        return false;
    }
    function filterHiddenIdentity(arr) {
        if (!Array.isArray(arr)) return [];
        return arr.filter(function(x) { return !isHiddenIdentity(x); });
    }
    function renderNpcList(list, editMode, mode) {
        if (list.length === 0) return '<div class="sam-empty">[无]</div>';
        var html = '<div class="sam-list-1col">';
        list.forEach(function(it) {
            var n = it.val;
            var path = '关系列表.'+it.key;
            // 层级显示: 形态激活且形态层级>自身时显示形态层级(仅显示, 不写回)
            var _dispRaw = displayTierRaw(n);
            var tierRoman = tierRomanOf(_dispRaw); var q = tierQOfClass(_dispRaw);
            var hp = safeNum(n.HP,0), hpmax = safeNum(n.HP_MAX,1);
            var ep = safeNum(n.EP,0), epmax = safeNum(n.EP_MAX,1);
            var thp = safeNum(n.THP,0);
            var favor = safeNum(n.好感度,0);
            var race = safeStr(n.种族) || '-';
            // 阵营身份默认隐藏(仅AI可见); 但小队成员或好感度>60时不隐藏
            var rawIdArr = Array.isArray(n.身份) ? n.身份 : [];
            var showAllIdentity = (n.是否队友 === true) || (favor > 60);
            var idArr = showAllIdentity ? rawIdArr : filterHiddenIdentity(rawIdArr);
            var idStr = idArr.length ? idArr.join(' / ') : '-';
            var jobStrHtml = occupationInlineHtml(n.职业) || '<span class="sam-ed-ph">-</span>';
            var looks = safeStr(n.外貌) || '';
            var dress = safeStr(n.着装) || '';
            var persona = safeStr(n.性格) || '';
            var likes = safeStr(n.喜爱) || '';
            var mind = safeStr(n.态度) || '';
            var bg = safeStr(n.背景故事) || '';
            var presentTxt = (n.在场 === true) ? '是' : '否';
            // 在场卡片点击弹详情(同全部/不在场)
            var cls = 'sam-card sam-npc-card q-'+q;
            var card = '<div class="'+cls+'" data-path="'+esc(path)+'" data-title="'+esc(it.key)+'">';
            // 编辑模式: 右上角删除按钮
            if (editMode) card += '<button type="button" class="sam-npc-del" data-del-npc="'+esc(it.key)+'" title="删除该NPC">✕</button>';
            // 在场卡片: 右上角转移按钮(仅在场时显示; 编辑模式时左移避开删除按钮)
            if (mode === 'present' && n.在场 === true) {
                var trfPos = editMode ? 'right:30px;' : 'right:4px;';
                card += '<button type="button" class="sam-npc-transfer" data-transfer-npc="'+esc(it.key)+'" style="'+trfPos+'" title="向该角色转移物资">📦 转移</button>';
                // 获取按钮: 仅死亡NPC显示
                if (isNpcDead(n)) {
                    var lootPos = editMode ? 'right:88px;' : 'right:62px;';
                    card += '<button type="button" class="sam-npc-loot" data-loot-npc="'+esc(it.key)+'" style="'+lootPos+'" title="获取该角色遗物">💀 获取</button>';
                }
            }
            // 头像+名字 横排: 有立绘=小头像(点击放大), 无立绘=小按钮(点击上传)
            var npcPUrl = getNpcPortrait(it.key);
            card += '<div class="sam-npc-head">';
            if (npcPUrl) {
                card += '<div class="sam-npc-avatar has-img" data-name="'+esc(it.key)+'" data-portrait="'+esc(npcPUrl)+'">';
                card += '<img src="'+esc(npcPUrl)+'" alt="'+esc(it.key)+'">';
                card += '</div>';
            } else {
                card += '<button type="button" class="sam-npc-portrait-btn" data-name="'+esc(it.key)+'" title="设置立绘">📷 立绘</button>';
            }
            // NPC 变身形态: 若 当前形态.激活===true 且有名称, 名字右侧显示形态名
            var npcCf = n.当前形态 || {};
            var npcFormName = (npcCf.激活 === true && safeStr(npcCf.名称)) ? safeStr(npcCf.名称) : '';
            var npcFormTag = npcFormName ? '<span class="sam-npc-form-tag">🌀 '+esc(npcFormName)+'</span>' : '';
            card += '<div class="sam-npc-head-info"><div class="sam-npc-head-name">'+esc(it.key)+npcFormTag+'</div></div>';
            card += '</div>';
            if (mode === 'all') {
                // 紧凑双列网格: 短字段并排, 节省纵向空间
                var allGrid = '';
                allGrid += npcRow('在场', presentTxt);
                allGrid += npcRow('种族', race);
                allGrid += npcRow('身份', idStr);
                allGrid += npcRow('好感', favor);
                var qty = safeNum(n.数量, 1);
                if (qty > 1) {
                    allGrid += npcRow('THP', thp);
                    allGrid += npcRow('数量', 'x'+qty);
                } else {
                    allGrid += npcRow('HP', hp+'/'+hpmax);
                }
                card += '<div class="sam-npc-grid">'+allGrid+'</div>';
                // 长文本全宽
                if (looks) card += npcRow('外貌', looks);
                if (bg) card += npcRow('背景故事', bg);
            } else if (mode === 'present') {
                // 基础信息双列网格
                var grid = '';
                grid += npcRow('在场', presentTxt);
                grid += npcRow('种族', race);
                grid += npcRow('身份', idStr);
                grid += '<div class="sam-npc-row"><span class="k">职业:</span> <span class="v" style="flex:1;">'+jobStrHtml+'</span></div>';
                grid += npcRow('层级', tierRoman, 'sam-npc-tier q-'+q);
                grid += npcRow('好感度', favor);
                card += '<div class="sam-npc-grid">'+grid+'</div>';
                if (n.是否队友 === true) card += renderNpcTierProgressBar(n, it.key);
                // 进度条 HP/EP/THP
                card += '<div class="sam-npc-sec"></div>';
                card += npcBar('HP', hp, hpmax, 'var(--sam-hp)');
                card += npcBar('EP', ep, epmax, 'var(--sam-ep)');
                card += npcThpRow(thp);
                // 外貌(含着装)
                if (looks || dress) {
                    card += '<div class="sam-npc-sec"></div>';
                    if (looks) card += npcRow('外貌', looks);
                    if (dress) card += npcRow('着装', dress);
                }
                // 态度
                if (mind) { card += '<div class="sam-npc-sec"></div>'; card += '<div class="sam-npc-quote">'+esc(mind)+'</div>'; }
            } else { // absent
                card += npcRow('种族', race);
                card += npcRow('身份', idStr);
                card += npcRow('层级', tierRoman, 'sam-npc-tier q-'+q);
                card += npcRow('好感度', favor);
                if (looks) card += npcRow('外貌', looks);
                if (bg) card += npcRow('背景故事', bg);
            }
            card += '</div>';
            html += card;
        });
        html += '</div>';
        return html;
    }
    function npcRow(k, v, vClass) {
        var cls = vClass ? ' v '+vClass : ' v';
        return '<div class="sam-npc-row"><span class="k">'+esc(k)+':</span> <span class="'+cls.trim()+'">'+esc(safeStr(v))+'</span></div>';
    }
    function npcBar(label, cur, max, color) {
        var pct = (max > 0) ? Math.min(100, Math.round(cur / max * 100)) : 0;
        return '<div class="sam-npc-bar">'
            + '<span class="lbl" style="color:'+color+';">'+esc(label)+'</span>'
            + '<div class="trk"><div class="fl" style="width:'+pct+'%;background:'+color+';"></div></div>'
            + '<span class="num">'+cur+'/'+max+'</span>'
            + '</div>';
    }
    /* NPC THP行: 纯数值(临时护盾/额外生命值, 无上限无进度条) */
    function npcThpRow(cur) {
        return '<div class="sam-npc-thp-row">'
            + '<span class="lbl">THP (临时护盾/额外生命值)</span>'
            + '<span class="num">'+cur+'</span>'
            + '</div>';
    }

    /* ===== 28. Tab: 经营(资产) —— 每个资产名为一个可折叠栏目, 展开显示全部资料(不再弹详情窗) ===== */
    function renderAssetTab(sd) {
        var assets = sd.资产 || {};
        var editMode = isEditMode();
        var keys = Object.keys(assets);
        if (keys.length === 0) return ''
            + '<div class="sam-asset-empty">'
            +   '<div class="ae-title">🏗️ 经营资产</div>'
            +   '<div class="ae-desc">这里显示数据库中的全部资产，包括玩家、NPC、势力共同资产与无主遗迹；只有所属对象包含当前玩家的资产才启用玩家自动收菜。</div>'
            +   '<div class="ae-section"><div class="ae-h">可经营类型</div>'
            +     '<ul>'
            +       '<li><b>固定地产</b>：领地 / 庄园 / 店铺 / 秘密据点，含建设序列、驻扎人员、待办事件</li>'
            +       '<li><b>大型载具或要塞</b>：星舰 / 战争兵器，可下场参战或场外火力支援，受能源与完整度约束</li>'
            +     '</ul>'
            +   '</div>'
            +   '<div class="ae-section"><div class="ae-h">如何获得</div>'
            +   '<div class="ae-desc">通过剧情事件、任务奖励或扩张领土获得（资产不得凭空生成）。获得领土级资产时，初始建设序列直接解锁满额 8 条。</div>'
            +   '</div>'
            + '</div>';
        var html = '<div class="sam-asset-wrap">';
        keys.forEach(function(k) {
            html += renderAssetBlock(k, assets[k] || {}, '资产.' + k, editMode);
        });
        html += '</div>';
        return html;
    }
    function normalizeAssetOwnersUi(value) {
        var fallbackPlayer = getPlayerName() || '<user>';
        var source = Array.isArray(value) ? value : (value == null ? [fallbackPlayer] : [value]);
        var out = [];
        source.forEach(function(raw) {
            var owner = canonicalPlayerIdentity(raw);
            if (!owner || owner === '无主' || out.indexOf(owner) >= 0) return;
            out.push(owner);
        });
        return out;
    }
    function assetOwnerChips(owners) {
        if (!owners.length) return '<span class="sam-asset-owner-chip unowned">无主</span>';
        return '<span class="sam-asset-owner-list">' + owners.map(function(owner) {
            var player = isPlayerIdentity(owner);
            var label = displayPlayerIdentity(owner);
            return '<span class="sam-asset-owner-chip'+(player ? ' player' : '')+'">'+esc(label)+'</span>';
        }).join('') + '</span>';
    }

    // 资产类型 → 图标
    function assetTypeIcon(type) {
        if (type === '大型载具' || type === '要塞' || type === '载具') return '🚀';
        if (type === '便携式据点' || type === '据点' || type === '安全屋') return '🎒';
        return '🏛️';
    }
    // 完整度 → 状态色类
    function assetIntegClass(v) {
        if (v >= 80) return 'good';
        if (v >= 40) return 'warn';
        return 'bad';
    }
    // 建设阶段 → 色类
    function assetStageClass(stage) {
        var map = { '基础':'s1', '进阶':'s2', '专业':'s3', '顶尖':'s4', '禁忌':'s5' };
        return map[stage] || 's1';
    }
    // 标量: 编辑态返回可编辑组件, 否则纯文本
    function assetScalar(path, val, type, editMode) {
        return editMode ? editInput(path, val, type || 'text') : esc(safeStr(val, '-'));
    }
    // 标签数组 → chips
    function assetTagChips(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return '<span class="sam-asset-none">无</span>';
        return '<div class="sam-asset-tags">' + arr.map(function(t) {
            return '<span class="sam-asset-tag">' + esc(safeStr(t)) + '</span>';
        }).join('') + '</div>';
    }
    // 规模点阵(1-10); 编辑态改用输入框
    function assetScaleDots(scale, path, editMode) {
        if (editMode) return editInput(path + '.主体规模', scale, 'number');
        var dots = '';
        for (var i = 1; i <= 10; i++) {
            dots += '<span class="sam-asset-dot' + (i <= scale ? ' on' : '') + '"></span>';
        }
        return dots + '<span class="sam-asset-scale-num">' + scale + '/10</span>';
    }
    // KV行
    function assetKvRow(k, vHtml) {
        return '<div class="sam-asset-kv"><span class="k">' + esc(k) + '</span><span class="v">' + vHtml + '</span></div>';
    }
    /* 单个资产可折叠栏目(默认展开, 展开后显示全部资料) */
    function renderAssetBlock(name, a, path, editMode) {
        var type = safeStr(a.类型, '固定地产');
        var integ = safeNum(a.完整度, 100);
        var scale = safeNum(a.主体规模, 1);
        var integCls = assetIntegClass(integ);
        var integW = Math.max(0, Math.min(100, integ));
        var owners = normalizeAssetOwnersUi(a.所属对象);
        var ownerHead = owners.length === 0 ? '无主' : (owners.length === 1 ? displayPlayerIdentity(owners[0]) : '共管 ' + owners.length);

        // 头部: 图标 + 名字 + 类型徽章 + 完整度 + (编辑模式)删除按钮
        var assetDelBtn = editMode ? '<button type="button" class="sam-fc-del-btn sam-asset-del" data-asset-del="' + esc(path) + '" title="删除该资产">✕</button>' : '';
        var head = '<summary class="sam-asset-sum">'
            + '<span class="sam-asset-ico">' + assetTypeIcon(type) + '</span>'
            + '<span class="sam-asset-name">' + esc(name) + '</span>'
            + '<span class="sam-asset-badge">' + esc(type) + '</span>'
            + '<span class="sam-asset-badge">' + esc(ownerHead) + '</span>'
            + '<span class="sam-asset-integ ' + integCls + '">' + integ + '%</span>'
            + assetDelBtn
            + '</summary>';

        var body = '<div class="sam-asset-body">';

        // 概览: 完整度进度条 / 主体规模 / 类型
        body += '<div class="sam-asset-overview">'
            + '<div class="sam-asset-ov-row">'
            +   '<span class="sam-asset-ov-lbl">完整度</span>'
            +   '<div class="sam-asset-bar"><div class="sam-asset-bar-fill ' + integCls + '" style="width:' + integW + '%;"></div></div>'
            +   '<span class="sam-asset-ov-val">' + (editMode ? editInput(path + '.完整度', integ, 'number') : integ + '%') + '</span>'
            + '</div>'
            + '<div class="sam-asset-ov-row">'
            +   '<span class="sam-asset-ov-lbl">主体规模</span>'
            +   '<div class="sam-asset-scale">' + assetScaleDots(scale, path, editMode) + '</div>'
            + '</div>'
            + '<div class="sam-asset-ov-row">'
            +   '<span class="sam-asset-ov-lbl">类型</span>'
            +   '<span class="sam-asset-ov-val">' + (editMode ? editSelect(path + '.类型', ['固定地产', '大型载具与要塞', '便携式据点'], type) : esc(type)) + '</span>'
            + '</div>'
            + '<div class="sam-asset-ov-row">'
            +   '<span class="sam-asset-ov-lbl">所属对象</span>'
            +   '<span class="sam-asset-ov-val">' + (editMode ? editInput(path + '.所属对象', owners, 'tags') : assetOwnerChips(owners)) + '</span>'
            + '</div>'
            + '</div>';

        // 状态(长文本)
        var status = safeStr(a.状态, '');
        body += '<div class="sam-asset-sec">'
            + '<div class="sam-asset-sec-t">📋 状态</div>'
            + '<div class="sam-asset-text">' + (editMode ? editInput(path + '.状态', status, 'textarea') : (status ? esc(status) : '<span class="sam-asset-none">无</span>')) + '</div>'
            + '</div>';

        // 能源(可选)
        var energy = a.能源;
        if (energy && typeof energy === 'object' && (safeStr(energy.类型) || safeNum(energy.上限) > 0 || safeStr(energy.描述))) {
            var eCur = safeNum(energy.当前, 0);
            var eMax = safeNum(energy.上限, 0);
            var ePct = eMax > 0 ? Math.max(0, Math.min(100, Math.round(eCur / eMax * 100))) : 0;
            body += '<div class="sam-asset-sec">'
                + '<div class="sam-asset-sec-t">⚡ 能源 · ' + esc(safeStr(energy.类型, '-')) + '</div>'
                + '<div class="sam-asset-energy">'
                +   '<div class="sam-asset-bar"><div class="sam-asset-bar-fill energy" style="width:' + ePct + '%;"></div></div>'
                +   '<span class="sam-asset-energy-num">' + (editMode ? editInput(path + '.能源.当前', eCur, 'number') : eCur) + ' / ' + (editMode ? editInput(path + '.能源.上限', eMax, 'number') : eMax) + '</span>'
                + '</div>';
            var eDesc = safeStr(energy.描述, '');
            if (eDesc || editMode) {
                body += '<div class="sam-asset-text">' + (editMode ? editInput(path + '.能源.描述', eDesc, 'textarea') : esc(eDesc)) + '</div>';
            }
            body += '</div>';
        }

        // 消耗单元(可选)
        var units = a.消耗单元 || {};
        var uKeys = Object.keys(units);
        if (uKeys.length > 0) {
            body += '<div class="sam-asset-sec"><div class="sam-asset-sec-t">🔋 消耗单元 (' + uKeys.length + ')</div>';
            uKeys.forEach(function(uk) {
                var u = units[uk] || {};
                var upath = path + '.消耗单元.' + uk;
                var rem = safeNum(u.余量, 0);
                var cap = safeNum(u.上限, 0);
                var upct = cap > 0 ? Math.max(0, Math.min(100, Math.round(rem / cap * 100))) : 0;
                body += '<div class="sam-asset-unit">'
                    + '<div class="sam-asset-unit-head"><span class="sam-asset-unit-name">' + esc(uk) + '</span>'
                    +   '<span class="sam-asset-unit-num">' + (editMode ? editInput(upath + '.余量', rem, 'number') : rem) + ' / ' + (editMode ? editInput(upath + '.上限', cap, 'number') : cap) + '</span></div>'
                    + '<div class="sam-asset-bar"><div class="sam-asset-bar-fill" style="width:' + upct + '%;"></div></div>'
                    + (Array.isArray(u.加成) && u.加成.length ? '<div class="sam-asset-unit-bonus">' + assetTagChips(u.加成) + '</div>' : '')
                    + '</div>';
            });
            body += '</div>';
        }

        // 建设序列(可选)
        var seqs = a.建设序列 || {};
        var sKeys = Object.keys(seqs);
        if (sKeys.length > 0) {
            body += '<div class="sam-asset-sec"><div class="sam-asset-sec-t">🏗️ 建设序列 (' + sKeys.length + ')</div>';
            sKeys.forEach(function(sk) {
                var s = seqs[sk] || {};
                var spath = path + '.建设序列.' + sk;
                var stage = safeStr(s.阶段, '基础');
                var seqDelBtn = editMode ? '<button type="button" class="sam-fc-del-btn sam-asset-seq-del" data-asset-seq-del="' + esc(spath) + '" title="删除该建设序列">✕</button>' : '';
                body += '<div class="sam-asset-seq">'
                    + '<div class="sam-asset-seq-head">'
                    +   '<span class="sam-asset-seq-name">' + esc(sk) + '</span>'
                    +   '<span class="sam-asset-stage ' + assetStageClass(stage) + '">' + esc(stage) + '</span>'
                    +   seqDelBtn
                    + '</div>'
                    + '<div class="sam-asset-seq-rows">'
                    +   assetKvRow('功能', assetScalar(spath + '.功能', safeStr(s.功能), 'text', editMode))
                    +   (function() {
                            var cv = safeStr(s.产出);
                            // 产出为空或"无"时隐藏该字段与下次产出日期(编辑模式仍保留以便录入)
                            if (!editMode && (!cv || cv === '无')) return '';
                            return assetKvRow('产出', assetScalar(spath + '.产出', cv, 'text', editMode))
                                + assetKvRow('下次产出日期', assetScalar(spath + '.下次产出日期', safeStr(s.下次产出日期, '无'), 'text', editMode));
                        })()
                    + '</div>'
                    + (Array.isArray(s.加成) && s.加成.length ? '<div class="sam-asset-seq-bonus">' + assetTagChips(s.加成) + '</div>' : '')
                    + '</div>';
            });
            body += '</div>';
        }

        // 驻扎人员(可选)
        var staff = a.驻扎人员 || {};
        var stKeys = Object.keys(staff);
        if (stKeys.length > 0) {
            body += '<div class="sam-asset-sec"><div class="sam-asset-sec-t">👥 驻扎人员 (' + stKeys.length + ')</div>'
                + '<div class="sam-asset-staff">';
            stKeys.forEach(function(pn) {
                body += '<div class="sam-asset-staff-item"><span class="sam-asset-staff-name">' + esc(pn) + '</span><span class="sam-asset-staff-role">' + esc(safeStr(staff[pn], '-')) + '</span></div>';
            });
            body += '</div></div>';
        }

        // 待办事件(可选) —— 非编辑模式下整条可点击, 点击将该条文本填入输入框
        var todo = a.待办事件;
        if (Array.isArray(todo) && todo.length > 0) {
            body += '<div class="sam-asset-sec"><div class="sam-asset-sec-t">📌 待办事件 (' + todo.length + ')</div>'
                + '<div class="sam-asset-todo">';
            todo.forEach(function(t) {
                var todoText = safeStr(t);
                if (editMode) {
                    body += '<div class="sam-asset-todo-item">' + esc(todoText) + '</div>';
                } else {
                    body += '<div class="sam-asset-todo-item clickable" data-asset-todo="' + esc(todoText) + '" title="点击将该待办事件填入输入框">'
                        + '<span class="sam-asset-todo-text">' + esc(todoText) + '</span>'
                        + '<span class="sam-asset-todo-go">📩</span>'
                        + '</div>';
                }
            });
            body += '</div></div>';
        }

        body += '</div>';
        return '<details class="sam-asset" open>' + head + body + '</details>';
    }

    /* ===== 29. Tab: 传闻(全部一屏展示; 根据变量全部显示, 情报交易.真实内幕除外) =====
       R21-传闻交易: 移植自 创世状态栏.txt
         - 顶部工具栏: 一键删除全部传闻(需确认)
         - 每个分类标题右侧: 一键清除(仅清该分类, 需确认)
         - 情报交易卡片: 要价数字旁加"可交易"按钮, 点击发送文字到输入框(找{卖家}购买情报「{名}」)
         - 每条传闻名字最右侧: 单条删除按钮
    */
    function renderRumorTab(sd) {
        var r = sd.传闻 || {};
        var editMode = isEditMode();
        var html = '';
        var street = r.街头巷议 || {};
        var intel = r.情报交易 || {};
        var notice = r.布告与檄文 || {};
        // 顶部工具栏: 一键删除全部传闻(仅当确实有传闻时才出现)
        var total = Object.keys(street).length + Object.keys(intel).length + Object.keys(notice).length;
        if (total > 0) {
            html += '<div class="sam-rumor-toolbar">'
                + '<button type="button" class="sam-rumor-clearall-btn" data-rumor-clearall="1">🗑 一键删除全部传闻 ('+total+')</button>'
                + '</div>';
        }
        // 分类清除按钮(挂在 secBlock summary 右侧) — 仅当该分类传闻数 ≥ 2 才显示
        function clearBtn(sectionKey, count) {
            if (count < 2) return '';
            return '<button type="button" class="sam-rumor-clear-btn" data-rumor-clear-section="'+esc(sectionKey)+'">一键清除</button>';
        }
        var nStreet = Object.keys(street).length;
        var nIntel = Object.keys(intel).length;
        var nNotice = Object.keys(notice).length;
        // 街头巷议
        html += secBlock('🗣️ 街头巷议 ('+nStreet+')',
            renderRumorFullList(street, '传闻.街头巷议', editMode, [
                {k:'来源', f:'来源', type:'text'},
                {k:'可信度', f:'可信度', type:'select', options:['酒话','可疑','或许可信']},
                {k:'内容', f:'内容', type:'textarea', block:true}
            ], '街头巷议'), nStreet > 0, clearBtn('街头巷议', nStreet));
        // 情报交易: 要价字段标记 tradeable:true, 触发交易按钮
        html += secBlock('💎 情报交易 ('+nIntel+')',
            renderRumorFullList(intel, '传闻.情报交易', editMode, [
                {k:'卖家', f:'卖家', type:'text'},
                {k:'情报评级', f:'情报评级', type:'select', options:['F','E','D','C','B','A','S','SS','SSS','日常','战略']},
                // ★ 要价字段按世界书规则为字符串(带货币单位如"50万日元"), 不能用 number 类型强转
                {k:'要价', f:'要价', type:'text', tradeable:true},
                {k:'摘要', f:'摘要', type:'textarea', block:true}
            ], '情报交易'), nIntel > 0, clearBtn('情报交易', nIntel));
        // 布告与檄文
        html += secBlock('📜 布告与檄文 ('+nNotice+')',
            renderRumorFullList(notice, '传闻.布告与檄文', editMode, [
                {k:'发布者', f:'发布者', type:'text'},
                {k:'张贴位置', f:'张贴位置', type:'text'},
                {k:'内容', f:'内容', type:'textarea', block:true}
            ], '布告与檄文'), nNotice > 0, clearBtn('布告与檄文', nNotice));
        return html;
    }
    /* 传闻/布告等通用完整字段列表(按schema字段全量展示, 长文本字段独占一行)
       sectionKey: 当前分类 key(街头巷议/情报交易/布告与檄文), 用于单条删除按钮回写路径
       fd.tradeable=true 的字段, 在值旁追加"可交易"按钮(仅情报交易.要价)
    */
    function renderRumorFullList(obj, basePath, editMode, fields, sectionKey) {
        var keys = Object.keys(obj);
        if (keys.length === 0) return '<div class="sam-empty">[无]</div>';
        var html = '<div class="sam-list-1col">';
        keys.forEach(function(k) {
            var it = obj[k] || {};
            var path = basePath+'.'+k;
            var rows = '';
            var blockHtml = '';
            fields.forEach(function(fd) {
                var val = it[fd.f];
                var fpath = path+'.'+fd.f;
                var isReadonly = isReadonlyPath(fpath);
                if (fd.block) {
                    var content;
                    if (editMode && !isReadonly) {
                        content = editInput(fpath, safeStr(val), fd.type === 'textarea' ? 'textarea' : 'text');
                    } else if (isReadonly) {
                        content = '<span class="sam-edit-readonly">'+esc(safeStr(val))+'</span>';
                    } else {
                        content = esc(safeStr(val) || '-');
                    }
                    blockHtml += '<div class="sam-rumor-content" style="margin-top:4px;">'
                        + '<div style="font-size:11px;color:var(--sam-sub);margin-bottom:3px;">'+esc(fd.k)+'</div>'
                        + '<div style="font-size:12px;color:var(--sam-text);line-height:1.6;word-break:break-word;white-space:pre-wrap;">'+content+'</div>'
                        + '</div>';
                } else {
                    var display;
                    if (fd.type === 'select') {
                        display = editMode && !isReadonly ? editSelect(fpath, fd.options, safeStr(val)) : esc(safeStr(val) || '-');
                    } else if (fd.type === 'number') {
                        var nv = safeNum(val, 0);
                        display = editMode && !isReadonly ? editInput(fpath, nv, 'number') : nv;
                    } else {
                        display = editMode && !isReadonly ? editInput(fpath, safeStr(val), 'text') : (isReadonly ? '<span class="sam-edit-readonly">'+esc(safeStr(val))+'</span>' : esc(safeStr(val) || '-'));
                    }
                    // ★ 可交易按钮: 紧贴要价数字右侧(仅情报交易.要价 字段)
                    if (fd.tradeable) {
                        var seller = safeStr(it.卖家) || '不明';
                        // ★ 要价为带货币单位的字符串(如"50万日元"), 保留原值透传给按钮 data-rumor-price,
                        //   不可强转 number 否则非纯数字字符串被归零(导致按钮也是0)
                        var priceStr = safeStr(val) || '0';
                        display = '<span class="sam-rumor-price">'+display
                            + '<button type="button" class="sam-rumor-trade-btn" data-rumor-trade="1" data-rumor-name="'+esc(k)+'" data-rumor-seller="'+esc(seller)+'" data-rumor-price="'+esc(priceStr)+'" title="发送交易请求到输入框">🛒 可交易</button>'
                            + '</span>';
                    }
                    rows += '<div class="sam-row"><span class="k">'+esc(fd.k)+'</span><span class="v">'+display+'</span></div>';
                }
            });
            // ★ 单条删除按钮: 挂在卡片标题最右侧(仅编辑模式显示)
            var delBtn = editMode ? '<button type="button" class="sam-rumor-del-btn" data-rumor-del="1" data-rumor-section="'+esc(sectionKey||'')+'" data-rumor-name="'+esc(k)+'" title="删除该条传闻">✕</button>' : '';
            html += '<div class="sam-full-card">'
                + '<div class="sam-fc-head"><div class="sam-fc-title">'+esc(k)+'</div>'+delBtn+'</div>'
                + '<div class="sam-fc-rows">'+rows+'</div>'
                + blockHtml
                + '</div>';
        });
        html += '</div>';
        return html;
    }

    /* ===== 30. Tab: 世界(全部一屏展示) ===== */
    function renderWorldTab(sd) {
        var w = sd.世界 || {};
        var isSingleWorld = (sd.设置 && sd.设置.单一世界 === true);
        var isInHub = (sd.系统状态 && sd.系统状态.是否在主神空间 === true);
        var editMode = isEditMode();
        var html = '';
        var alienRadar = w.异端雷达 || {};
        var alienRoster = alienRadar.名单 && typeof alienRadar.名单 === 'object' && !Array.isArray(alienRadar.名单) ? alienRadar.名单 : {};
        var alienNames = Object.keys(alienRoster);
        var alienAliveCount = alienNames.filter(function(name) {
            return safeStr((alienRoster[name] || {}).状态) !== '死亡';
        }).length;
        // 世界介绍(时间/地点已在顶部 topbar 显示, 此处不重复)
        var introFields = [
            {k:'名称', path:'世界.名称', type:'text'},
            {k:'位格', path:'世界.位格', type:'text'},
            {k:'难度', path:'世界.难度', type:'text'},
            {k:'模式', path:'世界.异端雷达.当前模式', type:'text', hideOnSingle:true}
        ];
        var introHtml = '';
        introFields.forEach(function(f) {
            if (f.hideOnSingle && (isSingleWorld || isInHub)) return;
            var v = resolvePath(sd, f.path);
            var display;
            if (f.readonly || isReadonlyPath(f.path)) display = '<span class="sam-edit-readonly">'+esc(v)+'</span>';
            else if (editMode) display = editInput(f.path, v, f.type);
            else display = esc(safeStr(v));
            introHtml += '<div class="sam-row"><span class="k">'+esc(f.k)+'</span><span class="v">'+display+'</span></div>';
        });
        var stabilityValue = Math.max(0, Math.min(120, safeNum(w.稳定, 100)));
        var stabilityPct = Math.max(0, Math.min(100, (stabilityValue / 120) * 100));
        var stabilityOverClass = stabilityValue > 100 ? ' over' : '';
        introHtml += '<div class="sam-world-stability">'
            + '<div class="sam-world-stability-head"><span class="k">稳定度</span><span class="v">'+esc(stabilityValue)+'</span></div>'
            + '<div class="sam-world-stability-track"><div class="sam-world-stability-fill'+stabilityOverClass+'" style="width:'+stabilityPct+'%"></div><span class="sam-world-stability-mark100"></span></div>'
            + '<div class="sam-world-stability-scale"><span class="s0">0</span><span class="s100">100</span><span class="s120">120</span></div>'
            + '</div>';
        if (!isSingleWorld && !isInHub) {
            introHtml += '<div class="sam-row"><span class="k">异端存活数量</span><span class="v"><span class="sam-edit-readonly">'+alienAliveCount+'</span></span></div>';
        }
        html += secBlock('🌍 世界介绍', introHtml);
        // 异端详情暂时对角色隐藏；保留完整折叠栏代码，后续只需将此开关改为 true 即可恢复。
        var SHOW_ALIEN_ROSTER_DETAILS = false;
        if (SHOW_ALIEN_ROSTER_DETAILS && !isSingleWorld && !isInHub && alienNames.length) {
            var alienHtml = '<div class="sam-alien-list">';
            alienNames.forEach(function(name) {
                var alien = alienRoster[name] || {};
                var status = safeStr(alien.状态) === '死亡' ? '死亡' : '活跃';
                var stateClass = status === '死亡' ? 'dead' : 'active';
                var sourceText = alien.来源 ? (alien.来源 === '原创' ? '原创' : '《' + alien.来源 + '》') : '';
                var meta = [sourceText, alien.阵营, alien.职业, alien.层级 ? alien.层级 + '级' : ''].filter(Boolean).join(' · ');
                alienHtml += '<div class="sam-alien-item"><div class="sam-alien-main"><div class="sam-alien-name">'+esc(name)+'</div>'
                    + (meta ? '<div class="sam-alien-meta">'+esc(meta)+'</div>' : '')
                    + (alien.经历 ? '<div class="sam-alien-meta">履历 · '+esc(alien.经历)+'</div>' : '')
                    + '</div><span class="sam-alien-state '+stateClass+'">'+esc(status)+'</span></div>';
            });
            alienHtml += '</div>';
            html += secBlock('☄️ 异端名单 · ' + alienAliveCount + '/' + alienNames.length, alienHtml, false);
        }
        // 法则(移到世界介绍下方)
        var laws = Array.isArray(w.法则) ? w.法则 : [];
        var lawHtml = '';
        if (laws.length === 0) lawHtml += '<div class="sam-empty">[无法则]</div>';
        else laws.forEach(function(law, i) { lawHtml += '<div class="sam-row"><span class="k">法则'+(i+1)+'</span><span class="v">'+(editMode ? editInput('世界.法则.'+i, safeStr(law), 'text') : esc(law))+'</span></div>'; });
        html += secBlock('📜 法则', lawHtml);
        // 货币
        var cur = w.货币 || {};
        var curHtml = '';
        curHtml += '<div class="sam-row"><span class="k">体系</span><span class="v">'+(editMode ? editInput('世界.货币.体系', safeStr(cur.体系), 'text') : esc(cur.体系||'-'))+'</span></div>';
        curHtml += '<div class="sam-row"><span class="k">购买力</span><span class="v">'+(editMode ? editInput('世界.货币.购买力基准', safeStr(cur.购买力基准), 'text') : esc(cur.购买力基准||'-'))+'</span></div>';
        curHtml += '<div class="sam-row"><span class="k">经济波动</span><span class="v">'+(editMode ? editInput('世界.货币.经济波动', safeStr(cur.经济波动), 'text') : esc(cur.经济波动||'-'))+'</span></div>';
        html += secBlock('💰 货币', curHtml);
        // 因果轨道(移到货币下方、探索点上方)
        var ko = w.因果轨道 || {};
        var koHtml = '';
        koHtml += '<div class="sam-row"><span class="k">当前阶段</span><span class="v">'+(editMode ? editInput('世界.因果轨道.当前阶段', safeStr(ko.当前阶段), 'text') : esc(ko.当前阶段||'-'))+'</span></div>';
        koHtml += '<div class="sam-row"><span class="k">故事线</span><span class="v">'+(editMode ? editInput('世界.因果轨道.故事线', safeStr(ko.故事线), 'text') : esc(ko.故事线||'-'))+'</span></div>';
        koHtml += '<div class="sam-row"><span class="k">下一节点</span><span class="v">'+(editMode ? editInput('世界.因果轨道.下一节点', safeStr(ko.下一节点), 'text') : esc(ko.下一节点||'-'))+'</span></div>';
        var off = ko.偏移记录 || {};
        var okeys = Object.keys(off);
        var offHtml = '';
        okeys.forEach(function(k) {
            var o = off[k] || {};
            var path = '世界.因果轨道.偏移记录.'+k;
            offHtml += '<div class="sam-row"><span class="k">'+esc(k)+'</span><span class="v">'+(editMode ? editInput(path+'.描述', safeStr(o.描述), 'text') : esc(o.描述||'-'))+'</span></div>';
        });
        if (okeys.length > 0) {
            koHtml += '<details class="sam-sec" style="margin-top:6px;">'
                + '<summary class="sam-sec-sum"><span class="sam-sec-title">偏差记录 ('+okeys.length+')</span></summary>'
                + '<div class="sam-sec-body">' + offHtml + '</div>'
                + '</details>';
        }
        html += secBlock('🌀 因果轨道', koHtml);
        // 探索点
        var exp = w.探索 || {};
        // 编辑模式删除按钮(探索点/势力通用, 挂在卡片 head 右侧)
        function worldDelBtn(path) {
            if (!editMode) return '';
            return '<button type="button" class="sam-rumor-del-btn" data-world-del="1" data-del-path="'+esc(path)+'" title="删除该条目">✕</button>';
        }
        var ekeys = Object.keys(exp);
        var expHtml = '';
        if (ekeys.length === 0) expHtml += '<div class="sam-empty">[无探索点]</div>';
        else ekeys.forEach(function(k) {
            var e = exp[k] || {};
            var path = '世界.探索.'+k;
            var q = e.风险 ? parseRarity(e.风险) : '';
            var rows = fcRow('探索度', safeNum(e.探索度,0)+'%', path+'.探索度', editMode, 'number');
            var body = fcRow('描述', e.描述, path+'.描述', editMode);
            expHtml += fullCard(q, k, rows, body, worldDelBtn(path));
        });
        html += secBlock('🧭 探索点 ('+Object.keys(w.探索||{}).length+')', expHtml, Object.keys(w.探索||{}).length > 0);
        // 势力
        var forces = w.势力 || {};
        var fkeys = Object.keys(forces);
        var forceHtml = '';
        if (fkeys.length === 0) forceHtml += '<div class="sam-empty">[无势力]</div>';
        else fkeys.forEach(function(k) {
            var f = forces[k] || {};
            var path = '世界.势力.'+k;
            var q = f.实力 ? parseRarity(f.实力) : '';
            var rows = '';
            rows += fcRow('声望', safeNum(f.声望,0), path+'.声望', editMode, 'number');
            var body = fcRow('描述', f.描述, path+'.描述', editMode);
            forceHtml += fullCard(q, k, rows, body, worldDelBtn(path));
        });
        html += secBlock('⚔️ 势力 ('+Object.keys(w.势力||{}).length+')', forceHtml, Object.keys(w.势力||{}).length > 0);
        return html;
    }

    /* ===== 30b. Tab: 商城(主神空间交易终端) =====
       - 顶部紧凑余额条: 显示当前空间币(角色.空间币, 只读, 由系统结算发放)
       - 状态提示条: 战斗中/任务世界/主神空间 三态, 置于商城入口栏目上方
       - 交易规则栏目(折叠): 双轨经济/物价锚点等, 置于商城入口上方
       - 商城入口栏目: 需求输入框(左) + 刷新商品按钮(右); 不在主神空间/战斗中时禁用
         刷新商品按钮: 调正文AI generateRaw 生成商品库 → 写回 stat_data.商城 → renderAll
     */
    function renderShopTab(sd) {
        var p = sd.角色 || {};
        var sys = sd.系统状态 || {};
        var editMode = isEditMode();
        var coin = safeNum(p.空间币, 0);
        var inHub = (sys.是否在主神空间 === true);
        var isCombat = (sys.是否战斗中 === true);
        // ★ 多角色商城: 校正 shopCurrentActor(若当前NPC已离场则退回角色), 并解析当前角色对象
        shopEnsureActorValid(sd);
        var actorCtx = shopResolveCharacter(sd, shopCurrentActor);
        var curCharacter = actorCtx.character;
        // 血统数量上限判定: 以当前选中角色的血统数为准(用于商城血统区灰显)
        shopBloodCount = Object.keys(curCharacter.血统 || {}).length;
        shopBloodLimit = BLOODLINE_CAP;
        var isSingleWorld = (sd && sd.设置 && sd.设置.单一世界 === true);
        var html = '';
        // 顶部紧凑余额条(空间币由系统结算发放, 余额只读展示; 编辑模式仅作兜底)
        var coinDisplay = editMode ? editInput('角色.空间币', coin, 'number') : esc(String(coin));
        html += '<div class="sam-shop-coin-mini"><span class="lbl">💰 余额</span><span class="val">' + coinDisplay + '</span><span class="lbl">空间币</span></div>';
        var credentialLedger = p.权限凭证 || {};
        var credentialChips = [];
        for (var _uiCi = 0; _uiCi < SHOP_PERMISSION_QUALITY_ORDER.length; _uiCi++) {
            var _uiGrade = SHOP_PERMISSION_QUALITY_ORDER[_uiCi];
            var _uiQty = Math.max(0, Math.floor(safeNum(credentialLedger[_uiGrade], 0)));
            if (_uiQty > 0) credentialChips.push('<span class="sam-shop-credential-chip">'+esc(_uiGrade)+' ×'+_uiQty+'</span>');
        }
        html += '<div class="sam-shop-credential-mini"><span class="lbl">🎫 权限凭证</span>'
            + (credentialChips.length ? credentialChips.join('') : '<span class="sam-shop-credential-empty">无</span>')
            + '</div>';
        // 状态提示条: 置于商城入口上方(独立于栏目, 不折叠)
        if (isCombat) {
            html += '<div class="sam-shop-warn">⚔️ 战斗中无法交易, 请在安全区域后再试</div>';
        } else if (!inHub && !isSingleWorld) {
            html += '<div class="sam-shop-warn">🔒 当前位于任务世界, 空间币已锁定<br>需返回主神空间后才能开启商城交易</div>';
        } else {
            if (isSingleWorld) {
                html += '<div class="sam-shop-ok">✅ 已在安全区域, 可开启商城交易</div>';
            }else{
                html += '<div class="sam-shop-ok">✅ 已在主神空间, 可开启商城交易</div>';
            }
        }
        // 交易规则(折叠): 置于商城入口上方
        var ruleHtml = '<div class="sam-row"><span class="k">交易货币</span><span class="v">空间币(主神空间专用)</span></div>'
            + '<div class="sam-row"><span class="k">商品类别</span><span class="v">装备 / 道具 / 技能 / 血统 / 升级服务</span></div>'
            + '<div class="sam-row"><span class="k">物价区间</span><span class="v">F(10-99) · E(100-999) · D(1k-4.9k) · C(5k-2w) · B(2w-8w) · A(8w-32w) · S(32w-127w) · SS(128w-511w) · SSS(512w+)</span></div>'
            + '<div class="sam-row"><span class="k">权限锁</span><span class="v">C级起，购买/升级高于购买对象当前层级的商品额外消耗同品质权限凭证×1；同级及以下不消耗，血统融合结果不消耗</span></div>'
            + '<div class="sam-row"><span class="k">双轨隔离</span><span class="v">任务世界内强制使用本地货币, 空间币不可流通</span></div>';
        html += secBlock('📜 交易规则', ruleHtml, false);
        // 商城入口(含商品市场): 需求输入框(左) + 刷新商品按钮(右) + Tab条 + 列表 + 购物车条
        // 不在主神空间时禁用入口控件, 但商品库仍可浏览(已购入的库存)
        var canShop = (!isCombat && (inHub || isSingleWorld));
        // 刷新中: 按钮置灰 + 文案变更, 需求输入框也禁用(由模块级 shopRefreshing 驱动, 切换界面/重渲染仍保持)
        var refreshDisabled = (!canShop || shopRefreshing) ? ' disabled' : '';
        var refreshBtnText = shopRefreshing ? '🔄 正在刷新商品…' : '🔄 刷新商品';
        var reqDisabled = (!canShop || shopRefreshing) ? ' disabled' : '';
        // ★ 角色下拉框: 角色自身 + 在场队友NPC; 刷新中也一并禁用
        var actorDisabled = (!canShop || shopRefreshing) ? ' disabled' : '';
        var actorOpts = shopBuildActorOptions(sd);
        var actorHtml = '<span class="sam-shop-actor-label">为目标:</span>'
            + '<select class="sam-shop-actor-select" data-shop-actor'+actorDisabled+'>';
        for (var ao = 0; ao < actorOpts.length; ao++) {
            var optEntry = actorOpts[ao];
            var sel = (optEntry.name === shopCurrentActor) ? ' selected' : '';
            actorHtml += '<option value="'+esc(optEntry.name)+'"'+sel+'>'+esc(optEntry.label)+'</option>';
        }
        actorHtml += '</select>';
        // 布局: 输入框单独一排(手机端不被挤窄); 目标下拉框 + 刷新按钮占另一排
        // 跨刷新保留输入内容: 渲染时回填模块级 shopReqText(刷新后 renderAll 重建DOM, value属性使其不丢)
        var entryHtml = '<div class="sam-shop-entry">'
            + '<input type="text" class="sam-shop-req" data-shop-req placeholder="写入需求内容(刷新后内容保留, 不满意可直接再刷)"'+reqDisabled+' value="'+esc(shopReqText)+'">'
            + '<div class="sam-shop-entry-actions">'
            + actorHtml
            + '<button type="button" class="sam-shop-refresh-btn" data-shop-refresh'+refreshDisabled+'>'+refreshBtnText+'</button>'
            + '</div>'
            + '</div>';
        // ===== 市场区: 从 stat_data.商城[当前角色的成员商库] 读取持久化商品数据 =====
        // 每个角色独有商品库, 切换角色时清空当前显示并加载该角色的库存; 库存由AI在刷新后写入, 持久保存在MVU中
        var rawMarket = (sd.商城 && sd.商城) ? sd.商城 : null;
        var actorLib = shopGetActorLibRaw(rawMarket, shopCurrentActor);
        if (actorLib) {
            shopMarketData = shopNormalizeMarketData(actorLib);
            // 切换聊天/新商品上架时, 若当前区域无数据则回退到首个有数据的区域
            var fallback = shopPickFirstAvailableTab();
            if (!shopActiveTab || !shopTabHasData(shopActiveTab)) shopActiveTab = fallback;
        } else {
            shopMarketData = null;
        }
        // 商品面板与"刷新/购买"能力绑定: 不能刷新(战斗中/不在主神空间)时, 直接隐藏下方整个商品面板
        //   canShop 下再细分三态:
        //     刷新中 → 固定高容器 + 刷新中提示(隐藏原列表)
        //     已刷新 → 固定高容器 + Tab条 + 列表 + 购物车条(三段式, footer常驻底部)
        //     空库   → 空库提示
        //   !canShop → 不渲染任何商品面板(原因由上方状态提示条说明)
        if (canShop) {
            if (shopRefreshing) {
                entryHtml += '<div class="sam-shop-market"><div class="sam-shop-refreshing">'
                    + '<div class="sam-shop-refreshing-spin">🔄</div>'
                    + '<div>正在请求正文AI生成商品…<br>可以关闭界面或等待, 商品刷新完成后会弹窗提示。</div>'
                    + '<button type="button" class="sam-shop-stop-btn" data-sam-act="shop-stop-refresh">⏹ 停止刷新(卡住时点此恢复)</button>'
                    + '</div></div>';
            } else if (shopMarketData) {
                var hasAnyItem = shopMarketHasAnyData();
                entryHtml += '<div class="sam-shop-market">' + shopRenderTabs() + shopRenderContent(coin) + (hasAnyItem ? shopRenderFooter(coin) : '') + '</div>';
            } else {
                entryHtml += '<div class="sam-shop-empty">尚未刷新商品, 请在上方写入需求后点击「刷新商品」</div>';
            }
        }
        html += secBlock('🛒 商城入口', entryHtml, true);
        var receiptText = safeStr(sys.待播报记录, '').trim();
        var receiptHtml = receiptText
            ? '<div style="white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.55;color:var(--sam-text)">'+esc(receiptText)+'</div>'
                + '<div style="display:flex;justify-content:flex-end;margin-top:8px"><button type="button" class="sam-confirm-btn cancel" data-receipt-clear>删除小票</button></div>'
            : '<div class="sam-empty">暂无待叙事交易</div>';
        html += secBlock('🧾 待播报记录', receiptHtml, true);
        return html;
    }

    // 市场区辅助: 判断某区域是否有数据
    function shopTabHasData(cat) {
        if (!shopMarketData) return false;
        // 装备区/技能区/道具区: 分组对象 {类型label: [...]}; 血统区: 扁平数组
        if (cat === '装备区' || cat === '技能区' || cat === '道具区') {
            var groups = shopMarketData[cat] || {};
            for (var g in groups) { if (groups.hasOwnProperty(g) && groups[g] && groups[g].length) return true; }
            return false;
        }
        return (shopMarketData[cat] || []).length > 0;
    }
    function shopPickFirstAvailableTab() {
        var order = ['装备区','道具区','技能区','血统区','形态区','升级区'];
        for (var i = 0; i < order.length; i++) { if (shopTabHasData(order[i])) return order[i]; }
        return '装备区';
    }
    // 检测商城全部区域是否至少有一个商品(用于决定是否渲染购物车栏)
    function shopMarketHasAnyData() {
        if (!shopMarketData) return false;
        var cats = ['装备区','道具区','技能区','血统区','形态区','升级区'];
        for (var i = 0; i < cats.length; i++) { if (shopTabHasData(cats[i])) return true; }
        return false;
    }
    // 按区域/槽位/名称查找标准化商品条目(返回数组, 供 toggleSelect 使用)
    function shopFindItems(cat, slot, name) {
        if (!shopMarketData) return [];
        var out = [];
        // 装备区/技能区/道具区: 分组对象(slot=类型label); 血统区: 扁平数组(slot忽略)
        if (cat === '装备区' || cat === '技能区' || cat === '道具区') {
            var groups = shopMarketData[cat] || {};
            if (slot) {
                // 有slot: 精确定位该类型分组
                var arr = groups[slot] || [];
                for (var i = 0; i < arr.length; i++) { if (arr[i].name === name) out.push(arr[i]); }
            } else {
                // 无slot(数量控件等场景): 遍历全部分组查找
                for (var g2 in groups) {
                    if (!groups.hasOwnProperty(g2)) continue;
                    var arr2 = groups[g2] || [];
                    for (var i2 = 0; i2 < arr2.length; i2++) { if (arr2[i2].name === name) out.push(arr2[i2]); }
                }
            }
        } else {
            var items = shopMarketData[cat] || [];
            for (var k = 0; k < items.length; k++) { if (items[k].name === name) out.push(items[k]); }
        }
        return out;
    }

    