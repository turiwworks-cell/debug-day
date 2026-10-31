const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
(async()=>{const h=await start();try{for(const [language,mobile] of [['en',false],['fa',false],['en',true],['fa',true]]){
 const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin);page.setDefaultTimeout(8000);
 f.data.setup.preferences={...f.data.setup.preferences,language,boardRailGoal:false,boardRailNote:false,boardRailHabits:false};
 f.data.days[f.date].notes[0].text='Draw';f.data.days[f.date].canvas={board4:{camera:{x:200,y:260,z:1},styles:{}}};
 f.data.setup.life={items:[{id:'section',type:'section',x:0,y:0,w:400,h:300,text:'Art'},{id:'long',type:'sticky',parent:'section',x:20,y:80,w:240,h:40,text:Array(35).fill('A long note that must show every word.').join('\n')}],frame:{x:100,y:1200},links:[]};
 await page.evaluate(d=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);await page.reload();await page.waitForSelector('#qa',{state:'attached'});await page.locator('.views button').nth(1).click();
 const canvas=page.locator('.b2-viewport'),note=page.locator('[data-board-id="sticky:note"]'),read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')));
 await canvas.focus();await page.keyboard.press('Control+Shift+F');await canvas.focus();await page.keyboard.press('0');await note.focus();
 const long=page.locator('[data-board-id="life:long"]');await page.waitForFunction(()=>document.querySelector('[data-board-id="life:long"]').offsetHeight>800);
 assert.equal(await long.locator('.dd-note-preview').evaluate(e=>getComputedStyle(e).overflowY),'visible');
 assert.equal(await note.locator('[data-edge="n"],[data-edge="s"]').count(),0);
 assert.match(await note.locator('time').getAttribute('datetime'),/^\d{4}-\d{2}-\d{2}$/);
 assert.equal(await long.locator('time').count(),0,'old Life notes have no invented date');
 // Outside typing, note styling is in ⋯ › Text style; while typing it sits in the bar.
 assert.equal(await page.locator('.b4-selectionbar [data-note-format]').count(),0);
 const textStyle=async(en,fa)=>{await page.locator('.b4-selectionbar').getByRole('button',{name:language==='fa'?'گزینه‌های بیشتر':'More actions',exact:true}).click();await page.getByRole('menuitem',{name:language==='fa'?'سبک متن':'Text style',exact:true}).click();await page.getByRole('menuitem',{name:language==='fa'?fa:en,exact:true}).click();};
 await textStyle('Bold','پررنگ');assert.equal((await read()).days[f.date].notes[0].text,'**Draw**');await note.locator('strong').waitFor();
 await textStyle('Strikethrough','خط‌خورده');await note.locator('s').waitFor();
 await textStyle('To-do','کار');await note.locator('input[type=checkbox]').check();assert.match((await read()).days[f.date].notes[0].text,/- \[x\]/);assert.equal(await note.locator('textarea').count(),0);
 await note.focus();await page.keyboard.press('Enter');const input=note.locator('textarea');await input.fill('Editable');await input.selectText();await page.keyboard.press('Control+b');assert.equal(await input.inputValue(),'**Editable**');await page.locator('.b4-selectionbar [data-note-format="strike"]').waitFor();await input.press('Control+Enter');
 await note.focus();await page.keyboard.press('Control+d');assert.equal((await read()).days[f.date].notes.at(-1).at,f.date);
 await page.keyboard.press('Control+z');await canvas.focus();await note.focus();await page.locator('.b4-selectionbar').waitFor();
 const labels=await page.locator('.b4-selectionbar button').evaluateAll(els=>els.map(e=>e.getAttribute('aria-label')));for(const old of ['Zoom to selection','Delete selected nodes','Duplicate selection','Edit selected node'])assert.ok(!labels.includes(old));
 if(!mobile){const r=await note.boundingBox(),bar=await page.locator('.b4-selectionbar').boundingBox();assert.ok(r.y-bar.y-bar.height>=16);await page.mouse.move(r.x+r.width-1,r.y+r.height*.3);await page.mouse.down();await page.mouse.move(r.x+r.width+105,r.y+r.height*.3,{steps:8});await page.mouse.up();await page.waitForTimeout(160);assert.equal((await read()).days[f.date].canvas.board4.styles['sticky:note'].width,360);}
 await canvas.focus();await page.keyboard.press('Shift+2');await page.waitForTimeout(150);
 await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'cards-'+language+'-'+(mobile?'phone':'desktop')+'.png')});
 await page.reload();await page.waitForSelector('#qa',{state:'attached'});const saved=(await read()).days[f.date].notes;assert.ok(saved.every(n=>n.id==='note'||n.at===f.date));assert.deepEqual(errors,[]);await page.context().close();console.log('cards',language,mobile?'phone':'desktop','ok');
 }}finally{await h.stop();}})().catch(e=>{console.error(e);process.exit(1)});
