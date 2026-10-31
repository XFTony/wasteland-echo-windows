import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
const root=path.resolve(import.meta.dirname,"../..");
const plan=JSON.parse(fs.readFileSync(path.join(root,"docs/cleanup/retirement-plan.json"),"utf8"));
const files=new Map(plan.files.map(f=>[f.path,f]));
const tracked=execFileSync("git",["ls-files","-z"],{cwd:root,encoding:"utf8",windowsHide:true}).split("\0").filter(p=>p.endsWith(".md")&&fs.existsSync(path.join(root,p))&&!p.startsWith("docs/cleanup/"));
const changes=[];
for(const filename of tracked) {
  const full=path.join(root,filename),before=fs.readFileSync(full,"utf8");
  let replacements=0;
  const recovery=path.relative(path.dirname(full),path.join(root,"docs/cleanup/retirement-report.md")).replaceAll("\\","/");
  let after=before.replace(/(!?)\[([^\]]*)\]\((?:<([^>]+)>|([^\s)]+))\)/g,(whole,image,label,angle,plain)=>{
    const target=angle||plain;
    if(/^[a-z][a-z\d+.-]*:|^#/i.test(target))return whole;
    const local=target.split("#")[0];
    let decoded;try{decoded=decodeURIComponent(local);}catch{return whole;}
    const relative=path.relative(root,path.resolve(path.dirname(full),decoded)).replaceAll("\\","/");
    const record=files.get(relative);
    const retiredDirectory=plan.roots.find(p=>relative===p.replace(/\/$/,"")||relative.startsWith(p));
    if(!record&&!retiredDirectory)return whole;
    const isVersioned=record?.gitBlob||plan.files.some(f=>f.gitBlob&&f.path.startsWith(relative.replace(/\/$/,"")+"/"));
    replacements++;
    if(isVersioned){const kind=record?"blob":"tree";const encoded=relative.split("/").map(encodeURIComponent).join("/");return `[${label}${image?"（归档原图）":""}](https://github.com/XFTony/wasteland-echo-windows/${kind}/${plan.baselineCommit}/${encoded})`;}
    return `[${label}（已归档）](${recovery})`;
  });
  if(after!==before) {
    if(filename.startsWith("docs/")&&!after.includes("历史素材已按清理记录归档")) {
      const end=after.indexOf("\n");
      after=after.slice(0,end+1)+`\n> 历史素材已按清理记录归档；原稿链接固定到清理前提交，旧预览恢复方法见[清理报告](${recovery})。\n`+after.slice(end+1);
    }
    fs.writeFileSync(full,after);changes.push({path:filename,replacements});
  }
}
fs.writeFileSync(path.join(root,"output/card-layout-cleanup/retired-link-updates.json"),JSON.stringify(changes,null,2)+"\n");
console.log(JSON.stringify({documents:changes.length,links:changes.reduce((n,c)=>n+c.replacements,0)}));
