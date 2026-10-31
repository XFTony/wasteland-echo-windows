import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname,"../..");
const output = path.join(root,"output/godot-migration");
const reference = JSON.parse(fs.readFileSync(path.join(output,"reference-ui/screenshots.json"),"utf8")).records;
const native = JSON.parse(fs.readFileSync(path.join(output,"native-ui/regions.json"),"utf8"));
function regions(record) {
  return new Map(record.actions.map(box => [record.menu==='shop' && box.action.startsWith('shopPage:')
    ? `shopPager:${box.x < record.width / 2 ? 'previous' : 'next'}` : box.action, box]));
}
const results = native.map(record => {
  const old = reference.find(r=>r.menu===record.menu&&r.width===record.width&&r.height===record.height);
  assert(old,"Reference resolution not found");
  const before = regions(old),after=regions(record);
  if(record.menu==='shop') {
    assert.equal(after.get('shopPager:previous').action,'shopPage:3');
    assert.equal(after.get('shopPager:next').action,'shopPage:1');
  }
  const missing=[...before.keys()].filter(key=>!after.has(key)),extra=[...after.keys()].filter(key=>!before.has(key));
  let maxRectDelta=0;
  for(const [key,box]of after){
    assert(box.x>=-1&&box.y>=-1&&box.x+box.w<=record.width+1&&box.y+box.h<=record.height+1,'Action outside viewport: '+key);
    if(before.has(key))for(const axis of ["x","y","w","h"])maxRectDelta=Math.max(maxRectDelta,Math.abs(box[axis]-before.get(key)[axis]));
  }
  return{page:record.menu,width:record.width,height:record.height,missing,extra,maxRectDelta,actions:after.size};
});
const proof={date:"2026-10-31",scope:"Default menu action IDs and rectangles; shop previous/next buttons use semantic identities so the four-page wrap target is checked without collapsing duplicate reference IDs. Not full behavior or visual acceptance.",results};
fs.writeFileSync(path.join(output,"ui-region-comparison.json"),JSON.stringify(proof,null,2)+"\n");
assert.equal(results.length,24);
for(const result of results){assert.deepEqual(result.missing,[],result.page);assert.deepEqual(result.extra,result.page==='inventory'?['workshop']:[],result.page);assert(result.maxRectDelta<.05,JSON.stringify(result));}
console.log(JSON.stringify({layouts:results.length,matchedActions:results.reduce((n,r)=>n+r.actions,0),maximumRectDelta:Math.max(...results.map(r=>r.maxRectDelta))}));
