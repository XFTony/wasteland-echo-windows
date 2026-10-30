import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const output=path.resolve(import.meta.dirname,"../../output/godot-migration");
const reference=JSON.parse(fs.readFileSync(path.join(output,"reference-battle-regions.json"))).records;
const native=JSON.parse(fs.readFileSync(path.join(output,"native-play/regions.json"))).records;
const results=native.map(record=>{
  const original=reference.find(row=>row.kind===record.kind&&row.width===record.width&&row.height===record.height);
  assert(original,"Missing reference layout");
  const before=new Map(original.actions.map(row=>[row.action,row]));
  const after=new Map(record.actions.map(row=>[row.action,row]));
  const missing=[...before.keys()].filter(key=>!after.has(key));
  const extra=[...after.keys()].filter(key=>!before.has(key));
  let maximumRectDelta=0;
  for(const[id,rect]of before)if(after.has(id))for(const axis of["x","y","w","h"])
    maximumRectDelta=Math.max(maximumRectDelta,Math.abs(rect[axis]-after.get(id)[axis]));
  return{kind:record.kind,width:record.width,height:record.height,actions:after.size,missing,extra,maximumRectDelta};
});
const report={scope:"Combat action IDs and hit areas; upgrade slots intentionally stay still while artwork animates; original rest layout is the reference. Not pixel comparison.",results};
fs.writeFileSync(path.join(output,"battle-region-comparison.json"),JSON.stringify(report,null,2)+"\n");
assert.equal(results.length,28);
for(const result of results){assert.deepEqual(result.missing,[]);assert.deepEqual(result.extra,[]);assert(result.maximumRectDelta<0.05,JSON.stringify(result));}
console.log(JSON.stringify({layouts:results.length,actions:results.reduce((sum,row)=>sum+row.actions,0),maximumRectDelta:Math.max(...results.map(row=>row.maximumRectDelta))}));
