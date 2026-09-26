    // 历史记忆手动维护：近期原始锚点可修正事实；长期总结可修正摘要/时间，但树层级与子项引用始终由程序托管。
    function historyMemoryEditorEscape(value) {
        if(typeof causalOverviewEscape==='function')return causalOverviewEscape(value);
        return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }
    function historyMemoryEditorSamePath(left,right) {
        return Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((item,index)=>String(item)===String(right[index]));
    }
    function historyMemoryEditorSyncReplay(raw,fingerprint,path,value) {
        const replay=raw?.__samsaraWorldReplay;
        if(!plain(replay)||String(replay.fingerprint||'')!==String(fingerprint||'')||!Array.isArray(replay.operations))return;
        replay.operations=replay.operations.filter(operation=>!historyMemoryEditorSamePath(operation?.path,path));
        replay.operations.push({op:'set',path:copy(path),value:copy(value)});
    }
    function historyMemoryEditorRelated(value) {
        const source=Array.isArray(value)?value.join('\n'):String(value||'');
        return [...new Set(source.split(/[\n,，、;；]+/).map(item=>item.trim()).filter(Boolean))];
    }
