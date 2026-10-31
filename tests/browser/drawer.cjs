const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// The Section Drawer (5.21): Sections, D or Ctrl+Space bring up a card file of
// every section. Top sections are colored dividers, the ones inside are cards
// filed behind them. It only reads setup.life, so a color or a name changed
// anywhere shows in the drawer, on the board, on task chips and in Plan.
(async()=>{
 const h=await start(),{DDsectionTint}=await import('../../public/life-board.js');
 try {
  for(const [language,mobile] of [['en',false],['fa',false],['fa',true]]){
   console.log('drawer:',language,mobile?'phone':'desktop');
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin),t=(en,fa)=>language==='fa'?fa:en;
   page.setDefaultTimeout(10000);
   f.data.setup.preferences.language=language;
   f.data.setup.life={v:2,items:[
    {id:'a',type:'section',parent:'',x:40,y:60,w:900,h:620,text:'Creative life',color:'#9DD6FF'},
    {id:'c',type:'section',parent:'a',x:420,y:80,w:420,h:320,text:'Sketches',color:'#D3B8FF'},
    {id:'e',type:'section',parent:'c',x:20,y:60,w:300,h:200,text:'Hands'},
    {id:'d',type:'section',parent:'a',x:40,y:400,w:300,h:200,text:'Colour studies'},
    {id:'n',type:'sticky',parent:'c',x:40,y:90,w:220,h:160,text:'Line study',color:'#A8E6B8'},
    {id:'b',type:'section',parent:'',x:1040,y:60,w:420,h:350,text:'Work & play',color:'#FFA6D9'},
    {id:'g',type:'section',parent:'b',x:20,y:60,w:300,h:200,text:'Clients'}
   ],links:[],frame:{x:24,y:1200}};
   f.data.days[f.date].blocks.find(b=>b.id==='writing').from='c';
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    tap=async(locator)=>mobile?locator.tap():locator.click(),
    drawer=page.locator('.dd-drawer'),
    card=(id)=>drawer.locator(`[data-drawer-card="${id}"]`),
    tab=(id)=>card(id).locator('.dd-drawer-tab'),
    shown=async()=>drawer.locator('[data-drawer-card]').evaluateAll((els)=>els.map((el)=>el.dataset.drawerCard)),
    bar=page.locator('.dd-room-bar'),
    path=drawer.locator('.dd-drawer-path'),
    focused=()=>page.evaluate(()=>document.activeElement?.closest('[data-drawer-card]')?.dataset.drawerCard||null),
    focusOn=async(id)=>{await page.waitForFunction((id)=>document.activeElement?.closest('[data-drawer-card]')?.dataset.drawerCard===id,id,{timeout:3000}).catch(()=>{});assert.equal(await focused(),id);},
    rgb=(hex)=>'rgb('+[1,3,5].map((i)=>parseInt(hex.slice(i,i+2),16)).join(', ')+')',
    button=page.locator('[data-drawer-button]');

   // Ctrl+Space, from Plan: the Sections row comes right after the Engine and opens the Board with the drawer.
   await page.keyboard.press('Control+Space');
   const modal=page.locator('.dd-command-modal');
   assert.equal(await modal.locator('.dd-panel-row').nth(1).getAttribute('data-panel'),'sections');
   await tap(modal.locator('.dd-panel-row[data-panel="sections"] .dd-command-open'));
   await drawer.waitFor();
   await page.locator('.b2.focus-mode').waitFor();// from search the Board opens in full screen (5.23)
   assert.equal(await page.locator('.views button[aria-pressed=true],.views button.on,.views button[aria-selected=true]').first().getAttribute('data-panel').catch(()=>null)??'board','board');
   assert.deepEqual(await shown(),['main','a','c','d','b','g'],'Main board first, then each divider with its cards behind it');
   await page.keyboard.press('Escape');await drawer.waitFor({state:'detached'});

   // Full screen board, mind map.
   if(!await page.locator('.b2.focus-mode').count()){await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+Shift+F');}
   await page.locator('.b2.focus-mode').waitFor();
   if((await page.locator('.b2-viewport').getAttribute('data-mode'))!=='mindmap')await page.locator('.b4-modes button').nth(0).click();

   // The toolbar button opens it and the same button closes it.
   await tap(button);await drawer.waitFor();
   assert.equal(await button.getAttribute('aria-expanded'),'true');
   assert.match(await tab('a').innerText(),/CL[\s\S]*II/,'a divider: initials and its count in Roman numerals');
   assert.match(await tab('b').innerText(),/WP[\s\S]*I/);
   assert.match(await tab('c').innerText(),/01[\s\S]*Sketches/,'a card: its index and name');
   assert.match(await tab('d').innerText(),/02[\s\S]*Colour studies/);
   assert.match(await card('a').locator('.dd-drawer-meta').innerText(),/Creative life/,'the divider card shows the full name');
   assert.match(await tab('main').innerText(),new RegExp(t('Main board','برد اصلی')));
   assert.equal(await drawer.locator('.dd-drawer-label').innerText(),t('Sections','سکشن‌ها'));
   // Three staggered columns: neighbours never share one.
   const lefts=await drawer.locator('.dd-drawer-tab').evaluateAll((els)=>els.map((el)=>Math.round(el.getBoundingClientRect().left+el.offsetWidth/2)));
   for(let i=1;i<lefts.length;i++)assert.ok(Math.abs(lefts[i]-lefts[i-1])>40,'tabs of neighbouring cards sit in different columns');
   const firstTab=await tab('main').boundingBox(),drawerBox=await drawer.boundingBox();
   if(language==='fa')assert.ok(firstTab.x+firstTab.width/2>drawerBox.x+drawerBox.width/2,'in Persian the first column is on the right');
   else assert.ok(firstTab.x+firstTab.width/2<drawerBox.x+drawerBox.width/2);
   if(mobile){
    assert.ok((await tab('c').boundingBox()).height>=44,'tabs are at least 44px tall on a phone');
    assert.ok(drawerBox.width>=380,'a full-width bottom sheet');
   }
   await tap(button);await drawer.waitFor({state:'detached'});

   // The D key opens it, Esc closes it.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('d');await drawer.waitFor();
   await page.waitForFunction(()=>document.activeElement?.closest('[data-drawer-card]'));
   assert.equal(await focused(),'a','the first section card has the focus');
   await page.keyboard.press('Escape');await drawer.waitFor({state:'detached'});

   // Opening a folder re-files the drawer and the path follows.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('d');await drawer.waitFor();
   await tap(tab('a'));
   await drawer.locator('[data-drawer-folder="a"]').waitFor();
   assert.deepEqual(await shown(),['main','c','d']);
   assert.match(await path.innerText(),new RegExp(t('Main board','برد اصلی')+'[\\s\\S]*Creative life'));
   assert.equal(await drawer.locator('.dd-drawer-label').innerText(),'Creative life');
   await tap(tab('c'));
   await drawer.locator('[data-drawer-folder="c"]').waitFor();
   assert.deepEqual(await shown(),['main','e']);
   assert.match(await path.innerText(),/Creative life[\s\S]*Sketches/);
   await tap(path.locator('[data-drawer-crumb="a"]'));
   await drawer.locator('[data-drawer-folder="a"]').waitFor();
   await page.waitForFunction(()=>document.activeElement?.closest('[data-drawer-card]'));
   await page.keyboard.press('Backspace');
   await drawer.locator('[data-drawer-folder="top"]').waitFor();

   // Keyboard: up is further back, the forward arrow opens a folder, the back arrow goes up, Enter enters.
   const forward=language==='fa'?'ArrowLeft':'ArrowRight',back=language==='fa'?'ArrowRight':'ArrowLeft';
   await page.waitForFunction(()=>document.activeElement?.closest('[data-drawer-card]'));
   assert.equal(await focused(),'a');
   await page.keyboard.press('ArrowUp');await focusOn('c');
   await page.keyboard.press('ArrowUp');await focusOn('d');
   await page.keyboard.press('ArrowDown');await focusOn('c');
   await page.keyboard.press('ArrowDown');await focusOn('a');
   await page.keyboard.press('ArrowDown');await focusOn('main');
   await page.keyboard.press('ArrowUp');await focusOn('a');
   await page.keyboard.press(forward);
   await drawer.locator('[data-drawer-folder="a"]').waitFor();
   await focusOn('c');
   await page.keyboard.press(back);
   await drawer.locator('[data-drawer-folder="top"]').waitFor();
   await page.waitForFunction(()=>document.activeElement?.closest('[data-drawer-card="a"]'));
   await page.keyboard.press('Enter');
   await drawer.waitFor({state:'detached'});
   await bar.waitFor();assert.match(await bar.innerText(),/Creative life/,'Enter goes into the section');

   // Main board leaves the section.
   await tap(button);await drawer.waitFor();
   await tap(tab('main'));
   await drawer.waitFor({state:'detached'});await bar.waitFor({state:'detached'});

   // The ↗ button enters a section, even one that has children.
   await tap(button);await drawer.waitFor();
   if(!mobile)await tab('c').hover();
   await tap(card('c').locator('[data-drawer-open="c"]'));
   await bar.waitFor();assert.match(await bar.innerText(),/Sketches/);
   assert.equal(await page.locator('[data-board-id="life:e"]').count(),1,'its own board is open');

   // Find looks through every level, shows the path, and Enter opens the first match.
   await tap(button);await drawer.waitFor();
   const find=drawer.getByRole('searchbox',{name:t('Find a section','پیدا کردن سکشن')});
   assert.equal(await find.getAttribute('placeholder'),t('Find a section…','پیدا کردن سکشن…'));
   await find.fill('hands');
   await page.waitForFunction(()=>document.querySelectorAll('.dd-drawer [data-drawer-card]').length===2);
   assert.deepEqual(await shown(),['main','e']);
   assert.match(await card('e').locator('.dd-drawer-meta').innerText(),/Creative life › … › Hands/,'a long path keeps its first and last parts');
   await find.press('Enter');
   await drawer.waitFor({state:'detached'});
   await page.waitForFunction(()=>/Hands/.test(document.querySelector('.dd-room-bar')?.innerText||''));
   await tap(bar.locator('[data-room-crumb="main"]'));await bar.waitFor({state:'detached'});

   // The task chip shows the whole path in the root's tint.
   const chip=page.locator('.dd-task-from[data-from="c"]');
   await chip.first().waitFor({state:'attached'});
   assert.match(await chip.first().innerText(),/Creative life › Sketches/);
   assert.equal(await chip.first().getAttribute('aria-label'),t('Came from ','آمده از ')+'Creative life › Sketches');
   // A child section wears its root's color, not its own old one.
   const node=(id)=>page.locator(`[data-board-id="life:${id}"]`),
    nodeColor=(id)=>node(id).evaluate((el)=>el.style.getPropertyValue('--node-color'));
   await page.locator('[data-life-jump]').click();await page.waitForTimeout(300);
   assert.equal(await nodeColor('c'),DDsectionTint(f.data.setup.life.items,'c').fill);
   assert.notEqual(await nodeColor('c'),'#D3B8FF');

   // Right-click (or a long press on a phone) on a divider colors that top section everywhere.
   await tap(button);await drawer.waitFor();
   if(mobile){await tab('a').dispatchEvent('pointerdown',{pointerType:'touch',button:0,isPrimary:true});await page.waitForTimeout(650);await tab('a').dispatchEvent('pointerup',{pointerType:'touch'});}
   else await tab('a').click({button:'right'});
   const palette=drawer.locator('.dd-drawer-palette');await palette.waitFor();
   assert.equal(await palette.locator('button').count(),10,'eight soft colors, ink black and paper white');
   if(!mobile){
    await tab('c').click({button:'right'});
    assert.equal(await palette.count(),0,'a card inside has no color of its own');
    await tab('a').click({button:'right'});await palette.waitFor();
   }
   await tap(palette.locator('[data-color="#FFA799"]'));
   await palette.waitFor({state:'detached'});
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find(i=>i.id==='a').color==='#FFA799');
   const items=(await read()).setup.life.items,root=DDsectionTint(items,'a'),child=DDsectionTint(items,'c');
   assert.equal(items.find(i=>i.id==='c').color,'#D3B8FF','the child keeps its stored color');
   assert.equal(await card('a').locator('.dd-drawer-tab-fill').evaluate((el)=>el.style.fill),rgb('#FFA799'),'the drawer tab');
   await page.keyboard.press('Escape');await drawer.waitFor({state:'detached'});
   await page.waitForFunction(([c])=>document.querySelector('[data-board-id="life:a"]')?.style.getPropertyValue('--node-color')===c,[root.fill]);
   assert.equal(await nodeColor('c'),child.fill,'the child frame follows its root');
   assert.equal(await chip.first().evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(child.fill),'the chip in Mindmap');
   await page.locator('.b4-modes button').nth(1).click();await page.locator('.b2-viewport[data-mode=lanes]').waitFor();
   await chip.first().waitFor({state:'attached'});
   assert.equal(await chip.first().evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(child.fill),'the chip in Lanes');
   assert.match(await chip.first().innerText(),/Creative life › Sketches/);
   await page.locator('.b4-modes button').nth(0).click();await page.locator('.b2-viewport[data-mode=mindmap]').waitFor();

   // In the Engine the picker shows the path and the tint too.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('e');
   const engine=page.getByRole('dialog',{name:t('Engine','انجین')});await engine.waitFor();
   const from=engine.locator('[data-engine-task="writing"] select.dd-engine-from');
   assert.match(await from.locator('option:checked').innerText(),/Creative life › Sketches/);
   assert.equal(await from.evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(child.fill));
   await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});

   // Renaming the root in Plan updates every chip at once, without a reload.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor({state:'detached'});
   await page.locator('.views button').nth(0).click();
   const planChip=page.locator('.dd-plan-from[data-from="c"]');
   await planChip.first().waitFor({state:'attached'});
   assert.match(await planChip.first().textContent(),/Creative life › Sketches/,'Plan shows the path');
   assert.equal(await planChip.first().evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(child.fill),'in the same tint');
   const name=page.locator('.dd-plan-life input[aria-label]').first();
   assert.equal(await name.inputValue(),'Creative life');
   // Plan's cards and Life list are folded away on a phone; type into the same field there.
   if(mobile)await name.evaluate((el)=>{el.value='Studio life';el.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));});
   else{await name.fill('Studio life');await name.press('Tab');}
   await page.waitForFunction(()=>/Studio life › Sketches/.test(document.querySelector('.dd-plan-from[data-from="c"]')?.innerText||''));
   await page.locator('.views button').nth(1).click();
   await chip.first().waitFor({state:'attached'});
   assert.match(await chip.first().innerText(),/Studio life › Sketches/,'the board chip follows the rename');
   await tap(button);await drawer.waitFor();
   assert.match(await card('a').locator('.dd-drawer-meta').innerText(),/Studio life/,'and so does the drawer');
   assert.match(await tab('a').innerText(),/SL/);
   await page.keyboard.press('Escape');await drawer.waitFor({state:'detached'});

   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false,'no sideways scroll');
   assert.deepEqual(errors,[]);
   await page.context().close();
  }
  console.log('drawer ok');
 } finally {await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
