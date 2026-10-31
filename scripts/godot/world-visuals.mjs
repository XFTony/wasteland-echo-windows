import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { TERRAIN_METHODS } = require("../../src/render/terrain-view.js");
const { OBSTACLE_METHODS } = require("../../src/render/obstacle-view.js");

function rgba(value, alpha = 1) {
  const match = /^rgba\((\d+),(\d+),(\d+),([.\d]+)\)$/.exec(String(value).replaceAll(" ", ""));
  if (match) return [Number(match[1])/255,Number(match[2])/255,Number(match[3])/255,Number(match[4])*alpha];
  if (!/^#[a-f\d]{6}$/i.test(value)) throw new Error(`Unsupported world color: ${value}`);
  return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255).concat(alpha);
}

function recorder() {
  const commands = [];
  let points = [];
  const ctx = {
    commands,fillStyle:"#000000",strokeStyle:"#000000",lineWidth:1,globalAlpha:1,
    fillRect(x,y,w,h){commands.push({kind:"rect",x,y,w,h,color:rgba(this.fillStyle,this.globalAlpha)});},
    strokeRect(x,y,w,h){commands.push({kind:"outline",x,y,w,h,color:rgba(this.strokeStyle,this.globalAlpha),width:this.lineWidth});},
    beginPath(){points=[];},
    moveTo(x,y){points=[{x,y}];},
    lineTo(x,y){
      if(points.length)commands.push({kind:"line",from:points.at(-1),to:{x,y},color:rgba(this.strokeStyle,this.globalAlpha),width:this.lineWidth});
      points.push({x,y});
    },
    closePath(){},
    arc(x,y,radius,start,end){commands.push({kind:"arc",x,y,radius,start,end,color:rgba(this.strokeStyle,this.globalAlpha),width:this.lineWidth});},
    stroke(){},
    fill(){if(points.length>=3){
      // Filled source polygons use lineTo for construction, not for a stroke.
      const lines=points.length-1;commands.splice(commands.length-lines,lines);
      commands.push({kind:"polygon",points,color:rgba(this.fillStyle,this.globalAlpha)});
    }},
    save(){},restore(){}
  };
  return ctx;
}

function host(ctx, layout, frame = 0) {
  return {ctx,mapLayout:layout,qualityLevel:2,frame,width:1e9,height:1e9,screenPoint:{},
    artStore:{ready:()=>false},
    worldToScreen(_x,_y,output){output.x=0;output.y=0;return output;},
    text(value,x,y,size,color,align="left",weight="normal"){
      ctx.commands.push({kind:"text",value:String(value),x,y,size,color:rgba(color),align,weight:weight==="bold"?700:400});
    }};
}

export function exportWorldVisuals(world, content) {
  const obstacles = {};
  const scenery = {};
  for (const mapId of content.ids("maps")) {
    const layout=world.get(content.maps[mapId].layoutId);
    obstacles[mapId]=layout.obstacles.map(obstacle=>{
      const ctx=recorder();OBSTACLE_METHODS.drawObstacles.call(host(ctx,layout),[obstacle]);return ctx.commands;
    });
    for(const item of layout.scenery){
      if(scenery[item.type])continue;
      const phases=[0,60].map(frame=>{const ctx=recorder();TERRAIN_METHODS.drawScenery.call(host(ctx,{...layout,scenery:[{...item,detail:false}]},frame));return ctx.commands;});
      scenery[item.type]={phases,period:{antenna:80,streetlight:90,railSignal:70}[item.type]||0,
        onFrames:{antenna:40,streetlight:54,railSignal:35}[item.type]||0};
    }
  }
  return {obstacles,scenery};
}
