// Board tools (5.36): note tags, parent notes, the pen and comments.
// Every new field must survive each normalizer and a sync round trip.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.js';
import {DDsameSnapshot} from '../public/sync.js';
import {DDtagList,DDnoteTags,DDsetNoteTags,DDtagText,DDallTags} from '../public/note-tags.js';
import {DDtags} from '../public/planner.js';
import {DDmediaList} from '../public/media.js';
import {DDgoalClean} from '../public/budgets.js';
import {DDdueClean} from '../public/deadlines.js';
import {DDnormalizeLife} from '../public/life-board.js';
import {DDreconcileDay} from '../public/relations.js';
import {DDstrokeEncode,DDstrokeDecode,DDnormalizeStrokes,DDsimplifyStroke,DDstrokePath,DDmarksRebase,DDeraseStrokeCircle,DDstrokeInBox,DDtransformPoints} from '../public/pen.js';
import {DDnormalizeComments,DDcommentsTransfer,DDcommentTime,DDcommentReact} from '../public/comments.js';
import {DDarrowFamily,DDnoteFamily,DDnoteBranch} from '../public/note-family.js';
import {DDboardSearchRows} from '../public/board-experience.js';
import {DDbuildSearchIndex,DDmatchSearch,DDparseSearch} from '../public/search.js';
import {DDsyncCopies} from '../public/linked.js';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const plain=(v)=>JSON.parse(JSON.stringify(v));
const at='2026-11-03T10:00:00.000Z';

test('note tags use the task tag system: one spelling, read and written in one place',()=>{
  assert.deepEqual(DDtagList(['#Idea','idea','sketch book','  ']),['Idea','sketch_book']);
  assert.deepEqual(DDtags('#a, b'),DDtagList('#a, b'),'tasks and notes clean tags the same way');
  const note={id:'n',text:'x'};
  assert.equal(DDsetNoteTags(note,['#one','two']),note,'changes the note in place');
  assert.deepEqual(DDnoteTags(note),['one','two']);
  DDsetNoteTags(note,[]);
  assert.equal('tags' in note,false,'no tags means no field');
  assert.deepEqual(DDnoteTags({tags:5}),[]);
  assert.equal(DDtagText(['a','b']),'#a #b');
  const days={d:{blocks:[{tags:['work']}],notes:[{tags:['Work','idea']}]}};
  assert.deepEqual(DDallTags(days,{life:{items:[{tags:['idea']}]},later:[{tags:['idea']}]}),['idea','work']);
});

test('day notes keep their tags through the day-note normalizer (stickies only)',()=>{
  const fn=html.match(/function Ve\(at\).*?(?=var He=)/s)[0],c={L:v=>typeof v==='string'?v:'',C:()=>'id',Ie:Number.isFinite,Le:/^#[a-f0-9]{6}$/i,we:['#FFE299'],DDtags,DDmediaList,DDgoalClean, DDdueClean};
  runInNewContext(fn+';this.note=Ve;',c);
  const once=c.note({id:'n',kind:'sticky',text:'Idea',tags:['#Idea','idea','sketch']});
  assert.deepEqual(plain(once.tags),['Idea','sketch']);
  assert.deepEqual(plain(c.note(plain(once))),plain(once),'normalizing twice changes nothing');
  assert.equal(c.note({id:'e',kind:'emoji',emoji:'🌱',tags:['x']}).tags,undefined,'stickers have no tags');
  assert.equal(c.note({id:'m',kind:'sticky',text:'',tags:[]}).tags,undefined);
});

const feed=()=>({v:2,items:[
  {id:'s',type:'section',parent:'',x:0,y:0,w:600,h:400,text:'Studio',tags:['no']},
  {id:'n',type:'sticky',parent:'s',x:20,y:20,w:200,h:200,text:'Idea',tags:['#sketch']},
],links:[],frame:{x:0,y:0,w:1000,h:800},
comments:[
  {id:'c1',on:'life:n',fx:0.5,fy:0.1,thread:[{id:'m1',text:'Love it',at}]},
  {id:'c2',parent:'s',x:300,y:200,done:true,thread:[{id:'m2',text:'Later',at,edited:at}]},
  {id:'gone',on:'life:missing',fx:0,fy:0,thread:[{id:'m3',text:'x',at}]},
],
strokes:[{id:'ink-1',parent:'s',pts:'10,10 5,5 5,-2',color:'#0D99FF',width:8},{id:'ink-2',parent:'nowhere',pts:'0,0 1,1',color:'red',width:5}]});

test('Feed notes, comments and drawings survive DDnormalizeLife and normalize the same twice',()=>{
  const once=DDnormalizeLife(feed());
  assert.deepEqual(once.items.find((i)=>i.id==='n').tags,['sketch']);
  assert.equal(once.items.find((i)=>i.id==='s').tags,undefined,'sections have no tags');
  assert.deepEqual(once.comments.map((c)=>c.id),['c1','c2'],'a comment on a missing note is gone');
  assert.deepEqual(once.comments[1],{id:'c2',parent:'s',x:300,y:200,done:true,thread:[{id:'m2',text:'Later',at,edited:at}]});
  assert.deepEqual(once.strokes[0],{id:'ink-1',parent:'s',pts:'10,10 5,5 5,-2',color:'#0D99FF',width:8});
  assert.deepEqual(once.strokes[1],{id:'ink-2',parent:'',pts:'0,0 1,1',color:'#1E1E1E',width:4},'a lost section and odd values are repaired');
  assert.deepEqual(DDnormalizeLife(plain(once)),once);
  const empty=DDnormalizeLife({v:2,items:[],links:[]});
  assert.equal('comments' in empty,false);assert.equal('strokes' in empty,false);
});

test('the board keeps the day comments and drawings through clean() and reconcile',()=>{
  const board=readFileSync(new URL('../public/board.js',import.meta.url),'utf8');
  const start=board.indexOf('      finite = (Y, G = 0) =>'),end=board.indexOf('\n      ),\n',board.indexOf('      clean = (Y) => ('))+8;
  const c={core:{styles:(s)=>s||{},zoom:(z)=>z},DDnormalizeComments,DDnormalizeStrokes};
  runInNewContext('const '+board.slice(start,end)+';this.clean=clean;',c);
  const raw={links:[],comments:[{id:'c',on:'sticky:p',fx:1.4,fy:-1,thread:[{id:'m',text:' hi ',at}]},{id:'free',x:10,y:20,thread:[{id:'m',text:'Day',at:'bad'}]}],strokes:[{id:'ink',pts:'1,2 3,4'}]};
  const once=plain(c.clean(raw));
  assert.deepEqual(once.comments,[{id:'c',on:'sticky:p',fx:1,fy:0,thread:[{id:'m',text:' hi ',at}]},{id:'free',x:10,y:20,thread:[{id:'m',text:'Day',at:''}]}],'a bad time is left empty, the same on every device');
  assert.deepEqual(once.strokes,[{id:'ink',pts:'1,2 3,4',color:'#1E1E1E',width:4}]);
  assert.deepEqual(plain(c.clean(once)),once);
  assert.equal('comments' in c.clean({}),false);
  // A deleted card takes its comments along; free comments stay.
  const day={date:'2026-11-03',blocks:[],notes:[{id:'q',kind:'sticky'}],bugs:[],canvas:{board4:once}};
  assert.deepEqual(DDreconcileDay(day,null,{}).canvas.board4.comments.map((x)=>x.id),['free']);
});

test('comments: cards, free spots and the Feed each keep their own shape',()=>{
  const out=DDnormalizeComments([
    {id:'a',on:'b:task',fx:0.2,fy:0.3,thread:[{id:'1',text:'ok',at}]},
    {id:'b',on:'weird:x',x:5,y:6,thread:[{id:'1',text:'free',at}]},
    {id:'c',thread:[{id:'1',text:'   ',at}]},
    {id:'a',thread:[{id:'1',text:'dup',at}]},
    {id:'d',on:'sticky:n',parent:'s',x:1,y:2,thread:[{id:'1',text:'in feed',at}]},
  ],{life:true});
  assert.deepEqual(out.map((c)=>c.id),['a','b','d']);
  assert.deepEqual(out[0],{id:'a',parent:'',x:0,y:0,thread:[{id:'1',text:'ok',at}]},'in the Feed a card is a Feed card');
  assert.deepEqual(out[2],{id:'d',parent:'s',x:1,y:2,thread:[{id:'1',text:'in feed',at}]});
  assert.equal(DDcommentTime(at,Date.parse(at)+30e3),'just now');
  // A card moved into a section takes its comments to the Feed.
  const d={notes:[],canvas:{board4:{comments:[{id:'x',on:'sticky:n',fx:0,fy:0,thread:[]},{id:'y',x:1,y:1,thread:[]}]}},__life:{items:[]}};
  DDcommentsTransfer(d,'sticky:n','life:n');
  assert.deepEqual(d.canvas.board4.comments.map((c)=>c.id),['y']);
  assert.deepEqual(d.__life.comments.map((c)=>[c.id,c.on]),[['x','life:n']]);
});

test('strokes: compact points, exact both ways, simplified and smooth',()=>{
  const pts=[100.04,20,100.5,20.25,-3,7];
  assert.equal(DDstrokeEncode(pts),'100,20 0.5,0.3 -103.5,-13.3');
  assert.deepEqual(DDstrokeDecode(DDstrokeEncode(pts)),[100,20,100.5,20.3,-3,7]);
  assert.deepEqual(DDstrokeDecode('1,2 x,3'),[],'broken points are dropped');
  const line=[];for(let i=0;i<=50;i++)line.push(i*2,0);
  assert.deepEqual(DDsimplifyStroke(line,0.5),[0,0,100,0],'a straight line keeps its two ends');
  assert.match(DDstrokePath([0,0,10,10,20,0]),/^M0 0\s?Q/);
  assert.deepEqual(DDnormalizeStrokes([{id:'a',pts:''},{id:'b',pts:'0,0 1,1',width:7},{id:'dot',pts:'5,5'}]).map((s)=>[s.id,s.width]),[['b',8],['dot',4]],'no points is not a stroke, a dot is; widths snap to the three sizes');
  assert.equal(DDcommentTime(''),'');
});

test('removing a section keeps its drawings and free comments where they were',()=>{
  const before={items:[{id:'outer',type:'section',parent:'',x:100,y:50},{id:'s',type:'section',parent:'outer',x:10,y:20},{id:'n',type:'sticky',parent:'s',x:0,y:0}]};
  const marks={strokes:[{id:'ink',parent:'s',pts:'1,1 2,2'}],comments:[{id:'c',parent:'s',x:5,y:5,thread:[]},{id:'on',on:'life:n',fx:0,fy:0,thread:[]}]};
  // Ungroup: the contents stay, so the marks move up to the outer section.
  const kept=DDmarksRebase(before,{items:[before.items[0],{...before.items[2],parent:'outer',x:10,y:20}],...marks});
  assert.deepEqual(kept.strokes,[{id:'ink',parent:'outer',pts:'11,21 2,2'}]);
  assert.deepEqual(kept.comments[0],{id:'c',parent:'outer',x:15,y:25,thread:[]});
  // Delete with contents: the drawings go too.
  const gone=DDmarksRebase(before,{items:[before.items[0]],...marks});
  assert.deepEqual(gone.strokes,[]);assert.deepEqual(gone.comments.map((c)=>c.id),['on']);
});

test('parent notes and sub-notes come from arrows only',()=>{
  assert.deepEqual(DDarrowFamily({from:'a',to:'b',arrow:true}),{parent:'a',child:'b'});
  assert.deepEqual(DDarrowFamily({from:'a',to:'b',arrow:true,arrowReverse:true}),{parent:'b',child:'a'});
  assert.equal(DDarrowFamily({from:'a',to:'b',arrow:true,arrowStart:true}),null,'two-way says nothing');
  assert.equal(DDarrowFamily({from:'a',to:'b'}),null,'a plain line says nothing');
  assert.equal(DDarrowFamily({from:'a',to:'b',arrow:true,automatic:true}),null);
  const fam=DDnoteFamily([{from:'p',to:'c1',arrow:true},{from:'p',to:'c2',arrow:true},{from:'c1',to:'g',arrow:true},{from:'p',to:'task',arrow:true}],(r)=>r!=='task');
  assert.deepEqual(fam.get('p'),{parents:[],children:['c1','c2']});
  assert.deepEqual(fam.get('c1'),{parents:['p'],children:['g']});
  assert.equal(fam.has('task'),false,'only notes are family');
  assert.deepEqual([...DDnoteBranch(fam,'p')],['p','c1','c2','g']);
});

test('#tag finds notes and tasks in Board search and app search',()=>{
  const day={date:'2026-11-03',blocks:[{id:'t',name:'Portfolio',tags:['idea']}],notes:[{id:'n',kind:'sticky',text:'Parent',tags:['Idea']}],bugs:[]};
  const life=[{id:'f',type:'sticky',text:'Line study',tags:['sketch']}];
  const rows=DDboardSearchRows(day,life,[]);
  const has=(id,tag)=>rows.some((r)=>r.id===id&&r.detail.toLowerCase().includes('#'+tag));
  assert.ok(has('b:t','idea')&&has('sticky:n','idea')&&has('life:f','sketch'),JSON.stringify(rows));
  const today='2026-11-03',data={setup:{life:{v:2,items:life,links:[]}},days:{[today]:day}};
  const found=(q)=>DDbuildSearchIndex(data,today).filter((r)=>DDmatchSearch(r,DDparseSearch(q,today))).map((r)=>r.id);
  assert.ok(found('#idea').some((id)=>/n$/.test(id)),'a day note with #idea: '+found('#idea'));
  assert.ok(found('#sketch').includes('life:f'),'a Feed note with #sketch: '+found('#sketch'));
});

test('sync round trip: two devices add comments, drawings and tags; the Worker keeps them all',async()=>{
  const merge=html.slice(html.indexOf('function DDmerge('),html.indexOf('function DDreadBoardView('));
  const {DDmerge}=runInNewContext(merge+';({DDmerge})',{DDsameSnapshot});
  const date='2026-11-03',msg=(t)=>[{id:'m-'+t,text:t,at}];
  const base={setup:{types:[{id:'work'}],lanes:[{id:'work'}],life:{v:2,items:[{id:'s',type:'section',parent:'',x:0,y:0,w:600,h:400,text:'Studio'},{id:'n',type:'sticky',parent:'s',x:20,y:20,w:200,h:200,text:'Idea'}],links:[],strokes:[{id:'ink-old',parent:'s',pts:'0,0 4,4',color:'#1E1E1E',width:4}]}},
    days:{[date]:{date,focus:'',blocks:[],notes:[{id:'p',kind:'sticky',text:'Parent',color:'#FFE299',x:0,y:0}],bugs:[],canvas:{board4:{links:[],comments:[{id:'c-base',on:'sticky:p',fx:0.5,fy:0.5,thread:msg('first')}]}}}}};
  const local=structuredClone(base),remote=structuredClone(base);
  // This device: a reply, a new drawing, a tag on the Feed note.
  local.days[date].canvas.board4.comments[0].thread.push(...msg('reply'));
  local.days[date].canvas.board4.strokes=[{id:'ink-a',pts:'1,1 2,2',color:'#0D99FF',width:8}];
  DDsetNoteTags(local.setup.life.items[1],['sketch']);
  // The other device: erases the old Feed drawing, comments in the section, tags the day note.
  remote.setup.life.strokes=[];
  remote.setup.life.comments=[{id:'c-feed',parent:'s',x:100,y:100,thread:msg('feed')}];
  DDsetNoteTags(remote.days[date].notes[0],['idea']);
  const result=plain(DDmerge(base,local,remote,'local')),merged=result.data;
  assert.deepEqual(result.conflicts,[]);
  const day=merged.days[date];
  assert.deepEqual(day.canvas.board4.comments[0].thread.map((m)=>m.text),['first','reply']);
  assert.deepEqual(day.canvas.board4.strokes.map((s)=>s.id),['ink-a']);
  assert.deepEqual(day.notes[0].tags,['idea']);
  assert.deepEqual(merged.setup.life.strokes,[],'the erase on the other device holds');
  assert.deepEqual(merged.setup.life.comments.map((c)=>c.id),['c-feed']);
  assert.deepEqual(merged.setup.life.items[1].tags,['sketch']);

  const sql=new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  try{
    const env={SYNC_TOKEN:'s'.repeat(64),MCP_WRITE_TOKEN:'w'.repeat(64),DB:{prepare(query){let args=[];return {bind(...values){args=values;return this},async first(){return sql.prepare(query).get(...args)||null},async run(){sql.prepare(query).run(...args);return {success:true}}}}}};
    const auth={Authorization:'Bearer '+env.SYNC_TOKEN,'Content-Type':'application/json'};
    const put=(data,rev)=>worker.fetch(new Request('http://localhost/api/sync',{method:'PUT',headers:{...auth,'If-Match':String(rev)},body:JSON.stringify({data})}),env);
    assert.equal((await put(merged,0)).status,200);
    const got=await (await worker.fetch(new Request('http://localhost/api/sync',{headers:auth}),env)).json();
    assert.deepEqual(got.data.days[date].canvas.board4.comments,day.canvas.board4.comments);
    assert.deepEqual(got.data.days[date].canvas.board4.strokes,day.canvas.board4.strokes);
    assert.deepEqual(got.data.setup.life.comments,merged.setup.life.comments);
    assert.deepEqual(got.data.days[date].notes[0].tags,['idea']);
    // Broken lists are refused.
    const dup=structuredClone(merged);dup.days[date].canvas.board4.strokes.push({...dup.days[date].canvas.board4.strokes[0]});
    assert.equal((await put(dup,got.revision)).status,400);
    const bad=structuredClone(merged);bad.setup.life.comments={id:'x'};
    assert.equal((await put(bad,got.revision)).status,400);
    // An MCP edit keeps them, and deleting the section keeps its drawing in place.
    const rpc=async(name,args)=>(await (await worker.fetch(new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer '+env.MCP_WRITE_TOKEN,Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}),env)).json()).result;
    const lifeNow=(await rpc('get_life',{})).structuredContent;
    assert.deepEqual(lifeNow.life.comments.map((c)=>c.id),['c-feed']);
    const edit=await rpc('update_life_item',{expected_revision:lifeNow.revision,item_id:'n',text:'Idea, again'});
    assert.equal(edit.isError,false,JSON.stringify(edit));
    const after=(await rpc('get_life',{})).structuredContent;
    assert.deepEqual(after.life.items.find((i)=>i.id==='n').tags,['sketch'],'MCP edits keep note tags');
    const removed=await rpc('delete_life_item',{expected_revision:after.revision,item_id:'s'});
    assert.equal(removed.isError,false,JSON.stringify(removed));
    const last=(await rpc('get_life',{})).structuredContent.life;
    assert.deepEqual(last.comments,[{id:'c-feed',parent:'',x:100,y:100,thread:msg('feed')}],'the section comment stays where it was');
  }finally{sql.close();}
});

test('a synced note keeps one set of tags in every copy (5.35 linked copies)',()=>{
  const n=(id,extra={})=>({id,kind:'sticky',x:0,y:0,text:'Fox',color:'#FFE299',syncId:'s-1',...extra});
  const before={setup:{life:{v:2,items:[{id:'f',type:'sticky',parent:'',x:0,y:0,w:240,h:240,text:'Fox',color:'#FFE299',syncId:'s-1'}],links:[],frame:{}}},
    days:{'2026-11-03':{blocks:[],notes:[n('a')],canvas:{board4:{styles:{}}}},'2026-11-05':{blocks:[],notes:[n('b',{tags:['old']})],canvas:{board4:{styles:{}}}}}};
  before.days['2026-11-03'].notes[0].tags=['old'];before.setup.life.items[0].tags=['old'];
  const next=structuredClone(before);
  DDsetNoteTags(next.days['2026-11-03'].notes[0],['#Fox','sketch book']);
  const out=DDsyncCopies(next,before);
  assert.deepEqual(DDnoteTags(out.days['2026-11-05'].notes[0]),['Fox','sketch_book']);
  assert.deepEqual(DDnoteTags(out.setup.life.items[0]),['Fox','sketch_book']);
  DDsetNoteTags(out.setup.life.items[0],[]);
  const cleared=DDsyncCopies(out,next);
  assert.equal('tags' in cleared.days['2026-11-05'].notes[0],false,'no tags left anywhere');
});

test("tag colours: one per tag, saved in the Feed, readable words", async () => {
  const { DDtagColors, DDtagColor, DDtagInk, DDtagPalette } = await import("../public/note-tags.js");
  const { DDnormalizeLife } = await import("../public/life-board.js");
  assert.deepEqual(DDtagColors({ "#Idea": "#5c7cfa", bad: "red", x: 3 }), { idea: "#5C7CFA" });
  assert.equal(DDtagColor({ idea: "#5C7CFA" }, "IDEA"), "#5C7CFA", "any spelling of a tag shares its colour");
  assert.ok(DDtagPalette.includes(DDtagColor({}, "sketch")), "an uncoloured tag gets one from its name");
  assert.equal(DDtagColor({}, "sketch"), DDtagColor({}, "Sketch"));
  assert.equal(DDtagInk("#FFD43B"), "#121211");
  assert.equal(DDtagInk("#495057"), "#FFFFFF");
  const life = DDnormalizeLife({ items: [], tagColors: { idea: "#5C7CFA", nope: "blue" } });
  assert.deepEqual({ ...life.tagColors }, { idea: "#5C7CFA" });
  assert.equal(DDnormalizeLife({ items: [] }).tagColors, undefined, "no colours, no field");
});

test('tag colours survive a sync merge and the Worker', async () => {
  const merge=html.slice(html.indexOf('function DDmerge('),html.indexOf('function DDreadBoardView('));
  const {DDmerge}=runInNewContext(merge+';({DDmerge})',{DDsameSnapshot});
  const date='2026-11-03';
  const base={setup:{types:[{id:'work'}],lanes:[{id:'work'}],life:{v:2,items:[{id:'n',type:'sticky',parent:'',x:0,y:0,w:200,h:200,text:'Idea'}],links:[]}},days:{[date]:{date,focus:'',blocks:[],notes:[],bugs:[]}}};
  const local=structuredClone(base),remote=structuredClone(base);
  local.setup.life.tagColors={idea:'#5C7CFA'};
  remote.setup.life.items[0].text='Idea, edited';
  const merged=plain(DDmerge(base,local,remote,'local').data);
  assert.deepEqual(merged.setup.life.tagColors,{idea:'#5C7CFA'});
  assert.equal(merged.setup.life.items[0].text,'Idea, edited');
  const sql=new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  const env={SYNC_TOKEN:'s'.repeat(64),MCP_WRITE_TOKEN:'w'.repeat(64),DB:{prepare(query){let args=[];return {bind(...values){args=values;return this},async first(){return sql.prepare(query).get(...args)||null},async run(){sql.prepare(query).run(...args);return {success:true}}}}}};
  const auth={Authorization:'Bearer '+env.SYNC_TOKEN,'Content-Type':'application/json'};
  assert.equal((await worker.fetch(new Request('http://localhost/api/sync',{method:'PUT',headers:{...auth,'If-Match':'0'},body:JSON.stringify({data:merged})}),env)).status,200);
  const got=await (await worker.fetch(new Request('http://localhost/api/sync',{headers:auth}),env)).json();
  assert.deepEqual(got.data.setup.life.tagColors,{idea:'#5C7CFA'});
});

test('pen 5.49 upgrades: point eraser splits strokes, marquee box hits strokes, bounding box scales and opacity normalizes', () => {
  // 1. Point eraser splits a straight line from (0,0)->(100,0) when erasing at (50,0) with radius 10
  const pieces = DDeraseStrokeCircle([0, 0, 100, 0], 50, 0, 10);
  assert.equal(pieces.length, 2, 'erasing the middle splits the stroke into two pieces');
  assert.deepEqual(pieces[0].map((v) => Math.round(v)), [0, 0, 40, 0]);
  assert.deepEqual(pieces[1].map((v) => Math.round(v)), [60, 0, 100, 0]);
  // Erasing completely over a short stroke removes it
  assert.deepEqual(DDeraseStrokeCircle([45, 0, 55, 0], 50, 0, 12), []);
  // 2. Marquee selection box hits strokes inside or crossing the box
  assert.equal(DDstrokeInBox([0, 0, 100, 100], { x: 40, y: 40, w: 20, h: 20 }), true);
  assert.equal(DDstrokeInBox([0, 0, 20, 20], { x: 40, y: 40, w: 20, h: 20 }), false);
  // 3. Bounding box scaling and translation
  assert.deepEqual(DDtransformPoints([10, 20, 30, 40], { dx: 5, dy: -5 }), [15, 15, 35, 35]);
  assert.deepEqual(DDtransformPoints([10, 20, 30, 40], { scale: { ox: 10, oy: 20, sx: 2, sy: 0.5 } }), [10, 20, 50, 30]);
  // 4. Opacity is preserved when < 1 and omitted when 1
  const norm = DDnormalizeStrokes([{ id: 's1', pts: '0,0 10,10', color: '#123456', width: 4, opacity: 0.65 }, { id: 's2', pts: '0,0 5,5', opacity: 1 }]);
  assert.equal(norm[0].color, '#123456');
  assert.equal(norm[0].opacity, 0.65);
  assert.equal('opacity' in norm[1], false);
});

test('Shift locks its initial ray while the pointer drifts perpendicular to it', async () => {
  const { DDlockedStrokeEnd } = await import('../public/pen.js');
  const g = { start: { x: 10, y: 20 } };
  assert.deepEqual(DDlockedStrokeEnd(g, { x: 30, y: 20 }), { x: 30, y: 20 });
  assert.deepEqual(DDlockedStrokeEnd(g, { x: 80, y: 200 }), { x: 80, y: 20 });
  assert.deepEqual(DDlockedStrokeEnd(g, { x: -20, y: 200 }), g.start);
  const diagonal = { start: { x: 0, y: 0 } };
  DDlockedStrokeEnd(diagonal, { x: -10, y: 10 });
  const end = DDlockedStrokeEnd(diagonal, { x: -80, y: 20 });
  assert.ok(Math.abs(end.x + end.y) < 1e-9);
});

test('comment reactions (5.64, Milanote): one of each, a second pick takes it off, kept through the normalizer', () => {
  let m = { id: 'm1', text: 'Hi', at: '2026-11-14T10:00:00.000Z' };
  m = DDcommentReact(m, '👍');
  assert.deepEqual(m.reactions, ['👍']);
  m = DDcommentReact(m, '🎉');
  assert.deepEqual(m.reactions, ['👍', '🎉']);
  m = DDcommentReact(m, '👍');
  assert.deepEqual(m.reactions, ['🎉']);
  assert.equal(DDcommentReact(m, '🎉').reactions, undefined, 'none left: no field');
  const [c] = DDnormalizeComments([{ id: 'c1', x: 1, y: 2, thread: [{ ...m, reactions: ['🎉', '🎉', 5, 'x'.repeat(40), '✨'] }] }]);
  assert.deepEqual([...c.thread[0].reactions], ['🎉', '✨'], 'unique short strings only');
});
