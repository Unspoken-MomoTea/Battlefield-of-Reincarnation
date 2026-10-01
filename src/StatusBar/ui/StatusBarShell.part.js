/* ===== 10. 面板开关 ===== */
    function toggleSamsaraPanel() {
        var $panel = $('#samsara-panel');
        var $ball = $('#samsara-ball');
        var isOpen = $panel.hasClass('open');
        if (isOpen) {
            // 打开时写了内联 display:flex，仅 removeClass('open') 不会立刻隐藏
            // 以前空等 300ms 才 display:none，又没有退场动画，体感像卡了约 1 秒
            if ($panel.data('samCloseTimer')) {
                clearTimeout($panel.data('samCloseTimer'));
                $panel.removeData('samCloseTimer');
            }
            $panel.removeClass('open').addClass('closing');
            var closeTimer = setTimeout(function() {
                $panel.removeClass('closing').css('display', 'none');
                $panel.removeData('samCloseTimer');
            }, 180);
            $panel.data('samCloseTimer', closeTimer);
            $ball.stop(true, true).fadeIn(160);
            try { localStorage.setItem(SAM_CONFIG.open, '0'); } catch(e){}
        } else {
            if ($panel.data('samCloseTimer')) {
                clearTimeout($panel.data('samCloseTimer'));
                $panel.removeData('samCloseTimer');
            }
            $panel.removeClass('closing');
            if (isMobile()) { $panel.css({left:'',top:'',right:'',bottom:'',margin:'',height:''}); }
            else {
                var r = $ball[0].getBoundingClientRect();
                var vw = GS_PARENT.innerWidth, vh = GS_PARENT.innerHeight;
                var pw = $panel.outerWidth() || 720;
                var nl = Math.max(20, Math.min(vw - pw - 20, r.left > vw/2 ? r.left - pw - 20 : r.left + 60));
                var nt = Math.max(20, Math.min(vh - 700, r.top));
                $panel.css({left:nl+'px', top:nt+'px', right:'auto', bottom:'auto'});
            }
            $panel.css('display', 'flex');
            $panel[0].offsetHeight;
            $panel.addClass('open');
            $ball.stop(true, true).fadeOut(160);
            try { localStorage.setItem(SAM_CONFIG.open, '1'); } catch(e){}
            renderAll();
        }
    }

    /* ===== 11. 拖拽系统(球+面板) ===== */
    function setupDragEngines() {
        var $ball = $('#samsara-ball');
        var $panel = $('#samsara-panel');
        if (!$ball.length || !$panel.length) return;

        if (!$ball.data('samDragBound')) {
            $ball.data('samDragBound', '1');
            var sx1=0, sy1=0, ox1=0, oy1=0, dragging1=false, moved1=false;
            try {
                var savedPos = localStorage.getItem(SAM_CONFIG.pos);
                if (savedPos && !isMobile()) {
                    var arr = savedPos.split(',');
                    if (arr.length === 2) {
                        $ball[0].style.setProperty('left', arr[0]+'px', 'important');
                        $ball[0].style.setProperty('top', arr[1]+'px', 'important');
                        $ball[0].style.setProperty('right', 'auto', 'important');
                    }
                }
            } catch(e){}
            $ball[0].addEventListener('touchstart', handleBallDown, { passive: false });
            $ball.on('mousedown', function(e) { if (e.button !== 0) return; handleBallDown(e); });
            function handleBallDown(e) {
                var p = e.originalEvent && e.originalEvent.touches ? e.originalEvent.touches[0] : (e.touches ? e.touches[0] : e);
                sx1 = p.clientX; sy1 = p.clientY;
                var r = $ball[0].getBoundingClientRect(); ox1 = r.left; oy1 = r.top;
                dragging1 = true;
                document.addEventListener('mousemove', handleBallMove);
                document.addEventListener('touchmove', handleBallMove, { passive: false });
                document.addEventListener('mouseup', handleBallUp);
                document.addEventListener('touchend', handleBallUp);
            }
            function handleBallMove(me) {
                if (!dragging1) return;
                var mp = me.originalEvent && me.originalEvent.touches ? me.originalEvent.touches[0] : (me.touches ? me.touches[0] : me);
                var dx = mp.clientX - sx1, dy = mp.clientY - sy1;
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    moved1 = true;
                    var vw = GS_PARENT.innerWidth||1024, vh = GS_PARENT.innerHeight||768;
                    var sz = $ball[0].offsetWidth || 34;
                    var nl = Math.max(10, Math.min(vw-sz-10, ox1+dx));
                    var nt = Math.max(10, Math.min(vh-sz-10, oy1+dy));
                    $ball[0].style.setProperty('right','auto','important');
                    $ball[0].style.setProperty('bottom','auto','important');
                    $ball[0].style.setProperty('left', nl+'px','important');
                    $ball[0].style.setProperty('top', nt+'px','important');
                    if (me.type === 'touchmove' && me.cancelable) me.preventDefault();
                }
            }
            function handleBallUp() {
                if (dragging1 && moved1) {
                    try { localStorage.setItem(SAM_CONFIG.pos, parseInt($ball[0].style.left)+','+parseInt($ball[0].style.top)); } catch(e){}
                }
                dragging1 = false;
                document.removeEventListener('mousemove', handleBallMove);
                document.removeEventListener('touchmove', handleBallMove);
                document.removeEventListener('mouseup', handleBallUp);
                document.removeEventListener('touchend', handleBallUp);
                setTimeout(function() { moved1 = false; }, 50);
            }
            $ball.on('click', function() { if (!moved1) toggleSamsaraPanel(); });
        }

        if (!$panel.data('samDragBound')) {
            $panel.data('samDragBound', '1');
            var sx2=0, sy2=0, ox2=0, oy2=0, dragging2=false;
            $panel.on('mousedown touchstart', '.sam-topbar', function(e) {
                if (e.type === 'mousedown' && e.button !== 0) return;
                if ($(e.target).closest('.sam-icon-btn').length) return;
                if (isMobile()) return;
                var p = e.originalEvent.touches ? e.originalEvent.touches[0] : e;
                sx2 = p.clientX; sy2 = p.clientY;
                var r = $panel[0].getBoundingClientRect(); ox2 = r.left; oy2 = r.top;
                dragging2 = true;
                $(document).on('mousemove.samPanel touchmove.samPanel', function(me) {
                    if (!dragging2) return;
                    var mp = me.originalEvent.touches ? me.originalEvent.touches[0] : me;
                    var dx = mp.clientX - sx2, dy = mp.clientY - sy2;
                    var vw = GS_PARENT.innerWidth||1024, vh = GS_PARENT.innerHeight||768;
                    var pw = $panel.outerWidth(), ph = $panel.outerHeight();
                    var nl = Math.max(0, Math.min(vw-pw, ox2+dx));
                    var nt = Math.max(0, Math.min(vh-ph, oy2+dy));
                    $panel.css({left:nl+'px', top:nt+'px', right:'auto', bottom:'auto'});
                    if (me.type === 'touchmove' && me.cancelable) me.preventDefault();
                });
                $(document).on('mouseup.samPanel touchend.samPanel', function() {
                    dragging2 = false;
                    $(document).off('mousemove.samPanel touchmove.samPanel mouseup.samPanel touchend.samPanel');
                });
            });
        }
    }

    /* ===== 12. DOM 注入 ===== */
    function initSamsaraDOM() {
        if (!document.getElementById('samsara-ball')) {
            var t = getTheme();
            var panelAttr = (t === 'night') ? '' : ('data-theme="'+t+'"');
            var tpl = '<div id="samsara-ball"><div class="core"></div></div><div id="samsara-panel" '+panelAttr+'></div><div id="samsara-modal"></div><div id="samsara-portrait-viewer"><img id="sam-pv-img" alt=""><div id="sam-pv-label"></div></div>';
            $('body').append(tpl);
            setupDragEngines();
            bindUIEvents();
            bindPortraitEvents();
        }
    }

    /* ===== 13. 弹窗 ===== */
    function showModal(title, bodyHtml, noBgClose) {
        var $m = $('#samsara-modal');
        if (!$m.length) { $('body').append('<div id="samsara-modal"></div>'); }
        $m = $('#samsara-modal');
        $m.html('<div class="sam-modal-box"><div class="sam-modal-head"><span>'+esc(title)+'</span><span class="sam-modal-close">✕</span></div><div class="sam-modal-body">'+bodyHtml+'</div></div>');
        $m[0].scrollTop = 0;
        $m.addClass('open');
        $m.off('click.samModal').on('click.samModal', '.sam-modal-close', closeModal);
        $m.off('click.samModalBg');
        if (!noBgClose) $m.on('click.samModalBg', function(e) { if (e.target === this) closeModal(); });
        // 停止按钮(.sam-shop-stop-btn, 通过 data-sam-act 分发): modal 在 body 之下独立于 #samsara-panel,
        // 故在 modal 自身追加分发委托(同 bloodFusionStop / shopStopRefresh), 与 panel 内同名委托解耦共存
        $m.off('click.samModalStop').on('click.samModalStop', '.sam-shop-stop-btn', function(e) {
            e.stopPropagation();
            var act = String($(this).attr('data-sam-act') || '');
            if (act === 'blood-fusion-stop') bloodFusionStop();
            else shopStopRefresh();
        });
    }
    function closeModal() {
        var $m = $('#samsara-modal');
        $m.removeClass('open');
        // 解绑所有可能残留的 modal 相关事件(防止 samConfirm 的遮罩点外关闭残留到下次 showModal 复用)
        $m.off('click.samModal').off('click.samModalBg').off('click.samConfirm').off('click.samConfirmBg');
    }

    