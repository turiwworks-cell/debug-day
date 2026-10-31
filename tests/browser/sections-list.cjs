const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// The Sections list (5.23): Sections, D or Ctrl+Space bring up every section in
// board order, each under its parent, on its family's tint. A subsection shows
// its own shade of the family color until it is given a color of its own. It
// only reads setup.life, so a color or a name changed anywhere shows in the list,
// on the board, on task chips, in the Engine and in Plan.
(async()=>{
 const h=await start(),{DDsectionTint,DDsectionShade}=await import('../../public/life-board.js');
 try {
  for(const [language,mobile] of [['en',false],['fa',false],['fa',true]]){
   console.log('sections list:',language,mobile?'phone':'desktop');
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin),t=(en,fa)=>language==='fa'?fa:en;
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
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    tap=async(locator)=>mobile?locator.tap():locator.click(),
    list=page.locator('.dd-sections'),
    row=(id)=>list.locator(`[data-section-row="${id}"]`),
    name=(id)=>row(id).locator('.dd-sections-name'),
    shown=()=>list.locator('[data-section-row]').evaluateAll((els)=>els.map((el)=>el.dataset.sectionRow)),
    bar=page.locator('.dd-room-bar'),
    focused=()=>page.evaluate(()=>document.activeElement?.closest('[data-section-row]')?.dataset.sectionRow??null),
    focusOn=async(id)=>{await page.waitForFunction((id)=>document.activeElement?.closest('[data-section-row]')?.dataset.sectionRow===id,id,{timeout:3000}).catch(()=>{});assert.equal(await focused(),id);},
    rgb=(hex)=>'rgb('+[1,3,5].map((i)=>parseInt(hex.slice(i,i+2),16)).join(', ')+')',
    node=(id)=>page.locator(`[data-board-id="life:${id}"]`),
    nodeColor=(id)=>node(id).evaluate((el)=>el.style.getPropertyValue('--node-color')),
    lifeItem=async(id)=>(await read()).setup.life.items.find((i)=>i.id===id),
    button=page.locator('[data-sections-button]'),
    open=async()=>{if(!await list.count()){await tap(button);await list.waitFor();}};

   // Ctrl+Space, from Plan: the Sections row comes right after the Engine and opens the Board with the list.
   await page.keyboard.press('Control+Space');
   const modal=page.locator('.dd-command-modal');
   assert.equal(await modal.locator('.dd-panel-row').nth(1).getAttribute('data-panel'),'sections');
   await tap(modal.locator('.dd-panel-row[data-panel="sections"] .dd-command-open'));
   await list.waitFor();
   assert.deepEqual(await shown(),['','a','c','e','d','b','g'],'Main board first, then each section right under its parent, in board order (not the saved order)');
   await tap(list.locator('.dd-sections-close'));await list.waitFor({state:'detached'});

   // Full screen board, mind map.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();
   if((await page.locator('.b2-viewport').getAttribute('data-mode'))!=='mindmap')await page.locator('.b4-modes button').nth(0).click();

   // The toolbar button opens it and the same button closes it.
   await tap(button);await list.waitFor();
   assert.equal(await button.getAttribute('aria-expanded'),'true');
   assert.match(await list.locator('.dd-sections-title').innerText(),new RegExp(t('Sections','سکشن‌ها')));
   assert.match(await row('').innerText(),new RegExp(t('Main board','برد اصلی')+'[\\s\\S]*'+t("You're here",'اینجایی')),'you are on the main board');
   assert.match(await row('c').innerText(),/Sketches[\s\S]*(2|۲)/,'a section shows its note count');
   assert.equal(await row('c').getAttribute('data-depth'),'1');
   assert.equal(await row('e').getAttribute('data-depth'),'2');
   // Each family sits on its own tint; a subsection's swatch is its own shade, not its parent's color.
   const items=f.data.setup.life.items,tintA=DDsectionTint(items,'a'),tintC=DDsectionTint(items,'c');
   assert.match(await row('a').locator('xpath=ancestor::li[contains(@class,"dd-sections-family")]').evaluate((el)=>el.style.getPropertyValue('--dd-family')),new RegExp(tintA.fill,'i'));
   assert.equal(await row('a').locator('.dd-sections-swatch').evaluate((el)=>getComputedStyle(el).backgroundColor),rgb('#9DD6FF'));
   assert.equal(await row('c').locator('.dd-sections-swatch').evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(tintC.fill));
   assert.notEqual(tintC.fill,tintA.fill,'the subsection looks a little different');
   assert.notEqual(tintC.fill,'#D3B8FF','an old color saved on it is not used');
   const panel=await list.boundingBox(),viewport=page.viewportSize();
   if(mobile){
    assert.ok((await name('c').boundingBox()).height>=44,'rows are at least 44px tall on a phone');
    assert.ok(panel.width>=viewport.width-2,'a full-width bottom sheet');
    assert.ok(panel.y+panel.height>=viewport.height-2,'that sits on the bottom edge');
   } else {
    assert.ok(panel.width<=340,'a side panel on desktop');
    if(language==='fa')assert.ok(panel.x<viewport.width/2,'in Persian it sits on the left (the end side)');
    else assert.ok(panel.x>viewport.width/2);
   }
   await tap(button);await list.waitFor({state:'detached'});

   // The D key opens it, ready to type on a desktop; Esc closes it.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('d');await list.waitFor();
   const find=list.getByRole('searchbox',{name:t('Find a section','پیدا کردن سکشن')});
   if(!mobile)assert.equal(await page.evaluate(()=>document.activeElement?.type),'search','the find field has the focus');
   await page.keyboard.press('Escape');await list.waitFor({state:'detached'});

   // Folding hides what is inside and counts it; it is remembered.
   await open();
   await tap(row('a').locator('[data-section-fold="a"]'));
   assert.deepEqual(await shown(),['','a','b','g']);
   assert.match(await row('a').locator('.dd-sections-hidden').innerText(),/\+(3|۳)/);
   assert.equal(await row('a').locator('[data-section-fold]').getAttribute('aria-expanded'),'false');
   assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:sections-folded'))),['a']);
   await tap(row('a').locator('[data-section-fold="a"]'));
   assert.deepEqual(await shown(),['','a','c','e','d','b','g']);

   if(!mobile){
    // Keyboard: arrows move, the back arrow folds or goes up, the forward arrow unfolds, Enter shows, Ctrl+Enter goes in.
    const forward=language==='fa'?'ArrowLeft':'ArrowRight',back=language==='fa'?'ArrowRight':'ArrowLeft';
    await find.focus();await page.keyboard.press('ArrowDown');await focusOn('');
    await page.keyboard.press('ArrowDown');await focusOn('a');
    await page.keyboard.press('ArrowDown');await focusOn('c');
    await page.keyboard.press(back);
    assert.deepEqual(await shown(),['','a','c','d','b','g'],'the back arrow folds');
    await page.keyboard.press(back);await focusOn('a');
    await page.keyboard.press(forward);await focusOn('c');
    await page.keyboard.press(forward);
    assert.deepEqual(await shown(),['','a','c','e','d','b','g'],'the forward arrow unfolds');
    await page.keyboard.press('ArrowDown');await focusOn('e');
    await page.keyboard.press('End');await focusOn('g');
    await page.keyboard.press('Home');await focusOn('');
    await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await focusOn('c');
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('[data-board-id="life:c"]')?.getAttribute('aria-selected')==='true');
    assert.equal(await list.count(),1,'showing a section keeps the list open on a desktop');
    assert.equal(await bar.count(),0,'and stays on the main board');
    await page.keyboard.press('Control+Enter');
    await bar.waitFor();assert.match(await bar.innerText(),/Sketches/,'Ctrl+Enter goes into the section');
    assert.equal(await list.count(),1);
    await row('c').locator('.dd-sections-here').waitFor();
    assert.equal(await row('').locator('.dd-sections-here').count(),0);
    await tap(name(''));await bar.waitFor({state:'detached'});
   }

   // Clicking a name shows it on the board; ↗ goes into its board.
   await open();
   await tap(name('d'));
   if(mobile)await list.waitFor({state:'detached'});
   assert.equal(await bar.count(),0);
   await open();
   if(!mobile)await row('c').hover();
   await tap(row('c').locator('[data-enter-section="c"]'));
   await bar.waitFor();assert.match(await bar.innerText(),/Sketches/);
   assert.equal(await node('e').count(),1,'its own board is open');
   if(mobile)await list.waitFor({state:'detached'});
   await open();
   await row('c').locator('.dd-sections-here').waitFor();
   assert.equal(await row('c').locator('[data-enter-section]').count(),0,'no ↗ on the board you are in');
   await tap(name(''));await bar.waitFor({state:'detached'});

   // Find looks through every level, keeps the parents (dimmed) and marks the words.
   await open();
   await find.fill('hands');
   await page.waitForFunction(()=>document.querySelectorAll('.dd-sections [data-section-row]').length===3);
   assert.deepEqual(await shown(),['a','c','e']);
   assert.match(await row('a').getAttribute('class'),/is-context/);
   assert.equal(await row('e').locator('mark').innerText(),'Hands');
   assert.match(await list.locator('.dd-sections-count').innerText(),/(1|۱)/);
   await find.fill('nothing like it');
   await list.getByText(t('No section matches.','سکشنی پیدا نشد.')).waitFor();
   await find.fill('');
   assert.equal((await shown()).length,7);

   // A subsection can have its own color: palette, custom, or back to the family shade.
   await tap(row('c').locator('[data-section-color="c"]'));
   const colors=list.locator('.dd-sections-colors');await colors.waitFor();
   assert.equal(await colors.locator('[data-color]').count(),10,'eight soft colors, ink black and paper white');
   assert.equal(await colors.locator('[data-family-shade]').getAttribute('aria-pressed'),'true','it shows its family shade now');
   assert.equal(await colors.locator('input[type=color]').count(),1,'and any custom color');
   await tap(colors.locator('[data-color="#FFA799"]'));
   await colors.waitFor({state:'detached'});
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find(i=>i.id==='c').ownColor===true);
   assert.equal((await lifeItem('c')).color,'#FFA799');
   assert.equal(await row('c').locator('.dd-sections-swatch').evaluate((el)=>getComputedStyle(el).backgroundColor),rgb('#FFA799'));
   if(mobile){await tap(list.locator('.dd-sections-close'));await list.waitFor({state:'detached'});}
   await page.locator('[data-life-jump]').click();await page.waitForTimeout(300);
   await page.waitForFunction(()=>document.querySelector('[data-board-id="life:c"]')?.style.getPropertyValue('--node-color')==='#FFA799');
   assert.equal(await nodeColor('e'),DDsectionShade('#FFA799','e'),'its children take shades of the new color');
   const chip=page.locator('.dd-task-from[data-from="c"]');
   await chip.first().waitFor({state:'attached'});
   assert.match(await chip.first().innerText(),/Creative life › Sketches/);
   assert.equal(await chip.first().evaluate((el)=>getComputedStyle(el).backgroundColor),rgb('#FFA799'),'the task chip wears it too');
   // A custom color, from the color picker.
   await open();
   await tap(row('d').locator('[data-section-color="d"]'));
   await colors.waitFor();
   await colors.locator('input[type=color]').evaluate((el)=>{el.value='#7a5ff5';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find(i=>i.id==='d').color==='#7A5FF5');
   assert.equal((await lifeItem('d')).ownColor,true);
   // Back to the family shade.
   await tap(row('c').locator('[data-section-color="c"]'));
   await colors.waitFor();
   assert.equal(await colors.locator('[data-color="#FFA799"]').getAttribute('aria-pressed'),'true');
   await tap(colors.locator('[data-family-shade="c"]'));
   await page.waitForFunction(()=>!JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find(i=>i.id==='c').ownColor);
   assert.equal(await row('c').locator('.dd-sections-swatch').evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(tintC.fill));
   // A top section's color moves its whole family.
   await tap(row('a').locator('[data-section-color="a"]'));
   await colors.waitFor();
   assert.equal(await colors.locator('[data-family-shade]').count(),0,'a top section has no family shade to go back to');
   await tap(colors.locator('[data-color="#C8E6A0"]'));
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find(i=>i.id==='a').color==='#C8E6A0');
   const after=(await read()).setup.life.items,childFill=DDsectionTint(after,'c').fill;
   assert.equal(childFill,DDsectionShade('#C8E6A0','c'));
   if(mobile){await tap(list.locator('.dd-sections-close'));await list.waitFor({state:'detached'});}
   await page.waitForFunction(([c])=>document.querySelector('[data-board-id="life:c"]')?.style.getPropertyValue('--node-color')===c,[childFill]);
   assert.equal(await chip.first().evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(childFill),'the chip in Mindmap');
   await page.locator('.b4-modes button').nth(1).click();await page.locator('.b2-viewport[data-mode=lanes]').waitFor();
   await chip.first().waitFor({state:'attached'});
   assert.equal(await chip.first().evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(childFill),'the chip in Lanes');
   await page.locator('.b4-modes button').nth(0).click();await page.locator('.b2-viewport[data-mode=mindmap]').waitFor();

   // In the Engine the picker shows the path and the same shade.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('e');
   const engine=page.getByRole('dialog',{name:t('Engine','انجین')});await engine.waitFor();
   const from=engine.locator('[data-engine-task="writing"] select.dd-engine-from');
   assert.match(await from.locator('option:checked').innerText(),/Creative life › Sketches/);
   assert.equal(await from.evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(childFill));
   await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});

   // The Life area tools stay, at the bottom of the list.
   await open();
   const toggle=list.locator('[data-life-tools]');
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   await tap(toggle);
   await list.getByRole('button',{name:t('Enlarge Life area +25%','بزرگ‌تر کردن محدودهٔ زندگی +۲۵٪')}).waitFor();
   await list.getByRole('button',{name:t('Compact layout','جمع‌وجور کن')}).waitFor();
   assert.equal(await list.getByRole('spinbutton',{name:t('Life area width','عرض محدودهٔ زندگی')}).count(),1);
   await tap(list.locator('.dd-sections-close'));await list.waitFor({state:'detached'});

   // Renaming the root in Plan updates the chips and the list at once, without a reload.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor({state:'detached'});
   await page.locator('.views button').nth(0).click();
   const planChip=page.locator('.dd-plan-from[data-from="c"]');
   await planChip.first().waitFor({state:'attached'});
   assert.match(await planChip.first().textContent(),/Creative life › Sketches/,'Plan shows the path');
   assert.equal(await planChip.first().evaluate((el)=>getComputedStyle(el).backgroundColor),rgb(childFill),'in the same shade');
   const fields=page.locator('.dd-plan-life input[aria-label]'),
    field=fields.nth(await fields.evaluateAll((els)=>els.findIndex((el)=>el.value==='Creative life')));
   assert.equal(await field.inputValue(),'Creative life');
   // Plan's cards and Life list are folded away on a phone; type into the same field there.
   if(mobile)await field.evaluate((el)=>{el.value='Studio life';el.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));});
   else{await field.fill('Studio life');await field.press('Tab');}
   await page.waitForFunction(()=>/Studio life › Sketches/.test(document.querySelector('.dd-plan-from[data-from="c"]')?.innerText||''));
   await page.locator('.views button').nth(1).click();
   await chip.first().waitFor({state:'attached'});
   assert.match(await chip.first().innerText(),/Studio life › Sketches/,'the board chip follows the rename');
   await open();
   assert.match(await name('a').innerText(),/Studio life/,'and so does the list');
   await tap(list.locator('.dd-sections-close'));await list.waitFor({state:'detached'});

   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false,'no sideways scroll');
   assert.deepEqual(errors,[]);
   await page.context().close();
  }
  console.log('sections list ok');
 } finally {await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
