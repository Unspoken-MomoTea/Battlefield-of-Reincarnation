    // 因果偏移手动维护：玩家可直接修正/删除偏移；写回后立即重算稳定值并同步同楼 replay。
    function causalOffsetRecalculateStability(stat) {
        if(!plain(stat?.世界))return null;
        if(stat.设置?.世界超稳===true){stat.世界.稳定=100;return 100;}
        const bucket=stat.世界?.因果轨道?.偏移记录||{};
        const total=Object.values(plain(bucket)?bucket:{}).reduce((sum,item)=>sum+(Number(item?.影响程度)||0),0);
        const stable=Math.max(0,Math.min(120,100+total));
        stat.世界.稳定=stable;
        return stable;
    }
    function causalOffsetReplaySamePath(left,right) {
        return Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((item,index)=>String(item)===String(right[index]));
    }
    function causalOffsetSyncReplay(raw,fingerprint,oldName,newName,record,deleted,stable) {
        const replay=raw?.__samsaraWorldReplay;
        if(!plain(replay)||String(replay.fingerprint||'')!==String(fingerprint||'')||!Array.isArray(replay.operations))return;
        const oldPath=['世界','因果轨道','偏移记录',String(oldName||'')];
        const newPath=['世界','因果轨道','偏移记录',String(newName||'')];
        const stabilityPath=['世界','稳定'];
        replay.operations=replay.operations.filter(operation=>{
            const path=operation?.path;
            return !causalOffsetReplaySamePath(path,oldPath)&&!causalOffsetReplaySamePath(path,newPath)&&!causalOffsetReplaySamePath(path,stabilityPath);
        });
        if(deleted){
            replay.operations.push({op:'remove',path:oldPath});
        }else{
            if(String(oldName)!==String(newName))replay.operations.push({op:'remove',path:oldPath});
            replay.operations.push({op:'set',path:newPath,value:copy(record)});
        }
        replay.operations.push({op:'set',path:stabilityPath,value:stable});
    }
