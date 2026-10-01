/* ===== 32d. 形态激活(写回MVU) ===== */
    function handleFormActivate(formName) {
        if (!formName) return;
        var sd = getStatData();
        if (!sd || !sd.角色) { samToast('error', '数据未就绪'); return; }
        var p = sd.角色;
        var cf = p.当前形态 || {};
        // 已激活的形态(当前生效)不可重复激活
        if (cf.激活 === true && safeStr(cf.名称) === formName) {
            samToast('warning', '该形态已激活: ' + formName);
            return;
        }
        // 冷却未归零不可激活(只有归零才能重新激活)
        var forms = p.形态库 || {};
        var f = forms[formName] || {};
        var cdM = safeStr(f.冷却).match(/^(\d+)\s*\/\s*(\d+)/);
        var cdCur = cdM ? (parseInt(cdM[1], 10) || 0) : 0;
        if (cdCur > 0) {
            samToast('warning', '冷却中, 无法激活: ' + formName + ' (剩余' + cdCur + '回合)');
            return;
        }
        // 写回: 设当前形态 + 该形态冷却2回合(不清理其他形态冷却)
        var ok = writeBackMvu(function(statData) {
            var pp = statData.角色;
            if (!pp) return;
            // 设当前形态
            pp.当前形态 = { 激活: true, 名称: formName };
            // 该形态冷却置为 2/2 回合(不触碰其他形态的冷却)
            var ff = pp.形态库 || {};
            if (ff[formName]) {
                ff[formName].冷却 = '2/2 回合';
            }
            // ★ 前端形态激活 → 记入待播报记录(与本次写回同一落盘, 待正文模型叙事后自动清空)
            shopAppendReceipt(statData, '[变身][角色] 激活形态「' + formName + '」');
        });
        if (ok) {
            samToast('success', '形态已激活: ' + formName + ' (冷却1回合)');
            renderAll();
        } else {
            samToast('error', '激活失败: MVU写回不可用');
        }
    }

    /* ===== 32e. 形态取消激活(写回MVU) ===== */
    function handleFormDeactivate(formName) {
        if (!formName) return;
        var sd = getStatData();
        if (!sd || !sd.角色) { samToast('error', '数据未就绪'); return; }
        var p = sd.角色;
        var cf = p.当前形态 || {};
        // 只有当前激活的就是这个形态才能取消
        if (!(cf.激活 === true && safeStr(cf.名称) === formName)) {
            samToast('warning', '该形态未激活, 无需取消: ' + formName);
            return;
        }
        // 写回: 当前形态设为未激活 + 清空名称(冷却不动, 按原倒数继续走)
        var ok = writeBackMvu(function(statData) {
            var pp = statData.角色;
            if (!pp) return;
            pp.当前形态 = { 激活: false, 名称: '' };
            // ★ 前端形态取消激活 → 记入待播报记录(与本次写回同一落盘, 待正文模型叙事后自动清空)
            shopAppendReceipt(statData, '[变身结束][角色] 取消形态「' + formName + '」');
        });
        if (ok) {
            samToast('success', '已取消形态: ' + formName);
            renderAll();
        } else {
            samToast('error', '取消失败: MVU写回不可用');
        }
    }

    /* ===== 32f. R21-传闻交易: 通用确认弹窗(替代原生 confirm) =====
       samConfirm(title, body, onOk) → 渲染模态框, onOk 在用户点确认时同步调用
    */
    function samConfirm(title, body, onOk) {
        // 复用 #samsara-modal 遮罩层(z-index:1000000, 已带 blur 背景, 高于面板999998)
        // 这样确认框不会被主界面/面板挡住
        var $m = $('#samsara-modal');
        if (!$m.length) { $('body').append('<div id="samsara-modal"></div>'); }
        $m = $('#samsara-modal');
        var box = '<div class="sam-confirm-box">'
            + '<div class="sam-confirm-title">'+esc(title)+'</div>'
            + '<div class="sam-confirm-body">'+esc(body)+'</div>'
            + '<div class="sam-confirm-actions">'
            + '<button type="button" class="sam-confirm-btn cancel">取消</button>'
            + '<button type="button" class="sam-confirm-btn ok">确认</button>'
            + '</div></div>';
        $m.html(box).addClass('open');
        // 按钮点击: 取消/确认 → 关闭弹窗; 确认则回调 onOk
        $m.off('click.samConfirm').on('click.samConfirm', '.sam-confirm-btn', function(e) {
            e.stopPropagation();
            var isOk = $(this).hasClass('ok');
            // 清理 samConfirm 自身全部事件(含遮罩点外关闭), 防止残留到下次复用 #samsara-modal 的 showModal
            $m.off('click.samConfirm').off('click.samConfirmBg');
            $m.removeClass('open').empty();
            if (isOk && typeof onOk === 'function') {
                try { onOk(); } catch(err) { console.error('[主神终端] samConfirm onOk error:', err); }
            }
        });
        // 点遮罩(弹窗外部)取消
        $m.off('click.samConfirmBg').on('click.samConfirmBg', function(e) {
            if (e.target === this) {
                $m.off('click.samConfirm').off('click.samConfirmBg');
                $m.removeClass('open').empty();
            }
        });
    }

    /* ===== 32g. R21-传闻交易: 发送文字到 SillyTavern 输入框 =====
       sendToInputBox(text, autoSend):
         - autoSend=true: 填入并点击发送按钮
         - autoSend=false: 仅追加到输入框(不自动发送), 若已存在则不重复追加
       返回 true=成功, false=未找到输入框
       参考 创世状态栏.txt sendToChat/sendMessageToChat
    */
    function sendToInputBox(text, autoSend) {
        try {
            var win = GS_PARENT || window;
            var $jq = (win.jQuery || window.jQuery || $);
            if (!$jq) return false;
            var $ta = $jq(win.document || document).find('#send_textarea');
            if (!$ta.length) return false;
            if (autoSend) {
                // 自动发送模式: 覆盖输入框 + 触发 input + 点击发送按钮
                var textarea = $ta[0];
                textarea.value = String(text || '');
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                var sendBtn = (win.document || document).getElementById('send_but');
                if (sendBtn) sendBtn.click();
                return true;
            }
            // 追加模式: 不覆盖已有内容, 若已包含相同文本则跳过
            var cur = $ta.val() || '';
            if (cur.indexOf(text) !== -1) return true;
            $ta.val((cur.trim() ? cur + ' ' : '') + text);
            $ta.trigger('input');
            return true;
        } catch (err) {
            console.error('[主神终端] sendToInputBox 失败:', err);
            return false;
        }
    }

    /* ===== 32h. R21-传闻交易: 删除单条传闻(写回MVU) =====
       sectionKey: '街头巷议' | '情报交易' | '布告与檄文'
       name: 传闻的 key(名字)
    */
    function handleRumorDelete(sectionKey, name) {
        if (!sectionKey || !name) return;
        var ok = writeBackMvu(function(statData) {
            if (!statData || !statData.传闻 || !statData.传闻[sectionKey]) return;
            if (statData.传闻[sectionKey][name]) {
                delete statData.传闻[sectionKey][name];
                try { console.log('%c[主神终端] ✅ 传闻已删除: '+sectionKey+'/'+name, 'color:#86efac'); } catch(e){}
            }
        });
        if (ok) { samToast('success', '已删除传闻: ' + name); renderAll(); }
        else samToast('error', '删除失败: MVU写回不可用');
    }

    /* ===== 32i. R21-传闻交易: 清空指定分类的全部传闻(写回MVU) ===== */
    function handleRumorClearSection(sectionKey) {
        if (!sectionKey) return;
        var ok = writeBackMvu(function(statData) {
            if (!statData || !statData.传闻) return;
            statData.传闻[sectionKey] = {};
            try { console.log('%c[主神终端] ✅ 已清空传闻分类: '+sectionKey, 'color:#86efac'); } catch(e){}
        });
        if (ok) { samToast('success', '已清空分类: ' + sectionKey); renderAll(); }
        else samToast('error', '清空失败: MVU写回不可用');
    }

    /* ===== 32j. R21-传闻交易: 删除全部传闻(街头巷议+情报交易+布告与檄文) ===== */
    function handleRumorClearAll() {
        var ok = writeBackMvu(function(statData) {
            if (!statData || !statData.传闻) return;
            statData.传闻 = { 街头巷议: {}, 情报交易: {}, 布告与檄文: {} };
            try { console.log('%c[主神终端] ✅ 已删除全部传闻', 'color:#86efac'); } catch(e){}
        });
        if (ok) { samToast('success', '已删除全部传闻'); renderAll(); }
        else samToast('error', '删除失败: MVU写回不可用');
    }

    /* ===== 33. 保存编辑(写回MVU) ===== */
    function saveEdits() {
        var $panel = $('#samsara-panel');
        var $modal = $('#samsara-modal'); // ★ modal 内(NPC档案编辑等)也有输入框, 一并扫描
        var changes = [];
        // 先把仍在编辑态(没失焦)的输入框暂存进pendingEdits
        $panel.find('.sam-edit-active').each(function() { flushStagedDisplay($(this)); });
        $modal.find('.sam-edit-active').each(function() { flushStagedDisplay($(this)); });
        // ★ 职业结构化编辑器: 焦点仍在卡片内时也需暂存, 重组所有容器
        $panel.find('.sam-occ-edit').each(function() { occReassemble($(this)); });
        $modal.find('.sam-occ-edit').each(function() { occReassemble($(this)); });
        // 从pendingEdits收集变更(点击即编辑的暂存区)
        Object.keys(pendingEdits).forEach(function(path) {
            if (isReadonlyPath(path)) return;
            changes.push({ path: path, val: pendingEdits[path].val });
        });
        // toggle 字段(开关也写进pendingEdits了, 兜底再扫一次; modal 内 NPC 档案的开关同样收集)
        $panel.add($modal).find('.sam-toggle-switch[data-toggle="field"]').each(function() {
            var $el = $(this);
            var path = $el.data('path');
            if (!path) return;
            if (isReadonlyPath(path)) return;
            if (pendingEdits[path]) return; // 已暂存则跳过
            changes.push({path: path, val: $el.hasClass('on')});
        });
        if (changes.length === 0) {
            try { console.log('%c[主神终端] 无变更', 'color:#8b95a6'); } catch(e){}
            pendingEdits = {};
            setEditMode(false);
            closeModal();
            renderAll();
            return;
        }
        var ok = writeBackMvu(function(statData) {
            changes.forEach(function(c) {
                try {
                    var v = c.val;
                    // ★ 职业已改为记录对象: 编辑模式下以JSON文本提交, 写回前尝试还原为对象
                    if (/^(?:角色|关系列表\.[^.]+)\.职业$/.test(c.path) && typeof v === 'string') {
                        var trimmed = v.trim();
                        if (trimmed === '') { v = {}; }
                        else { try { v = JSON.parse(trimmed); } catch(e2) { /* 非法JSON保留原字符串,ZOD层会拒绝并回退 */ } }
                    }
                    if (_ && _.set) _.set(statData, c.path, v);
                    else setByPathFallback(statData, c.path, v);
                } catch(e) { console.warn('[主神终端] 写入路径失败:', c.path, e); }
            });
        });
        if (ok) {
            pendingEdits = {};
            // 退出编辑模式
            setEditMode(false);
            closeModal();
            setTimeout(renderAll, 300);
        } else {
            showModal('保存失败', '<div class="sam-empty">MVU写回API不可用,请检查环境</div>');
        }
    }
    function setByPathFallback(obj, path, value) {
        var keys = path.split('.');
        var cur = obj;
        for (var i = 0; i < keys.length - 1; i++) {
            if (cur[keys[i]] === undefined) cur[keys[i]] = {};
            cur = cur[keys[i]];
        }
        cur[keys[keys.length - 1]] = value;
    }

    