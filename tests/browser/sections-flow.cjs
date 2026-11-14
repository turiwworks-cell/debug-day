const assert=require('node:assert/strict');
const {start,fixture,openEngine}=require('./harness.cjs');
// The Sections flowchart (5.28), like After Effects' Tab flowchart: Tab, D, the
// Sections button or Ctrl+Space bring up every section at once, Main board on the
// start side and each section branching off its parent. The board you are in is
// blue and so is the way to it. A click goes into a section; Shift+click or the
// right-click menu shows it on the board and gives it a color. It only reads
// setup.life, so a color or a name changed anywhere shows here, on the board, on
// task chips, in the Engine and in Plan.
(async()=>{
 const h=await start(),{DDsectionTint,DDsectionShade}=await import('../../public/life-board.js');
 try {
  for(const [language,mobile] of [['en',false],['en',true]]){
   console.log('sections flowchart:',language,mobile?'phone':'desktop');
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin),t=(en,fa)=>language==='fa'?fa:en,rtl=language==='fa';
   page.setDefaultTimeout(10000);
   f.data.setup.preferences.language=language;
   f.data.setup.life={v:2,items:[
    {id:'b',type:'section',parent:'',x:1040,y:60,w:420,h:350,text:'Work & play',color:'#FFA6D9'},
    {id:'c',type:'section',parent:'a',x:420,y:80,w:420,h:320,text:'Sketches',color:'#D3B8FF'},
    {id:'a',type:'section',parent:'',x:40,y:60,w:900,h:620,text:'Creative life',color:'#9DD6FF'},
    {id:'e',type:'section',parent:'c',x:20,y:60,w:300,h:200,text:'Hands'},
    {id:'d',type:'section',parent:'a',x:40,y:400,w:300,h:200,text:'Colour studies'},
    {id:'n',type:'sticky',parent:'c',x:40,y:90,w:220,h:160,text:'Line study',color:'#A8E6B8'},
    {id:'n2',type:'sticky',parent:'c',x:280,y:90,w:220,h:160,text:'Gesture',color:'#A8E6B8'},
    {id:'g',type:'section',parent:'b',x:20,y:60,w:300,h:200,text:'Clients'}
   ],links:[],frame:{x:24,y:1200}};
   f.data.days[f.date].blocks.find(b=>b.id==='writing').from='c';
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('.views',{state:'attached'});
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    tap=async(locator)=>mobile?locator.tap():locator.click(),
    flow=page.locator('.dd-flow'),
    box=(id)=>flow.locator(`[data-flow-node="${id}"]`),
    pill=(id)=>box(id).locator('.dd-flow-pill'),
    shown=()=>flow.locator('[data-flow-node]:not(.is-capture)').evaluateAll((els)=>els.map((el)=>el.dataset.flowNode)),
    links=()=>flow.locator('[data-flow-link]').evaluateAll((els)=>els.map((el)=>el.dataset.flowLink)),
    marked=(cls)=>flow.locator('[data-flow-node].'+cls).evaluateAll((els)=>els.map((el)=>el.dataset.flowNode)),
    bar=page.locator('.dd-room-bar'),
    focused=()=>page.evaluate(()=>document.activeElement?.closest('[data-flow-node]')?.dataset.flowNode??null),
    focusOn=async(id)=>{await page.waitForFunction((id)=>document.activeElement?.closest('[data-flow-node]')?.dataset.flowNode===id,id,{timeout:3000}).catch(()=>{});assert.equal(await focused(),id);},
    rgb=(hex)=>'rgb('+[1,3,5].map((i)=>parseInt(hex.slice(i,i+2),16)).join(', ')+')',
    dot=(id)=>box(id).locator('.dd-flow-dot').evaluate((el)=>getComputedStyle(el).backgroundColor),
    node=(id)=>page.locator(`[data-board-id="life:${id}"]`),
    nodeColor=(id)=>node(id).evaluate((el)=>el.style.getPropertyValue('--node-color')),
    lifeItem=async(id)=>(await read()).setup.life.items.find((i)=>i.id===id),
    button=page.locator('[data-sections-button]'),
    close=async()=>{if(await flow.count()){await tap(flow.locator('.dd-flow-close'));await flow.waitFor({state:'detached'});}},
    open=async()=>{if(!await flow.count()){await tap(button);await flow.waitFor();}},
    menuFor=async(id)=>{if(mobile)await pill(id).dispatchEvent('contextmenu');else await pill(id).click({button:'right'});const menu=flow.locator('.dd-flow-menu');await menu.waitFor();return menu;};

   // Ctrl+Space, from Plan: the Sections row comes right after the Engine and opens the Board with the flowchart.
   await page.keyboard.press('Control+Space');
   const modal=page.locator('.dd-command-modal');
   assert.equal(await modal.locator('.dd-panel-row').nth(1).getAttribute('data-panel'),'sections');
   await tap(modal.locator('.dd-panel-row[data-panel="sections"] .dd-command-open'));
   await flow.waitFor();
   await page.locator('.b2.focus-mode').waitFor();// from search the Board opens in full screen (5.23)
   assert.deepEqual(await shown(),['','a','c','e','d','b','g'],'Main board first, then each section after its parent, in board order (not the saved order)');
   assert.deepEqual(await links(),['>a','a>c','c>e','a>d','>b','b>g'],'a line from each parent to each section inside it');
   await close();

   // Full screen board, mind map.
   if(!await page.locator('.b2.focus-mode').count()){await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+Shift+F');}
   await page.locator('.b2.focus-mode').waitFor();
   if((await page.locator('.b2-viewport').getAttribute('data-mode'))!=='mindmap')await page.locator('.b4-modes button').nth(0).click();

   // The toolbar button opens it and the same button closes it.
   await tap(button);await flow.waitFor();
   assert.equal(await button.getAttribute('aria-expanded'),'true');
   assert.equal(await flow.getAttribute('aria-label'),t('Sections flowchart','فلوچارت سکشن‌ها'));
   assert.match(await pill('').innerText(),new RegExp(t('Main board','برد اصلی')));
   assert.deepEqual(await marked('is-here'),[''],'you are on the main board, and it is blue');
   assert.equal(await pill('').getAttribute('aria-current'),'location');
   assert.equal(await pill('').evaluate((el)=>getComputedStyle(el).backgroundColor),'rgb(35, 103, 209)');
   assert.match(await pill('c').innerText(),/Sketches[\s\S]*(2|۲)/,'a section shows its note count');
   assert.equal(await box('c').getAttribute('data-depth'),'2');
   assert.equal(await box('e').getAttribute('data-depth'),'3');
   // Children sit on the far side of their parent, each level a column, lines between them.
   const [ba,bc,bd,be]=await Promise.all(['a','c','d','e'].map((id)=>box(id).boundingBox()));
   if(rtl)assert.ok(bc.x+bc.width<ba.x-30&&be.x+be.width<bc.x-30,'in Persian the flowchart runs right to left');
   else assert.ok(bc.x>ba.x+ba.width+30&&be.x>bc.x+bc.width+30,'sections branch to the right');
   assert.ok(rtl?Math.abs(bc.x+bc.width-bd.x-bd.width)<1:Math.abs(bc.x-bd.x)<1,'siblings share a column, lined up on the start side');
   assert.ok(Math.abs((ba.y+ba.height/2)-((bc.y+bd.y)/2+bc.height/2))<1.5,'a parent sits in the middle of its children');
   assert.equal(await flow.locator('[data-flow-link="a>c"] .dd-flow-arrow').count(),1,'each line has an arrow');
   assert.equal(await box('e').locator('.dd-flow-end').count(),1,'a section with nothing inside ends in a ⊣');
   // Each pill's dot wears its section's tint; a subsection's is its own shade, not its parent's color.
   const items=f.data.setup.life.items,tintC=DDsectionTint(items,'c');
   assert.equal(await dot('a'),rgb('#9DD6FF'));
   assert.equal(await dot('c'),rgb(tintC.fill));
   assert.notEqual(tintC.fill,'#9DD6FF','the subsection looks a little different');
   assert.notEqual(tintC.fill,'#D3B8FF','an old color saved on it is not used');
   const panel=await flow.boundingBox(),viewport=page.viewportSize();
   if(mobile){
    assert.ok((await pill('c').boundingBox()).height>=44,'pills are at least 44px tall on a phone');
    assert.ok((await box('a').locator('.dd-flow-fold').boundingBox()).width>=26,'and the fold toggles are easy to hit');
    assert.ok(panel.width>=viewport.width-2,'a full-width bottom sheet');
    // The phone tabs stay under a full screen board (5.41), so the sheet sits on the board's bottom edge.
    const boardBox=await page.locator('.b2').boundingBox();
    assert.ok(panel.y+panel.height>=boardBox.y+boardBox.height-2,'that sits on the bottom edge');
   } else {
    const room=await page.locator('.dd-flow-backdrop').boundingBox();
    assert.ok(Math.abs(panel.x+panel.width/2-room.x-room.width/2)<4,'on a desktop it comes up in the middle of the board');
    assert.ok(panel.y<viewport.height/3,'near the top');
   }
   await tap(button);await flow.waitFor({state:'detached'});

   if(!mobile){
    // Tab on the canvas brings it up, like After Effects, with the board you are in focused; Tab again puts it away.
    await page.locator('.b2-viewport').focus();await page.keyboard.press('Tab');await flow.waitFor();
    await focusOn('');
    await page.keyboard.press('Tab');await flow.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('b2-viewport')),true,'focus goes back to the board');
    // Tab on a section of the board too.
    await node('a').focus();await page.keyboard.press('Tab');await flow.waitFor();
    await page.keyboard.press('Escape');await flow.waitFor({state:'detached'});
    // Tab on a toolbar button still moves to the next button.
    await page.locator('[data-life-jump]').focus();await page.keyboard.press('Tab');
    assert.equal(await flow.count(),0,'Tab still walks through the toolbar');
   }
   // D opens it too; Esc closes it.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('d');await flow.waitFor();
   const find=flow.getByRole('searchbox',{name:t('Find a section','پیدا کردن سکشن')});
   assert.equal(await find.inputValue(),'','D does not type into the find field');
   await page.keyboard.press('Escape');await flow.waitFor({state:'detached'});

   // Folding hides what is inside and counts it; it is remembered.
   await open();
   await tap(flow.locator('[data-flow-fold="a"]'));
   assert.deepEqual(await shown(),['','a','b','g']);
   assert.match(await box('a').locator('.dd-flow-hidden').innerText(),/\+(3|۳)/);
   assert.equal(await pill('a').getAttribute('aria-expanded'),'false');
   assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:sections-folded'))),['a']);
   await close();await open();
   assert.deepEqual(await shown(),['','a','b','g'],'still folded the next time');
   await tap(flow.locator('[data-flow-fold="a"]'));
   assert.deepEqual(await shown(),['','a','c','e','d','b','g']);

   if(!mobile){
    // Keyboard: the arrows follow the lines, up and down stay in a column, the back arrow folds or goes up.
    const forward=rtl?'ArrowLeft':'ArrowRight',back=rtl?'ArrowRight':'ArrowLeft';
    await close();await open();await focusOn('');
    await page.keyboard.press(forward);await focusOn('a');
    await page.keyboard.press(forward);await focusOn('c');
    await page.keyboard.press('ArrowDown');await focusOn('d');
    await page.keyboard.press('ArrowUp');await focusOn('c');
    await page.keyboard.press(back);
    assert.deepEqual(await shown(),['','a','c','d','b','g'],'the back arrow folds');
    await page.keyboard.press(back);await focusOn('a');
    await page.keyboard.press(forward);await focusOn('c');
    await page.keyboard.press(forward);
    assert.deepEqual(await shown(),['','a','c','e','d','b','g'],'the forward arrow unfolds');
    await page.keyboard.press(forward);await focusOn('e');
    await page.keyboard.press('Home');await focusOn('');
    // Shift+Enter shows a section on the board; Enter goes into it.
    await page.keyboard.press(forward);await page.keyboard.press(forward);await focusOn('c');
    await page.keyboard.press('Shift+Enter');await flow.waitFor({state:'detached'});
    await page.waitForFunction(()=>document.querySelector('[data-board-id="life:c"]')?.getAttribute('aria-selected')==='true');
    assert.equal(await bar.count(),0,'showing stays on the main board');
    await open();await focusOn('');
    await page.keyboard.press(forward);await page.keyboard.press(forward);
    await page.keyboard.press('Enter');await flow.waitFor({state:'detached'});
    await bar.waitFor();assert.match(await bar.innerText(),/Sketches/,'Enter goes into the section');
    await open();
    assert.deepEqual(await marked('is-here'),['c'],'now Sketches is blue');
    assert.deepEqual(await marked('is-trail'),['','a','c'],'and so is the way to it');
    assert.match(await flow.locator('[data-flow-link="a>c"]').getAttribute('class'),/is-trail/);
    assert.doesNotMatch(await flow.locator('[data-flow-link="a>d"]').getAttribute('class'),/is-trail/);
    await focusOn('c');
    await page.keyboard.press('Home');await page.keyboard.press('Enter');await bar.waitFor({state:'detached'});
    // Shift+click shows a section on the board.
    await open();await pill('d').click({modifiers:['Shift']});await flow.waitFor({state:'detached'});
    await page.waitForFunction(()=>document.querySelector('[data-board-id="life:d"]')?.getAttribute('aria-selected')==='true');
    assert.equal(await bar.count(),0);
   } else {
    // On a phone the long-press menu shows a section on the board.
    await (await menuFor('d')).locator('[data-flow-show="d"]').tap();await flow.waitFor({state:'detached'});
    await page.waitForFunction(()=>document.querySelector('[data-board-id="life:d"]')?.getAttribute('aria-selected')==='true');
    assert.equal(await bar.count(),0);
   }

   // A click goes into a section's board, and closes the flowchart.
   await open();
   await tap(pill('c'));await flow.waitFor({state:'detached'});
   await bar.waitFor();assert.match(await bar.innerText(),/Sketches/);
   assert.equal(await node('e').count(),1,'its own board is open');
   await open();
   assert.deepEqual(await marked('is-here'),['c']);
   await tap(pill(''));await bar.waitFor({state:'detached'});
   // The menu can open a board too.
   await open();
   await (await menuFor('g')).locator('[data-flow-open="g"]').click();
   await bar.waitFor();assert.match(await bar.innerText(),/Clients/);
   await open();await tap(pill(''));await bar.waitFor({state:'detached'});

   // Find looks through every level, dims the rest and marks the words.
   await open();
   await find.fill('hands');
   await page.waitForFunction(()=>document.querySelectorAll('.dd-flow [data-flow-node].is-found').length===1);
   assert.deepEqual(await marked('is-found'),['e']);
   assert.deepEqual(await marked('is-dim'),['','a','c','d','b','g','lf-inbox'],'Capture dims too');
   assert.equal(await box('e').locator('mark').innerText(),'Hands');
   assert.match(await flow.locator('.dd-flow-count').innerText(),/(1|۱)/);
   await find.fill('nothing like it');
   await flow.getByText(t('No section matches.','سکشنی پیدا نشد.')).waitFor();
   await find.fill('clie');
   if(!mobile){
    await find.press('Enter');await flow.waitFor({state:'detached'});
    await bar.waitFor();assert.match(await bar.innerText(),/Clients/,'Enter in the find field goes into the first match');
    await open();await tap(pill(''));await bar.waitFor({state:'detached'});await open();
   }
   await find.fill('');
   assert.equal((await marked('is-dim')).length,0);

   // A subsection can have its own color: palette, custom, or back to the family shade.
   let menu=await menuFor('c');
   assert.equal(await menu.locator('[data-color]').count(),10,'eight soft colors, ink black and paper white');
   assert.equal(await menu.locator('[data-family-shade]').getAttribute('aria-pressed'),'true','it shows its family shade now');
   assert.equal(await menu.locator('input[type=color]').count(),1,'and any custom color');
   await tap(menu.locator('[data-color="#FFA799"]'));
   await menu.waitFor({state:'detached'});
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find(i=>i.id==='c').ownColor===true);
   assert.equal((await lifeItem('c')).color,'#FFA799');
   assert.equal(await dot('c'),rgb('#FFA799'));
   assert.equal(await flow.count(),1,'picking a color keeps the flowchart open');
   await close();
   await page.locator('[data-life-jump]').click();await page.waitForTimeout(300);
   await page.waitForFunction(()=>document.querySelector('[data-board-id="life:c"]')?.style.getPropertyValue('--node-color')==='#FFA799');
   assert.equal(await nodeColor('e'),DDsectionShade('#FFA799','e'),'its children take shades of the new color');
   const chip=page.locator('.dd-task-from[data-from="c"]');
   await chip.first().waitFor({state:'attached'});
   assert.match(await chip.first().innerText(),/Creative life › Sketches/);
   assert.equal(await chip.first().evaluate((el)=>getComputedStyle(el).backgroundColor),rgb('#FFA799'),'the task chip wears it too');
   // A custom color, from the color picker.
   await open();
   menu=await menuFor('d');
   await menu.locator('input[type=color]').evaluate((el)=>{el.value='#7a5ff5';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find(i=>i.id==='d').color==='#7A5FF5');
   assert.equal((await lifeItem('d')).ownColor,true);
   assert.equal(await dot('d'),rgb('#7A5FF5'));
   // Back to the family shade.
   menu=await menuFor('c');
   assert.equal(await menu.locator('[data-color="#FFA799"]').getAttribute('aria-checked'),'true');
   await tap(menu.locator('[data-family-shade="c"]'));
   await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find(i=>i.id==='c').ownColor);
   assert.equal(await dot('c'),rgb(tintC.fill));
   // A top section's color moves its whole family.
   menu=await menuFor('a');
   assert.equal(await menu.locator('[data-family-shade]').count(),0,'a top section has no family shade to go back to');
   if(!mobile){await page.keyboard.press('Escape');await menu.waitFor({state:'detached'});assert.equal(await flow.count(),1,'Esc closes the menu first');menu=await menuFor('a');}
   await tap(menu.locator('[data-color="#C8E6A0"]'));
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find(i=>i.id==='a').color==='#C8E6A0');
   const after=(await read()).setup.life.items,childFill=DDsectionTint(after,'c').fill;
   assert.equal(childFill,DDsectionShade('#C8E6A0','c'));
   assert.equal(await dot('c'),rgb(childFill));
   await close();
   await page.waitForFunction(([c])=>document.querySelector('[data-board-id="life:c"]')?.style.getPropertyValue('--node-color')===c,[childFill]);
   assert.equal(await chip.first().evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(childFill),'the chip in Mindmap');
   await page.locator('.b4-modes button').nth(1).click();await page.locator('.b2-viewport[data-mode=lanes]').waitFor();
   await chip.first().waitFor({state:'attached'});
   assert.equal(await chip.first().evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(childFill),'the chip in Lanes');
   await open();
   assert.equal(await dot('c'),rgb(childFill),'the flowchart in Lanes reads the same colors');
   await close();
   await page.locator('.b4-modes button').nth(0).click();await page.locator('.b2-viewport[data-mode=mindmap]').waitFor();

   // In the Engine the picker shows the path and the same shade.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('e');
   const engine=page.getByRole('dialog',{name:t('Engine','انجین')});await engine.waitFor();
   // The tag on the row reads the same path; the picker sits behind ⋯.
   assert.match(await engine.locator('[data-engine-task="writing"] .dd-engine-tag').innerText(),/Sketches/);
   await tap(engine.locator('[data-engine-task="writing"] .dd-engine-more'));
   const from=engine.locator('[data-engine-task="writing"] select.dd-engine-from');
   assert.match(await from.locator('option:checked').innerText(),/Creative life › Sketches/);
   assert.equal(await from.evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(childFill));
   await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});

   // The Feed tools stay, behind the ≡ button.
   await open();
   const toggle=flow.locator('[data-life-tools]');
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   await tap(toggle);
   await flow.getByRole('button',{name:t('Enlarge Feed +25%','بزرگ‌تر کردن فید +۲۵٪')}).waitFor();
   await flow.getByRole('button',{name:t('Compact layout','جمع‌وجور کن')}).waitFor();
   const width=flow.getByRole('spinbutton',{name:t('Feed width','عرض فید')});
   const before=Number(await width.inputValue());
   await tap(flow.getByRole('button',{name:t('Enlarge Feed +25%','بزرگ‌تر کردن فید +۲۵٪')}));
   await page.waitForFunction((b)=>Number(document.querySelector('.dd-flow [aria-label] input[type=number], .dd-flow input[type=number]')?.value)>b,before);
   await close();

   // Renaming the root on the board updates the Engine's tags, the board chip and the flowchart
   // at once, without a reload. (The Engine does not list the Feed itself, 5.28.)
   await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor({state:'detached'});
   await openEngine(page);
   const planChip=page.locator('.dd-engine .dd-engine-tag[data-from="c"]');
   await planChip.first().waitFor({state:'attached'});
   assert.match(await planChip.first().textContent(),/Creative life › Sketches/,'Plan shows the path');
   assert.equal(await planChip.first().evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(childFill),'in the same shade');
   assert.equal(await page.locator('.dd-plan-life').count(),0,'the Feed is not listed in the Engine');
   await page.keyboard.press('Escape');await page.locator('.dd-engine').waitFor({state:'detached'});
   const rootNode=page.locator('[data-board-id="life:a"]');
   await rootNode.focus();await page.keyboard.press('Enter');
   const field=rootNode.locator('.b4-node-body input');
   assert.equal(await field.inputValue(),'Creative life');
   await field.fill('Studio life');await field.press('Enter');
   await openEngine(page);
   await page.waitForFunction(()=>/Studio life › Sketches/.test(document.querySelector('.dd-engine .dd-engine-tag[data-from="c"]')?.innerText||''));
   await page.keyboard.press('Escape');await page.locator('.dd-engine').waitFor({state:'detached'});
   await chip.first().waitFor({state:'attached'});
   assert.match(await chip.first().innerText(),/Studio life › Sketches/,'the board chip follows the rename');
   await open();
   assert.match(await pill('a').innerText(),/Studio life/,'and so does the flowchart');
   await close();

   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false,'no sideways scroll');
   assert.deepEqual(errors,[]);
   await page.context().close();
  }
  console.log('sections flowchart ok');
 } finally {await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
