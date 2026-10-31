"use strict";

const test=require("node:test"), assert=require("node:assert/strict"), fs=require("node:fs"), path=require("node:path"), crypto=require("node:crypto");
const { AudioBank, MusicStream }=require("../src/platform/audio-bank");
const { AudioEngine }=require("../src/platform/audio-engine");
const { AUDIO_ASSETS }=require("../src/content/audio-assets");

test("registered local audio matches provenance and stays inside the runtime budget",()=>{
  const provenance=JSON.parse(fs.readFileSync(path.join(__dirname,"../art/audio/survival-v1/source-provenance.json"),"utf8"));
  assert.deepEqual(provenance.runtime,AUDIO_ASSETS.filter(a=>a.src.includes("/survival-v1/")));
  for(const source of provenance.sourceFiles){const bytes=fs.readFileSync(path.join(__dirname,"../art/audio/survival-v1",source.path));assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(),source.sha256);}
  let total=0;
  for(const a of AUDIO_ASSETS){ const bytes=fs.readFileSync(path.join(__dirname,"../web",a.src)); total+=bytes.length;
    assert.equal(bytes.length,a.bytes); assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(),a.sha256);
    if(a.src.endsWith(".wav")){
      assert.equal(bytes.toString("ascii",0,4),"RIFF"); let peak=0,energy=0,start=0,length=0;
      for(let i=12;i+8<=bytes.length;){const size=bytes.readUInt32LE(i+4);if(bytes.toString("ascii",i,i+4)==="data"){start=i+8;length=size;break;}i+=8+size+(size%2);}
      assert(start>0&&start+length<=bytes.length);
      for(let i=start;i+1<start+length;i+=2){const v=bytes.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(v));energy+=v*v;}
      assert(peak>.05&&peak<.96);assert(energy>1);assert(bytes.readUInt16LE(22)===1,"short mono effects avoid excess memory");
    } else assert.equal(bytes.toString("ascii",0,4),"OggS");
  }
  assert(total<700000);assert.equal(AUDIO_ASSETS.filter(a=>a.role==="shot").length,10);
});

test("short effects decode once while full music is never decoded into the cache",async()=>{
  let loads=0,decodes=0;
  const buffer={length:100,numberOfChannels:1,duration:.2}; const context={decodeAudioData(_bytes,success){decodes++;success(buffer);return Promise.resolve(buffer);}};
  const bank=new AudioBank(async()=>{loads++;return new ArrayBuffer(10);});
  const [a,b]=await Promise.all([bank.prepare(context,"scrap_pistol"),bank.prepare(context,"scrap_pistol")]);
  assert.equal(a,buffer);assert.equal(b,buffer);assert.equal(loads,1);assert.equal(decodes,1);assert.equal(bank.stats.decodedBytes,400);
  assert.equal(await bank.prepare(context,"theme_menu"),null);assert.equal(loads,1);
});

test("failed recordings fail softly and do not retry a request every shot",async()=>{
  let requests=0;const bank=new AudioBank(async()=>{requests++;throw Error("missing");}),c={decodeAudioData(){}};
  assert.equal(await bank.prepare(c,"scrap_pistol"),null);assert.equal(await bank.prepare(c,"scrap_pistol"),null);assert.equal(requests,1);assert.equal(bank.stats.failed,1);
});

test("recorded shots use a buffer source without the old oscillator body",async()=>{
  let voices=0,oscillators=0;const param=()=>({setValueAtTime(){}});
  const c={currentTime:0,destination:{},resume(){},decodeAudioData(_b,success){success({length:4410,numberOfChannels:1,duration:.2});},createOscillator(){oscillators++;},
    createGain(){return{gain:param(),connect(){},disconnect(){}};},createBufferSource(){return{playbackRate:param(),connect(){},disconnect(){},start(){voices++;},stop(){}};}};
  const audio=new AudioEngine(()=>c,{loadBytes:async()=>new ArrayBuffer(1)});audio.unlock();
  await Promise.all([audio.bank.prepare(c,"scrap_pistol"),audio.bank.prepare(c,"mechanical_light")]);
  assert(audio.playShot("scrap_pistol"));assert.equal(oscillators,0);assert.equal(voices,2);assert.equal(audio.soundStats.recorded,1);
  audio.setSettings({sfxMuted:true});assert.equal(audio.playShot("scrap_pistol"),false);assert.equal(voices,2);
});

test("streamed music transitions stay at two channels, mute immediately and pause on hide",()=>{
  const made=[];const music=new MusicStream(src=>{const e={src,paused:true,volume:0,play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;},removeAttribute(){},load(){}};made.push(e);return e;});
  music.update(1,"theme_menu",.5);assert.equal(made.length,0);music.unlock();music.update(1,"theme_menu",.5);assert(made[0].volume>0);
  music.update(.1,"theme_combat",.5);assert.equal(music.slots.length,2);music.update(.1,"theme_pressure",.5);assert.equal(music.slots.length,2);
  music.setVolume(0);assert(music.slots.every(s=>s.element.volume===0));music.suspend();assert(music.slots.every(s=>s.element.paused));
  music.update(1,"theme_combat",.5);assert(music.slots.every(s=>s.element.paused));
  music.unlock();music.update(1,null,.5);assert(music.slots.every(s=>s.element.paused));
});
