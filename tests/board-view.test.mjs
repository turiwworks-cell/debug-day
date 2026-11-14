import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.js';
import {DDsameSnapshot} from '../public/sync.js';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function DDreadBoardView('),html.indexOf('const DDCloud='));
function fixture(){
  const values=new Map();
  const localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const api=runInNewContext(source+';({read:DDreadBoardView,save:DDsaveBoardView})',{localStorage});
  return {values,localStorage,...api};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('board navigation persists per day without touching planner data or the sync base',()=>{
  const f=fixture(),planner='{"days":{"2026-10-22":{"blocks":[]}}}',base='{"revision":42}';
  f.values.set('debug-day:v2',planner);f.values.set('debug-day:cloud-base',base);
  for(let i=0;i<10;i++)f.save('2026-10-22',{x:i,y:-i,z:0.8},i%2?'lanes':'mindmap');
  assert.deepEqual(plain(f.read('2026-10-22',null)),{camera:{x:9,y:-9,z:0.8},mode:'lanes'});
  assert.deepEqual(plain(f.read('2026-10-23',null)),{});
  assert.equal(f.values.get('debug-day:v2'),planner);
  assert.equal(f.values.get('debug-day:cloud-base'),base);
});
test('local navigation overrides legacy navigation and preserves shared board content',()=>{
  const f=fixture(),board={camera:{x:10,y:20,z:1},mode:'mindmap',links:[{id:'link'}],layouts:{lanes:{task:{x:30,y:40}}}};
  f.save('2026-10-22',{x:100,y:200,z:0.6},'lanes');
  const actual=plain(f.read('2026-10-22',board));
  assert.deepEqual(actual,{...board,camera:{x:100,y:200,z:0.6},mode:'lanes'});
  assert.equal(board.mode,'mindmap');assert.equal(board.camera.x,10);
  assert.equal(f.read('2026-10-23',board),board);
});
test('corrupt local navigation falls back safely to legacy board state',()=>{
  const f=fixture(),board={mode:'lanes',camera:{x:1,y:2,z:1}};
  for(const invalid of ['{','null','"text"','[]','{"mode":"invalid","camera":{"x":null,"y":0,"z":1}}']){
    f.values.set('debug-day:board-view:2026-10-22',invalid);
    assert.deepEqual(plain(f.read('2026-10-22',board)),board);
  }
});
test('unavailable browser storage never prevents using a legacy board',()=>{
  const api=runInNewContext(source+';({read:DDreadBoardView,save:DDsaveBoardView})',{localStorage:{getItem(){throw Error('blocked')},setItem(){throw Error('full')}}});
  const board={mode:'lanes'};
  assert.equal(api.read('2026-10-22',board),board);
  assert.doesNotThrow(()=>api.save('2026-10-22',{x:0,y:0,z:1},'mindmap'));
});

// Run the shipped cloud controller and camera save handler against the real
// Worker with SQLite, without requiring a browser or touching production.
test('ten MCP additions succeed between simulated board navigation and sync; content still uses revisions',async()=>{
  const sql=new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  try {
    const origin='http://localhost:8787',date='2026-10-22';
    const env={SYNC_TOKEN:'s'.repeat(64),MCP_WRITE_TOKEN:'w'.repeat(64),DB:{prepare(query){let args=[];return {bind(...values){args=values;return this},async first(){return sql.prepare(query).get(...args)||null}}}}};
    const data={setup:{types:[{id:'work'}],lanes:[{id:'work'}]},days:{[date]:{date,focus:'Original',blocks:[],notes:[],bugs:[],canvas:null}}};
    const request=(path,options)=>worker.fetch(new Request(origin+path,options),env);
    const seed=await request('/api/sync',{method:'PUT',headers:{Authorization:'Bearer '+env.SYNC_TOKEN,'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify({data})});
    assert.equal(seed.status,200);
    const values=new Map([
      ['debug-day:cloud-config',JSON.stringify({url:origin,key:env.SYNC_TOKEN})],
      ['debug-day:cloud-base',JSON.stringify({url:origin,data,revision:1})]
    ]);
    const merge=html.slice(html.indexOf('function DDmerge('),html.indexOf('function DDreadBoardView('));
    const cloud=html.slice(html.indexOf('const DDCloud='),html.indexOf('function useDebugDayEnhancements('));
    const board=readFileSync(new URL('../public/board.js',import.meta.url),'utf8');
    const camera=board.slice(board.indexOf('function saveCamera()'),board.indexOf('function scheduleCamera()'));
    let puts=0;
    const app=runInNewContext(source+merge+cloud+
      'let dayRef={current:{date:"'+date+'"}},cam={current:null},viewMode,cameraTimer={current:0};'+camera+
      ';({cloud:DDCloud,navigate(camera,nextMode){cam.current=camera;viewMode=nextMode;saveCamera()}})',{
      localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},
      window:new EventTarget(),document:Object.assign(new EventTarget(),{hidden:false}),Event,
      navigator:{onLine:true},AbortSignal,
      // saveCamera also tells the place trail where the camera is (5.33).
      DDplaces:{note(){}},
      setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,
      DDsameSnapshot,DDvalidateSnapshot:value=>value,DDnormalizeSnapshot:value=>JSON.parse(JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)),
      async fetch(url,options){if(options.method==='PUT')puts++;return worker.fetch(new Request(url,options),env)}
    });
    let local=structuredClone(data);
    const apply=next=>{local=next;app.cloud.observe(local,apply)};
    app.cloud.observe(local,apply);
    await app.cloud.sync();
    async function rpc(name,args){const response=await request('/mcp',{method:'POST',headers:{Authorization:'Bearer '+env.MCP_WRITE_TOKEN,Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});return (await response.json()).result}
    for(let i=0;i<10;i++){
      const before=await rpc('get_day',{date});
      app.navigate({x:i*10,y:-i*5,z:0.8},i%2?'lanes':'mindmap');
      await app.cloud.sync();
      const result=await rpc('add_block',{date,expected_revision:before.structuredContent.revision,name:'Task '+i,minutes:30,type_id:'work',lane_id:'work'});
      assert.equal(result.isError,false,'first attempt for task '+i);
      await app.cloud.sync();
    }
    assert.equal(puts,0,'navigation and polling must never upload planner data');
    assert.equal(sql.prepare('SELECT revision FROM planner').get().revision,11);
    assert.equal(local.days[date].blocks.length,10,'MCP edits reach the open app');
    assert.equal(local.days[date].canvas,null,'navigation must not create shared board state');
    assert.equal(JSON.parse(values.get('debug-day:board-view:'+date)).mode,'lanes');
    local=structuredClone(local);local.days[date].focus='Edited in app';
    app.cloud.observe(local,apply);await app.cloud.sync();
    assert.equal(puts,1,'real edits still upload');
    assert.equal(sql.prepare('SELECT revision FROM planner').get().revision,12);
    const stale=await rpc('add_block',{date,expected_revision:11,name:'Stale edit',minutes:30,type_id:'work',lane_id:'work'});
    assert.equal(stale.isError,true,'real content conflicts remain protected');
    assert.match(stale.content[0].text,/Conflict/);
  } finally {sql.close()}
});
