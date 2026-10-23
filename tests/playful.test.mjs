import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DDplayfulData as symbols } from "../public/playful.js";
import { DDcreatePlayfulArt } from "../public/playful-art.js";

const day = () => ({
  date: "2026-10-23", blocks: [{id:"task",name:"Paint",emo:"",done:false,subtasks:[{id:"step",done:false,children:[{id:"child",done:false,children:[]}]}]}],
  bugs: [], notes: [{id:"existing",kind:"sticky",text:"Keep me",x:5,y:5}],
  canvas: {board4:{locked:[],links:[],styles:{},layouts:{mindmap:{},lanes:{}},groups:{},overrides:{},hidden:[],stack:[]}}
});
test("original stickers have unique persistable tokens and bilingual names", () => {
  assert.equal(symbols.stickers.length,8);assert.equal(symbols.emojis.length,48);
  const values = [...symbols.stickers,...symbols.emojis].map(item=>item.value);
  assert.equal(new Set(values).size,values.length);
  for(const item of [...symbols.stickers,...symbols.emojis]){
    assert.ok(item.value.length<=16);assert.ok(item.fa&&item.en);
    assert.equal(symbols.label(item.value,"fa"),item.fa);
  }
});
test("day stickers are native emoji notes and immutable shared board objects", () => {
  const old=day(),saved=structuredClone(old);
  const next=symbols.put(old,"sticker:spark",{id:"spark",x:150000,y:-35});
  assert.deepEqual(old,saved);assert.equal(next.blocks,old.blocks);
  const note=next.notes[1];assert.equal(note.kind,"emoji");assert.equal(note.text,"sticker:spark");
  assert.match(note.label,/Little spark.*جرقه/);assert.equal(note.x,100000);assert.equal(note.y,-35);
  assert.deepEqual(next.canvas.board4.styles["sticky:spark"],{width:128,height:128});
  assert.equal(symbols.put(next,"sticker:heart",{id:"spark"}),next);
  assert.equal(symbols.put(next,"unknown",{id:"bad"}),next);
});
test("task symbols edit the actual task without adding a second object", () => {
  const old=day(),next=symbols.put(old,"sticker:studio",{taskId:"task"});
  assert.equal(next.blocks[0].emo,"sticker:studio");assert.equal(next.notes,old.notes);
  assert.equal(next.blocks[0].done,false);assert.equal(next.blocks[0].subtasks,old.blocks[0].subtasks);
  assert.equal(symbols.put(next,"sticker:studio",{taskId:"task"}),next);
  assert.equal(symbols.put(next,"💜",{taskId:"deleted"}),next);
});
test("changing a sticker keeps its ID, position, appearance and connections", () => {
  const old=symbols.put(day(),"sticker:spark",{id:"spark",x:123,y:456});
  old.canvas.board4.links.push({id:"link",from:"sticky:spark",to:"b:task"});
  old.canvas.board4.styles["sticky:spark"]={width:190,height:170,opacity:.4};
  const next=symbols.put(old,"☕",{replace:"spark"});
  assert.equal(next.notes[1].id,"spark");assert.equal(next.notes[1].x,123);assert.equal(next.notes[1].y,456);
  assert.equal(next.notes[1].text,"☕");assert.deepEqual(next.canvas.board4.styles["sticky:spark"],old.canvas.board4.styles["sticky:spark"]);
  assert.equal(next.canvas.board4.links,old.canvas.board4.links);
  assert.equal(symbols.put(next,"💜",{replace:"gone"}),next);
  assert.equal(symbols.put(next,"💜",{replace:"existing"}),next);
});
test("locked task and note symbols cannot be replaced or removed", () => {
  const old=symbols.put(day(),"sticker:spark",{id:"spark"});
  old.canvas.board4.locked=["b:task","sticky:spark"];
  assert.equal(symbols.put(old,"💜",{taskId:"task"}),old);
  assert.equal(symbols.put(old,"💜",{replace:"spark"}),old);
  assert.equal(symbols.remove(old,"spark"),old);
});
test("removing a day sticker cleans its board references in every layout", () => {
  const old=symbols.put(day(),"sticker:spark",{id:"spark"}),ref="sticky:spark",board=old.canvas.board4;
  board.links=[{id:"remove",from:ref,to:"b:task"},{id:"keep",from:"sticky:existing",to:"b:task"}];
  board.layouts={mindmap:{[ref]:{x:2,y:3}},lanes:{[ref]:{x:3,y:4},"b:task":{x:6,y:7}}};
  board.groups={remove:[ref,"b:task"],keep:["sticky:existing","b:task"]};
  board.stack=[ref,"b:task"];board.hidden=["auto:"+ref+"->b:task","auto:sticky:existing->b:task"];
  board.overrides={["auto:"+ref+"->b:task"]:{color:"#fff"},keep:{color:"#000"}};
  const snapshot=structuredClone(old),next=symbols.remove(old,"spark"),clean=next.canvas.board4;
  assert.deepEqual(old,snapshot);assert.equal(next.notes.length,1);assert.equal(next.notes[0].id,"existing");
  assert.equal(clean.links.length,1);assert.equal(clean.links[0].id,"keep");
  for(const layout of Object.values(clean.layouts))assert.equal(layout[ref],undefined);
  assert.equal(clean.styles[ref],undefined);assert.deepEqual(clean.stack,["b:task"]);
  assert.deepEqual(Object.keys(clean.groups),["keep"]);assert.deepEqual(Object.keys(clean.overrides),["keep"]);
  assert.deepEqual(clean.hidden,["auto:sticky:existing->b:task"]);
  assert.equal(symbols.remove(next,"spark"),next);assert.equal(symbols.remove(next,"existing"),next);
});
test("completion reactions require an actual task or existing nested step transition", () => {
  const old=day(),next=structuredClone(old);next.blocks[0].subtasks[0].children[0].done=true;
  assert.equal(symbols.completed(old,next,"task"),true);
  assert.equal(symbols.completed(next,old,"task"),false);
  assert.equal(symbols.completed(old,structuredClone(old),"task"),false);
  const imported=structuredClone(old);imported.blocks[0].subtasks.push({id:"import",done:true,children:[]});
  assert.equal(symbols.completed(old,imported,"task"),false);
  next.blocks[0].done=true;assert.equal(symbols.completed(old,next,"task"),true);
  assert.equal(symbols.completed({blocks:[]},next,"task"),false);
});
test("the real app normalizer retains sticker labels and tokens on reload and backup", async () => {
  const html=await readFile(new URL("../public/index.html",import.meta.url),"utf8");
  const normalizer=html.match(/function Ve\(at\)\{[\s\S]*?\}\}var He=/)?.[0].replace(/var He=$/,"");
  assert.ok(normalizer);
  const normalize=new Function("L","C","Ie","Le","we",normalizer+";return Ve;")(
    v=>typeof v==="string"?v:"",()=>"new-id",Number.isFinite,/^#[a-f0-9]{6}$/i,["#FFE27A"]
  );
  const note=symbols.put(day(),"sticker:coffee",{id:"coffee"}).notes[1];
  assert.equal(normalize(JSON.parse(JSON.stringify(note))).text,"sticker:coffee");
  assert.equal(normalize(note).label,note.label);
});
test("all sticker characters render vector artwork with independent gradient IDs", () => {
  let uid=0;const render=DDcreatePlayfulArt({useId:()=>":r"+(++uid)+":",createElement:(tag,props,...children)=>({tag,props,children})});
  const ids=new Set();
  for(const item of symbols.stickers){
    const svg=render({item});assert.equal(svg.tag,"svg");assert.equal(svg.props.viewBox,"0 0 100 100");
    const serialized=JSON.stringify(svg);assert.match(serialized,/"path"/);assert.doesNotMatch(serialized,/"image"|"foreignObject"|https:\/\//);
    const id=svg.children[0].children[0].props.id;assert.ok(!ids.has(id));ids.add(id);
  }
});
test("offline bundling can inline both sticker modules without nested imports", async () => {
  for(const path of ["playful.js","playful-art.js"]){
    const module=await readFile(new URL("../public/"+path,import.meta.url),"utf8");
    assert.doesNotMatch(module,/^\s*import\s/m);
  }
});

test("day additions find free space while an explicit board position stays exact", () => {
  const old=day();old.notes[0].x=80;old.notes[0].y=80;
  const first=symbols.put(old,"sticker:cloud",{id:"one"}),second=symbols.put(first,"sticker:heart",{id:"two"});
  const a=second.notes.find(n=>n.id==="one"),b=second.notes.find(n=>n.id==="two");
  assert.ok(a.x>=316||a.y>=256,"a new sticker leaves space around the existing note");
  assert.ok(a.x+128<=b.x||b.x+128<=a.x||a.y+128<=b.y||b.y+128<=a.y,"day stickers do not pile on each other");
  const explicit=symbols.put(second,"✨",{id:"here",x:80,y:80}).notes.at(-1);
  assert.equal(explicit.x,80);assert.equal(explicit.y,80);
});
