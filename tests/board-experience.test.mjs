import { test } from "node:test";
import assert from "node:assert/strict";
import { DDboardSearchRows, DDboardSearch, DDrootSelection, DDmarqueeSelection, DDselectionToolbar } from "../public/board-experience.js";
import { DDtimerRemaining } from "../public/timer.js";

test("board search reads collapsed descendants and normalizes Persian, Arabic and digits", () => {
  const day={blocks:[{id:"b",name:"Writing",expanded:false,tags:["idea"],subtasks:[{id:"s",text:"Nested",expanded:false,children:[{id:"deep",text:"Deep idea"}]}]}],notes:[{id:"n",text:"کار 123"},{id:"emoji",kind:"emoji",text:"sticker:spark",label:"Little spark · جرقهٔ کوچولو"}]};
  const life=[{id:"parent",type:"section",text:"Creative",collapsed:true},{id:"child",type:"sticky",parent:"parent",text:"Hidden idea"}];
  const rows=DDboardSearchRows(day,life,[]);
  assert.equal(DDboardSearch(rows,"كار ۱۲۳")[0].id,"sticky:n");
  assert.deepEqual(DDboardSearch(rows,"deep")[0].parents,["s"]);
  assert.equal(DDboardSearch(rows,"hidden idea")[0].id,"life:child");
  assert.equal(DDboardSearch(rows,"little spark").length,0);
  assert.equal(DDboardSearch(rows,"جرقهٔ کوچولو").length,0);
  assert.equal(DDboardSearch(rows,"no such object").length,0);
});
test("selection moves an ancestor once even when a grandchild is selected",()=>{
  const nodes=[{id:"a"},{id:"b",parentId:"a"},{id:"c",parentId:"b"},{id:"d"}];
  assert.deepEqual(DDrootSelection(nodes,new Set(["a","c","d"])).map(n=>n.id),["a","d"]);
});
test("marquee selects touched notes, fully enclosed containers and skips locked notes",()=>{
  const nodes=[{id:"a",lifeSection:true,x:0,y:0,w:100,h:100},{id:"n",parentId:"a",x:20,y:20,w:30,h:30},{id:"locked",x:20,y:20,w:30,h:30}];
  assert.deepEqual(DDmarqueeSelection(nodes,{x:10,y:10,w:50,h:50},new Set(["locked"])),["n"]);
  assert.deepEqual(DDmarqueeSelection(nodes,{x:-10,y:-10,w:120,h:120},new Set(["locked"])),["a"]);
});
test("selection toolbar follows camera and flips below a selection near the header",()=>{
  const b={x:100,y:100,w:200,h:100},v={w:900,h:700},size={w:320,h:44};
  assert.deepEqual(DDselectionToolbar(b,{x:0,y:0,z:1},v,size),{x:40,y:214});
  assert.deepEqual(DDselectionToolbar(b,{x:80,y:100,z:1},v,size),{x:120,y:132});
  const edge=DDselectionToolbar({x:1000,y:800,w:100,h:100},{x:0,y:0,z:1},v,size);
  assert.equal(edge.x,572);assert.equal(edge.y,574);
});
test("timer uses a wall-clock deadline after a background-tab delay and stops at zero",()=>{
  assert.equal(DDtimerRemaining(20000,1000),19);
  assert.equal(DDtimerRemaining(20000,11150),9);
  assert.equal(DDtimerRemaining(20000,19999),1);
  assert.equal(DDtimerRemaining(20000,70000),0);
});
