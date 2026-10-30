import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { drawUpgradeIllustration } = require("../../src/render/ui/upgrade-illustrations.js");

function color(value) {
  const rgba = /^rgba\((\d+),(\d+),(\d+),([.\d]+)\)$/.exec(value.replaceAll(" ",""));
  if (!rgba) return value;
  return "#" + rgba.slice(1,4).map(n=>Number(n).toString(16).padStart(2,"0")).join("")
    + Math.round(Number(rgba[4])*255).toString(16).padStart(2,"0");
}

export function exportUpgradeGlyphs(content) {
  const glyphs = {};
  const items = [...Object.values(content.upgrades), ...Object.values(content.fieldGoods),
    ...Object.values(content.fieldGoods).map(item=>({...item,id:item.icon}))];
  for (const item of items) {
    const commands = [];
    let path = [];
    const context = {
      fillStyle:"#000000",strokeStyle:"#000000",lineWidth:1,
      save(){},restore(){},translate(x,y){if(x!==0||y!==0)throw Error("Unexpected glyph translation");},
      scale(x,y){if(x!==1||y!==1)throw Error("Unexpected glyph scale");},
      fillRect(x,y,w,h){commands.push({kind:"rect",x,y,w,h,color:color(this.fillStyle)});},
      beginPath(){path=[];},arc(x,y,radius,start,end){path.push({kind:"arc",x,y,radius,start,end});},
      stroke(){for(const part of path)commands.push({...part,color:color(this.strokeStyle),width:this.lineWidth});},
      fill(){for(const part of path)commands.push({...part,color:color(this.fillStyle),filled:true});}
    };
    drawUpgradeIllustration(context,item.id,32,32,64,item.family);
    glyphs[item.id]=commands;
  }
  return glyphs;
}
