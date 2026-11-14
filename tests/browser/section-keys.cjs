const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Shortcut keys in the Tab flowchart (5.52): Tab then a section's letter goes
// straight into its board, Shift with the letter brings its Engine too, and
// 1–4 go back to the boards you were on last. "This App" has T. A key is given
// with Alt+letter on a section or from its right-click menu, and lives on the
// section itself, so it syncs like its name.
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   const section=(id,text,x,extra={})=>({id,type:'section',parent:'',x,y:60,w:420,h:300,text,...extra});
   f.data.setup.life={v:2,items:[section('app','This App',40),section('work','Work',500),section('home','Home',960),{id:'n',type:'sticky',parent:'home',x:30,y:80,w:220,h:160,text:'Plant seeds'}],links:[],frame:{x:24,y:1200}};
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('.views',{state:'attached'});
   const tap=async(locator)=>mobile?locator.tap():locator.click(),
    flow=page.locator('.dd-flow'),
    pill=(id)=>flow.locator(`[data-flow-node="${id}"] .dd-flow-pill`),
    room=()=>page.evaluate(()=>sessionStorage.getItem('debug-day:board-room')),
    keyOf=(id)=>page.evaluate((id)=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find((i)=>i.id===id).key,id),
    view=page.locator('.b2-viewport');
   await page.locator('[role=tab][data-panel=board]').click();await view.waitFor();
   const open=async()=>{if(mobile)await tap(page.locator('[data-sections-button]'));else{await view.focus();await page.keyboard.press('Tab');}await flow.waitFor();if(!mobile)await page.waitForFunction(()=>document.activeElement?.closest('.dd-flow'));};

   // This App shows its T on its box and in the Keys row.
   await open();
   assert.equal(await pill('app').locator('[data-flow-kbd="t"]').innerText(),'T');
   assert.equal(await pill('app').getAttribute('aria-keyshortcuts'),'T');
   // A phone has no keys to press: the same chips, without the letters.
   assert.match(await flow.locator('[data-flow-quick="keys"] [data-flow-key="t"]').innerText(),mobile?/^This App$/:/T[\s\S]*This App/);
   assert.equal(await flow.locator('[data-flow-quick="recent"]').count(),0,'nowhere to go back to yet');

   if(!mobile){
    // Tab, T: into This App. Tab, 1: back to the Main board.
    await page.keyboard.press('t');await flow.waitFor({state:'detached'});
    await page.waitForFunction(()=>sessionStorage.getItem('debug-day:board-room')==='app');
    await open();
    assert.match(await flow.locator('[data-flow-recent=""]').innerText(),/1[\s\S]*Main board/);
    await page.keyboard.press('1');await flow.waitFor({state:'detached'});
    await page.waitForFunction(()=>!sessionStorage.getItem('debug-day:board-room'));

    // Alt+W on Work gives it W at once; the flowchart stays open.
    await open();
    await pill('work').focus();await page.keyboard.press('Alt+w');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find((i)=>i.id==='work').key==='w');
    await pill('work').locator('[data-flow-kbd="w"]').waitFor();
    assert.match(await flow.locator('[data-flow-recent="app"]').innerText(),/1[\s\S]*This App/,'1 now goes back to This App');
   }

   if(mobile){
    // A tap on a chip goes in, like the letter, and the way back is a chip too.
    await tap(flow.locator('[data-flow-key="t"]'));await flow.waitFor({state:'detached'});
    await page.waitForFunction(()=>sessionStorage.getItem('debug-day:board-room')==='app');
    await open();
    await tap(flow.locator('[data-flow-recent=""]'));await flow.waitFor({state:'detached'});
    await page.waitForFunction(()=>!sessionStorage.getItem('debug-day:board-room'));
    await open();
    await pill('home').dispatchEvent('contextmenu');
    await flow.locator('.dd-flow-menu').waitFor();
    assert.equal(await flow.locator('[data-flow-key-set]').count(),0,'no key to ask for without a keyboard');
   }else{
   // The menu asks for a key: the next letter is Home's, H.
   const menuFor=async(id)=>{if(mobile)await pill(id).dispatchEvent('contextmenu');else await pill(id).click({button:'right'});const menu=flow.locator('.dd-flow-menu');await menu.waitFor();return menu;};
   let menu=await menuFor('home');
   await tap(menu.locator('[data-flow-key-set="home"]'));
   await flow.locator('[data-flow-keying="home"]').waitFor();
   await page.keyboard.press('h');
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find((i)=>i.id==='home').key==='h');
   await flow.locator('[data-flow-keying]').waitFor({state:'detached'});
   assert.equal(await pill('home').locator('[data-flow-kbd="h"]').innerText(),'H');

   // Taking T for Home moves it off This App.
   menu=await menuFor('home');
   assert.match(await menu.locator('[data-flow-key-set="home"]').innerText(),/H/);
   await tap(menu.locator('[data-flow-key-set="home"]'));
   await page.keyboard.press('t');
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find((i)=>i.id==='home').key==='t');
   await pill('app').locator('.dd-flow-kbd').waitFor({state:'detached'});
   // Delete takes it away again, and This App has its T back.
   menu=await menuFor('home');
   await tap(menu.locator('[data-flow-key-set="home"]'));
   await page.keyboard.press('Delete');
   await pill('app').locator('[data-flow-kbd="t"]').waitFor();
   assert.equal(await keyOf('home'),undefined);
   // Esc while waiting changes nothing.
   menu=await menuFor('home');
   await tap(menu.locator('[data-flow-key-set="home"]'));
   await page.keyboard.press('Escape');
   await flow.locator('[data-flow-keying]').waitFor({state:'detached'});
   assert.equal(await flow.count(),1,'Esc only stops waiting');
   assert.equal(await keyOf('home'),undefined);

    // Shift+T: into This App with its Engine over the board.
    await page.keyboard.press('Shift+T');await flow.waitFor({state:'detached'});
    await page.getByRole('dialog',{name:'Engine'}).waitFor();
    assert.equal(await room(),'app');
    await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Engine'}).waitFor({state:'detached'});
    // Tab, W typed in one go: the W reaches the flowchart, not the board's tools.
    await view.focus();await page.keyboard.press('Tab');await page.keyboard.press('w');
    await page.waitForFunction(()=>sessionStorage.getItem('debug-day:board-room')==='work');
    await flow.waitFor({state:'detached'});
    assert.equal(await view.getAttribute('data-tool'),'select');
    // D still closes, and is never a key.
    await open();
    await pill('work').focus();await page.keyboard.press('Alt+d');
    assert.equal(await keyOf('work'),'w');
    await page.keyboard.press('d');await flow.waitFor({state:'detached'});
   }

   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false,'no sideways scroll');
   assert.deepEqual(errors,[]);
   await page.context().close();
   console.log('section keys ok',mobile?'phone':'desktop');
  }
 }finally{await h.stop();}
})().catch((error)=>{console.error(error);process.exit(1);});
