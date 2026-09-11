const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('World Book/⚙️世界因果与法则协议.txt','utf8');
// Execute the template's control flow and literal output without requiring the Tavern runtime.
function render(stat){
 let code='let out="";\n',last=0;
 for(const m of source.matchAll(/<%([_=-]?)([\s\S]*?)_?%>/g)){
  code+='out+='+JSON.stringify(source.slice(last,m.index))+';\n';
  code+=m[1]==='='?'out+=('+m[2]+');\n':m[2]+'\n';last=m.index+m[0].length;
 }
 code+='out+='+JSON.stringify(source.slice(last))+';return out;';
 return new Function('getMessageVar','_',code)(()=>stat,{get:(obj,path,fallback)=>path.split('.').reduce((v,k)=>v?.[k],obj)??fallback});
}
const labels=['黄金祝福','世界青睐','原著时间线 | 稳定','轻度偏移','初步警觉','因果紊乱','世界疏离','时空渗透 | 法则松动','世界畸变','英雄崩塌','终焉倒计时'].map(label=>' | '+label);
for(const [value,index] of [[120,0],[111,0],[110,1],[101,1],[100,2],[99,3],[90,3],[89,4],[80,4],[79,5],[70,5],[69,6],[60,6],[59,7],[50,7],[49,8],[40,8],[39,9],[30,9],[29,10],[10,10]]){
 const text=render({世界:{稳定:value}});
 labels.forEach((label,i)=>assert.equal(text.includes(label),i===index,`${value}: ${label}`));
}
assert(labels.every(label=>!render({世界:{稳定:5}}).includes(label)));
const locked=render({设置:{世界超稳:true},世界:{稳定:30}});
assert(locked.includes('世界稳定值固定为100'));
assert(labels.every(label=>!locked.includes(label)));
console.log('Stability EJS range boundaries and override passed');
