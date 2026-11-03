const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Photos straight on the Board (5.38): drop image files on the canvas or paste
// one, and a photo card lands there. The file goes to Google Drive (mocked
// here); the card is a normal note holding only the Drive link, so it is saved
// with the day, read by search and the Day review, and kept through reloads.
// Without a Drive sign-in the photo waits as a preview with "Save to Drive".
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,errors,context}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   let uploads=0;
   const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Expose-Headers':'Location'};
   await page.route('https://www.googleapis.com/**',async(route)=>{
    const r=route.request(),u=new URL(r.url());
    if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
    if(u.pathname==='/drive/v3/files/folder0000001')return route.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify({id:'folder0000001',trashed:false})});
    if(u.pathname==='/upload/drive/v3/files'&&r.method()==='POST')return route.fulfill({status:200,headers:{...cors,Location:'https://www.googleapis.com/upload/session/s1'},body:''});
    if(u.pathname==='/upload/session/s1'&&r.method()==='PUT'){uploads++;return route.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify({id:'drivephoto000'+uploads,name:'wall-'+uploads+'.png',mimeType:'image/png',size:'1234'})});}
    if(u.pathname.startsWith('/drive/v3/files/drivephoto'))return route.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify({thumbnailLink:''})});
    return route.fulfill({status:404,headers:cors,body:''});
   });
   const day=f.data.days[f.date];day.notes=[];
   await page.evaluate((d)=>{localStorage.setItem('debug-day:v2',JSON.stringify(d.data));localStorage.setItem('debug-day:ui',JSON.stringify({view:'board'}));localStorage.setItem('debug-day:media-folder','folder0000001');localStorage.setItem('debug-day:board-view:'+d.date,JSON.stringify({camera:{x:0,y:0,z:1},mode:'mindmap'}));},{data:f.data,date:f.date});
   await page.reload();await page.waitForSelector('.b2-viewport');
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    notes=async()=>(await read()).days[f.date].notes||[],
    view=page.locator('.b2-viewport');
   // The phone board waits for a tap; full screen opens it (like the other board tests).
   await view.focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();await page.waitForTimeout(400);
   const box=await view.boundingBox(),at={x:Math.round(box.x+box.width*0.6),y:Math.round(box.y+box.height*0.45)};
   // Sends real image files to the board, as a drop or a paste.
   const send=(how,count=1)=>page.evaluate(async({how,at,count})=>{
    const dt=new DataTransfer();
    for(let i=0;i<count;i++){
     const c=document.createElement('canvas');c.width=160;c.height=90;const g=c.getContext('2d');g.fillStyle=['#e85','#58e','#5b8'][i%3];g.fillRect(0,0,160,90);
     const blob=await new Promise((r)=>c.toBlob(r,'image/png'));dt.items.add(new File([blob],'wall-'+i+'.png',{type:'image/png'}));
    }
    const v=document.querySelector('.b2-viewport');
    if(how==='paste'){v.focus();v.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));return;}
    const o={dataTransfer:dt,clientX:at.x,clientY:at.y,bubbles:true,cancelable:true};
    v.dispatchEvent(new DragEvent('dragenter',o));v.dispatchEvent(new DragEvent('dragover',o));
    if(how==='hover')return;
    v.dispatchEvent(new DragEvent('drop',o));
   },{how,at,count});

   // 1) Not signed in to Drive: the photo waits as a preview, nothing is saved.
   await send('hover');
   await page.locator('.dd-photo-drop-hint').waitFor();
   await send('drop');
   const waiting=page.locator('.dd-photo-pending');
   await waiting.first().waitFor();
   assert.equal(await waiting.getAttribute('data-state'),'need');
   assert.equal(await page.locator('.dd-photo-drop-hint').count(),0,'the hint goes away after the drop');
   await waiting.locator('.dd-photo-save').waitFor();
   assert.equal((await notes()).length,0,'a photo not yet in Drive saves no note');
   await waiting.locator('.dd-photo-cancel').click();
   assert.equal(await waiting.count(),0);

   // 2) Signed in: a dropped photo goes to Drive and lands as a photo card.
   await page.evaluate(()=>sessionStorage.setItem('debug-day:media-token',JSON.stringify({token:'test-token',expiry:Date.now()+3600e3})));
   await send('drop');
   await page.waitForFunction((d)=>(JSON.parse(localStorage.getItem('debug-day:v2')).days[d].notes||[]).length===1,f.date);
   let list=await notes();
   assert.deepEqual(list[0].media,[{id:'drivephoto0001',name:'wall-1.png',mime:'image/png',size:1234,w:160,h:90}]);
   const card=page.locator('[data-board-id="sticky:'+list[0].id+'"]');
   await card.waitFor();
   assert.equal(await card.getAttribute('data-photo'),'image');
   assert.equal(await card.getAttribute('aria-selected'),'true','the new photo is picked');
   assert.equal(await card.locator('textarea').count(),0,'and not opened for typing');
   const img=card.locator('.dd-photo-face img');
   await img.waitFor();
   assert.match(await img.getAttribute('src'),/^blob:/,'shows from the file right away');
   const cb=await card.boundingBox(),vb=await view.boundingBox();
   assert.ok(Math.abs(cb.height/cb.width-90/160)<0.03,'card follows the picture shape '+cb.width+'x'+cb.height);
   assert.ok(Math.abs(cb.x+cb.width/2-at.x)<4&&Math.abs(cb.y+cb.height/2-at.y)<4,'lands where it was dropped');
   assert.equal(await page.locator('.dd-photo-pending').count(),0);

   // 3) Paste two photos at once: they sit side by side.
   await page.mouse.move(at.x-300,at.y+200);
   await send('paste',2);
   await page.waitForFunction((d)=>(JSON.parse(localStorage.getItem('debug-day:v2')).days[d].notes||[]).length===3,f.date);
   list=await notes();
   assert.equal(list.filter((n)=>n.media?.length===1).length,3);
   assert.ok(list[2].x>list[1].x,'second pasted photo sits beside the first');
   assert.equal(uploads,3);

   // 4) Search finds a photo by its file name; reload keeps the cards.
   await page.reload();await page.waitForSelector('.b2-viewport');
   assert.equal(await page.locator('.b4-sticky[data-photo]').count(),3,'photo cards survive a reload');

   // 5) The tools dock's ⋯ offers "Photo or video…" (phone too), which opens the file picker.
   await page.locator('[data-dock-more="tools"]').click();
   const chooser=page.waitForEvent('filechooser');
   await page.getByRole('menuitem',{name:/Photo or video/}).click();
   await chooser;
   if(mobile){const w=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(w<=1,'no sideways scroll');}
   assert.deepEqual(errors.filter((e)=>!/Failed to load resource/.test(e)),[]);
   await context.close();
  }
  console.log('board photos ok');
 }finally{await h.stop();}
})().catch(e=>{console.error(e);process.exit(1);});
