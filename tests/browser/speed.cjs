const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Speed check (5.46.5): a big board must stay quick. Machines differ, so this
// counts work instead of timing it: how often the board draws itself, how many
// cards it draws, how many hidden tools it makes, and how much the browser
// restyles while you type. Times are printed and only fail when far too slow.
(async()=>{
 const h=await start();
 try{
  const {page,errors,context}=await h.context(false),f=await fixture(page,h.origin);
  page.setDefaultTimeout(15000);
  // About 300 cards: 60 notes on the day, 20 Feed sections with 10 notes each, and drawings.
  const items=[];
  for(let s=0;s<20;s++){items.push({id:'s'+s,type:'section',parent:'',x:(s%5)*700,y:2000+Math.floor(s/5)*600,w:640,h:520,text:'Section '+s,color:'#9DD6FF'});
   for(let k=0;k<10;k++)items.push({id:'s'+s+'n'+k,type:'sticky',parent:'s'+s,x:20+(k%4)*150,y:60+Math.floor(k/4)*150,w:140,h:140,text:'Feed note '+s+' '+k+' with a few more words',color:'#FFE08A',tags:['idea']});}
  const strokes=[];for(let i=0;i<40;i++){let p='100,100';for(let j=0;j<60;j++)p+=' 3,4';strokes.push({id:'st'+i,pts:p,color:'#333',w:3});}
  f.data.setup.life={v:2,items,links:[],strokes,comments:[],frame:{x:24,y:2000,w:3600,h:3000}};
  const today=f.data.days[f.date];
  today.notes=[];for(let i=0;i<60;i++)today.notes.push({id:'n'+i,kind:'sticky',text:'Day note '+i+' with a sentence of text',color:'#FFE299',x:100+(i%10)*260,y:100+Math.floor(i/10)*260});
  // The note typed in is short, so the ten keys never make it grow a line (that redraws, rightly).
  today.notes[14].text='Hi';
  await page.addInitScript(()=>{window.__ddPerf={board:0,cards:0};});
  await page.evaluate((d)=>{localStorage.setItem('debug-day:v2',JSON.stringify(d.data));localStorage.setItem('debug-day:board-view:'+d.date,JSON.stringify({camera:{x:40,y:50,z:0.9},mode:'mindmap'}));},{data:f.data,date:f.date});
  await page.reload();await page.waitForSelector('.views',{state:'attached'});
  const node=(ref)=>page.locator(`[data-board-id="${ref}"]`),
   count=()=>page.evaluate(()=>({...window.__ddPerf})),
   frames=()=>page.evaluate(()=>new Promise((r)=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,0))))),
   settle=async()=>{await page.waitForTimeout(350);await frames();},
   since=async(before)=>{const now=await count();return {board:now.board-before.board,cards:now.cards-before.cards};},
   pick=async(ref)=>{const b=await node(ref).boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await frames();};
  await page.locator('.views button[data-panel="board"]').click();
  await node('sticky:n0').waitFor();await page.waitForTimeout(1200);
  const cards=await page.locator('.b4-node').count();
  assert.ok(cards>=280,'the board has its cards ('+cards+')');

  // 1. Hidden tools are not made: no dots or resize handles while nothing is picked,
  // and the board stays under 20 elements a card.
  assert.equal(await page.locator('.b4-port').count(),0,'no connection dots');
  assert.equal(await page.locator('.b6-note-resize').count(),0,'no resize handles');
  const elements=await page.locator('.b2-viewport *').count();
  assert.ok(elements/cards<20,`about ${Math.round(elements/cards)} elements a card`);

  // 2. Resting, moving the mouse and zooming do not draw the board.
  let c=await count();await page.waitForTimeout(800);
  assert.equal((await since(c)).board,0,'resting draws nothing');
  const vp=await page.locator('.b2-viewport').boundingBox();
  c=await count();
  for(let i=0;i<20;i++)await page.mouse.move(vp.x+100+i*30,vp.y+200+i*8);
  await page.mouse.move(vp.x+vp.width/2,vp.y+vp.height/2);
  for(let i=0;i<5;i++){await page.mouse.wheel(0,-60);await page.waitForTimeout(40);}
  await settle();
  assert.equal((await since(c)).board,0,'mouse moves and zoom draw nothing');

  // 3. Picking a card draws the board once and only the cards that changed.
  await pick('sticky:n12');await settle();
  c=await count();const t0=Date.now();await pick('sticky:n13');const clickMs=Date.now()-t0;await settle();
  let d=await since(c);
  assert.equal(d.board,1,'one draw for a click');
  assert.ok(d.cards<=2,`a click redraws the two cards involved, not ${d.cards}`);
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.b4-node[aria-selected=true]')].map((e)=>e.dataset.boardId)),['sticky:n13']);
  await page.keyboard.press('Escape');await settle();

  // 4. Typing in a note does not draw the board, and each key restyles only a few elements.
  await node('sticky:n14').locator('.dd-note-preview').dblclick();
  const ed=node('sticky:n14').locator('textarea');await ed.waitFor();await ed.press('End');await settle();
  const cdp=await context.newCDPSession(page),events=[];
  cdp.on('Tracing.dataCollected',(e)=>events.push(...e.value));
  await cdp.send('Tracing.start',{traceConfig:{includedCategories:['devtools.timeline']}});
  c=await count();const keys=[];
  for(let i=0;i<10;i++){const a=Date.now();await page.keyboard.type('x');await frames();keys.push(Date.now()-a);}
  d=await since(c);
  await new Promise((r)=>{cdp.once('Tracing.tracingComplete',r);cdp.send('Tracing.end');});
  assert.equal(d.board,0,'typing draws only the note');
  const restyled=events.filter((e)=>e.name==='UpdateLayoutTree'&&e.ph==='X').reduce((n,e)=>n+(e.args?.elementCount||0),0);
  assert.ok(restyled/10<100,`each key restyles about ${Math.round(restyled/10)} elements`);
  await page.keyboard.press('Escape');
  keys.sort((a,b)=>a-b);const keyMs=keys[keys.length>>1];
  // Far too slow only: today a key takes about 10 ms and a click about 20 ms on a desktop.
  assert.ok(keyMs<120,`a key took ${keyMs} ms`);
  assert.ok(clickMs<600,`a click took ${clickMs} ms`);

  assert.deepEqual(errors,[]);
  console.log(`speed: ${cards} cards, ${Math.round(elements/cards)} elements a card, ${Math.round(restyled/10)} restyled a key, key ${keyMs} ms, click ${clickMs} ms passed`);
 }finally{await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
