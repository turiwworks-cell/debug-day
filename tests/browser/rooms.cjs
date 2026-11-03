const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Sections (5.18): every Life section opens as its own board, with today's
// Engine beside it. Same data as the main board: what is made inside stays in
// the section, and a note dragged into the Engine becomes today's task.
(async()=>{
 const h=await start();
 try {
  for(const [language,mobile] of [['en',false],['en',true]]){
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin),t=(en,fa)=>language==='fa'?fa:en;
   f.data.setup.preferences.language=language;
   f.data.setup.life={v:2,items:[
    {id:'a',type:'section',parent:'',x:40,y:60,w:900,h:620,text:'Creative life',color:'#9DD6FF'},
    {id:'c',type:'section',parent:'a',x:420,y:80,w:420,h:320,text:'Sketches',color:'#D3B8FF'},
    {id:'n',type:'sticky',parent:'a',x:40,y:90,w:220,h:160,text:'Shared idea',color:'#FFE08A'},
    {id:'k',type:'sticky',parent:'c',x:40,y:90,w:220,h:160,text:'Line study',color:'#A8E6B8'},
    {id:'b',type:'section',parent:'',x:1040,y:60,w:420,h:350,text:'Work & play',color:'#FFA6D9'},
    {id:'m',type:'sticky',parent:'b',x:40,y:90,w:220,h:160,text:'Second idea',color:'#A8E6B8'}
   ],links:[],frame:{x:24,y:1200}};
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    item=async(id)=>(await read()).setup.life.items.find(i=>i.id===id),
    inside=async(id,root)=>{const items=(await read()).setup.life.items;let it=items.find(i=>i.id===id),hops=0;while(it&&hops++<20){if(it.id===root)return true;it=items.find(i=>i.id===it.parent);}return false;},
    bar=page.locator('.dd-room-bar'),
    tap=async(locator)=>mobile?locator.tap():locator.click();
   await page.locator('.views button').nth(1).click();
   await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();
   await page.locator('[data-life-jump]').click();await page.waitForTimeout(300);
   // Enter "Creative life" from the button on its name.
   await tap(page.locator('[data-board-id="life:a"] [data-enter-section="a"]'));
   await bar.waitFor();
   assert.match(await bar.innerText(),new RegExp(t('Main board','برد اصلی')+'[\\s\\S]*Creative life'));
   for(const id of ['a','c','n','k'])assert.equal(await page.locator(`[data-board-id="life:${id}"]`).count(),1,id+' shows inside');
   for(const id of ['b','m'])assert.equal(await page.locator(`[data-board-id="life:${id}"]`).count(),0,id+' stays on the main board');
   assert.equal(await page.locator('[data-board-id="sticky:note"]').count(),0,'day notes stay on the main board');
   assert.equal(await page.locator('[data-board-id="section:habits"]').count(),0);
   // Today's Engine is there too, beside the section.
   const area=page.locator('[data-board-id="section:engine"]');await area.waitFor();
   // Entering a section schedules its camera fit. Wait for that fit before
   // saving screen coordinates; the old main-board camera can put them outside
   // the viewport (and make the later note-creation click hit nothing).
   await page.waitForFunction((mobile)=>{
    const el=document.querySelector(mobile?'[data-board-id="life:a"]':'[data-board-id="section:engine"]');
    if(!el)return false;
    const r=el.getBoundingClientRect();
    return r.top>=0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;
   },mobile);
   assert.equal(await area.locator('..').locator('[data-board-id="day:root"]').count(),1);
   const ab=await area.boundingBox(),sb=await page.locator('[data-board-id="life:a"]').boundingBox();
   if(mobile)assert.ok(sb.y>ab.y+ab.height-2,'on a phone the section sits under the Engine');
   else assert.ok(sb.x>ab.x+ab.width-2,'the section sits to the right of the Engine');
   const rb=await bar.boundingBox(),tb=await page.locator('.b2-top-actions').boundingBox();
   assert.ok(rb.y>=tb.y+tb.height-1||rb.y+rb.height<=tb.y+1,'the path is not under the toolbar');
   // The Engine overlay opens inside a section, and adds to the same day.
   if(!mobile){
    await page.locator('.b2-viewport').focus();await page.keyboard.press('e');
    const engine=page.getByRole('dialog',{name:t('Engine','انجین')});await engine.waitFor();
    const add=engine.locator('[data-lane="work"] .dd-engine-add input');await add.fill('Made inside a section');await add.press('Enter');
    assert.equal((await read()).days[f.date].blocks.find(b=>b.name==='Made inside a section')?.from,'a','the Engine is the same everywhere, and the task knows its section');
    await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});
    // A note made outside the section lands inside it.
    await page.locator('.b2-viewport').focus();await page.keyboard.press('s');
    await page.mouse.click(ab.x+40,ab.y+ab.height+60);
    await page.locator('.b2 textarea').first().fill('Made on this board');await page.locator('.b2 textarea').first().press('Control+Enter');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.some(i=>i.text==='Made on this board'));
    const made=(await read()).setup.life.items.find(i=>i.text==='Made on this board');
    assert.ok(await inside(made.id,'a'),'a new note joins the open section');
    assert.ok(!(await read()).days[f.date].notes.some(n=>n.text==='Made on this board'),'not a day note');
    // Dragged out past the edge it stays in the section.
    await page.keyboard.press('Escape');
    const nb=await page.locator('[data-board-id="life:n"]').boundingBox();
    await page.mouse.move(nb.x+nb.width/2,nb.y+10);await page.mouse.down();
    const sb2=await page.locator('[data-board-id="life:a"]').boundingBox();
    await page.mouse.move(nb.x+nb.width/2,sb2.y+sb2.height+30,{steps:10});await page.mouse.up();await page.waitForTimeout(200);
    assert.ok((await item('n')).y+80>sb2.height/ (sb2.width/900),'it really moved past the edge');
    assert.ok(await inside('n','a'),'a note dragged past the edge stays in the section');
    // Dragged into the Engine it becomes today's task.
    const nb2=await page.locator('[data-board-id="life:n"]').boundingBox(),eb=await area.boundingBox();
    await page.keyboard.press('Escape');
    await page.mouse.move(nb2.x+nb2.width/2,nb2.y+nb2.height/2);await page.mouse.down();
    await page.mouse.move(eb.x+eb.width-80,eb.y+eb.height-50,{steps:16});await page.mouse.up();
    await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks.some(b=>b.name==='Shared idea'),f.date);
    assert.equal(await item('n'),undefined,'the note became the task');
    assert.equal((await read()).days[f.date].blocks.find(b=>b.name==='Shared idea').from,'a','it remembers the section it sat in');
   }
   // Into the nested section, then back out one level at a time.
   // On a phone from the button on its name; on desktop (the task's details are
   // open beside it now) from the Sections flowchart.
   if(mobile)await tap(page.locator('[data-board-id="life:c"] [data-enter-section="c"]'));
   else{await page.locator('[data-sections-button]').click();await page.locator('.dd-flow [data-flow-node="c"] .dd-flow-pill').click();await page.locator('.dd-flow').waitFor({state:'detached'});}
   await page.waitForFunction(()=>/Sketches/.test(document.querySelector('.dd-room-bar')?.innerText||''));
   assert.equal(await page.locator('[data-board-id="life:a"]').count(),0,'the outer section is not drawn inside the inner one');
   assert.equal(await page.locator('[data-board-id="life:k"]').count(),1);
   if(!mobile){
    // A reload keeps you where you were.
    await page.reload();await page.waitForSelector('#qa',{state:'attached'});
    await page.locator('.views button').nth(1).click();await bar.waitFor();
    assert.match(await bar.innerText(),/Sketches/);
    await page.locator('.b2-viewport').focus();await page.keyboard.press('Escape');
   } else await tap(bar.locator('[data-room-back]'));
   await page.waitForFunction(()=>!/Sketches/.test(document.querySelector('.dd-room-bar')?.innerText||''));
   assert.equal(await page.locator('[data-board-id="life:a"]').count(),1,'back in Creative life');
   await tap(bar.locator('[data-room-crumb="main"]'));
   await bar.waitFor({state:'detached'});
   assert.equal(await page.locator('[data-board-id="life:b"]').count(),1,'the main board again');
   assert.equal(await page.locator('[data-board-id="sticky:note"]').count(),1);
   // The selection toolbar can open a section too.
   await tap(page.locator('[data-sections-button]'));await page.locator('.dd-flow [data-flow-node="b"] .dd-flow-pill').dispatchEvent('contextmenu');
   await tap(page.locator('.dd-flow [data-flow-show="b"]'));await page.locator('.dd-flow').waitFor({state:'detached'});await page.waitForTimeout(300);
   await tap(page.locator('[data-board-id="life:b"] .b4-node-title'));
   await tap(page.locator('.b4-selectionbar [data-enter-section="b"]'));
   await bar.waitFor();assert.match(await bar.innerText(),/Work & play/);
   // A section deleted elsewhere closes its board.
   await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('debug-day:v2'));d.setup.life.items=d.setup.life.items.filter(i=>i.id!=='b'&&i.parent!=='b');localStorage.setItem('debug-day:v2',JSON.stringify(d));});
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});await page.locator('.views button').nth(1).click();
   await page.locator('[data-board-id="section:engine"]').waitFor();
   assert.equal(await bar.count(),0,'no board for a section that is gone');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false,'no sideways scroll');
   assert.deepEqual(errors,[]);
   await page.context().close();
  }
  console.log('rooms ok');
 } finally {await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
