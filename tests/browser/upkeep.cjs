const assert=require('node:assert/strict');
const {start,fixture,openEngine}=require('./harness.cjs');
// Upkeep and gentle nudges (5.45): yesterday's leftovers and a very full day
// show as one calm line at the top of the Engine; Feed deletes wait in Recently
// deleted; an empty note stays when you close it; days stop keeping copies
// of Feed places; Settings shows the space used.
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,errors,context}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   const shift=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*864e5).toISOString().slice(0,10),tomorrow=shift(f.date,1);
   f.data.setup.life={v:2,items:[
    {id:'s',type:'section',parent:'',x:40,y:60,w:620,h:380,text:'Ideas',color:'#9DD6FF'},
    {id:'fox',type:'sticky',parent:'s',x:30,y:80,w:200,h:200,text:'Fox poses',color:'#FFE08A'},
    {id:'owl',type:'sticky',parent:'s',x:270,y:80,w:200,h:200,text:'Owl',color:'#A8E6B8'},
   ],links:[],frame:{x:24,y:700,w:1420,h:700}};
   // Yesterday left one task open; today is very full.
   f.data.days[f.last].blocks=[{id:'old',name:'Old sketch',type:'writing',lane:'work',min:30,done:false,subtasks:[],expanded:false}];
   f.data.days[f.date].blocks=[
    {id:'big',name:'Animate intro',type:'writing',lane:'work',min:420,pri:2,done:false,subtasks:[],expanded:false},
    {id:'small',name:'Emails',type:'writing',lane:'work',min:120,pri:0,done:false,subtasks:[],expanded:false},
    {id:'mid',name:'Storyboard',type:'writing',lane:'work',min:120,pri:1,done:false,subtasks:[],expanded:false},
   ];
   // An old day board kept its own copies of Feed places.
   f.data.days[f.date].canvas={board4:{version:1,mode:'mindmap',layouts:{mindmap:{'life:fox':{x:1,y:2},'life:owl':{x:3,y:4}},lanes:{}},links:[],hidden:[],overrides:{},locked:[],groups:{},styles:{},stack:[]}};
   await page.evaluate((d)=>{localStorage.setItem('debug-day:v2',JSON.stringify(d.data));localStorage.setItem('debug-day:board-view:'+d.date,JSON.stringify({camera:{x:40,y:150,z:0.5},mode:'mindmap'}));},{data:f.data,date:f.date});
   await page.reload();await page.waitForSelector('.views',{state:'attached'});
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    nudge=(id)=>page.locator(`[data-nudge="${id}"]:visible`);
   // 1. Yesterday's leftovers come first: the Engine's carry line (the Engine
   //    opens over the Board, 5.67).
   await openEngine(page);
   const carry=page.locator('.dd-engine .dd-engine-carry');
   await carry.waitFor();
   assert.match(await carry.innerText(),/1 still open from[\s\S]*Old sketch/);
   await carry.getByRole('button',{name:'Bring it'}).click();
   await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks.some((b)=>b.name==='Old sketch'),f.date);
   await carry.waitFor({state:'detached'});
   let data=await read();
   assert.equal(data.days[f.last].blocks[0].done,false,'yesterday is left as it was');
   assert.deepEqual(data.days[f.date].canvas.board4.layouts.mindmap,{},'the saved day no longer keeps Feed places');
   // 2. A very full day offers to move the easiest task to tomorrow.
   assert.match(await nudge('full').innerText(),/This day is very full \(11h 30m\)/);
   // The lowest priority goes first, the last one among equals.
   await nudge('full').getByRole('button',{name:'Move “Old sketch”'}).click();
   await page.waitForFunction((d)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[d]?.blocks.some((b)=>b.name==='Old sketch'),tomorrow);
   assert.match(await nudge('full').innerText(),/This day is very full \(11h\)/);
   await nudge('full').getByRole('button',{name:'Move “Emails”'}).click();
   await page.waitForFunction((d)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[d]?.blocks.some((b)=>b.name==='Emails'),tomorrow);
   data=await read();
   assert.equal(data.days[f.date].blocks.some((b)=>b.name==='Emails'),false);
   await nudge('full').waitFor({state:'detached'});
   await page.keyboard.press('Escape');await page.locator('.dd-engine').waitFor({state:'detached'});
   // 3. Settings says how much space the planner uses.
   await page.locator('button',{hasText:'Settings'}).last().click();
   const space=page.locator('.dd-storage-use');await space.waitFor();
   assert.match(await space.innerText(),/Space used: \d+ KB of 1\.5 MB \(\d+%\)/);
   await page.keyboard.press('Escape');
   if(!mobile){
    // 4. A Feed delete waits in Recently deleted; Undo takes the entry away again.
    await page.locator('.views button',{hasText:'Board'}).click();
    const view=page.locator('.b2-viewport');await view.waitFor();
    await view.focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();
    await view.focus();await page.keyboard.press('Shift+1');await page.waitForTimeout(350);
    const node=(ref)=>page.locator(`[data-board-id="${ref}"]`),menu=()=>page.getByRole('menu',{name:'Board context menu'}),menuItem=(name)=>menu().getByRole('menuitem',{name,exact:true});
    const b=await node('life:fox').locator(':scope>.b4-node-body').boundingBox();
    await page.mouse.click(b.x+b.width/2,b.y+30);await page.waitForTimeout(150);
    await view.focus();await page.keyboard.press('Delete');
    await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.some((i)=>i.id==='fox'));
    data=await read();
    assert.equal(data.setup.life.trash.length,1);
    assert.equal(data.setup.life.trash[0].items[0].text,'Fox poses');
    await view.focus();await page.keyboard.press('Control+z');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.some((i)=>i.id==='fox'));
    assert.equal((await read()).setup.life.trash,undefined,'undoing the delete also empties the list');
    await page.keyboard.press('Escape');
    const b2=await node('life:fox').locator(':scope>.b4-node-body').boundingBox();
    await page.mouse.click(b2.x+b2.width/2,b2.y+30);await page.waitForTimeout(150);
    await view.focus();await page.keyboard.press('Delete');
    await page.waitForFunction(()=>(JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.trash||[]).length===1);
    await page.locator('[data-dock-more="top"]').click();
    await menuItem('Recently deleted · 1').click();
    await menuItem('Fox poses · just now').click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.some((i)=>i.id==='fox'));
    data=await read();
    assert.equal(data.setup.life.items.find((i)=>i.id==='fox').parent,'s','back inside its section');
    assert.equal(data.setup.life.trash,undefined);
    await node('life:fox').waitFor();
    // 5. A note closed with nothing in it stays (5.67).
    const n0=(await read()).days[f.date].notes.length,vb=await view.boundingBox();
    await page.keyboard.press('Escape');
    await page.mouse.dblclick(vb.x+vb.width*.8,vb.y+vb.height*.3);
    const typing=page.locator('.dd-note-editor textarea');await typing.waitFor();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    assert.equal((await read()).days[f.date].notes.length,n0+1,'the empty note stays');
    assert.equal((await read()).days[f.date].notes.at(-1).text,'','and it is empty');
    await page.mouse.dblclick(vb.x+vb.width*.8,vb.y+vb.height*.3);
    await typing.waitFor();await typing.fill('Kept');await page.keyboard.press('Escape');
    await page.waitForFunction((a)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[a.date].notes.some((n)=>n.text==='Kept'),{date:f.date});
    await page.waitForTimeout(300);
    assert.equal((await read()).days[f.date].notes.length,n0+1,'a note with words stays');
   }
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('upkeep: leftovers and full-day nudges, Recently deleted, empty notes stay, no Feed copies on days, space used');
 }finally{await h.stop();}
})().catch((error)=>{console.error(error);process.exitCode=1;});
