const assert=require('node:assert/strict');
const {start,fixture,openEngine}=require('./harness.cjs');
// Photos and videos on a task (5.34): links to files in the person's Google Drive
// live on block.media, so the Board card details and the Plan card show the same list.
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,errors,context}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   const b=f.data.days[f.date].blocks[0];
   b.media=[{id:'drivefile0001',name:'sketch.jpg',mime:'image/jpeg',size:120000},{id:'drivefile0002',name:'studio.mp4',mime:'video/mp4',size:9000000},{id:'bad id',name:'x'}];
   await page.evaluate((d)=>{localStorage.setItem('debug-day:v2',JSON.stringify(d));},f.data);
   await page.reload();await page.waitForSelector('.views',{state:'attached'});
   const config=await page.evaluate(()=>fetch('/api/media-config').then(r=>r.json()));
   assert.deepEqual(config,{googleClientId:''},'no Client ID in the test server');
   // The Engine row shows the count; its details show the tiles.
   await openEngine(page);
   assert.match(await page.locator('.dd-engine [data-engine-task="writing"] .dd-media-count').first().textContent(),/2/);
   // Plan cards have no width in the phone test context (see harness notes), so the
   // phone pass checks the shared data and the page, the desktop pass the panels.
   if(!mobile){
   await page.locator('.dd-engine [data-engine-task="writing"] .dd-engine-more').click();
   const ed=page.locator('.dd-engine [data-engine-task="writing"] .dd-engine-details');await ed.waitFor();
   const tiles=ed.locator('.dd-task-media .dd-media-tile');
   assert.equal(await tiles.count(),2,'broken links are dropped');
   assert.equal(await tiles.nth(1).getAttribute('data-kind'),'video');
   assert.equal(await tiles.nth(0).locator('a').getAttribute('href'),'https://drive.google.com/file/d/drivefile0001/view');
   // Not set up yet: a calm sentence, no crash.
   const chooser=page.waitForEvent('filechooser');
   await ed.getByRole('button',{name:'＋ Photo or video'}).click();
   const fc=await chooser;
   await fc.setFiles({name:'a.png',mimeType:'image/png',buffer:Buffer.from('x')});
   await page.waitForFunction(()=>/isn't set up/.test(document.querySelector('.dd-engine-details .dd-media-help')?.innerText||''));
   // Removing only unlinks it from the task, and every view follows.
   await tiles.nth(0).locator('.dd-media-remove').click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).days[new Date().toLocaleDateString('en-CA')].blocks[0].media?.length===1);
   assert.equal(await tiles.count(),1);
   assert.match(await page.locator('.dd-engine [data-engine-task="writing"] .dd-media-count').first().textContent(),/1/);
   {
    await page.keyboard.press('Escape');await page.locator('.dd-engine').waitFor({state:'detached'});
    await page.locator('[data-board-id="b:writing"] .b4-node-body').click({force:true});
    const details=page.locator('.dd-card-details');
    if(!(await details.count()))await page.getByRole('button',{name:'Card details',exact:true}).click();
    await details.waitFor();
    assert.equal(await details.locator('.dd-media-tile').count(),1,'the Board card shows the same file');
   }
   }
   if(mobile){const w=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(w<=1,'no sideways scroll');}
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('media ok');
 }finally{await h.stop();}
})().catch(e=>{console.error(e);process.exit(1);});
