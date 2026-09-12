const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup() {
    const handlers = {}, events = {}, lifecycle = {}, messages = [];
    const input = { id: 'send_textarea', value: '' };
    let fail = false;
    const doc = {
        getElementById: () => input,
        addEventListener: (type, fn) => { handlers[type] = fn; },
        removeEventListener: type => { delete handlers[type]; },
    };
    const context = vm.createContext({
        window: { parent: { document: doc }, addEventListener: (type, fn) => { lifecycle[type] = fn; } },
        console: { error() {} }, tavern_events: { MESSAGE_SENT: 'sent', CHAT_CHANGED: 'chat' },
        eventOn(type, fn) { events[type] = fn; return { stop() { delete events[type]; } }; },
        getChatMessages: id => [messages[id]],
        async setChatMessages(changes) {
            if (fail) throw new Error('write failed');
            changes.forEach(change => Object.assign(messages[change.message_id], change));
        },
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../script/用户输入追加说明.js'), 'utf8'), context);
    return {
        input, handlers, events, lifecycle,
        type(text, trusted = true) { input.value = text; handlers.input({ target: input, isTrusted: trusted }); },
        click(trusted = true) { handlers.click({ type: 'click', isTrusted: trusted, target: { closest: () => ({}) } }); },
        enter(extra = {}) { handlers.keydown({ type: 'keydown', target: input, key: 'Enter', isTrusted: true, ...extra }); },
        async send(text = input.value) {
            this.type('', false);
            const id = messages.length;
            messages.push({ role: 'user', message: text });
            await events.sent(id);
            return messages[id].message;
        },
        failWrite() { fail = true; },
    };
}
test('manual send survives native input clearing and does not duplicate', async () => {
    for (const method of ['enter', 'click']) {
        const app = setup();
        app.type('我尝试推开门');
        app.type('我尝试推开门', false);
        app[method]();
        assert.equal(app.input.value, '我尝试推开门');
        const sent = await app.send();
        assert.match(sent, /^我尝试推开门\n<tmd_nan>/);
        app.type(sent); app[method]();
        assert.equal(await app.send(), sent);
    }
});
test('automatic input, synthetic click, direct overwrite are skipped', async () => {
    const app = setup();
    app.type('自动开局', false); app.click(false);
    assert.equal(await app.send(), '自动开局');
    app.type('程序填入', false); app.click();
    assert.equal(await app.send(), '程序填入');
    app.type('手动草稿'); app.click(false);
    assert.equal(await app.send(), '手动草稿');
    app.type('手动草稿'); app.input.value = '直接覆盖'; app.enter();
    assert.equal(await app.send(), '直接覆盖');
});
test('newline, IME, commands and chat changes are skipped; cleanup works', async () => {
    const app = setup();
    for (const extra of [{ shiftKey: true }, { isComposing: true }, { keyCode: 229 }]) {
        app.type('内容'); app.enter(extra);
        assert.equal(await app.send(), '内容');
    }
    app.type('换行'); app.enter(); app.type('换行\n');
    assert.equal(await app.send(), '换行\n');
    for (const text of ['/send 开局', '   ']) {
        app.type(text); app.click(); assert.equal(await app.send(), text);
    }
    app.type('旧聊天'); app.click(); app.events.chat();
    assert.equal(await app.send(), '旧聊天');
    app.lifecycle.pagehide();
    assert.deepEqual(Object.keys(app.handlers), []);
    assert.deepEqual(Object.keys(app.events), []);
});
test('write failure does not reject send event or prevent generation', async () => {
    const app = setup();
    app.type('正常发送'); app.click(); app.failWrite();
    assert.equal(await app.send(), '正常发送');
});
