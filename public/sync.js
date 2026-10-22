// JSON object field order is not a planner edit. Array order still is.
export function DDsameSnapshot(a,b){
 if(a===b)return true;
 const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
 return stable(a)===stable(b);
}
