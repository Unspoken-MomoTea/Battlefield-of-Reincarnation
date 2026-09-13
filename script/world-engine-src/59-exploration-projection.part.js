    // 玩家探索投影保护层。
    const EXPLORATION_PROJECTION_SUFFIX=/(?:地区|区域|校区|城区|街区|片区)$/;
    function explorationProjectionBaseKey(value) {
        const key=nameKey(value);
        const stripped=key.replace(EXPLORATION_PROJECTION_SUFFIX,'');
        return stripped.length>=2?stripped:key;
    }
    function explorationProjectionEquivalent(a,b) {
        const x=nameKey(a),y=nameKey(b);if(!x||!y)return false;
        if(x===y)return true;
        const xb=explorationProjectionBaseKey(a),yb=explorationProjectionBaseKey(b);
        return xb===yb&&xb.length>=2;
    }
    function explorationLocationContainsArea(location,areaName) {
        const locationKey=nameKey(location),areaKey=nameKey(areaName);if(!locationKey||!areaKey)return false;
        if(locationKey===areaKey||locationKey.includes(areaKey))return true;
        const locationBase=explorationProjectionBaseKey(location),areaBase=explorationProjectionBaseKey(areaName);
        return areaBase.length>=2&&(locationBase===areaBase||locationBase.includes(areaBase));
    }
    function explorationProjectionRegionCandidates(stat,result) {
        const stored=stat?.世界?.[PATH]?.势力地区||{},map=new Map();
        for(const [name,record] of Object.entries(stored)){
            if(!plain(record))continue;
            map.set(nameKey(name),{名称:name,记录:copy(record)});
        }
        for(const item of result?.势力地区||[]){
            if(!plain(item)||item.操作==='撤销本轮')continue;
            const id=nameKey(item.名称);if(!id)continue;
            const previous=map.get(id);
            map.set(id,{名称:previous?.名称||item.名称,记录:Object.assign({},previous?.记录||{},copy(item))});
        }
        return Array.from(map.values()).filter(item=>String(item.记录?.类型||'地区')!=='势力');
    }
    function currentExplorationProjectionRegion(stat,result) {
        if(stat?.系统状态?.是否在主神空间)return null;
        const location=String(stat?.世界?.地点||'').trim();if(!location)return null;
        const locationKey=nameKey(location);
        const candidates=explorationProjectionRegionCandidates(stat,result).filter(item=>explorationLocationContainsArea(location,item.名称));
        if(!candidates.length)return null;
        candidates.sort((a,b)=>{
            const ak=nameKey(a.名称),bk=nameKey(b.名称);
            const exactA=ak===locationKey?1:0,exactB=bk===locationKey?1:0;
            if(exactA!==exactB)return exactB-exactA;
            return bk.length-ak.length;
        });
        return candidates[0];
    }
