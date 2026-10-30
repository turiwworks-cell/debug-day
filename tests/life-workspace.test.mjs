import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DDlifeState,DDlifeDefault,DDlifeBounds,DDlifeCompact,DDlifeAbs,DDnormalizeLife} from '../public/life-board.js';
import {DDboardCore as core} from '../public/board-core.js';
import {DDbuildSearchIndex,DDeditSearchResult} from '../public/search.js';
import {callTool,save,read} from '../src/worker.js';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

const items=[{id:'a',type:'section',parent:'',x:50,y:60,w:500,h:400,text:'Creative life',collapsed:true},{id:'n',type:'sticky',parent:'a',x:40,y:70,w:220,h:160,text:'Shared idea',color:'#FFE08A'}];
const doc=()=>({date:'2026-10-30',blocks:[],bugs:[],notes:[],canvas:{board4:{}},__life:DDlifeState({life:{items}}),__lifeFrame:{x:10,y:20}});
test('compact removes empty space while preserving ids, contents and membership',()=>{
 const before=DDlifeDefault(),next=DDlifeCompact(before),a=DDlifeBounds(before),b=DDlifeBounds(next);
 assert.ok(b.w*b.h<a.w*a.h*.3);
 assert.deepEqual(next.map(i=>[i.id,i.parent,i.text,i.color]),before.map(i=>[i.id,i.parent,i.text,i.color]));
 assert.deepEqual(DDlifeCompact(next),next,'compaction is stable');
 assert.deepEqual(before,DDlifeDefault(),'does not mutate saved items');
});
test('shared frame, collapse, colors and links survive normalization',()=>{
 const raw={items,frame:{x:12,y:20,w:900,h:600},links:[{id:'wire',from:'life:a',to:'life:n'}]};
 const clean=DDnormalizeLife(raw);
 assert.deepEqual(clean.frame,raw.frame);assert.equal(clean.items[0].collapsed,true);assert.deepEqual(clean.links,raw.links);
});
test('native copy includes hidden descendants of a collapsed section and remaps ids',()=>{
 const d=doc(),nodes=[{id:'life:a',lifeId:'a',kind:'life-section',x:60,y:80,w:500,h:38}];
 const payload=core.copy(d,nodes,[],new Set(['life:a']));
 assert.equal(payload.items.length,2);
 let id=0;const pasted=core.paste(d,payload,{x:600,y:100},'mindmap',()=>`new-${++id}`);
 const newItems=pasted.day.__life.items.slice(2);
 assert.equal(newItems[1].parent,newItems[0].id);assert.equal(newItems[1].text,'Shared idea');
 assert.deepEqual([newItems[1].x,newItems[1].y],[40,70]);
 assert.equal(new Set(pasted.day.__life.items.map(i=>i.id)).size,4);
});
test('native appearance, nudge and deletion update shared notes and preserve children',()=>{
 const d=doc(),n={id:'life:n',lifeId:'n',kind:'sticky',x:100,y:150};
 const styled=core.setStyle(d,[n],{fill:'#D3B8FF',width:300,height:240});
 assert.deepEqual([styled.__life.items[1].color,styled.__life.items[1].w,styled.__life.items[1].h],['#D3B8FF',300,240]);
 const moved=core.place(styled,[n],{'life:n':{x:110,y:160}},'mindmap');assert.deepEqual([moved.__life.items[1].x,moved.__life.items[1].y],[50,80]);
 const original=DDlifeAbs(d.__life.items,'n'),removed=core.remove(d,[{id:'life:a',lifeId:'a',kind:'life-section'}]);
 assert.equal(removed.__life.items[0].parent,'');assert.deepEqual(DDlifeAbs(removed.__life.items,'n'),original);
});
test('global search indexes Life once and edits the same shared record',()=>{
 const data={setup:{life:{items}},days:{}},rows=DDbuildSearchIndex(data,'2026-10-30');
 const row=rows.find(r=>r.id==='life:n');assert.equal(row.title,'Shared idea');assert.equal(rows.filter(r=>r.kind==='life').length,2);
 const next=DDeditSearchResult(data,row,'rename','Updated idea',()=>{});
 assert.equal(next.setup.life.items[1].text,'Updated idea');assert.deepEqual(next.days,{});
});
test('Life MCP supports validated revision-protected writes and preserves children on delete',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const env={DB:{prepare(query){let args=[];return {bind(...values){args=values;return this},async first(){return sql.prepare(query).get(...args)||null}}}}};
 try {
  await save(env,{setup:{life:{items},types:[],lanes:[]},days:{}},0);
  const life=await callTool('get_life',{},env,'read');assert.equal(life.life.items.length,2);
  await assert.rejects(callTool('add_life_item',{expected_revision:1,type:'sticky',text:'Read only'},env,'read'));
  await assert.rejects(callTool('add_life_item',{expected_revision:1,type:'other'},env,'write'),/Invalid type/);
  const added=await callTool('add_life_item',{expected_revision:1,type:'sticky',text:'MCP note',parent:'a'},env,'write');
  assert.equal(added.revision,2);
  await assert.rejects(callTool('update_life_item',{expected_revision:1,item_id:added.item.id,text:'stale'},env,'write'),/Conflict/);
  await assert.rejects(callTool('update_life_item',{expected_revision:2,item_id:'a',parent:'a'},env,'write'),/cycle/);
  await assert.rejects(callTool('update_life_item',{expected_revision:2,item_id:'a',x:'not a number'},env,'write'),/Invalid x/);
  await callTool('update_life_item',{expected_revision:2,item_id:added.item.id,text:'Updated by MCP',w:300,color:'#9DD6FF'},env,'write');
  const before=DDlifeAbs((await read(env)).data.setup.life.items,'n');
  await callTool('delete_life_item',{expected_revision:3,item_id:'a'},env,'write');
  const state=(await read(env));assert.equal(state.revision,4);assert.equal(state.data.setup.life.items.find(i=>i.id==='n').parent,'');assert.deepEqual(DDlifeAbs(state.data.setup.life.items,'n'),before);
 }finally{sql.close();}
});
