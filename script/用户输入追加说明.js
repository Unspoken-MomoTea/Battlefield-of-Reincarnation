// 酒馆助手独立脚本：新建脚本后粘贴本文件全部内容并启用。
// 只处理亲自输入/粘贴后，亲自按回车或点击发送的内容。程序自动发送不处理。
// 说明会保存在用户消息正文中，并随正文发送给 AI。关闭脚本不会删除已追加的内容。
(function () {
    'use strict';

    // 需要修改追加内容时，只改这一行。
    const SUFFIX = '<tmd_nan>\n（当前用户输入的只是一个可能的发展方向，实际发展需根据当前真实情况或骰子判定为准。）\n</tmd_nan>';

    const host = typeof GS_PARENT !== 'undefined' ? GS_PARENT : window.parent;
    const doc = host.document;
    let manualDraft = null;
    let pending = null;
    let subscription;
    let chatSubscription;

    function onInput(event) {
        if (event.target?.id !== 'send_textarea') return;
        // 浏览器的真实输入/粘贴为可信事件；脚本 dispatchEvent 和 jQuery.trigger 不可信。
        const value = event.target.value;
        if (event.isTrusted) {
            manualDraft = value;
            pending = null;
        } else if (value !== manualDraft) {
            manualDraft = null;
            // 酒馆原生发送会先清空输入框，再创建消息，不能在清空时丢失发送标记。
            if (value !== '') pending = null;
        }
    }

    function onSend(event) {
        if (!event.isTrusted || event.defaultPrevented) return;
        if (event.type === 'keydown') {
            if (event.target?.id !== 'send_textarea' || event.key !== 'Enter' ||
                event.isComposing || event.keyCode === 229 || event.repeat ||
                event.shiftKey || event.altKey || event.metaKey) return;
        } else if (!event.target?.closest?.('#send_but')) {
            return;
        }
        const input = doc.getElementById('send_textarea');
        // 程序直接改 value（没有触发 input）也会因内容不匹配被排除。
        if (!input || manualDraft === null || input.value !== manualDraft) return;
        const text = input.value.trimEnd();
        if (!text.trim() || text.trimStart().startsWith('/') || text.endsWith(SUFFIX)) return;
        // 仅登记意图，不修改输入框、不模拟点击、不阻止事件。
        // 如果 Enter 实际是换行，后续真实 input 会清除此标记。
        pending = { text: text.trim(), at: Date.now() };
    }

    async function appendNote(messageId) {
        const intent = pending;
        pending = null;
        if (!intent || Date.now() - intent.at > 15000 || !Number.isInteger(messageId)) return;
        try {
            const message = getChatMessages(messageId)[0];
            if (!message || message.role !== 'user' || typeof message.message !== 'string') return;
            const text = message.message.trimEnd();
            // 只修改刚才手动发送的同一份内容；不匹配时保守跳过自动消息。
            if (text.trim() !== intent.text || text.endsWith(SUFFIX)) return;
            await setChatMessages([{ message_id: messageId, message: text + '\n' + SUFFIX }], { refresh: 'none' });
        } catch (error) {
            // 追加失败也不能中断酒馆原有的生成流程。
            console.error('[用户输入追加说明] 追加失败：', error);
        }
    }

    function cleanup() {
        manualDraft = null;
        pending = null;
        subscription?.stop();
        chatSubscription?.stop();
        doc.removeEventListener('input', onInput, true);
        doc.removeEventListener('keydown', onSend, true);
        doc.removeEventListener('click', onSend, true);
    }
    window.addEventListener('pagehide', cleanup, { once: true });
    try {
        if (typeof eventOn !== 'function' || typeof tavern_events === 'undefined' ||
            typeof getChatMessages !== 'function' || typeof setChatMessages !== 'function') {
            throw new Error('请在酒馆助手脚本库中运行');
        }
        const subscribe = typeof eventMakeFirst === 'function' ? eventMakeFirst : eventOn;
        subscription = subscribe(tavern_events.MESSAGE_SENT, appendNote);
        chatSubscription = eventOn(tavern_events.CHAT_CHANGED, () => { manualDraft = null; pending = null; });
        doc.addEventListener('input', onInput, true);
        doc.addEventListener('keydown', onSend, true);
        doc.addEventListener('click', onSend, true);
    } catch (error) {
        cleanup();
        console.error('[用户输入追加说明] 启动失败，未启用自动追加：', error);
    }
})();
