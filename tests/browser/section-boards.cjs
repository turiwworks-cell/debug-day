const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// A section's own board is all of it (5.29). Notes and sections made anywhere
// there belong to the section and stay where they were made. What sits outside
// the section's frame shows only on that board: the main board shows what is
// inside the frame, plus a count on the ↗ button. Search and the Sections
// flowchart open the board a thing lives on. Making a section smaller on the
// main board never hides anything: what ends up outside drops onto the board.
// Notes also grow while you type, so no line is cut in half.
(async()=>{
 const h=await start();
 try{
  for(const language of ['en','fa']){
   const {page,errors}=await h.context(false),f=await fixture(page,h.origin),t=(en,fa)=>language==='fa'?fa:en;
   page.setDefaultTimeout(10000);
   f.data.setup.preferences.language=language;
   f.data.setup.life={v:2,items:[
    {id:'a',type:'section',parent:'',x:40,y:60,w:520,h:380,text:'Studio',color:'#9DD6FF'},
    {id:'n',type:'sticky',parent:'a',x:40,y:90,w:220,h:160,text:'Inside',color:'#FFE08A'},
    {id:'b',type:'section',parent:'',x:700,y:60,w:420,h:350,text:'Desk',color:'#FFA6D9'},
    {id:'m',type:'sticky',parent:'b',x:40,y:90,w:220,h:160,text:'Second',color:'#A8E6B8'},
    {id:'q',type:'sticky',parent:'b',x:180,y:170,w:220,h:160,text:'Near the edge',color:'#A8E6B8'}
   ],links:[],frame:{x:24,y:1200}};
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    items=async()=>(await read()).setup.life.items,
    node=(id)=>page.locator(`[data-board-id="life:${id}"]`),
    view=page.locator('.b2-viewport'),bar=page.locator('.dd-room-bar'),
    key=async(k)=>{await view.focus();await page.keyboard.press(k);await page.waitForTimeout(250);},
    settle=()=>page.waitForTimeout(350);
   await page.locator('.views button').nth(1).click();
   await view.focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();
   await page.locator('[data-life-jump]').click();await settle();

   // Open Studio as its own board.
   await page.locator('[data-board-id="life:a"] [data-enter-section="a"]').click();
   await bar.waitFor();await settle();
   assert.match(await bar.locator('.dd-room-note').innerText(),new RegExp(t('outside its frame','بیرون قاب')));
   const engine=await page.locator('[data-board-id="section:engine"]').boundingBox();
   let ab=await node('a').boundingBox();
   const z=Number(await view.getAttribute('data-zoom'));
   // Double-click under the frame: a note there, in Studio.
   const spot={x:ab.x+ab.width*.5,y:Math.min(ab.y+ab.height+140*z,880)};
   assert.ok(spot.y>ab.y+ab.height+20,'the spot is outside the frame');
   await page.mouse.dblclick(spot.x,spot.y);
   await page.locator('.dd-note-editor textarea').waitFor();await page.keyboard.type('Below the frame');
   await page.keyboard.press('Escape');await page.keyboard.press('Escape');await settle();
   let below=(await items()).find((i)=>i.text==='Below the frame');
   assert.equal(below?.parent,'a','a note made outside the frame belongs to the section');
   assert.ok(below.y>380,'and stays where it was made: '+JSON.stringify(below));
   // The note grows while you type: every line shows, none is cut in half.
   await page.mouse.dblclick(...(await (async()=>{const b=await node(below.id).boundingBox();return [b.x+b.width/2,b.y+b.height/2];})()));
   const area=page.locator('.dd-note-editor textarea');await area.waitFor();
   await page.keyboard.press('Control+End');
   for(let i=0;i<9;i++){await page.keyboard.press('Enter');await page.keyboard.type(t('line ','خط ')+i);}
   await page.waitForTimeout(250);
   const fit=await area.evaluate((e)=>({client:e.clientHeight,scroll:e.scrollHeight,top:e.scrollTop,note:e.closest('.b4-node').getBoundingClientRect().height,box:e.getBoundingClientRect().height}));
   assert.ok(fit.scroll<=fit.client+1&&fit.top===0,'the text field holds every line: '+JSON.stringify(fit));
   assert.ok(fit.note>=fit.box,'and the note grew around it: '+JSON.stringify(fit));
   await page.keyboard.press('Escape');await page.keyboard.press('Escape');await settle();

   // The section tool works anywhere on this board, outside the frame too.
   ab=await node('a').boundingBox();
   if(ab.x+ab.width+300>1400){await page.mouse.move(700,450);await page.mouse.wheel(ab.x+ab.width+300-1400,0);await settle();ab=await node('a').boundingBox();}
   const from={x:ab.x+ab.width+60,y:ab.y+20};
   assert.ok(from.x>ab.x+ab.width+20,'the drag starts outside the frame');
   await key('Shift+S');
   await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(from.x+180,from.y+150,{steps:6});await page.mouse.up();await settle();
   const inner=(await items()).filter((i)=>i.type==='section'&&!['a','b'].includes(i.id));
   assert.equal(inner.length,1,'a section was drawn');
   assert.equal(inner[0].parent,'a','it belongs to Studio');
   assert.ok(inner[0].x>520,'and sits where it was drawn: '+JSON.stringify(inner[0]));
   await page.keyboard.press('Escape');
   // It opens as its own board too.
   await node(inner[0].id).locator(`[data-enter-section="${inner[0].id}"]`).click();
   await page.waitForFunction((n)=>document.querySelector('.dd-room-bar [aria-current=page]')?.textContent===n,inner[0].text);
   assert.match(await bar.innerText(),/Studio/);

   // Back on the main board: only what is inside Studio's frame shows.
   await bar.locator('[data-room-crumb="main"]').click();await bar.waitFor({state:'detached'});await settle();
   assert.equal(await node('n').count(),1,'the note inside the frame shows');
   assert.equal(await node(below.id).count(),0,'the note outside the frame stays on Studio\'s board');
   assert.equal(await node(inner[0].id).count(),0,'so does the section drawn there');
   const enter=page.locator('[data-board-id="life:a"] [data-enter-section="a"]');
   assert.equal(await enter.getAttribute('data-more'),'2','the ↗ button counts what is on its board');
   assert.match(await enter.innerText(),new RegExp('↗ '+t('2','۲')));

   // The Sections flowchart opens the board a section lives on.
   await page.locator('[data-sections-button]').click();
   await page.locator(`.dd-flow [data-flow-node="${inner[0].id}"] .dd-flow-pill`).dispatchEvent('contextmenu');
   await page.locator(`.dd-flow [data-flow-show="${inner[0].id}"]`).click();await page.locator('.dd-flow').waitFor({state:'detached'});
   await bar.waitFor();await settle();
   assert.match(await bar.locator('[aria-current=page]').innerText(),/Studio/,'Studio\'s board opens');
   assert.equal(await node(inner[0].id).count(),1,'with the section on it');
   await bar.locator('[data-room-crumb="main"]').click();await bar.waitFor({state:'detached'});await settle();

   // Making Desk smaller on the main board: the note that ends up outside drops
   // onto the main board instead of disappearing.
   await page.locator('[data-life-jump]').click();await settle();await key('0');
   const desk=node('b');await desk.scrollIntoViewIfNeeded();
   await desk.locator('.b4-node-title').first().click();
   const grip=desk.locator('[data-edge="se"]').first(),gb=await grip.boundingBox();
   const db=await desk.boundingBox();
   await page.mouse.move(gb.x+gb.width/2,gb.y+gb.height/2);await page.mouse.down();
   await page.mouse.move(db.x+db.width*.55,db.y+db.height*.62,{steps:8});
   await page.mouse.up();await settle();
   const list=await items(),Q=list.find((i)=>i.id==='q'),M=list.find((i)=>i.id==='m');
   assert.equal(M.parent,'b','what still fits stays in the section');
   assert.equal(Q.parent,'','what ends up outside drops onto the board');
   assert.equal(await node('q').count(),1,'and still shows');

   // A section drawn on the board outside the Feed stays right there.
   await key('f');
   const feed=page.locator('[data-board-id="section:life"]'),fb=await feed.boundingBox(),eb=await page.locator('[data-board-id="section:engine"]').boundingBox();
   const frame0=(await read()).setup.life.frame,feedW=fb.width;
   // A note of the day where the section will go: drawing around it takes it in.
   const zoomNow=Number(await view.getAttribute('data-zoom'));
   const gap={x:eb.x+eb.width+60,y:eb.y+10};
   assert.ok(gap.x+200<1400&&gap.y+160<fb.y,'there is empty board beside the Engine');
   await page.mouse.dblclick(gap.x+100,gap.y+70);
   await page.locator('.dd-note-editor textarea').waitFor();await page.keyboard.type(t('Loose idea','ایده'));
   await page.keyboard.press('Escape');await page.keyboard.press('Escape');await settle();
   const loose=(await read()).days[f.date].notes.find((n)=>n.text===t('Loose idea','ایده'));
   assert.ok(loose,'a day note');
   const lb=await page.locator(`[data-board-id="sticky:${loose.id}"]`).boundingBox();
   await key('Shift+S');
   const r0={x:lb.x-30,y:lb.y-50},r1={x:lb.x+lb.width+30,y:lb.y+lb.height+30};
   await page.mouse.move(r0.x,r0.y);await page.mouse.down();await page.mouse.move(r1.x,r1.y,{steps:8});await page.mouse.up();await settle();
   const drawn=(await items()).find((i)=>i.type==='section'&&!i.parent&&!['a','b'].includes(i.id));
   assert.ok(drawn,'a section was drawn');
   assert.equal(drawn.out,true,'it sits outside the Feed');
   assert.deepEqual((await read()).setup.life.frame,frame0,'the Feed did not stretch to take it');
   assert.ok(Math.abs((await feed.boundingBox()).width-feedW)<2,'and looks the same size');
   const db2=await node(drawn.id).boundingBox();
   assert.ok(Math.abs(db2.x-r0.x)<4&&Math.abs(db2.y-r0.y)<4,'it is where it was drawn: '+JSON.stringify([db2,r0]));
   assert.ok(db2.y+db2.height<fb.y,'not inside the Feed');
   const joined=(await items()).find((i)=>i.text===t('Loose idea','ایده'));
   assert.equal(joined?.parent,drawn.id,'the note inside it joined it');
   assert.ok(!(await read()).days[f.date].notes.some((n)=>n.id===loose.id),'and is no longer a loose note of the day');
   await page.keyboard.press('Escape');
   // Moving the Feed leaves it where it is.
   const handle=page.locator('[data-feed-handle]'),hb=await handle.boundingBox();
   await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+hb.width/2+40/zoomNow*zoomNow,hb.y+hb.height/2+30,{steps:6});await page.mouse.up();await settle();
   const db3=await node(drawn.id).boundingBox();
   assert.ok(Math.abs(db3.x-db2.x)<2&&Math.abs(db3.y-db2.y)<2,'moving the Feed leaves it in place');
   assert.equal(await node(drawn.id).count(),1);
   // Dragged into the Feed by its name, it is part of the Feed again.
   const name=node(drawn.id).locator(':scope > .b4-node-body .b4-node-title'),nb=await name.boundingBox(),fb2=await feed.boundingBox(),ab2=await node('a').boundingBox();
   // Its top-left goes beside Studio, at Studio's height.
   const dx=ab2.x+ab2.width+40-db3.x,dy=ab2.y-db3.y;
   const gx=language==="fa"?nb.x+nb.width-12:nb.x+12;await page.mouse.move(gx,nb.y+nb.height/2);await page.mouse.down();await page.mouse.move(gx+dx,nb.y+nb.height/2+dy,{steps:12});await page.mouse.up();await settle();
   const back=(await items()).find((i)=>i.id===drawn.id);
   assert.equal(back.out,undefined,'moved into the Feed, it belongs to the Feed: '+JSON.stringify(back));
   assert.equal(back.parent,'');
   assert.deepEqual(errors,[]);
   await page.context().close();
  }
  console.log('section boards: notes and sections made anywhere on a section\'s board stay there, the main board shows the frame with a count, the flowchart opens the right board, shrinking drops notes out, notes grow while typing, sections stay outside the Feed (en/fa)');
 }finally{await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
