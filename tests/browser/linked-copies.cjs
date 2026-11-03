const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Linked copies (5.34): a synced note keeps the same words and look on every day
// and in the Feed; a synced section is one section seen in two places. Duplicate
// stays a copy on its own. A small mark outside the paper shows a synced copy,
// and its menu lists the other copies and goes there (Back returns).
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,errors,context}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   f.data.setup.life={v:2,items:[
    {id:'s',type:'section',parent:'',x:40,y:60,w:520,h:340,text:'Ideas',color:'#9DD6FF'},
    {id:'s1',type:'sticky',parent:'s',x:30,y:70,w:200,h:200,text:'Fox poses',color:'#FFE08A'},
    {id:'s2',type:'sticky',parent:'s',x:270,y:70,w:200,h:200,text:'Owl',color:'#A8E6B8'},
    {id:'feedfox',type:'sticky',parent:'',x:1150,y:60,w:220,h:220,text:'Fox sketch',color:'#FFE08A'},
   ],links:[{id:'in',from:'life:s1',to:'life:s2',style:'straight',arrow:true}],frame:{x:24,y:700,w:1420,h:700}};
   f.data.days[f.date].notes=[
    {id:'a',kind:'sticky',text:'Fox sketch',color:'#FFE299',x:1700,y:200},
    {id:'b',kind:'sticky',text:'Beta',color:'#FFE299',x:2100,y:200},
   ];
   f.data.days[f.date].canvas={board4:{layouts:{mindmap:{}},locked:[],styles:{},links:[]}};
   f.data.days[f.last].notes=[{id:'old',kind:'sticky',text:'Fox sketch',color:'#FFE299',x:200,y:200}];
   await page.evaluate((d)=>{localStorage.setItem('debug-day:v2',JSON.stringify(d.data));localStorage.setItem('debug-day:board-view:'+d.date,JSON.stringify({camera:{x:40,y:150,z:0.4},mode:'mindmap'}));localStorage.setItem('debug-day:ui',JSON.stringify({view:'board'}));},{data:f.data,date:f.date});
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    items=async()=>(await read()).setup.life.items,
    day=async(date=f.date)=>(await read()).days[date],
    node=(ref)=>page.locator(`[data-board-id="${ref}"]`),
    view=page.locator('.b2-viewport'),
    key=async(k)=>{await view.focus();await page.keyboard.press(k);await page.waitForTimeout(200);},
    settle=()=>page.waitForTimeout(400),
    menu=()=>page.getByRole('menu',{name:'Board context menu'}),
    menuItem=(name)=>menu().getByRole('menuitem',{name,exact:true}),
    openMenu=async(ref)=>{const target=node(ref).locator(':scope>.b4-node-body');if(mobile)await target.dispatchEvent('contextmenu');else await target.click({button:'right'});await menu().waitFor();},
    pick=async(ref)=>{const b=await node(ref).boundingBox();if(mobile)await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);else await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.waitForTimeout(150);},
    // Esc clears a selection (it leaves full screen only when nothing is selected).
    only=async(ref)=>{if(await page.locator('[aria-selected=true][data-board-id]').count()){await view.focus();await page.keyboard.press('Escape');await page.waitForTimeout(100);}await pick(ref);},
    write=async(ref,text)=>{await only(ref);await openMenu(ref);await menuItem('Edit text').click();const editor=node(ref).locator('textarea');await editor.waitFor();await editor.fill(text);await editor.press('Control+Enter');await settle();},
    shown=async()=>page.evaluate(()=>document.querySelector('.views [aria-selected=true]')?.dataset.panel);
   const shots=process.env.DEBUG_DAY_SCREENSHOTS,shot=async(name)=>{if(shots){require('node:fs').mkdirSync(shots,{recursive:true});await page.screenshot({path:require('node:path').join(shots,name+(mobile?'-phone':'')+'.png')});}};
   await view.waitFor();
   if(!mobile){await view.focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();}
   await key('Shift+1');await settle();

   // 1. A synced copy: Ctrl/Cmd+Shift+D (or the menu) puts it beside the original.
   await pick('sticky:a');
   if(mobile){await openMenu('sticky:a');await menuItem('Synced copy…').click();await menuItem('Make a synced copy').click();}
   else await key('Control+Shift+D');
   await settle();
   let notes=(await day()).notes;
   const copy=notes.find((n)=>n.id!=='a'&&n.text==='Fox sketch');
   assert.ok(copy,'the copy is there');
   const link=notes.find((n)=>n.id==='a').syncId;
   assert.ok(link&&copy.syncId===link,'both share one link');
   const badge=node('sticky:a').locator('.dd-sync-badge');
   await badge.waitFor();
   assert.equal(await badge.getAttribute('aria-label'),'Synced · 2 copies');
   // The mark sits outside the paper: the note itself looks the same.
   const nb=await node('sticky:a').boundingBox(),bb=await badge.boundingBox();
   assert.ok(bb.y+bb.height<=nb.y+1,'the mark is above the note, not on it');
   await shot('synced-copy');

   // 2. Edit either one: the other follows, with its color.
   await write('sticky:'+copy.id,'Fox sketch, 3 poses');
   assert.equal((await day()).notes.find((n)=>n.id==='a').text,'Fox sketch, 3 poses');
   // Undo takes the edit back in both.
   await key('Control+z');await settle();
   notes=(await day()).notes;
   assert.deepEqual([notes.find((n)=>n.id==='a').text,notes.find((n)=>n.id===copy.id).text],['Fox sketch','Fox sketch']);
   await key('Control+Shift+z');await settle();
   notes=(await day()).notes;
   assert.deepEqual([notes.find((n)=>n.id==='a').text,notes.find((n)=>n.id===copy.id).text],['Fox sketch, 3 poses','Fox sketch, 3 poses']);
   await openMenu('sticky:a');
   await menu().getByRole('menuitemradio',{name:'Color #B3EFBD',exact:true}).click();await settle();
   assert.equal((await day()).notes.find((n)=>n.id===copy.id).color,'#B3EFBD');

   // 3. Notes made earlier with Copy and Paste: "Sync … with the same words" links them,
   //    on another day and in the Feed too.
   await write('sticky:a','Fox sketch');
   await openMenu('sticky:a');await menuItem('Synced copy…').click();
   await menuItem('Sync 2 more with the same words').click();await settle();
   assert.equal((await day(f.last)).notes[0].syncId,link,'last week\'s note joined');
   assert.equal((await items()).find((i)=>i.id==='feedfox').syncId,link,'the Feed note joined');
   assert.equal((await day(f.last)).notes[0].color,'#B3EFBD','and took this one\'s look');
   await write('sticky:a','Fox sketch · final');
   assert.equal((await day(f.last)).notes[0].text,'Fox sketch · final','another day follows');
   assert.equal((await items()).find((i)=>i.id==='feedfox').text,'Fox sketch · final','the Feed follows');
   assert.equal(await node('life:feedfox').locator('.dd-sync-badge').getAttribute('aria-label'),'Synced · 4 copies');
   // An edit in the Feed comes back to the day.
   await write('life:feedfox','Fox sketch · from the Feed');
   assert.equal((await day()).notes.find((n)=>n.id==='a').text,'Fox sketch · from the Feed');

   // 4. The menu lists the copies and goes there, on any day.
   await openMenu('sticky:a');await menuItem('Synced copy…').click();
   const places=await menu().getByRole('menuitem').evaluateAll((l)=>l.map((e)=>e.getAttribute('aria-label')));
   assert.ok(places.includes('Here')&&places.includes('This day')&&places.includes('Feed'),places.join(', '));
   await shot('synced-menu');
   const lastLabel=new Date(f.last+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
   await menuItem(lastLabel).click();
   await page.waitForFunction((d)=>document.querySelector('[data-board-id="sticky:old"]')&&document.querySelector('[data-board-id="sticky:old"]').getAttribute('aria-selected')==='true',f.last);
   assert.equal(await shown(),'board');
   if(!mobile)assert.equal(await page.locator('.b2.focus-mode').count(),1,'still full screen on the other day');
   const todayLabel=new Date(f.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
   await openMenu('sticky:old');await menuItem('Synced copy…').click();
   await menuItem('Here').waitFor();
   await menu().getByRole('menuitem',{name:todayLabel,exact:true}).first().click();
   await node('sticky:a').waitFor();await settle();

   // 5. Duplicate (Ctrl/Cmd+D) is a copy on its own.
   const before=(await day()).notes.length;
   await openMenu('sticky:b');await menuItem('Duplicate').click();await settle();
   notes=(await day()).notes;
   assert.equal(notes.length,before+1);
   assert.equal(notes.at(-1).syncId,undefined,'a duplicate is not linked');
   assert.equal(await node('sticky:b').locator('.dd-sync-badge').count(),0,'no mark on a note with no copies');

   // 6. A synced section: name, size, notes and lines match; each keeps its own place.
   await key('Shift+1');await settle();
   // (On a phone the long-press menu picks the section.)
   if(!mobile){await node('life:s').locator(':scope>.b4-node-body').click();await page.waitForTimeout(150);}
   if(mobile){await openMenu('life:s');await menuItem('Synced copy…').click();await menuItem('Make a synced copy').click();}
   else await key('Control+Shift+D');
   await settle();
   let list=await items();
   const twin=list.find((i)=>i.type==='section'&&i.id!=='s'&&i.text==='Ideas');
   assert.ok(twin&&twin.syncId&&twin.syncId===list.find((i)=>i.id==='s').syncId,'the section copy is linked');
   const kids=list.filter((i)=>i.parent===twin.id);
   assert.equal(kids.length,2,'its notes came along');
   const inside=new Set(kids.map((i)=>'life:'+i.id));
   assert.equal((await read()).setup.life.links.filter((l)=>inside.has(l.from)&&inside.has(l.to)).length,1,'and the line between them');
   const twinFox=kids.find((i)=>i.text==='Fox poses');
   await key('Shift+1');await settle();
   await node('life:'+twin.id).locator('.dd-sync-badge').waitFor();
   await shot('synced-section');
   await write('life:'+twinFox.id,'Fox poses, quick');
   list=await items();
   assert.equal(list.find((i)=>i.id==='s1').text,'Fox poses, quick','an edit inside one copy shows in the other');
   // Deleting a note in one copy deletes its twin; deleting a copy keeps the other.
   await pick('life:s2');
   await key('Delete');await settle();
   list=await items();
   assert.equal(list.filter((i)=>i.parent===twin.id).length,1,'the twin went too');
   await only('life:'+twin.id);await key('Delete');await settle();
   list=await items();
   assert.ok(list.some((i)=>i.id==='s')&&list.some((i)=>i.id==='s1'),'the source stays');
   assert.ok(!list.some((i)=>i.id===twin.id),'the copy is gone');

   // 7. Unsync this copy: it stands on its own from now on.
   await openMenu('sticky:'+copy.id);await menuItem('Synced copy…').click();
   await menuItem('Unsync this copy').click();await settle();
   await write('sticky:'+copy.id,'Just mine');
   assert.notEqual((await day()).notes.find((n)=>n.id==='a').text,'Just mine');

   // 8. The note menu stays short.
   await openMenu('sticky:a');
   const labels=await menu().getByRole('menuitem').evaluateAll((l)=>l.map((e)=>e.getAttribute('aria-label')));
   assert.ok(labels.length<=10,'a short menu: '+labels.join(', '));
   await page.keyboard.press('Escape');

   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('linked copies: ok');
 }finally{await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
