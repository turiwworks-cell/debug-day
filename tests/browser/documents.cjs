const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
const {mkdirSync,readFileSync}=require('node:fs');
const {join}=require('node:path');
// Documents (5.63), after Milanote: a note becomes a document, a double-click
// opens it full size to read and write, it shows as a card or an icon, and it
// saves as Markdown, text, Word or PDF.
(async()=>{
 const h=await start();
 try{
  const {page,context,errors}=await h.context(false),f=await fixture(page,h.origin);
  page.setDefaultTimeout(10000);
  const day=f.data.days[f.date];
  day.notes=[{id:'n',kind:'sticky',x:200,y:700,text:'Trip plan\nDay one\n- pack the camera',color:'#FFE08A'}];
  await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
  await page.reload();await page.waitForSelector('#qa',{state:'attached'});
  await page.locator('.views button').nth(1).click();
  await page.getByRole('button',{name:'Full screen',exact:true}).click();
  const read=async()=>(await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')))).days[f.date],
   node=(ref)=>page.locator(`[data-board-id="${ref}"]`),
   settle=(ms=350)=>page.waitForTimeout(ms),
   menuItem=(name)=>page.getByRole('menu',{name:'Board context menu'}).getByRole('menuitem',{name,exact:true}),
   style=async(id)=>(await read()).canvas?.board4?.styles?.['sticky:'+id]||{};
  // Right-click a note: Convert to document. Its first line is the name.
  await node('sticky:n').click({button:'right'});
  await menuItem('More').click();await menuItem('Convert to document').click();await settle();
  assert.equal((await style('n')).doc,true);
  assert.equal((await read()).notes[0].text,'# Trip plan\n\nDay one\n- pack the camera');
  const card=node('sticky:n');
  assert.ok((await card.getAttribute('class')).includes('b4-doc'));
  assert.equal((await card.locator('.dd-doc-name').innerText()).trim(),'Trip plan');
  assert.match(await card.locator('.dd-doc-preview').innerText(),/pack the camera/);
  if(process.env.DEBUG_DAY_SCREENSHOTS){mkdirSync(process.env.DEBUG_DAY_SCREENSHOTS,{recursive:true});await page.screenshot({path:join(process.env.DEBUG_DAY_SCREENSHOTS,'document-card.png')});}
  // A double-click opens it full size, ready to read.
  await card.dblclick();
  const doc=page.getByRole('dialog',{name:'Document: Trip plan'});
  await doc.waitFor();
  assert.equal(await doc.getByRole('textbox',{name:'Document name'}).inputValue(),'Trip plan');
  assert.match(await doc.locator('.dd-doc-read').innerText(),/Day one/);
  // Write: the same formatting as notes, lists carry on.
  await doc.getByRole('button',{name:'Write',exact:true}).click();
  const words=doc.getByRole('textbox',{name:'Document text'});
  await words.press('Control+End');
  await page.keyboard.press('Enter');await page.keyboard.type('charge the battery');
  await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  await doc.locator('[data-doc-format="h2"]').click();await page.keyboard.type('Day two');

  await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].notes[0].text.includes('Day two'),f.date);
  assert.equal((await read()).notes[0].text,'# Trip plan\n\nDay one\n- pack the camera\n- charge the battery\n## Day two');
  // Save as Markdown.
  await doc.getByRole('button',{name:'Save as…'}).click();
  const [download]=await Promise.all([page.waitForEvent('download'),doc.locator('[data-doc-save="md"]').click()]);
  assert.equal(download.suggestedFilename(),'Trip plan.md');
  assert.match(readFileSync(await download.path(),'utf8'),/^# Trip plan\n\nDay one\n- pack the camera/);
  const out=process.env.DEBUG_DAY_SCREENSHOTS;
  if(out){mkdirSync(out,{recursive:true});await doc.getByRole('button',{name:'Read',exact:true}).click();await page.screenshot({path:join(out,'document-open.png')});}
  // Escape closes it; the card shows the new words.
  await page.keyboard.press('Escape');await settle();
  assert.equal(await doc.count(),0);
  assert.match(await card.locator('.dd-doc-preview').innerText(),/Day two/);
  // Show as icon, then as a card again.
  await card.click({button:'right'});
  await menuItem('More').click();await menuItem('Show as icon').click();
  await settle();
  assert.equal((await style('n')).docView,'icon');
  const icon=await card.boundingBox();
  assert.ok(icon.width<200,'a small icon: '+icon.width);
  assert.equal((await card.locator('.dd-doc-icon b').innerText()).trim(),'Trip plan');
  if(out)await page.screenshot({path:join(out,'document-icon.png')});
  // A new document from the tools menu opens empty, ready for its name.
  await page.locator('[data-dock-more="tools"]').click();
  await menuItem('Document').click();
  const blank=page.getByRole('dialog',{name:'Document: Untitled document'});
  await blank.waitFor();
  await page.keyboard.type('Studio notes');
  await page.keyboard.press('Enter');await page.keyboard.type('First line');
  await page.keyboard.press('Escape');await settle();
  const made=(await read()).notes.find((n)=>n.id!=='n');
  assert.equal(made.text,'# Studio notes\n\nFirst line');
  assert.equal((await style(made.id)).doc,true);
  // Convert back to a note: the words stay.
  await card.click({button:'right'});
  await menuItem('More').click();await menuItem('Convert to note').click();await settle();
  assert.equal((await style('n')).doc,undefined);
  assert.match((await read()).notes.find((n)=>n.id==='n').text,/Day two/);
  assert.deepEqual(errors,[]);await context.close();
  console.log('Documents: convert, open, write, save as Markdown, icon, new and back to a note passed');
 }finally{await h.stop()}
})().catch(e=>{console.error(e);process.exit(1)});
