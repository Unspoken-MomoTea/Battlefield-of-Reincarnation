/* ===== 31. 详情弹窗(点击卡片) ===== */
    // 角色不可见的敏感字段(不给角色看)
    var HIDDEN_FIELDS = ['隐藏真相', '真实内幕', '态度', '真属性'];
    function openDetailModal(path, title) {
        var sd = getStatData();
        if (!sd) return;
        var obj = resolvePath(sd, path);
        if (obj == null) { showModal(title, '<div class="sam-empty">数据不存在</div>'); return; }
        // NPC详情: 走专用角色档案面板(分区精美排版, 空值不显示, 不裸露技术字段)
        var isNpc = (typeof path === 'string' && path.indexOf('关系列表.') === 0);
        if (isNpc) {
            // ★ 编辑模式: NPC档案内嵌可编辑字段(种族/身份/好感度/战斗数值/档案文本), 底部追加保存按钮
            var editMode = isEditMode();
            var npcHtml = renderNpcDetail(obj, title, editMode, path);
            var footHtml = editMode ? '<div class="sam-nd-edit-tip">✎ 编辑模式 · 点击数值就地修改, 失焦自动暂存</div><button type="button" class="sam-save-btn sam-nd-save">💾 保存</button>' : '';
            showModal(title + ' · 角色档案' + (editMode ? ' · 编辑' : ''), '<div class="sam-nd">'+npcHtml+footHtml+'</div>');
            if (editMode) bindEditorEvents($('#samsara-modal')); // modal 独立DOM, 需单独委托编辑事件
            return;
        }
        // ★ 编辑模式: 通用详情(世界条目/角色状态等)也走递归编辑渲染, 底部追加保存按钮
        var ed2 = isEditMode();
        var hidden = HIDDEN_FIELDS;
        var html = ed2 ? renderDetailNode(obj, hidden, [], ed2, path) : renderDetailNode(obj, hidden);
        var footHtml2 = ed2 ? '<div class="sam-nd-edit-tip">✎ 编辑模式 · 点击数值就地修改, 失焦自动暂存</div><button type="button" class="sam-save-btn sam-nd-save">💾 保存</button>' : '';
        showModal(title + ' · 详情' + (ed2 ? ' · 编辑' : ''), '<div class="sam-detail">'+html+'</div>'+footHtml2);
        if (ed2) bindEditorEvents($('#samsara-modal')); // modal 独立DOM, 需单独委托编辑事件
    }
    /* NPC角色档案专用渲染: 分区卡片式, 仅显示有值字段, 不裸露HP_MAX/EP_MAX/空对象/未激活形态等技术字段
       ★ editMode(编辑模式): 基础信息/好感度/战斗数值/档案文本渲染为点击即编辑控件(editInput), 层级/最终属性保持只读(受 isReadonlyPath 保护) */
    function renderNpcDetail(n, name, editMode, npcPath) {
        if (!n || typeof n !== 'object') return '<div class="sam-empty">数据不存在</div>';
        editMode = !!editMode;
        npcPath = npcPath || ('关系列表.' + name);
        // 层级显示: 形态激活且形态层级>自身时显示形态层级(仅显示, 不写回)
        var _dispRaw = displayTierRaw(n);
        var tierRoman = tierRomanOf(_dispRaw); var q = tierQOfClass(_dispRaw);
        var hp = safeNum(n.HP,0), hpmax = safeNum(n.HP_MAX,0);
        var ep = safeNum(n.EP,0), epmax = safeNum(n.EP_MAX,0);
        var thp = safeNum(n.THP,0);
        var favor = safeNum(n.好感度,0);
        var race = safeStr(n.种族) || '';
        var rawIdArr = Array.isArray(n.身份) ? n.身份 : [];
        var showAllId = (n.是否队友 === true) || (favor > 60);
        var idArr = showAllId ? rawIdArr : filterHiddenIdentity(rawIdArr);
        // 编辑态字段取值辅助: 值单元格(可编辑=editInput, 只读/非编辑=纯文本)
        var edCell = function(field, val, type) {
            var p = npcPath + '.' + field;
            if (editMode && !isReadonlyPath(p)) {
                var v = (type === 'number') ? safeNum(val, 0) : val;
                return '<span class="v">'+editInput(p, v, type || 'text')+'</span>';
            }
            return '<span class="v">'+esc(safeStr(val))+'</span>';
        };
        // 编辑态开关辅助(在场/是否队友)
        var edToggle = function(field, val) {
            var p = npcPath + '.' + field;
            if (editMode && !isReadonlyPath(p)) return editToggle(p, val);
            return (val === true) ? '是' : '否';
        };
        var cf = n.当前形态 || {};
        var formName = (cf.激活 === true && safeStr(cf.名称)) ? safeStr(cf.名称) : '';
        var attrs = n.最终属性 || {};
        var html = '';
        // ① 头部: 名字 + 形态标签 + 层级徽章 + 在场/队友徽章
        html += '<div class="sam-nd-head"><div class="sam-nd-name">'+esc(name||'')+(formName?'<span class="sam-nd-form">🌀 '+esc(formName)+'</span>':'')+'</div>';
        html += '<div class="sam-nd-badges"><span class="sam-nd-tier q-'+q+'">'+esc(tierRoman)+'</span>';
        if (n.在场 === true) html += '<span class="sam-nd-badge present">在场</span>';
        if (n.是否队友 === true) html += '<span class="sam-nd-badge team">队友</span>';
        // 编辑模式: 头部徽章区追加 在场/队友 开关(点击切换, 保存时写回)
        if (editMode) {
            html += '<span class="sam-nd-badge edit-toggle">在场 '+editToggle(npcPath+'.在场', n.在场 === true)+'</span>';
            html += '<span class="sam-nd-badge edit-toggle">队友 '+editToggle(npcPath+'.是否队友', n.是否队友 === true)+'</span>';
        }
        html += '</div></div>';
        // ② 好感度双向条 (中线=0, 正向右绿, 负向左红); 编辑模式数值部分可编辑
        var favorColor = favor > 60 ? '#56bf7b' : (favor < 0 ? 'var(--sam-hp)' : 'var(--sam-accent)');
        var favorPct = Math.min(50, Math.abs(favor) / 2);
        var favorDir = favor >= 0 ? 'pos' : 'neg';
        html += '<div class="sam-nd-favor"><span class="sam-nd-favor-lbl">好感度</span>';
        html += '<div class="sam-nd-favor-track"><div class="sam-nd-favor-fill '+favorDir+'" style="width:'+favorPct+'%;background:'+favorColor+';"></div></div>';
        if (editMode && !isReadonlyPath(npcPath+'.好感度')) {
            html += '<span class="sam-nd-favor-val" style="color:'+favorColor+';">'+editInput(npcPath+'.好感度', favor, 'number')+'</span>';
        } else {
            html += '<span class="sam-nd-favor-val" style="color:'+favorColor+';">'+(favor>0?'+':'')+favor+'</span>';
        }
        html += '</div>';
        // ③ 基础信息网格 (编辑模式恒渲染可编辑行; 只读态仅有值时)
        var grid = '';
        if (editMode) {
            grid += ndEditRow('种族', edCell('种族', race));
            // ★ 身份编辑用原始数组(未过滤隐藏阵营身份), 避免保存时把隐藏身份冲掉; flushStagedDisplay 对 .身份 自动拆数组
            grid += ndEditRow('身份', edCell('身份', rawIdArr.join(',')));
            var npcQty2 = safeNum(n.数量, 1);
            grid += ndEditRow('数量', edCell('数量', npcQty2, 'number'));
        } else {
            if (race) grid += ndRow('种族', race);
            if (idArr.length) grid += ndRow('身份', idArr.join(' / '));
            var npcQty = safeNum(n.数量, 1);
            if (npcQty > 1) grid += ndRow('数量', 'x'+npcQty);
        }
        if (grid) html += '<div class="sam-nd-grid">'+grid+'</div>';
        // ★ 职业: 编辑模式→结构化编辑器(同角色面板); 只读态→折叠面板(自带 🎖 标题)
        if (editMode && !isReadonlyPath(npcPath+'.职业')) {
            html += occupationEditHtml(n.职业, npcPath+'.职业');
        } else {
            var occHtml = occupationCardsHtml(n.职业);
            if (occHtml) html += occHtml;
        }
        // ④ 态度 (编辑模式: 全宽可编辑块(textarea 在 2 列网格中过窄, 故独立渲染); 只读态: 仅有值时显示引用)
        if (editMode) {
            if (!isReadonlyPath(npcPath+'.态度')) {
                html += '<div class="sam-nd-block"><div class="sam-nd-block-lbl">态度</div><div class="sam-nd-block-ct">'+editInput(npcPath+'.态度', safeStr(n.态度), 'textarea')+'</div></div>';
            }
        } else if (safeStr(n.态度)) {
            html += '<div class="sam-nd-quote">💬 '+esc(safeStr(n.态度))+'</div>';
        }
        // ⑤ 战斗属性条 (HP_MAX/EP_MAX/THP 任一>0 才显示; 编辑模式: HP/EP/THP 当前值可编辑, 上限只读)
        if (editMode || hpmax > 0 || epmax > 0 || thp > 0) {
            html += '<div class="sam-nd-sec-lbl">⚔ 战斗属性</div><div class="sam-nd-bars">';
            if (editMode) {
                // 编辑模式: 直接用编辑行(标签+当前值编辑框+只读上限), 不再重复渲染只读进度条
                html += npcEdBar('HP', npcPath+'.HP', hp, hpmax > 0 ? hpmax : null, 'var(--sam-hp)', editMode);
                html += npcEdBar('EP', npcPath+'.EP', ep, epmax > 0 ? epmax : null, 'var(--sam-ep)', editMode);
                html += npcEdBar('THP', npcPath+'.THP', thp, null, 'var(--sam-thp)', editMode);
            } else {
                if (hpmax > 0) html += npcBar('HP', hp, hpmax, 'var(--sam-hp)');
                if (epmax > 0) html += npcBar('EP', ep, epmax, 'var(--sam-ep)');
                if (thp > 0) html += npcThpRow(thp);
            }
            html += '</div>';
        }
        // ⑤ 最终属性 (仅非零项, 排除武器对象) + 武器攻击(并入最终属性, ATK/MATK分两排)
        // 固定顺序: 五维 → 力量修正等(修正) → DEF/MDEF/AP → 武器 → 减伤率 → 检定
        var ATTR_ORDER = [
            '力量','敏捷','体质','精神','魅力',
            '力量修正','敏捷修正','体质修正','精神修正','魅力修正',
            'DEF','MDEF','AP',
            '物理减伤率','魔法减伤率',
            '先攻DC','防御DC'
        ];
        var attrKeys = ATTR_ORDER.filter(function(k){
            return Object.prototype.hasOwnProperty.call(attrs, k) && k !== '武器' && safeNum(attrs[k],0) !== 0;
        });
        // 兜底: ATTR_ORDER 之外的非0非武器键(防漏新字段)
        Object.keys(attrs).forEach(function(k){
            if (k === '武器' || ATTR_ORDER.indexOf(k) >= 0) return;
            if (safeNum(attrs[k],0) !== 0 && attrKeys.indexOf(k) < 0) attrKeys.push(k);
        });
        var wpn = attrs.武器;
        var wpnKeys = (wpn && typeof wpn === 'object') ? Object.keys(wpn) : [];
        if (attrKeys.length || wpnKeys.length) {
            html += '<div class="sam-nd-sec-lbl">📊 最终属性</div>';
            if (attrKeys.length) {
                html += '<div class="sam-nd-attrs">';
                attrKeys.forEach(function(k){ html += '<div class="sam-nd-attr"><span class="k">'+esc(k)+'</span><span class="v">'+safeNum(attrs[k],0)+'</span></div>'; });
                html += '</div>';
            }
            if (wpnKeys.length) {
                html += '<div class="sam-nd-wpn">';
                wpnKeys.forEach(function(name) {
                    var w = wpn[name] || {};
                    var isBase = (name === '无武装');
                    html += '<div class="sam-nd-wpn-row'+(isBase?' base':'')+'"><div class="nm">'+(isBase?'无武装':'⚔ '+esc(name))+'</div><div class="atk">ATK (物攻) <b>'+safeNum(w.ATK,0)+'</b></div><div class="matk">MATK (术攻) <b>'+safeNum(w.MATK,0)+'</b></div></div>';
                });
                html += '</div>';
            }
        }
        // ⑥ 人物档案 (外貌/着装/性格/喜爱/背景故事, 仅有值时; 编辑模式→可编辑文本块, 恒渲染)
        var profile = '';
        var profileFields = ['外貌','着装','性格','喜爱','背景故事'];
        if (editMode) {
            profileFields.forEach(function(f) {
                var p = npcPath + '.' + f;
                var v = safeStr(n[f]);
                if (isReadonlyPath(p)) return;
                profile += '<div class="sam-nd-block"><div class="sam-nd-block-lbl">'+esc(f)+'</div><div class="sam-nd-block-ct">'+editInput(p, v, 'textarea')+'</div></div>';
            });
        } else {
            if (safeStr(n.外貌)) profile += ndBlock('外貌', n.外貌);
            if (safeStr(n.着装)) profile += ndBlock('着装', n.着装);
            if (safeStr(n.性格)) profile += ndBlock('性格', n.性格);
            if (safeStr(n.喜爱)) profile += ndBlock('喜爱', n.喜爱);
            if (safeStr(n.背景故事)) profile += ndBlock('背景故事', n.背景故事);
        }
        if (profile) html += '<details class="sam-nd-sub" '+(editMode?'open':'')+'><summary>👤 人物档案</summary><div class="sam-nd-sub-body">'+profile+'</div></details>';
        // ⑨ 子系统 (装备/技能/血统/形态库/状态, 仅非空时才折叠显示)
        var subs = [{k:'状态',d:n.状态},{k:'血统',d:n.血统},{k:'形态库',d:n.形态库},{k:'技能',d:n.技能},{k:'装备',d:n.装备},{k:'道具',d:n.道具}];
        subs.forEach(function(s) {
            var d = s.d || {};
            var ks = Object.keys(d);
            // ★ 编辑模式: 子系统(状态/血统/技能/装备/形态库/道具)内所有条目递归就地编辑
            if (editMode && ks.length > 0 && !isReadonlyPath(npcPath+'.'+s.k)) {
                var subEdHtml = renderDetailNode(d, ['隐藏真相','真实内幕','真属性'], [s.k], true, npcPath+'.'+s.k);
                html += '<details class="sam-nd-sub" open><summary>✎ '+esc(s.k)+' ('+ks.length+')</summary><div class="sam-nd-sub-body">'+subEdHtml+'</div></details>';
                return;
            }
            if (ks.length === 0) return;
            var subHtml = renderDetailNode(d, ['隐藏真相','真实内幕','真属性'], [s.k]);
            html += '<details class="sam-nd-sub"><summary>'+esc(s.k)+' ('+ks.length+')</summary><div class="sam-nd-sub-body">'+subHtml+'</div></details>';
        });
        return html;
    }
    function ndRow(k, v) {
        return '<div class="sam-nd-row"><span class="k">'+esc(k)+'</span><span class="v">'+esc(safeStr(v))+'</span></div>';
    }
    /* NPC档案编辑行: vHtml 为已构造的值单元格(含 editInput 控件), 不再二次转义 */
    function ndEditRow(k, vHtml) {
        return '<div class="sam-nd-row"><span class="k">'+esc(k)+'</span>'+vHtml+'</div>';
    }
    /* NPC战斗属性编辑行: 标签 + 当前值编辑框 + (可选)只读上限; max=null 时不显示上限(如 THP) */
    function npcEdBar(label, path, cur, max, color, editMode) {
        if (!editMode) return '';
        var maxTxt = (max != null) ? '<span class="mx readonly">/ '+max+'</span>' : '';
        var valHtml = '<span class="num-ed">'+editInput(path, cur, 'number')+'</span>';
        return '<div class="sam-npc-bar">'
            + '<span class="lbl" style="color:'+color+';">'+esc(label)+'</span>'
            + valHtml + maxTxt
            + '</div>';
    }
    function ndBlock(label, content) {
        return '<div class="sam-nd-block"><div class="sam-nd-block-lbl">'+esc(label)+'</div><div class="sam-nd-block-ct">'+esc(safeStr(content))+'</div></div>';
    }
    /* 精美递归渲染: 标量分短值(网格行)/长文本(块); 子对象/数组用可伸缩details; 字符串数组用tag chips */
    var DETAIL_LONG_FIELDS = ['描述','外貌','着装','性格','喜爱','态度','背景故事','内容','状态','效果','摘要','真实内幕','隐藏真相'];
    function isLongField(k, v) {
        if (DETAIL_LONG_FIELDS.indexOf(k) >= 0) return true;
        if (typeof v === 'string' && v.length > 30) return true;
        return false;
    }
    /* 枚举翻译表(装备类型/装备状态/技能类型) */
    var EQUIP_TYPE_MAP = ['武器','手部','头部','胸部','腿部','鞋子','披风','饰品','世界遗物'];
    var EQUIP_STATUS_MAP = ['未装备','已装备','仓库'];
    var SKILL_TYPE_MAP = ['主动','被动','特殊'];
    // 父级容器键 -> 判定枚举字段
    var ENUM_PARENTS = { 装备: { 类型: EQUIP_TYPE_MAP, 状态: EQUIP_STATUS_MAP }, 道具: { 状态: EQUIP_STATUS_MAP }, 技能: { 类型: SKILL_TYPE_MAP }, 形态: { 状态: EQUIP_STATUS_MAP } };
    function translateEnum(field, value, ancestors) {
        if (!ancestors || ancestors.length < 2) return null;
        // ancestors: [..., 容器键(装备/技能/道具/形态), 条目名, field]
        // 找到最近的容器键
        for (var i = ancestors.length - 2; i >= 0; i--) {
            var container = ancestors[i];
            if (ENUM_PARENTS[container] && ENUM_PARENTS[container][field]) {
                var map = ENUM_PARENTS[container][field];
                var idx = (typeof value === 'number') ? value : parseInt(value, 10);
                if (!isNaN(idx) && idx >= 0 && idx < map.length) return map[idx];
                return null;
            }
        }
        return null;
    }
    /* 统一判定"消耗"是否为空/无, 应隐藏不渲染
       覆盖: undefined/null/''/'无'/'0'/0/'0MP'/'0EP'/'0回合'/'无消耗'/'0 EP' 等一切等价于无消耗的形式 */
    function isCostEmpty(c) {
        if (c == null) return true;
        if (typeof c === 'number') return c === 0;
        if (typeof c !== 'string') return false;
        var s = String(c).trim();
        if (s === '') return true;
        if (s === '无' || s === '无消耗' || s === '消耗无' || s === '无消耗。' || s === '无。') return true;
        // 纯数字 0 / 形如 "0"、"0.0"
        if (/^[0-9.]+$/.test(s)) return parseFloat(s) === 0 || isNaN(parseFloat(s));
        // 形如 "0MP"、"0 EP"、"0EP"、"0 回合"、"0点"… 消耗数量为0
        if (/^0(\s|点)?(MP|EP|HP|SP|回合|点|怒气|能量|p|P)?$/.test(s)) return true;
        return false;
    }
    /* ★ 通用递归详情渲染(世界条目/NPC子系统等): editMode+basePath 时标量/标签/数值网格就地编辑
       - basePath 为 MVU 完整路径前缀(如 关系列表.李三.技能), 递归逐层拼接
       - 受 isReadonlyPath 保护; 真属性/隐藏真相等 hidden 字段不渲染更不可编辑 */
    function renderDetailNode(node, hidden, ancestors, editMode, basePath) {
        ancestors = ancestors || [];
        var ed = !!(editMode && basePath);
        var selfPath = ed ? basePath : '';
        if (node == null) return '<div class="sam-empty">无</div>';
        if (typeof node !== 'object') {
            return '<div class="sam-d-block"><div class="sam-d-content">'+esc(fmtScalar(node, ancestors))+'</div></div>';
        }
        if (Array.isArray(node)) {
            if (node.length === 0) return '<div class="sam-empty">无</div>';
            return renderDetailArray(node, hidden, ancestors, editMode, basePath);
        }
        var keys = Object.keys(node);
        if (keys.length === 0) return '<div class="sam-empty">无</div>';
        // 分三类: 短标量/长文本/对象数组
        var shortRows = '', longBlocks = '', subBlocks = '';
        // 当前节点是否为纯数值对象(如 原始属性 {力量:0, ATK:5}): 值为0的项统一隐藏
        var nodeIsNumObj = isNumObj(node);
        keys.forEach(function(k) {
            if (hidden && hidden.indexOf(k) >= 0) return;
            var v = node[k];
            if (v == null) return;
            if (v === '' && !ed) return; // ★ 编辑模式保留空字符串字段(可填入内容), 只读态隐藏
            // ★ 消耗字段: 无/0/0MP 等"等价于无消耗"的形式统一隐藏
            if (k === '消耗' && isCostEmpty(v)) return;
            // 身份数组: 过滤仅AI可见的关键词(守护者/篡夺者/织梦者/残魂/穿越者)
            if (k === '身份' && Array.isArray(v)) {
                // 小队成员或好感度>60时不隐藏阵营身份
                var _showAllId = (node.是否队友 === true) || (safeNum(node.好感度,0) > 60);
                if (!_showAllId) v = filterHiddenIdentity(v);
                if (v.length === 0) return;
            }
            var childAnc = ancestors.concat([k]);
            var childPath = ed ? (selfPath + '.' + k) : '';
            // 原始属性是血统/装备/形态/状态等条目的基准值，只展示、不允许在编辑模式改写。
            // 递归调用也使用 childEditMode，保证品质字母属性和数值属性均不会漏出编辑框。
            var childEditMode = ed && k !== '原始属性';
            if (ed && isReadonlyPath(childPath)) {
                // 只读路径: 仍渲染(只读态), 但不进入编辑
            } else if (typeof v === 'object') {
                // 对象/数组 -> 可伸缩
                if (Array.isArray(v)) {
                    if (v.length === 0) {
                        // 空数组: 跳过, 不渲染空折叠栏
                    } else if (isStringArray(v)) {
                        // 纯字符串数组 -> tag chips, 不折叠(编辑态渲染 tags 编辑器)
                        subBlocks += detailTagBlock(k, v, childAnc, childEditMode, childPath);
                    } else {
                        subBlocks += detailSub(k, renderDetailArray(v, hidden, childAnc, childEditMode, childPath), v.length <= 2);
                    }
                } else if (Object.keys(v).length === 0) {
                    // 空对象(如原始属性/效果为{}): 跳过, 不渲染空折叠栏
                } else if (isNumObj(v)) {
                    // 纯数值属性对象(原始属性等): 原始属性固定只读，其余编辑态全量+就地编辑
                    var gridHtml = formatStatGrid(v, 6, childEditMode, childPath);
                    if (gridHtml) subBlocks += detailSub(k, '<div class="sam-d-sub-body">'+gridHtml+'</div>', false);
                } else {
                    var childHtml = renderDetailNode(v, hidden, childAnc, childEditMode, childPath);
                    // 子节点过滤后可能为空(如原始属性全0), 不渲染空折叠栏
                    if (childHtml && childHtml.trim() && !/class="sam-empty"/.test(childHtml)) {
                        subBlocks += detailSub(k, '<div class="sam-d-sub-body">'+childHtml+'</div>', Object.keys(v).length <= 2 || ed);
                    }
                }
            } else {
                // 标量: 纯数值对象内的0值跳过; 枚举字段(类型/状态=0)保留翻译显示
                // ★ 编辑模式不做0值过滤(否则0值字段不渲染, 无法编辑修改)
                if (!ed) {
                    if (nodeIsNumObj && safeNum(v, 0) === 0) return;
                    if (!nodeIsNumObj && safeNum(v, NaN) === 0 && (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(String(v).trim())))) {
                        // 非数值对象中的数值0: 枚举字段(装备类型0=武器/状态0=未装备)保留, 其他属性加成类0隐藏
                        var isEnumField = false;
                        for (var ei = ancestors.length - 1; ei >= 0; ei--) {
                            if (ENUM_PARENTS[ancestors[ei]] && ENUM_PARENTS[ancestors[ei]][k]) { isEnumField = true; break; }
                        }
                        // 当前节点自身作为容器时也查 ENUM_PARENTS
                        if (!isEnumField && ENUM_PARENTS[ancestors[ancestors.length - 1]] && ENUM_PARENTS[ancestors[ancestors.length - 1]][k]) isEnumField = true;
                        // 直接挂在装备/道具/技能条目下: ancestors 末段是条目名, 再前是容器
                        if (!isEnumField && ancestors.length >= 2) {
                            var contKey = ancestors[ancestors.length - 2];
                            if (ENUM_PARENTS[contKey] && ENUM_PARENTS[contKey][k]) isEnumField = true;
                        }
                        if (!isEnumField && k !== '好感度' && k !== '数量') return;
                    }
                }
                // ★ 编辑模式: 标量就地编辑(布尔→开关, 长文本→textarea, 数值→number, 其他→text)
                if (childEditMode) {
                    if (typeof v === 'boolean') {
                        // 布尔字段用开关(直接暂存true/false, 避免文本写回破坏类型)
                        shortRows += '<div class="sam-d-row"><span class="k">'+esc(k)+':</span><span class="v">'+editToggle(childPath, v)+'</span></div>';
                    } else {
                        var etype = isLongField(k, v) ? 'textarea' : (typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v).trim()) ? 'number' : 'text');
                        var ev = (etype === 'number') ? safeNum(v, 0) : safeStr(v);
                        if (isLongField(k, v)) {
                            longBlocks += '<div class="sam-d-block"><div class="sam-d-label">'+esc(k)+'</div><div class="sam-d-content">'+editInput(childPath, ev, etype)+'</div></div>';
                        } else {
                            shortRows += '<div class="sam-d-row"><span class="k">'+esc(k)+':</span><span class="v">'+editInput(childPath, ev, etype)+'</span></div>';
                        }
                    }
                } else {
                    var fv = fmtScalar(v, childAnc);
                    if (isLongField(k, v)) {
                        longBlocks += '<div class="sam-d-block"><div class="sam-d-label">'+esc(k)+'</div><div class="sam-d-content">'+esc(fv)+'</div></div>';
                    } else {
                        shortRows += '<div class="sam-d-row"><span class="k">'+esc(k)+':</span><span class="v">'+esc(fv)+'</span></div>';
                    }
                }
            }
        });
        var html = '';
        if (shortRows) html += '<div class="sam-detail-grid">'+shortRows+'</div>';
        if (longBlocks) html += longBlocks;
        if (subBlocks) html += subBlocks;
        return html;
    }
    function renderDetailArray(arr, hidden, ancestors, editMode, basePath) {
        // 标量数组: tag chips(编辑态: 纯字符串→tags编辑器; 含数字/布尔→JSON编辑器保持元素类型)
        if (isStringArray(arr)) {
            if (editMode && basePath) {
                var allStr = arr.every(function(x) { return typeof x === 'string'; });
                if (allStr) return '<div class="sam-d-tags">'+editInput(basePath, arr.join(','), 'tags')+'</div>';
                var js2 = '';
                try { js2 = JSON.stringify(arr); } catch(e3) { js2 = ''; }
                return '<div class="sam-d-tags">'+editInput(basePath, js2, 'json')+'</div>';
            }
            var chips = arr.map(function(item) { return '<span class="sam-d-tag">'+esc(fmtScalar(item, ancestors))+'</span>'; }).join('');
            return '<div class="sam-d-tags">'+chips+'</div>';
        }
        // ★ 编辑模式: 对象数组整体用 JSON 编辑器(逐元素无法构造稳定MVU路径, 避免互相覆盖)
        if (editMode && basePath) {
            var jsonStr = '';
            try { jsonStr = JSON.stringify(arr, null, 1); } catch(e2) { jsonStr = ''; }
            return '<div class="sam-d-block"><div class="sam-d-label">'+esc(ancestors[ancestors.length-1]||'数组')+'</div><div class="sam-d-content">'+editInput(basePath, jsonStr, 'json')+'</div></div>';
        }
        var html = '';
        arr.forEach(function(item, i) {
            if (typeof item === 'object' && item !== null) {
                html += '<div class="sam-d-block">'+renderDetailNode(item, hidden, ancestors, editMode, basePath)+'</div>';
            } else {
                html += '<div class="sam-d-row"><span class="v">'+esc(fmtScalar(item, ancestors))+'</span></div>';
            }
        });
        return html;
    }
    function detailSub(label, contentHtml, openByDefault) {
        return '<details class="sam-d-sub" '+(openByDefault?'open':'')+'><summary>'+esc(label)+'</summary><div class="sam-d-sub-body">'+contentHtml+'</div></details>';
    }
    function detailTagBlock(label, arr, ancestors, editMode, path) {
        var inner;
        if (editMode && path) {
            // 纯字符串数组→tags编辑器; 含数字/布尔的标量数组→JSON编辑器(拆分写回会破坏元素类型)
            var allStr = arr.every(function(x) { return typeof x === 'string'; });
            if (allStr) {
                inner = editInput(path, arr.join(','), 'tags');
            } else {
                var js = '';
                try { js = JSON.stringify(arr); } catch(e2) { js = ''; }
                inner = editInput(path, js, 'json');
            }
        } else {
            inner = arr.map(function(item) { return '<span class="sam-d-tag">'+esc(fmtScalar(item, ancestors))+'</span>'; }).join('');
        }
        return '<div class="sam-d-block"><div class="sam-d-label">'+esc(label)+'</div><div class="sam-d-tags">'+inner+'</div></div>';
    }
    function isNumObj(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
        var keys = Object.keys(obj);
        if (keys.length === 0) return false;
        return keys.every(function(k) { var v = obj[k]; return typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(String(v).trim())); });
    }
    function isStringArray(arr) {
        return arr.every(function(x) { return typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean'; });
    }
    /* 标量格式化: 布尔→是/否; 枚举字段(装备类型/状态/技能类型)→翻译; 其他→字符串 */
    function fmtScalar(v, ancestors) {
        if (v === true) return '是';
        if (v === false) return '否';
        if (ancestors && ancestors.length) {
            var field = ancestors[ancestors.length - 1];
            var tr = translateEnum(field, v, ancestors);
            if (tr != null) return tr;
        }
        return safeStr(v);
    }

    /* ===== 32. 编辑器组件 ===== */
    /* ★ 职业记录渲染助手: 职业 已从字符串数组改为 {职业名:{类型,品质,特性[],来源}} 记录对象 */
    // 取职业名列表(兼容旧字符串数组/标量回退)
    function occupationNames(occ) {
        if (!occ) return [];
        if (Array.isArray(occ)) return occ.map(function(s){return safeStr(s);}).filter(Boolean);
        if (typeof occ === 'string') return [occ];
        if (typeof occ === 'object') return Object.keys(occ).filter(function(k){return k && String(k).trim();});
        return [];
    }
    // 紧凑内联(每个职业名+类型小徽章)，用于 NPC 卡片/行内简要展示
    function occupationInlineHtml(occ) {
        var names = occupationNames(occ);
        if (names.length === 0) return '';
        var rec = (occ && typeof occ === 'object' && !Array.isArray(occ)) ? occ : null;
        var html = '<span class="sam-occ-inline">';
        names.forEach(function(nm) {
            var e = (rec && rec[nm]) ? rec[nm] : {};
            var t = safeStr(e.类型) || '辅助';
            if (['战斗','生活','辅助'].indexOf(t) < 0) t = '辅助';
            html += '<span class="sam-occ-chip">'+esc(nm)+'<span class="sam-occ-sumtype '+esc(t)+'">'+esc(t)+'</span></span>';
        });
        html += '</span>';
        return html;
    }
    // 折叠面板: summary(标题+数量+各职业名/类型速览) → 展开后逐职业卡片(名+类型徽章+特性chips+来源)，用于角色信息面板/NPC详情面板
    function occupationCardsHtml(occ) {
        var names = occupationNames(occ);
        if (names.length === 0) return '';
        var rec = (occ && typeof occ === 'object' && !Array.isArray(occ)) ? occ : null;
        function typeOf(e) { var t = safeStr(e.类型) || '辅助'; return (['战斗','生活','辅助'].indexOf(t) < 0) ? '辅助' : t; }
        // summary 行: 职业名 + 类型小品徽
        var sumRow = '';
        names.forEach(function(nm) {
            var e = (rec && rec[nm]) ? rec[nm] : {};
            sumRow += '<span class="sam-occ-sumname">'+esc(nm)+'<span class="sam-occ-sumtype '+esc(typeOf(e))+'">'+esc(typeOf(e))+'</span></span>';
        });
        var html = '<details class="sam-occ-panel" open>'
            + '<summary class="sam-occ-summary">'
              + '<span class="sam-occ-sumtitle">🎖 职业</span>'
              + '<span class="sam-occ-sumcount">'+names.length+'</span>'
              + '<span class="sam-occ-sumrow">'+sumRow+'</span>'
            + '</summary>'
            + '<div class="sam-occ-body">';
        names.forEach(function(nm) {
            var entry = (rec && rec[nm]) ? rec[nm] : {};
            var type = typeOf(entry);
            var tags = Array.isArray(entry.特性) ? entry.特性 : [];
            var src = safeStr(entry.来源) || '';
            html += '<div class="sam-occ-card">'
                + '<div class="sam-occ-head"><span class="sam-occ-name">'+esc(nm)+'</span>'
                + '<span class="sam-occ-type '+esc(type)+'">'+esc(type)+'</span></div>';
            if (tags.length) {
                html += '<div class="sam-occ-tags">';
                tags.forEach(function(t) { html += '<span class="sam-occ-tag">'+esc(safeStr(t))+'</span>'; });
                html += '</div>';
            }
            if (src) html += '<div class="sam-occ-src">📍 来源: '+esc(src)+'</div>';
            html += '</div>';
        });
        html += '</div></details>';
        return html;
    }
    // 单行文本摘要(供商城AI上下文使用): "职业名[类型] 特性1/特性2 来源:xxx"
    function occupationSummaryText(occ) {
        var names = occupationNames(occ);
        if (names.length === 0) return '';
        var rec = (occ && typeof occ === 'object' && !Array.isArray(occ)) ? occ : null;
        return names.map(function(nm) {
            var entry = (rec && rec[nm]) ? rec[nm] : {};
            var type = safeStr(entry.类型) || '辅助';
            var tags = Array.isArray(entry.特性) ? entry.特性 : [];
            var src = safeStr(entry.来源) || '';
            var parts = [nm + '[' + type + ']'];
            if (tags.length) parts.push(tags.join('/'));
            if (src) parts.push('来源:' + src);
            return parts.join(' ');
        }).join(', ');
    }
    /* ★ 职业结构化编辑器(编辑模式): 逐职业卡片(职业名/类型下拉/特性逗号输入/来源输入)+删除按钮+"添加职业"按钮
       整个对象作为一个快照暂存到 pendingEdits[path]; 输入失焦/变更→occReassemble 重组并暂存; 删除/添加→改DOM后重组.
       data-occ-field 取值: key(职业名)/类型/特性/来源 */
    function occupationEditHtml(occ, basePath) {
        var names = occupationNames(occ);
        var rec = (occ && typeof occ === 'object' && !Array.isArray(occ)) ? occ : null;
        var html = '<div class="sam-occ-edit" data-occ-path="'+esc(basePath)+'">';
        names.forEach(function(nm) {
            var e = (rec && rec[nm]) ? rec[nm] : {};
            var type = safeStr(e.类型) || '辅助';
            if (['战斗','生活','辅助'].indexOf(type) < 0) type = '辅助';
            var tags = Array.isArray(e.特性) ? e.特性 : [];
            var src = safeStr(e.来源) || '';
            html += occupationEditCardHtml(nm, type, tags, src);
        });
        html += '</div>';
        html += '<button type="button" class="sam-occ-add-btn" data-occ-path="'+esc(basePath)+'">+ 添加职业</button>';
        return html;
    }
    // 单张职业编辑卡片(供 occupationEditHtml 与"添加"按钮复用)
    function occupationEditCardHtml(name, type, tags, src) {
        type = type || '辅助';
        if (['战斗','生活','辅助'].indexOf(type) < 0) type = '辅助';
        var tagsStr = Array.isArray(tags) ? tags.join(',') : safeStr(tags);
        var nameVal = (name === undefined || name === null) ? '' : String(name);
        // 类型下拉选项
        var typeOpts = ['战斗','生活','辅助'].map(function(t) {
            return '<option value="'+esc(t)+'"'+(t === type ? ' selected' : '')+'>'+esc(t)+'</option>';
        }).join('');
        // 用 sam-occ-field 类(非 sam-edit-input/sam-edit-active), 避免 flushStagedDisplay/saveEdits 默认走"点击即编辑"逻辑
        return '<div class="sam-occ-edit-card" data-occ-key="'+esc(nameVal)+'">'
            + '<div class="sam-occ-edit-head">'
              + '<input class="sam-occ-field sam-occ-edit-name" data-occ-field="key" type="text" value="'+esc(nameVal)+'" placeholder="职业名" />'
              + '<select class="sam-occ-field sam-occ-edit-type" data-occ-field="类型">'+typeOpts+'</select>'
              + '<button type="button" class="sam-occ-del-btn" title="删除该职业">✕</button>'
            + '</div>'
            + '<div class="sam-occ-edit-row"><span class="k">特性</span>'
              + '<input class="sam-occ-field sam-occ-edit-tags" data-occ-field="特性" type="text" value="'+esc(tagsStr)+'" placeholder="逗号分隔, 如: 剑术,格挡" /></div>'
            + '<div class="sam-occ-edit-row"><span class="k">来源</span>'
              + '<input class="sam-occ-field sam-occ-edit-src" data-occ-field="来源" type="text" value="'+esc(src)+'" placeholder="来源(可选)" /></div>'
            + '</div>';
    }
    /* 职业编辑器: 重组当前容器的所有卡片为对象并暂存到 pendingEdits[path] */
    function occReassemble($container) {
        if (!$container || !$container.length) return;
        var path = $container.attr('data-occ-path');
        if (!path) return;
        var out = {};
        var usedKeys = {};
        $container.find('.sam-occ-edit-card').each(function(idx) {
            var $c = $(this);
            var name = String($c.find('[data-occ-field="key"]').val() || '').trim();
            var type = String($c.find('[data-occ-field="类型"]').val() || '辅助');
            if (['战斗','生活','辅助'].indexOf(type) < 0) type = '辅助';
            var tagsStr = String($c.find('[data-occ-field="特性"]').val() || '');
            var tags = tagsStr.split(/[\/,，]/).map(function(s){return String(s).trim();}).filter(Boolean);
            var src = String($c.find('[data-occ-field="来源"]').val() || '').trim();
            // 职业名为空 → 用占位键 "新职业<i>" 避免覆盖, 保存时ZOD会校验
            var key = name || ('新职业' + (idx + 1));
            // 键去重: 重名则追加序号
            var k = key, n = 2;
            while (usedKeys[k]) { k = key + '_' + (n++); }
            usedKeys[k] = true;
            out[k] = { 类型: type, 特性: tags, 来源: src };
        });
        stageEdit(path, out, 'object');
    }
    /* 职业编辑器: 删除指定卡片后重组暂存 */
    function occEditDelete($card) {
        var $container = $card.closest('.sam-occ-edit');
        $card.remove();
        occReassemble($container);
    }
    /* 职业编辑器: 追加一张空卡片后重组暂存 */
    function occEditAdd($btn) {
        var path = $btn.attr('data-occ-path');
        // 用 filter 按属性匹配, 避免路径含选择器特殊字符
        var $container = $('.sam-occ-edit').filter(function(){ return $(this).attr('data-occ-path') === path; });
        if (!$container.length) return;
        $container.append(occupationEditCardHtml('', '辅助', [], ''));
        occReassemble($container);
    }
    /* 编辑模式不再直接渲染输入框; 改为"点击即编辑":
       editInput/editSelect 返回显示态HTML(文本+✎), 点击后由事件动态插入真实输入框, 失焦/回车暂存到 pendingEdits 并还原显示态. 这样不会让所有输入框同时撑开导致变形. */
    function editInput(path, val, type) {
        return editDisplayHtml(path, val, type || 'text', '');
    }
    function editSelect(path, options, val) {
        return editDisplayHtml(path, val, 'select', optsToStr(options));
    }
    function editToggle(path, val) {
        return '<span class="sam-toggle-switch '+(val?'on':'')+'" data-toggle="field" data-path="'+esc(path)+'"><div class="knob"></div></span>';
    }
    function modalRow(k, v) {
        var vs = (typeof v === 'object') ? JSON.stringify(v) : safeStr(v);
        return '<div class="sam-row"><span class="k">'+esc(k)+'</span><span class="v">'+esc(vs)+'</span></div>';
    }
    /* 效果对象分行渲染 {a:b,c:d} → 多行 */
    function formatEffects(effects, path, editMode) {
        if (!effects || typeof effects !== 'object') return '';
        var keys = Object.keys(effects);
        if (keys.length === 0 && !editMode) return '';
        var html = '<div class="sam-effects">';
        keys.forEach(function(k) {
            var v = effects[k];
            var isObj = (v !== null && typeof v === 'object');
            var vs = isObj ? JSON.stringify(v) : safeStr(v);
            if (editMode && path && !isReadonlyPath(path+'.'+k)) {
                // 对象值(嵌套效果)用 json 编辑器, 标量用文本
                html += '<div class="sam-effect-line"><span class="ek">'+esc(k)+':</span> '+editInput(path+'.'+k, vs, isObj ? 'json' : 'text')+'</div>';
            } else {
                html += '<div class="sam-effect-line"><span class="ek">'+esc(k)+':</span> '+esc(vs)+'</div>';
            }
        });
        html += '</div>';
        return html;
    }
    /* 标签数组渲染 */
    function formatTags(tags, path, editMode) {
        if (!Array.isArray(tags)) tags = [];
        if (tags.length === 0 && !editMode) return '<span class="sam-empty" style="padding:2px 0;">无</span>';
        if (editMode && path) return editInput(path, tags.join(','), 'tags');
        var html = '<div class="sam-tags">';
        tags.forEach(function(t) { html += '<span class="sam-tag">'+esc(t)+'</span>'; });
        html += '</div>';
        return html;
    }
    /* 品质枚举（F~SSS），用于识别五维属性中的品质字母（成长/功法状态） */
    var STAT_QUALITY_SET = { 'F':1, 'E':1, 'D':1, 'C':1, 'B':1, 'A':1, 'S':1, 'SS':1, 'SSS':1 };
    function isStatQuality(v) {
        if (typeof v !== 'string') return false;
        return Object.prototype.hasOwnProperty.call(STAT_QUALITY_SET, v.toUpperCase().trim());
    }
    /* 属性值标准化: 品质字母(F~SSS)保留为字符串, 其余 parseFloat 为数字(非数字→0)
       用于解析商城/角色 原始属性 {力量:'B', ATK:5} 时兼容字母与数值混合写法 */
    function attrMapVal(raw) {
        if (raw == null) return 0;
        if (typeof raw === 'string' && STAT_QUALITY_SET.hasOwnProperty(raw.trim().toUpperCase())) {
            return raw.trim().toUpperCase();
        }
        var n = parseFloat(raw);
        return isFinite(n) ? n : 0;
    }
    /* 数值属性网格: 隐藏值为0的属性(装备/血统/形态/状态详情等共用; 装备仅写非0项)
       ★ 状态五维双修: 品质字母(如 力量:'B')原样显示, 数值(如 ATK:15 / 力量:-5)走原数值逻辑
       ★ editMode: 每格数值就地编辑(含0值全量渲染); path 为空时退化为只读网格 */
    function formatStatGrid(stats, cols, editMode, path) {
        if (!stats || typeof stats !== 'object') return '';
        var keys = Object.keys(stats);
        if (!editMode) {
            keys = keys.filter(function(k) {
                var v = stats[k];
                if (isStatQuality(v)) return true;          // 品质字母: 保留
                return safeNum(v, 0) !== 0;                  // 数值: 隐藏0
            });
        }
        if (keys.length === 0) return '';
        var html = '<div class="sam-stat-grid">';
        keys.forEach(function(k) {
            var v = stats[k];
            if (editMode && path && !isReadonlyPath(path+'.'+k)) {
                // 编辑模式: 品质字母用文本编辑, 数值用数字编辑
                var t = isStatQuality(v) ? 'text' : 'number';
                var dv = isStatQuality(v) ? safeStr(v) : safeNum(v, 0);
                html += '<div class="sam-stat-cell"><div class="sn">'+esc(k)+'</div><div class="sv">'+editInput(path+'.'+k, dv, t)+'</div></div>';
            } else {
                var display = isStatQuality(v) ? safeStr(v) : safeNum(v, 0);
                html += '<div class="sam-stat-cell"><div class="sn">'+esc(k)+'</div><div class="sv">'+esc(String(display))+'</div></div>';
            }
        });
        html += '</div>';
        return html;
    }
    /* 内联完整资料卡片(装备/道具/技能/血统/形态) */
    // 删除按钮HTML(编辑模式时显示, 挂在卡片头部右侧; 点击触发二级确认→写MVU删除)
    function samDelBtn(path, editMode, label) {
        if (!editMode) return '';
        return '<button type="button" class="sam-fc-del-btn" data-del-path="'+esc(path)+'" title="'+(label||'删除')+'">✕</button>';
    }
    function fullCard(q, title, rowsHtml, bodyHtml, headExtra) {
        // q 可为: 字符串(品质字母, 显示=着色) 或对象 {label:显示文本, cls:色阶字母}
        //   形态走层级(Ⅰ~Ⅸ): label=罗马数字(显示), cls=对应品质字母(着色 q-class)
        var label, qc;
        if (q && typeof q === 'object') { label = q.label || ''; qc = q.cls ? parseRarity(q.cls) : ''; }
        else { qc = q ? parseRarity(q) : ''; label = qc; }
        var badge = qc ? '<div class="sam-fc-q q-'+qc+'">'+esc(label)+'</div>' : '';
        var head = '<div class="sam-fc-head"><div class="sam-fc-title">'+esc(title)+'</div>'+(headExtra||'')+badge+'</div>';
        return '<div class="sam-full-card'+(qc?' q-'+qc:'')+'">'+head+(rowsHtml?'<div class="sam-fc-rows">'+rowsHtml+'</div>':'')+(bodyHtml||'')+'</div>';
    }
    function fcRow(k, v, path, editMode, type) {
        if (editMode && path && !isReadonlyPath(path)) {
            var val = (type === 'number') ? safeNum(v,0) : v;
            return '<div class="sam-row"><span class="k">'+esc(k)+'</span><span class="v">'+editInput(path, val, type||'text')+'</span></div>';
        }
        if (v === null || v === undefined || v === '') return '';
        var vs = (typeof v === 'object') ? JSON.stringify(v) : safeStr(v);
        return '<div class="sam-row"><span class="k">'+esc(k)+'</span><span class="v">'+esc(vs)+'</span></div>';
    }
    /* 全宽左对齐块: 标签在上, 内容独占整行(效果/描述等长文本用) */
    function fcBody(label, contentHtml, extraClass) {
        if (!contentHtml || !String(contentHtml).trim()) return '';
        return '<div class="sam-fc-block">'
            + '<div class="sam-fc-label">'+esc(label)+'</div>'
            + '<div class="sam-fc-content '+(extraClass||'')+'">'+contentHtml+'</div>'
            + '</div>';
    }
    /* 可伸缩全宽块: <details> 折叠(原始属性等大块用); 内容为空时不渲染(全0属性被过滤后) */
    function fcBodyCollapsible(label, contentHtml, extraClass, openByDefault) {
        if (!contentHtml || !String(contentHtml).trim()) return '';
        return '<details class="sam-fc-collapse '+(extraClass||'')+'" '+(openByDefault?'open':'')+'>'
            + '<summary class="sam-fc-collapse-sum">'+esc(label)+'</summary>'
            + '<div class="sam-fc-content '+(extraClass||'')+'">'+contentHtml+'</div>'
            + '</details>';
    }
    /* 栏目级可伸缩块: title(含emoji) + 内容; 默认展开 */
    function secBlock(title, contentHtml, openByDefault, headExtra) {
        return '<details class="sam-sec" '+(openByDefault === false ? '' : 'open')+'>'
            + '<summary class="sam-sec-sum"><span class="sam-sec-title">'+esc(title)+'</span>'+(headExtra||'')+'</summary>'
            + '<div class="sam-sec-body">'+(contentHtml||'')+'</div>'
            + '</details>';
    }

    /* ===== 32b. 删除NPC(写回MVU) ===== */
    function deleteNpc(name) {
        if (!name) return;
        var ok = writeBackMvu(function(statData) {
            if (statData && statData.关系列表 && statData.关系列表[name]) {
                delete statData.关系列表[name];
                try { console.log('%c[主神终端] ✅ NPC已删除: '+name, 'color:#86efac'); } catch(e){}
            }
        });
        if (ok) { try { closeModal(); } catch(e){} renderAll(); }
    }

    /* ===== 32b2. 删除世界条目(探索点/势力等, 写回MVU) =====
       fullKey: 完整路径如 "世界.探索.城镇废墟" / "世界.势力.黑鹰团"
       parentPath: 父对象路径如 "世界.探索" / "世界.势力"
       key: 末段名, 用于提示
    */
    function deleteWorldEntry(fullKey, parentPath, key) {
        if (!fullKey) return;
        var ok = writeBackMvu(function(statData) {
            // 通用按点路径删除: 沿路径走到最后第二段, 删末段
            var parts = fullKey.split('.');
            var obj = statData;
            for (var i = 0; i < parts.length - 1; i++) {
                if (!obj || typeof obj !== 'object') return;
                obj = obj[parts[i]];
            }
            if (obj && typeof obj === 'object' && obj.hasOwnProperty(parts[parts.length-1])) {
                delete obj[parts[parts.length-1]];
                try { console.log('%c[主神终端] ✅ 世界条目已删除: '+fullKey, 'color:#86efac'); } catch(e){}
            }
        });
        if (ok) { samToast('success', '已删除: ' + (key || fullKey)); renderAll(); }
        else samToast('error', '删除失败: MVU写回不可用');
    }

    /* ===== 32c. 装备/道具操作按钮(穿戴/脱下/存放/取回/删除) ===== */
    function actBtn(label, action, path, kind, type, key) {
        return '<button class="sam-act-btn" data-act="'+esc(action)+'" data-path="'+esc(path)+'" data-kind="'+esc(kind)+'" data-type="'+esc(String(type==null?'':type))+'" data-key="'+esc(key||'')+'">'+esc(label)+'</button>';
    }
    /* 装备操作按钮: 状态0(装备箱)=穿戴/存放/删除; 状态1(战术栏)=脱下/存放/删除; 状态2(仓库)=穿戴/取回/删除; 类型8(特殊)无按钮
       editMode 为 true 时才生成删除按钮(否则仅显示穿戴/脱下/存放/取回) */
    function equipActionButtons(path, status, type, editMode) {
        if (type === 8) return ''; // 特殊装备: 无限制也无按钮
        var key = path.split('.').pop();
        var delBtn = editMode ? actBtn('删除','delete',path,'equip',type,key) : '';
        if (status === 0) return actBtn('穿戴','wear',path,'equip',type,key)+actBtn('存放','store',path,'equip',type,key)+delBtn;
        if (status === 1) return actBtn('脱下','remove',path,'equip',type,key)+actBtn('存放','store',path,'equip',type,key)+delBtn;
        if (status === 2) return actBtn('穿戴','wear',path,'equip',type,key)+actBtn('取回','takeback',path,'equip',type,key)+delBtn;
        return '';
    }
    /* 道具操作按钮: 状态0(道具箱)=穿戴/存放/删除; 状态1(战术栏)=脱下/存放/删除; 状态2(仓库)=穿戴/取回/删除
       editMode 为 true 时才生成删除按钮 */
    function itemActionButtons(path, status, editMode) {
        var key = path.split('.').pop();
        var delBtn = editMode ? actBtn('删除','delete',path,'item','',key) : '';
        if (status === 0) return actBtn('穿戴','wear',path,'item','',key)+actBtn('存放','store',path,'item','',key)+delBtn;
        if (status === 1) return actBtn('脱下','remove',path,'item','',key)+actBtn('存放','store',path,'item','',key)+delBtn;
        if (status === 2) return actBtn('穿戴','wear',path,'item','',key)+actBtn('取回','takeback',path,'item','',key)+delBtn;
        return '';
    }
    function samToast(type, msg) {
        try {
            if (typeof toastr !== 'undefined' && toastr[type]) { toastr[type]('[主神终端] '+msg); return; }
        } catch(e){}
        try { console.log('%c[主神终端] '+msg, 'color:'+(type==='success'?'#86efac':type==='warning'?'#fbbf24':type==='error'?'#f87171':'#8b95a6')); } catch(e){}
    }
    /* ===== 32c2. 商城市场区: 归一化/解析/购物车/渲染/执行 =====
       移植自 打开商店代码.html, 删除同伴交易(空间币互转+多收件人分账),
       仅保留角色单人购物. 区域改为 装备|道具|技能|血统(4类).
       装备区遵循"左类型nav + 右物品list"布局; 其余区为单列list. */
    // ---- 字段归一化层(ES5改写) ----
