/* ===== 13.5 物资转移(向在场NPC转移装备/道具) ===== */
    var transferTarget = null;                  // 转移目标NPC名
    var transferCart = { 装备: {}, 道具: {} };   // 选中项: { 装备: {key:1}, 道具: {key:qty} }
    function openTransferModal(npcName) {
        var sd = getStatData();
        var npc = sd && sd.关系列表 && sd.关系列表[npcName];
        if (!npc) { samToast('error', '未找到该角色'); return; }
        transferTarget = npcName;
        transferCart = { 装备: {}, 道具: {} };
        showModal('向「'+npcName+'」转移物资', renderTransferList(sd));
    }
    function renderTransferList(sd) {
        var equips = (sd.角色 && sd.角色.装备) || {};
        var backpack = (sd.角色 && sd.角色.道具) || {};
        var eqList = [], bpList = [];
        Object.keys(equips).forEach(function(k) {
            var e = equips[k] || {};
            if (safeNum(e.状态, 0) === 1) return;   // 已装备: 排除
            if (safeNum(e.类型, 0) === 8) return;    // 特殊类型: 排除
            eqList.push({ key: k, val: e });
        });
        Object.keys(backpack).forEach(function(k) {
            var b = backpack[k] || {};
            if (safeNum(b.数量, 0) <= 0) return;
            bpList.push({ key: k, val: b, qty: safeNum(b.数量, 0) });
        });
        var html = '<div class="sam-trf-list">';
        if (eqList.length) {
            html += '<div class="sam-trf-sec">⚔ 装备 · '+eqList.length+'</div>';
            eqList.forEach(function(it) { html += transferItemCard('装备', it.key, it.val, 1); });
        }
        if (bpList.length) {
            html += '<div class="sam-trf-sec">🎒 道具 · '+bpList.length+'</div>';
            bpList.forEach(function(it) { html += transferItemCard('道具', it.key, it.val, it.qty); });
        }
        if (!eqList.length && !bpList.length) {
            html += '<div class="sam-empty">无可转移物资（已装备与特殊装备已自动排除）</div>';
        }
        html += '</div>';
        var hasSel = Object.keys(transferCart.装备).length + Object.keys(transferCart.道具).length > 0;
        html += '<div class="sam-trf-footer">';
        html += '<div class="sam-trf-warn">⚠️ 确认转移后<strong>不可取消、不可取回</strong>，物资将直接归属目标角色，请认真考虑。</div>';
        html += '<div class="sam-trf-actions">';
        html += '<button type="button" class="sam-trf-btn cancel">取消</button>';
        html += '<button type="button" class="sam-trf-btn confirm"'+(hasSel ? '' : ' disabled')+'>确认转移</button>';
        html += '</div></div>';
        return html;
    }
    function transferItemCard(cat, key, item, maxQty) {
        var sel = transferCart[cat][key] != null;
        var selQty = sel ? transferCart[cat][key] : 0;
        var q = parseRarity(item.品质);
        var isItem = (cat === '道具');
        var corner = sel ? (isItem ? '已选 ×'+selQty : '已选') : '';
        var typeLabel = isItem ? safeStr(item.类型) : (EQUIP_TYPE_MAP[safeNum(item.类型, 0)] || '');
        var attrs = item.原始属性 || {};
        // 展示属性: 品质字母原样显示, 数值隐藏0(与 formatStatGrid / 装备卡一致)
        var attrStr = Object.keys(attrs).filter(function(k) {
            var v = attrs[k];
            if (isStatQuality(v)) return true;
            return safeNum(v, 0) !== 0;
        }).map(function(k) {
            var v = attrs[k];
            return esc(k)+' '+(isStatQuality(v) ? safeStr(v) : safeNum(v, 0));
        }).join(' / ');
        var desc = safeStr(item.描述) || '';
        var inner = '<div class="sam-trf-head"><span class="sam-trf-name">'+esc(key)+'</span><span class="sam-trf-qtag q-'+q+'">'+esc(q)+'</span></div>';
        if (typeLabel) inner += '<div class="sam-trf-sub">'+esc(typeLabel) + (isItem ? ' · 持有 '+maxQty : '') + '</div>';
        if (attrStr) inner += '<div class="sam-trf-attrs">'+attrStr+'</div>';
        if (desc) inner += '<div class="sam-trf-desc">'+esc(desc)+'</div>';
        if (isItem && sel) {
            inner += '<div class="sam-trf-qty">'
                + '<button type="button" class="sam-trf-qty-btn" data-trf-qty="minus" data-cat="'+esc(cat)+'" data-key="'+esc(key)+'">−</button>'
                + '<input type="number" class="sam-trf-qty-inp" min="1" max="'+maxQty+'" value="'+selQty+'" data-cat="'+esc(cat)+'" data-key="'+esc(key)+'">'
                + '<button type="button" class="sam-trf-qty-btn" data-trf-qty="plus" data-cat="'+esc(cat)+'" data-key="'+esc(key)+'">+</button>'
                + '<span class="sam-trf-qty-max">/'+maxQty+'</span></div>';
        }
        return '<div class="sam-trf-item'+(sel?' selected':'')+'" data-trf-cat="'+esc(cat)+'" data-trf-key="'+esc(key)+'">'+inner+'<span class="sam-trf-corner">'+esc(corner)+'</span></div>';
    }
    function transferToggle(cat, key) {
        if (transferCart[cat][key] != null) delete transferCart[cat][key];
        else transferCart[cat][key] = 1;
        refreshTransferModal();
    }
    function transferAdjustQty(cat, key, dir) {
        var sd = getStatData();
        var max = 1;
        if (cat === '道具') max = safeNum(sd.角色.道具[key] && sd.角色.道具[key].数量, 1);
        var cur = transferCart[cat][key] != null ? transferCart[cat][key] : 1;
        if (dir === 'plus') cur = Math.min(max, cur + 1);
        else cur = Math.max(1, cur - 1);
        transferCart[cat][key] = cur;
        refreshTransferModal();
    }
    function transferInputQty(cat, key, val) {
        var sd = getStatData();
        var max = 1;
        if (cat === '道具') max = safeNum(sd.角色.道具[key] && sd.角色.道具[key].数量, 1);
        var v = Math.max(1, Math.min(max, parseInt(val, 10) || 1));
        transferCart[cat][key] = v;
        refreshTransferModal();
    }
    function refreshTransferModal() {
        var $body = $('#samsara-modal .sam-modal-body');
        // 列表已改为 body 单层滚动，恢复 body 的 scrollTop
        var saved = $body.length ? ($body[0].scrollTop || 0) : 0;
        var sd = getStatData();
        $body.html(renderTransferList(sd));
        if ($body.length && saved > 0) { try { $body[0].scrollTop = saved; } catch(e){} }
    }
    function executeTransfer() {
        var eqKeys = Object.keys(transferCart.装备);
        var bpKeys = Object.keys(transferCart.道具);
        if (eqKeys.length + bpKeys.length === 0) return;
        var npcName = transferTarget;
        samConfirm('确认转移', '确定将选中的物资转移给「'+npcName+'」吗？此操作不可取消、不可取回。', function() {
            var ok = writeBackMvu(function(statData) {
                if (!statData) return;
                var mc = statData.角色 = statData.角色 || {};
                mc.装备 = mc.装备 || {}; mc.道具 = mc.道具 || {};
                var rel = statData.关系列表 = statData.关系列表 || {};
                var npc = rel[npcName] = rel[npcName] || {};
                npc.装备 = npc.装备 || {}; npc.道具 = npc.道具 || {};
                var movedParts = []; // ★ 实际转移成功的明细, 用于待播报记录
                // 装备: 整件复制给NPC(状态置0未装备), 删除角色的
                eqKeys.forEach(function(key) {
                    var e = mc.装备[key];
                    if (!e) return;
                    var copy = (_ && _.cloneDeep) ? _.cloneDeep(e) : JSON.parse(JSON.stringify(e));
                    copy.状态 = 0;
                    npc.装备[key] = copy;
                    delete mc.装备[key];
                    movedParts.push('装备「' + key + '」');
                });
                // 道具: 按数量转移(NPC已有则累加, 否则新建; 角色扣减, 归0则删)
                bpKeys.forEach(function(key) {
                    var b = mc.道具[key];
                    if (!b) return;
                    var have = safeNum(b.数量, 0);
                    var move = Math.min(transferCart.道具[key] || 1, have);
                    if (move <= 0) return;
                    if (npc.道具[key]) {
                        npc.道具[key].数量 = safeNum(npc.道具[key].数量, 0) + move;
                    } else {
                        var copy2 = (_ && _.cloneDeep) ? _.cloneDeep(b) : JSON.parse(JSON.stringify(b));
                        copy2.数量 = move;
                        npc.道具[key] = copy2;
                    }
                    b.数量 = have - move;
                    if (b.数量 <= 0) delete mc.道具[key];
                    movedParts.push('道具「' + key + '」×' + move);
                });
                // ★ 前端赠送NPC物资 → 记入待播报记录(与本次写回同一落盘, 待正文模型叙事后自动清空)
                if (movedParts.length) {
                    shopAppendReceipt(statData, '[赠送][角色] 向「' + npcName + '」转移 ' + movedParts.join('、'));
                }
            });
            if (ok) {
                var cnt = eqKeys.length + bpKeys.length;
                transferCart = { 装备: {}, 道具: {} };
                transferTarget = null;
                closeModal();
                samToast('success', '已向「'+npcName+'」转移 '+cnt+' 项物资');
                renderAll();
            } else {
                samToast('error', '转移失败: 数据写回不可用');
            }
        });
    }

    /* ===== 13b. NPC死亡检测 + 遗物获取(复用转移模板, 方向: NPC→角色, 无二次确认) ===== */
    function isNpcDead(n) {
        if (!n || typeof n !== 'object') return false;
        var hp = safeNum(n.HP, 0);
        if (hp <= 0) return true;
        var isExplicitlyDead = n.状态 && Object.keys(n.状态).some(function(key) { return key.indexOf('死亡') >= 0; });
        return !!isExplicitlyDead;
    }
    var lootTarget = null;
    var lootCart = { 装备: {}, 道具: {} };
    function openLootModal(npcName) {
        var sd = getStatData();
        var npc = sd && sd.关系列表 && sd.关系列表[npcName];
        if (!npc) { samToast('error', '未找到该角色'); return; }
        lootTarget = npcName;
        lootCart = { 装备: {}, 道具: {} };
        showModal('从「'+npcName+'」获取遗物', renderLootList(npc));
    }
    function renderLootList(npc) {
        var equips = npc.装备 || {};
        var backpack = npc.道具 || {};
        var eqList = [], bpList = [];
        Object.keys(equips).forEach(function(k) {
            var e = equips[k] || {};
            if (safeNum(e.类型, 0) === 8) return;
            eqList.push({ key: k, val: e });
        });
        Object.keys(backpack).forEach(function(k) {
            var b = backpack[k] || {};
            if (safeNum(b.数量, 0) <= 0) return;
            bpList.push({ key: k, val: b, qty: safeNum(b.数量, 0) });
        });
        var html = '<div class="sam-trf-list">';
        if (eqList.length) {
            html += '<div class="sam-trf-sec">⚔ 装备 · '+eqList.length+'</div>';
            eqList.forEach(function(it) { html += lootItemCard('装备', it.key, it.val, 1); });
        }
        if (bpList.length) {
            html += '<div class="sam-trf-sec">🎒 道具 · '+bpList.length+'</div>';
            bpList.forEach(function(it) { html += lootItemCard('道具', it.key, it.val, it.qty); });
        }
        if (!eqList.length && !bpList.length) {
            html += '<div class="sam-empty">该角色身上没有可获取的物资</div>';
        }
        html += '</div>';
        var hasSel = Object.keys(lootCart.装备).length + Object.keys(lootCart.道具).length > 0;
        html += '<div class="sam-trf-footer">';
        html += '<div class="sam-trf-warn">⚠️ 获取遗物后将直接归属角色, 不可退回。</div>';
        html += '<div class="sam-trf-actions">';
        html += '<button type="button" class="sam-loot-btn cancel">取消</button>';
        html += '<button type="button" class="sam-loot-btn confirm"'+(hasSel ? '' : ' disabled')+'>确认获取</button>';
        html += '</div></div>';
        return html;
    }
    function lootItemCard(cat, key, item, maxQty) {
        var sel = lootCart[cat][key] != null;
        var selQty = sel ? lootCart[cat][key] : 0;
        var q = parseRarity(item.品质);
        var isItem = (cat === '道具');
        var corner = sel ? (isItem ? '已选 ×'+selQty : '已选') : '';
        var typeLabel = isItem ? safeStr(item.类型) : (EQUIP_TYPE_MAP[safeNum(item.类型, 0)] || '');
        var attrs = item.原始属性 || {};
        // 展示属性: 品质字母原样显示, 数值隐藏0(与 formatStatGrid / 装备卡一致)
        var attrStr = Object.keys(attrs).filter(function(k) {
            var v = attrs[k];
            if (isStatQuality(v)) return true;
            return safeNum(v, 0) !== 0;
        }).map(function(k) {
            var v = attrs[k];
            return esc(k)+' '+(isStatQuality(v) ? safeStr(v) : safeNum(v, 0));
        }).join(' / ');
        var desc = safeStr(item.描述) || '';
        var inner = '<div class="sam-trf-head"><span class="sam-trf-name">'+esc(key)+'</span><span class="sam-trf-qtag q-'+q+'">'+esc(q)+'</span></div>';
        if (typeLabel) inner += '<div class="sam-trf-sub">'+esc(typeLabel) + (isItem ? ' · 持有 '+maxQty : '') + '</div>';
        if (attrStr) inner += '<div class="sam-trf-attrs">'+attrStr+'</div>';
        if (desc) inner += '<div class="sam-trf-desc">'+esc(desc)+'</div>';
        if (isItem && sel) {
            inner += '<div class="sam-trf-qty">'
                + '<button type="button" class="sam-loot-qty-btn" data-trf-qty="minus" data-cat="'+esc(cat)+'" data-key="'+esc(key)+'">−</button>'
                + '<input type="number" class="sam-loot-qty-inp" min="1" max="'+maxQty+'" value="'+selQty+'" data-cat="'+esc(cat)+'" data-key="'+esc(key)+'">'
                + '<button type="button" class="sam-loot-qty-btn" data-trf-qty="plus" data-cat="'+esc(cat)+'" data-key="'+esc(key)+'">+</button>'
                + '<span class="sam-trf-qty-max">/'+maxQty+'</span></div>';
        }
        return '<div class="sam-trf-item sam-loot-item'+(sel?' selected':'')+'" data-loot-cat="'+esc(cat)+'" data-loot-key="'+esc(key)+'">'+inner+'<span class="sam-trf-corner">'+esc(corner)+'</span></div>';
    }
    function lootToggle(cat, key) {
        if (lootCart[cat][key] != null) delete lootCart[cat][key];
        else lootCart[cat][key] = 1;
        refreshLootModal();
    }
    function lootAdjustQty(cat, key, dir) {
        var sd = getStatData();
        var npc = sd && sd.关系列表 && sd.关系列表[lootTarget];
        if (!npc) return;
        var max = 1;
        if (cat === '道具') max = safeNum(npc.道具[key] && npc.道具[key].数量, 1);
        var cur = lootCart[cat][key] != null ? lootCart[cat][key] : 1;
        if (dir === 'plus') cur = Math.min(max, cur + 1);
        else cur = Math.max(1, cur - 1);
        lootCart[cat][key] = cur;
        refreshLootModal();
    }
    function lootInputQty(cat, key, val) {
        var sd = getStatData();
        var npc = sd && sd.关系列表 && sd.关系列表[lootTarget];
        if (!npc) return;
        var max = 1;
        if (cat === '道具') max = safeNum(npc.道具[key] && npc.道具[key].数量, 1);
        var v = Math.max(1, Math.min(max, parseInt(val, 10) || 1));
        lootCart[cat][key] = v;
        refreshLootModal();
    }
    function refreshLootModal() {
        var $body = $('#samsara-modal .sam-modal-body');
        var saved = $body.length ? ($body[0].scrollTop || 0) : 0;
        var sd = getStatData();
        var npc = sd && sd.关系列表 && sd.关系列表[lootTarget];
        if (npc) $body.html(renderLootList(npc));
        if ($body.length && saved > 0) { try { $body[0].scrollTop = saved; } catch(e){} }
    }
    function executeLoot() {
        var eqKeys = Object.keys(lootCart.装备);
        var bpKeys = Object.keys(lootCart.道具);
        if (eqKeys.length + bpKeys.length === 0) return;
        var npcName = lootTarget;
        var ok = writeBackMvu(function(statData) {
            if (!statData) return;
            var mc = statData.角色 = statData.角色 || {};
            mc.装备 = mc.装备 || {}; mc.道具 = mc.道具 || {};
            var rel = statData.关系列表 = statData.关系列表 || {};
            var npc = rel[npcName] = rel[npcName] || {};
            npc.装备 = npc.装备 || {}; npc.道具 = npc.道具 || {};
            var lootedParts = []; // ★ 实际拿取成功的明细, 用于待播报记录
            // 装备: 从NPC复制给角色(状态置0), 删除NPC的
            eqKeys.forEach(function(key) {
                var e = npc.装备[key];
                if (!e) return;
                var copy = (_ && _.cloneDeep) ? _.cloneDeep(e) : JSON.parse(JSON.stringify(e));
                copy.状态 = 0;
                mc.装备[key] = copy;
                delete npc.装备[key];
                lootedParts.push('装备「' + key + '」');
            });
            // 道具: 按数量从NPC转移给角色
            bpKeys.forEach(function(key) {
                var b = npc.道具[key];
                if (!b) return;
                var have = safeNum(b.数量, 0);
                var move = Math.min(lootCart.道具[key] || 1, have);
                if (move <= 0) return;
                if (mc.道具[key]) {
                    mc.道具[key].数量 = safeNum(mc.道具[key].数量, 0) + move;
                } else {
                    var copy2 = (_ && _.cloneDeep) ? _.cloneDeep(b) : JSON.parse(JSON.stringify(b));
                    copy2.数量 = move;
                    mc.道具[key] = copy2;
                }
                b.数量 = have - move;
                if (b.数量 <= 0) delete npc.道具[key];
                lootedParts.push('道具「' + key + '」×' + move);
            });
            // ★ 前端从NPC拿取物资 → 记入待播报记录(与本次写回同一落盘, 待正文模型叙事后自动清空)
            if (lootedParts.length) {
                shopAppendReceipt(statData, '[获取][角色] 从「' + npcName + '」处获得 ' + lootedParts.join('、'));
            }
        });
        if (ok) {
            var cnt = eqKeys.length + bpKeys.length;
            lootCart = { 装备: {}, 道具: {} };
            lootTarget = null;
            closeModal();
            samToast('success', '从「'+npcName+'」获取 '+cnt+' 项遗物');
            renderAll();
        } else {
            samToast('error', '获取失败: 数据写回不可用');
        }
    }
