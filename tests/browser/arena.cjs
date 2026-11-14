const assert = require('node:assert/strict');
const {start,fixture} = require('./harness.cjs');
(async()=>{
 const h=await start();
 try {
  for (const mobile of [false,true]) for (const language of ['en','fa']) {
   const {page,errors,context}=await h.context(mobile), f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   // The current app pins DDprefs.language to English. Inject only the picker
   // language at its call site to exercise its real Persian UI independently.
   if(language==='fa') await page.route('**/board-photos.js',async route=>{
    const response=await route.fetch();let source=await response.text();
    source=source.replace('language: ctx.language, initial: arena.initial','language: "fa", initial: arena.initial');
    await route.fulfill({response,body:source});
   });
   f.data.setup.preferences.language=language; f.data.days[f.date].notes=[];
   let imageRequests=0, apiRequests=0;
   const src='https://d2w9rnfcy7mm78.cloudfront.net/123/display.jpg';
   await page.route('https://d2w9rnfcy7mm78.cloudfront.net/**',route=>{imageRequests++;return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#ab7"/></svg>'});});
   await page.route('**/api/arena?**',async route=>{
    apiRequests++;
    assert.equal(route.request().headers().authorization,'Bearer '+'s'.repeat(64));
    const q=new URL(route.request().url()).searchParams;
    if(q.get('query')==='error') return route.fulfill({status:429,json:{error:'Rate limited'}});
    if(q.get('type')==='Channel'&&q.get('op')==='search') return route.fulfill({json:{data:[{id:9,base_type:'Channel',slug:'art',title:'Art channel'}],meta:{has_more_pages:false}}});
    return route.fulfill({json:{data:[{id:123,type:'Image',title:'Art reference',image:{width:600,height:400,src,medium:{src}}}],meta:{has_more_pages:q.get('page')!=='2'}}});
   });
   await page.evaluate(({data,date})=>{localStorage.setItem('debug-day:v2',JSON.stringify(data));localStorage.setItem('debug-day:ui',JSON.stringify({view:'board'}));localStorage.setItem('debug-day:board-view:'+date,JSON.stringify({camera:{x:0,y:0,z:1},mode:'mindmap'}));},{data:f.data,date:f.date});
   await page.reload(); await page.waitForSelector('.b2-viewport');
   await page.locator('.b2-viewport').focus(); await page.keyboard.press('Control+Shift+F');
   await page.locator('.b2.focus-mode').waitFor();
   const open=async()=>{await page.locator('[data-dock-more="tools"]').click();await page.getByRole('menuitem',{name:/Are.na/}).click();await page.getByRole('dialog',{name:'Are.na'}).waitFor();};
   await open();
   const dialog=page.getByRole('dialog',{name:'Are.na'}), field=dialog.locator('input');
   await field.fill('poster');await dialog.locator('button[type=submit]').click();
   await dialog.getByRole('status').filter({hasText:language==='fa'?'اول این دستگاه':'Connect this device'}).waitFor();
   await page.evaluate(origin=>localStorage.setItem('debug-day:cloud-config',JSON.stringify({url:origin,key:'s'.repeat(64)})),h.origin);
   await dialog.locator('button[type=submit]').click();
   const result=dialog.getByRole('button',{name:'Art reference',exact:true});await result.waitFor();
   await page.screenshot({path:'/tmp/arena-'+language+'-'+(mobile?'phone':'desktop')+'.png'});
   await result.click();assert.equal(await result.getAttribute('aria-pressed'),'true');
   await dialog.getByRole('button',{name:/Add selected|افزودن انتخاب/}).click();
   await dialog.waitFor({state:'hidden'});
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')));
   await page.waitForFunction(date=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].notes.length===1,f.date);
   let data=await read(), note=data.days[f.date].notes[0];
   assert.equal(note.media[0].provider,'arena');assert.equal(note.media[0].src,src);
   const card=page.locator('[data-board-id="sticky:'+note.id+'"]');await card.waitFor();
   await card.locator('img').waitFor();
   assert.equal(await card.locator('img').getAttribute('src'),src);
   assert.equal(await card.locator('img').evaluate(i=>i.naturalWidth),600);
   assert.equal(await card.locator('.dd-photo-show').count(),0,'no Drive sign-in for Are.na');
   assert.equal(await card.locator('[data-photo-open]').getAttribute('title'),'Are.na');
   // One import is an ordinary board edit: Undo and Redo keep the reference.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+z');
   await page.waitForFunction(date=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].notes.length===0,f.date);
   await page.keyboard.press('Control+Shift+z');
   await page.waitForFunction(date=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].notes.length===1,f.date);
   // Browse channels and request another page on demand, then exercise errors.
   await open();await field.fill('art');await dialog.locator('select').selectOption('Channel');await dialog.locator('button[type=submit]').click();
   await dialog.getByRole('button',{name:'Art channel'}).click();await result.waitFor();
   await dialog.getByRole('button',{name:/^Next$|^بعدی$/}).click();await result.waitFor();
   assert.equal(await dialog.getByRole('button',{name:/^Next$|^بعدی$/}).isDisabled(),true);
   await field.fill('error');await dialog.locator('button[type=submit]').click();
   await dialog.getByRole('status').filter({hasText:language==='fa'?'درخواست‌ها':'too many requests'}).waitFor();
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   // Pasting an Are.na URL opens the importer rather than a text note.
   await page.locator('.b2-viewport').focus();
   await page.evaluate(()=>{const dt=new DataTransfer();dt.setData('text/plain','https://www.are.na/block/123');document.querySelector('.b2-viewport').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});
   await dialog.waitFor();assert.equal(await field.inputValue(),'https://www.are.na/block/123');await page.keyboard.press('Escape');
   // Leave sync inactive for the reload: image links remain in saved data.
   await page.evaluate(()=>localStorage.removeItem('debug-day:cloud-config'));
   const requests=apiRequests;
   await page.reload();await page.locator('.b4-sticky[data-photo] img').waitFor();
   assert.equal(apiRequests,requests,'reloading a linked image does not call the API');
   assert.ok(imageRequests>0);assert.equal((await read()).days[f.date].notes[0].media[0].provider,'arena');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=1),'no document overflow');
   assert.deepEqual(errors.filter(e=>!/Failed to load resource/.test(e)),[]);
   if (!mobile && language==='en') {
    // Export the real artifact, then serve it to a fresh isolated browser with
    // every external request blocked. Managed Chrome disallows file:// URLs.
    const {mkdtempSync,readFileSync,rmSync}=require('node:fs');
    const folder=mkdtempSync('/tmp/arena-export-');
    if(await page.locator('.b2.focus-mode').count()){await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+Shift+F');}
    await page.locator('.foot .utilities button').last().click();
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download standalone HTML',exact:true}).click();
    const download=await pending;const file=folder+'/planner.html';await download.saveAs(file);
    const standalone=readFileSync(file,'utf8');
    assert.ok(standalone.includes('DDarenaPicker'),'export bundles the Are.na module');
    const isolated=await h.browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tehran'});
    await isolated.route('**/*',route=>route.request().url()===h.origin+'/standalone-test'
      ? route.fulfill({contentType:'text/html',body:standalone})
      : route.abort());
    const off=await isolated.newPage(),offErrors=[];off.on('pageerror',e=>offErrors.push(e.message));
    await off.goto(h.origin+'/standalone-test');await off.waitForSelector('.views');
    assert.deepEqual(offErrors,[]);await off.locator('.views button[data-panel="board"]').click();await off.waitForSelector('.b2-viewport');
    const saved=await off.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')));
    assert.equal(saved.days[f.date].notes[0].media[0].provider,'arena');
    assert.deepEqual(offErrors,[]);await isolated.close();rmSync(folder,{recursive:true});
   }
   await context.close();
  }
  // Multiple selections inside a section use the shared Feed, not a day copy.
  {
   const {page,context,errors}=await h.context(false),f=await fixture(page,h.origin);
   f.data.setup.life={v:2,items:[{id:'art',type:'section',parent:'',x:0,y:0,w:1000,h:800,text:'Art direction',color:'#eeeeee'}]};
   await page.route('**/api/arena?**',route=>route.fulfill({json:{data:[123,124].map(id=>({id,type:'Image',title:'Reference '+id,image:{width:600,height:400,src:'https://images.are.na/'+id+'.jpg',medium:{src:'https://images.are.na/'+id+'.jpg'}}})),meta:{has_more_pages:false}}}));
   await page.evaluate(({data})=>{localStorage.setItem('debug-day:v2',JSON.stringify(data));localStorage.setItem('debug-day:ui',JSON.stringify({view:'board'}));sessionStorage.setItem('debug-day:board-room','art');},f);
   await page.reload();await page.waitForSelector('.b2-viewport');
   await page.evaluate(origin=>localStorage.setItem('debug-day:cloud-config',JSON.stringify({url:origin,key:'s'.repeat(64)})),h.origin);
   await page.locator('[data-dock-more="tools"]').click();await page.getByRole('menuitem',{name:/Are.na/}).click();
   const dialog=page.getByRole('dialog',{name:'Are.na'});
   await dialog.locator('input').fill('art');await dialog.locator('button[type=submit]').click();
   await dialog.getByRole('button',{name:'Reference 123',exact:true}).click();await dialog.getByRole('button',{name:'Reference 124',exact:true}).click();
   await dialog.getByRole('button',{name:/Add selected/}).click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.filter(i=>i.media?.[0]?.provider==='arena').length===2);
   const imported=await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.filter(i=>i.media));
   assert.ok(imported.every(i=>i.parent==='art'),'references belong to the selected section');
   assert.notEqual(imported[0].x,imported[1].x,'multiple images have separate positions');
   assert.deepEqual(errors.filter(e=>!/Failed to load resource/.test(e)),[]);await context.close();
  }
  console.log('Are.na board import ok (desktop/phone, English integration, Persian picker, shared section, standalone export)');
 } finally {await h.stop();}
})().catch(e=>{console.error(e);process.exit(1)});
