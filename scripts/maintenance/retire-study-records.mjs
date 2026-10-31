import fs from "node:fs";
import path from "node:path";
const actualRoot = path.resolve(import.meta.dirname, "../..");
const root = path.resolve(process.argv.find(a=>a.startsWith("--workspace="))?.slice(12)||actualRoot);
const plan = JSON.parse(fs.readFileSync(path.join(actualRoot, "docs/cleanup/retirement-plan.json"),"utf8"));
if(plan.blockers.length)throw new Error("Retirement still has dependency blockers");
const filename=path.join(root,"art/manifest.json");
const manifest=JSON.parse(fs.readFileSync(filename,"utf8"));
const ids=new Set(plan.retiredStudyIds), proofs=new Map(plan.files.map(f=>[f.path,f]));
manifest.archivedAssets ||= [];
let archived=0;
for(const record of manifest.assets.filter(a=>ids.has(a.id))) {
  if(record.status!=="inactive"||!record.id.startsWith("study.ranger."))throw new Error("Only specifically retired inactive studies may move to archive records");
  if(manifest.archivedAssets.some(a=>a.id===record.id))continue;
  const paths=[record.runtimePath,record.sourceRuntimePath,record.archivePath,...(record.sourcePaths||[]),...(record.inactiveVariants||[])].filter(Boolean);
  const archivedFiles=paths.filter(p=>proofs.has(p)).map(p=>({path:p,sha256:proofs.get(p).sha256,gitBlob:proofs.get(p).gitBlob}));
  if(!archivedFiles.length)throw new Error("Archived study must have specific recoverable file proofs");
  manifest.archivedAssets.push({...record,retirement:{date:plan.date,reason:"Superseded detailed animation route; unused by active game or retained authoring",baselineCommit:plan.baselineCommit,plan:"docs/cleanup/retirement-plan.json",backupSet:"2026-10-31-card-layout-cleanup",files:archivedFiles}});
  archived++;
}
manifest.assets=manifest.assets.filter(a=>!ids.has(a.id));
manifest.policy.verifiedRetirement={date:plan.date,scope:[...ids],records:"archivedAssets",plan:"docs/cleanup/retirement-plan.json",automaticInactiveDeletion:false};
fs.writeFileSync(filename,JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({archived,activeOrRetainedRecords:manifest.assets.length,archivedRecords:manifest.archivedAssets.length}));
