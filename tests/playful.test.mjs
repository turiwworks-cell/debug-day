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
  const note={id:"coffee",kind:"emoji",text:"sticker:coffee",label:"Coffee pause · مکث قهوه",x:80,y:80};
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
