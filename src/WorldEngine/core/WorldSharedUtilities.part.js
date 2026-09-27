    const copy = value => JSON.parse(JSON.stringify(value));
    const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    function digest(text) {
        let a = 2166136261, b = 5381;
        for (let i=0;i<text.length;i++) { a = Math.imul(a ^ text.charCodeAt(i),16777619); b = Math.imul(b,33) ^ text.charCodeAt(i); }
        return (a >>> 0).toString(16) + (b >>> 0).toString(16) + ':' + text.length;
    }
    const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
