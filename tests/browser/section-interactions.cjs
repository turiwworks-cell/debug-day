const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
const {mkdirSync}=require('node:fs');
const {join}=require('node:path');
(async()=>{
 const h=await start();
 try {
  for(const mobile of [false,true]){
   const {page,context,errors}=await h.context(mobile),f=await fixture(page,h.origin);
   f.data.setup.life={v:2,items:[
    {id:'a',type:'section',parent:'',x:40,y:60,w:420,h:350,text:'Creative life',color:'#9DD6FF'},
    {id:'b',type:'section',parent:'',x:560,y:60,w:420,h:350,text:'Work & play',color:'#D3B8FF'},
    {id:'n',type:'sticky',parent:'a',x:40,y:70,w:220,h:160,text:'Shared idea',color:'#FFE08A'},
    {id:'m',type:'sticky',parent:'b',x:40,y:70,w:220,h:160,text:'Second idea',color:'#A8E6B8'}
   ],links:[],frame:{x:24,y:1200}};
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   await page.locator('.views button').nth(1).click();
   await page.getByRole('button',{name:'Full screen',exact:true}).click();
   await page.locator('[data-life-jump]').click();
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')));
   const note=page.locator('[data-life-id="n"]');
   await note.locator('.dd-note-preview').click();if(!await note.locator('textarea').count())await page.keyboard.press('Enter');
   await note.locator('textarea').fill('Edited with one tap');
   await note.locator('textarea').press('Control+Enter');
   assert.equal((await read()).setup.life.items.find(i=>i.id==='n').text,'Edited with one tap');
   const drag=async(locator,dx,dy,end='up')=>{
    const box=await locator.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:10});
    if(end==='escape')await page.keyboard.press('Escape');
    await page.mouse.up();
   };
   if(mobile){
    const touch=await context.newCDPSession(page);let previous=40;

    for(let n=0;n<3;n++){
     const b=await note.locator('.dd-note-drag').boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
     await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
     for(let step=1;step<=8;step++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+30*step/8,y:y+20*step/8,id:1}]});
     await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});

     await page.waitForFunction((prev)=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find(i=>i.id==='n').x>prev,previous);
     previous=(await read()).setup.life.items.find(i=>i.id==='n').x;
    }
    assert.equal(await note.locator('textarea').count(),0,'short touch drags do not enter edit mode');
    await page.locator('[data-drawer-button]').click();await page.locator('[data-drawer-list]').click();
    await page.locator('.dd-life-nav').getByRole('button',{name:/Work & play/}).click();
    assert.equal(await page.locator('[data-life-id="b"]').getAttribute('aria-selected'),'true','section navigator is reachable on phones');
   }else{
    await note.focus();
    await drag(note.locator('[data-edge="se"]'),55,45);
    let state=(await read()).setup.life.items.find(i=>i.id==='n');assert.ok(state.w>220&&(state.style?.textSize||16)>16,'native note resize persists (a corner scales the note and its text; height follows the text)');
    const before=await read();await drag(note.locator('.dd-note-preview'),50,20,'escape');
    assert.deepEqual((await read()).setup.life,before.setup.life,'Escape cancels a drag');
    // A real port gesture connects Life notes using native wires, stored in shared setup.
    await note.focus();
    const from=await note.locator('[data-add-near="right"]').boundingBox();const to=await page.locator('[data-life-id="m"] .b4-port.left').boundingBox();
    await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});await page.mouse.up();
    state=await read();assert.equal(state.setup.life.links.length,1,'Life-to-Life connections are shared');
    // Dragging out moves the same text, size and its wire into the day.
    const frame=await page.locator('[data-board-id="section:life"]').boundingBox(),box=await note.boundingBox();
    await drag(note.locator('.dd-note-preview'),frame.x+frame.width+80-box.x,0);
    state=await read();assert.equal(state.setup.life.items.some(i=>i.id==='n'),false);
    assert.equal(state.days[f.date].notes.find(i=>i.id==='n').text,'Edited with one tap');
    assert.ok(state.days[f.date].canvas.board4.links.some(l=>l.from==='sticky:n'||l.to==='sticky:n'),'transfer preserves the connection');
    await page.keyboard.press('Control+z');assert.equal(await note.count(),1);
    const outer=page.locator('[data-board-id="section:life"]'),oldW=await outer.evaluate(e=>e.offsetWidth);
    await drag(outer.locator('[data-resize]'),80,60);
    state=await read();assert.ok(state.setup.life.frame.w>oldW,'Life area resize is shared');
    assert.equal(await outer.getAttribute('aria-selected'),null);
   }
   const out=process.env.DEBUG_DAY_SCREENSHOTS;
   if(out){mkdirSync(out,{recursive:true});await page.screenshot({path:join(out,'life-native-'+(mobile?'phone':'desktop')+'.png')});}
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Native Life: note editing, touch dragging, resizing, cancellation, shared wires and transfer passed');
 }finally{await h.stop()}
})().catch(e=>{console.error(e);process.exit(1)});
