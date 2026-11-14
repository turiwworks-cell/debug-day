const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Back to where you were (5.33): the app remembers the tab, the open section and
// where the board was looking. The Back button, Alt+← / Alt+→ and the browser's
// own back / forward (mouse side buttons) walk the same trail. Alt+↑ / Alt+↓
// step through the tabs. Panning only updates the place you are in.
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,errors,context}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   f.data.setup.life={v:2,items:[
    {id:'a',type:'section',parent:'',x:40,y:60,w:900,h:620,text:'Creative life',color:'#9DD6FF'},
    {id:'c',type:'section',parent:'a',x:420,y:80,w:420,h:320,text:'Sketches',color:'#D3B8FF'},
    {id:'n',type:'sticky',parent:'a',x:40,y:90,w:220,h:160,text:'Shared idea',color:'#FFE08A'},
    {id:'k',type:'sticky',parent:'c',x:40,y:90,w:220,h:160,text:'Line study',color:'#A8E6B8'},
    {id:'b',type:'section',parent:'',x:1040,y:60,w:420,h:350,text:'Work & play',color:'#FFA6D9'},
   ],links:[],frame:{x:24,y:1200}};
   f.data.days[f.date].notes.push({id:'far',kind:'sticky',text:'Far away thought',color:'#FFE27A',x:4200,y:2600});
   await page.evaluate((d)=>{localStorage.setItem('debug-day:v2',JSON.stringify(d));localStorage.setItem('debug-day:ui',JSON.stringify({view:'plan'}));},f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   const back=page.locator('.dd-tabs [data-places-back]'),
    tab=(name)=>page.locator(`.views [role=tab][data-panel="${name}"]`),
    selected=async()=>page.locator('.views [role=tab][aria-selected=true]').getAttribute('data-panel'),
    bar=page.locator('.dd-room-bar'),
    view=page.locator('.b2-viewport'),
    camera=()=>page.locator('.b2-world').evaluate((el)=>el.style.transform),
    tap=async(locator)=>mobile?locator.tap():locator.click(),
    // Alt+arrows act anywhere outside a text field.
    alt=async(arrow)=>{await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Alt+'+arrow);await page.waitForTimeout(250);},
    roomText=async()=>(await bar.count())?await bar.innerText():'';
   const shots=process.env.DEBUG_DAY_SCREENSHOTS,shot=async(name)=>{if(shots){require('node:fs').mkdirSync(shots,{recursive:true});await page.screenshot({path:require('node:path').join(shots,name+(mobile?'-phone':'')+'.png')});}};

   // 1. Nothing to go back to yet; one tab later, Back goes there in one click.
   assert.equal(await selected(),'engine');
   assert.equal(await back.isDisabled(),true,'nothing behind the first place');
   await tap(tab('board'));await view.waitFor();
   assert.equal(await back.isDisabled(),false);
   assert.equal(await back.getAttribute('aria-label'),'Back to Engine');
   if(mobile){
    const bb=await back.boundingBox(),vb=await page.locator('.views').boundingBox();
    assert.ok(Math.abs((bb.y+bb.height/2)-(vb.y+vb.height/2))<4,'on a phone Back sits on the tabs row');
    assert.ok(bb.width>=43.9&&bb.height>=43.9,'a thumb-sized button');
   }
   await shot('back-button');
   await tap(back);
   await page.waitForFunction(()=>document.querySelector('.views [aria-selected=true]')?.dataset.panel==='engine');
   assert.equal(await back.isDisabled(),true,'back at the start');
   // Alt+→ (or the mouse's forward button) goes forward again.
   await alt('ArrowRight');
   assert.equal(await selected(),'board');
   await view.waitFor();

   // 2. Into a section and deeper; each board is a place, with its own camera.
   await view.focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();
   await page.locator('[data-life-jump]').click();await page.waitForTimeout(300);
   await tap(page.locator('[data-board-id="life:a"] [data-enter-section="a"]'));
   await bar.waitFor();await page.waitForTimeout(400);
   assert.match(await roomText(),/Creative life/);
   // Look somewhere else inside it: the place keeps that view, no new place.
   const vb=await view.boundingBox();
   await page.mouse.move(vb.x+vb.width/2,vb.y+vb.height/2);await page.mouse.wheel(140,90);
   await page.waitForTimeout(500);
   const looked=await camera();
   assert.equal(await back.getAttribute('aria-label'),'Back to Board','panning made no new place');
   if(mobile)await tap(page.locator('[data-board-id="life:c"] [data-enter-section="c"]'));
   else{await page.locator('[data-sections-button]').click();await page.locator('.dd-flow [data-flow-node="c"] .dd-flow-pill').click();await page.locator('.dd-flow').waitFor({state:'detached'});}
   await page.waitForFunction(()=>/Sketches/.test(document.querySelector('.dd-room-bar')?.innerText||''));
   await page.waitForTimeout(400);
   assert.equal(await back.getAttribute('aria-label'),'Back to Board · Creative life');
   await shot('inside-sketches');
   await alt('ArrowLeft');
   await page.waitForFunction(()=>{const t=document.querySelector('.dd-room-bar')?.innerText||'';return /Creative life/.test(t)&&!/Sketches/.test(t);});
   await page.waitForTimeout(450);
   assert.equal(await camera(),looked,'the camera is where you left it');
   await alt('ArrowRight');
   await page.waitForFunction(()=>/Sketches/.test(document.querySelector('.dd-room-bar')?.innerText||''));

   // 3. A search jump is a place: Back returns to the view before it.
   await page.waitForTimeout(300);
   const before=await camera();
   await view.focus();await page.keyboard.press('Control+f');
   await page.locator('.b4-search input').fill('Far away');
   await page.locator('.b4-search button').filter({hasText:'Far away thought'}).click();
   await page.waitForFunction(()=>!document.querySelector('.dd-room-bar'),null,{timeout:4000}).catch(()=>{});
   await page.waitForTimeout(500);
   assert.notEqual(await camera(),before,'the board jumped to the note');
   assert.equal(await page.locator('[data-board-id="sticky:far"].selected').count(),1);
   // Full screen hides the tabs; Back comes along on the board.
   const boardBack=page.locator('.b2-brandbar [data-places-back]');
   // The place is recorded when the jump settles, which can be a frame or two late on a slow runner.
   await page.waitForFunction(()=>document.querySelector('.b2-brandbar [data-places-back]')?.getAttribute('aria-label')==='Back to Board · Sketches',null,{timeout:4000}).catch(()=>{});
   assert.equal(await boardBack.getAttribute('aria-label'),'Back to Board · Sketches');
   await tap(boardBack);
   await page.waitForFunction(()=>/Sketches/.test(document.querySelector('.dd-room-bar')?.innerText||''));
   await page.waitForTimeout(450);
   assert.equal(await camera(),before,'back where the search started');

   // 4. Alt+↑ / Alt+↓ step through the tabs; a tab is a place too.
   await alt('ArrowDown');
   assert.equal(await selected(),'calendar');
   await alt('ArrowDown');
   assert.equal(await selected(),'engine','the tabs go round');
   await alt('ArrowUp');
   assert.equal(await selected(),'calendar');
   // From another tab, Back opens the board in the section, where you were.
   await alt('ArrowLeft');await alt('ArrowLeft');
   assert.equal(await selected(),'calendar');
   await alt('ArrowLeft');
   assert.equal(await selected(),'board');
   await page.waitForFunction(()=>/Sketches/.test(document.querySelector('.dd-room-bar')?.innerText||''));
   await page.waitForTimeout(450);
   assert.equal(await camera(),before,'the board reopens with the same view');

   // 5. In a text field Alt+arrows stay with the text.
   await tap(tab('engine'));
   const input=page.locator('#qa');
   if(await input.isVisible()){
    await input.focus();await page.keyboard.press('Alt+ArrowLeft');await page.waitForTimeout(250);
    assert.equal(await selected(),'engine','typing keeps its keys');
   }

   // 6. A reload keeps the trail.
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   assert.equal(await selected(),'engine');
   assert.equal(await back.getAttribute('aria-label'),'Back to Board · Sketches');
   await tap(back);
   await page.waitForFunction(()=>/Sketches/.test(document.querySelector('.dd-room-bar')?.innerText||''));
   // The browser's own back (a mouse side button) walks the same trail.
   await page.goBack();
   await page.waitForFunction(()=>{const t=document.querySelector('.dd-room-bar')?.innerText||'';return /Creative life/.test(t)&&!/Sketches/.test(t);});
   await page.goForward();
   await page.waitForFunction(()=>/Sketches/.test(document.querySelector('.dd-room-bar')?.innerText||''));

   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false,'no sideways scroll');
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('places ok');
 } finally {await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
