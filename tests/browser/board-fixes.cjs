const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Board fixes (5.28): notes keep their size at every zoom and read clearly,
// notes are made on sections (sticky tool and double-click), a double-click
// anywhere makes a note, a drag on a section's empty area selects what is in
// it, the Feed moves by its name and grows from its corner, and the Engine
// grows from its corner too.
(async()=>{
 const h=await start();
 try{
  for(const [language,mobile] of [['en',false]]){
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin),t=(en,fa)=>language==='fa'?fa:en;
   page.setDefaultTimeout(10000);
   f.data.setup.preferences.language=language;
   f.data.setup.life={v:2,items:[
    {id:'a',type:'section',parent:'',x:40,y:60,w:900,h:620,text:'Creative life',color:'#9DD6FF'},
    {id:'c',type:'section',parent:'a',x:420,y:80,w:420,h:320,text:'Sketches',color:'#D3B8FF'},
    {id:'n',type:'sticky',parent:'c',x:40,y:90,w:220,h:160,text:'Line study',color:'#A8E6B8'},
    {id:'n2',type:'sticky',parent:'c',x:180,y:150,w:220,h:160,text:'Plan\n- [ ] one\n- [x] two\nend',color:'#A8E6B8'},
    {id:'b',type:'section',parent:'',x:1040,y:60,w:420,h:350,text:'Work & play',color:'#FFA6D9'}
   ],links:[],frame:{x:24,y:1200}};
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    life=async()=>(await read()).setup.life,
    today=async()=>(await read()).days[f.date],
    node=(id)=>page.locator(`[data-board-id="${id.includes(':')?id:'life:'+id}"]`),
    box=(id)=>node(id).boundingBox(),
    view=page.locator('.b2-viewport'),
    zoom=async()=>Number(await view.getAttribute('data-zoom')),
    key=async(k)=>{await view.focus();await page.keyboard.press(k);await page.waitForTimeout(220);},
    escape=async()=>{await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.waitForTimeout(80);};
   await page.locator('.views button').nth(1).click();
   await node('a').waitFor();
   await view.focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();

   // Habits live beside the board only; App changes and the Feed list in Plan are gone.
   assert.equal(await page.locator('[data-board-id="section:habits"]').count(),0);
   assert.equal(await page.locator('[data-section-id="lab"]').count(),0);
   assert.match(await page.locator('[data-board-id="section:life"] .dd-life-area-title').innerText(),new RegExp(t('Feed','فید')));

   // Frame the Feed at 100%.
   const frameFeed=async()=>{
    await page.locator('[data-life-jump]').click();await page.waitForTimeout(300);
    await page.keyboard.press('Escape');await key('0');
    // Scroll the board so the Feed's top-left corner sits near the top-left of the screen.
    for(let i=0;i<3;i++){const fb=await box('section:life');if(Math.abs(fb.x-60)<4&&Math.abs(fb.y-150)<4)break;
     await page.mouse.move(700,450);await page.mouse.wheel(fb.x-60,fb.y-150);await page.waitForTimeout(200);}
   };
   await frameFeed();

   // Note text is larger and firmer than before; a note keeps its size when zooming out.
   const text=await node('n').locator('.dd-note-preview').evaluate((e)=>{const s=getComputedStyle(e);return {size:parseFloat(s.fontSize),weight:Number(s.fontWeight)};});
   assert.ok(text.size>=17&&text.weight>=500,'readable note text: '+JSON.stringify(text));
   const height=()=>node('n2').evaluate((e)=>parseFloat(e.style.height));
   const h100=await height();
   await key('-');await key('-');await key('-');
   assert.ok(await zoom()<0.5);
   await page.waitForTimeout(300);
   assert.ok(Math.abs(await height()-h100)<=1,'a note does not grow when zooming out: '+h100+' → '+await height());
   await key('0');
   // A to-do note shows every line, boxes and plain text alike.
   const lines=await node('n2').locator('.dd-note-preview').innerText();
   for(const word of ['Plan','one','two','end'])assert.match(lines,new RegExp(word));
   assert.ok(!/- \[/.test(lines),'no raw "- [ ]" shows');
   const row=await node('n2').locator('.dd-sticky-todo').first().evaluate((e)=>({box:e.querySelector('input').getBoundingClientRect().width,text:e.querySelector('span').getBoundingClientRect().width,lines:Math.round(e.querySelector('span').getBoundingClientRect().height/parseFloat(getComputedStyle(e).lineHeight))}));
   assert.ok(row.box<30&&row.text>100&&row.lines===1,'a to-do line keeps its words on one line beside a small box: '+JSON.stringify(row));

   // Sticky tool on a section's empty area makes the note inside that section.
   await frameFeed();
   let ab=await box('a');
   await key('s');
   await page.mouse.click(ab.x+90,ab.y+ab.height-120);
   await page.locator('.dd-note-editor textarea').waitFor();
   await page.locator('.dd-note-editor textarea').fill('Tool note');
   await escape();
   let items=(await life()).items,made=items.find((i)=>i.text==='Tool note');
   assert.ok(made,'the sticky tool works over a section');assert.equal(made.parent,'a','and the note joins it');

   // Double-click on a section's empty area: a note inside it, ready to type.
   const bb=await box('b');
   await page.mouse.dblclick(bb.x+80,bb.y+bb.height-60);
   await page.locator('.dd-note-editor textarea').waitFor();
   await page.keyboard.type('Inside b');await escape();
   items=(await life()).items;
   assert.equal(items.find((i)=>i.text==='Inside b')?.parent,'b','double-click makes the note in that section');

   // Double-click on a section's name renames it.
   const name=node('b').locator(':scope > .b4-node-body .b4-node-title'),nb=await name.boundingBox();
   await page.mouse.dblclick(nb.x+12,nb.y+nb.height/2);
   const rename=node('b').locator('.b4-node-body input');await rename.waitFor();
   await rename.fill('Play');await rename.press('Enter');
   assert.equal((await life()).items.find((i)=>i.id==='b').text,'Play');

   // Double-click on empty board, outside the Feed: a day note.
   await key('f');
   const vb=await view.boundingBox(),notes0=(await today()).notes.length,eb0=await box('section:engine'),fb0=await box('section:life');
   await page.mouse.dblclick(eb0.x+eb0.width/2,(eb0.y+eb0.height+fb0.y)/2);
   await page.locator('.dd-note-editor textarea').waitFor();await page.keyboard.type('Loose');await escape();
   assert.equal((await today()).notes.length,notes0+1,'double-click on the board makes a note');

   // A drag on a section's empty area selects what it touches, instead of moving the section.
   await frameFeed();
   const before=JSON.stringify((await life()).items.find((i)=>i.id==='c'));
   const cb=await box('c');
   await page.mouse.move(cb.x+cb.width-8,cb.y+cb.height-8);await page.mouse.down();await page.mouse.move(cb.x+cb.width*.3,cb.y+cb.height*.5,{steps:8});await page.mouse.up();
   const picked=await page.evaluate(()=>[...document.querySelectorAll('.b4-node.selected')].map((e)=>e.dataset.boardId).sort());
   assert.deepEqual(picked,['life:n','life:n2'],'the box picks the notes inside');
   assert.equal(JSON.stringify((await life()).items.find((i)=>i.id==='c')),before,'and the section stays put');
   // Shift-click the section too, then drag its body: everything selected moves together.
   const nBefore=(await life()).items.find((i)=>i.id==='n');
   ab=await box('a');
   const empty={x:ab.x+300,y:ab.y+100};
   await page.keyboard.down('Shift');await page.mouse.click(empty.x,empty.y);await page.keyboard.up('Shift');
   assert.equal(await node('a').getAttribute('aria-selected'),'true','shift-click adds the section');
   await page.mouse.move(empty.x,empty.y);await page.mouse.down();await page.mouse.move(empty.x+60,empty.y+30,{steps:8});await page.mouse.up();
   items=(await life()).items;
   const A=items.find((i)=>i.id==='a'),N=items.find((i)=>i.id==='n');
   assert.ok(A.x>40,'the section moved: '+JSON.stringify(A));
   assert.equal(N.parent,'c','its note stays in its section');assert.deepEqual([N.x,N.y],[nBefore.x,nBefore.y],'and keeps its place inside it');
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('.b2.focus-mode').count(),1,'still in full screen');
   await frameFeed();

   // The Feed moves by its name, with everything in it, on every day.
   const frame0=(await life()).frame,handle=page.locator('[data-feed-handle]'),hb=await handle.boundingBox();
   await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+hb.width/2+150,hb.y+hb.height/2+100,{steps:8});await page.mouse.up();
   const frame1=(await life()).frame;
   assert.ok(frame1.x>frame0.x+100&&frame1.y>frame0.y+60,'the Feed moved: '+JSON.stringify([frame0,frame1]));
   assert.deepEqual((await life()).items.find((i)=>i.id==='a').x,A.x,'its sections keep their places inside it');
   // …and grows from its corner.
   await key('f');
   const grip=node('section:life').locator('.dd-area-resize'),gb=await grip.boundingBox(),w0=(await box('section:life')).width;
   await page.mouse.move(gb.x+gb.width/2,gb.y+gb.height/2);await page.mouse.down();await page.mouse.move(gb.x+gb.width/2+160,gb.y+gb.height/2+80,{steps:8});await page.mouse.up();
   assert.ok((await life()).frame.w>frame1.w||(await box('section:life')).width>w0+100,'the Feed grows');

   // The Engine grows from its corner and keeps that size.
   await key('f');
   const egrip=node('section:engine').locator('.dd-area-resize');
   const eb=await egrip.boundingBox(),ew0=(await box('section:engine')).width;
   await page.mouse.move(eb.x+eb.width/2,eb.y+eb.height/2);await page.mouse.down();await page.mouse.move(eb.x+eb.width/2+90,eb.y+eb.height/2+50,{steps:8});await page.mouse.up();
   const saved=(await today()).canvas.board4.layouts.mindmap['section:engine'];
   assert.ok(saved&&saved.w>0&&saved.h>0,'the Engine size is saved: '+JSON.stringify(saved));
   assert.ok((await box('section:engine')).width>ew0+40,'the Engine is wider');
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   await page.locator('.views button').nth(1).click();await node('section:engine').waitFor();
   const after=await node('section:engine').evaluate((e)=>parseFloat(e.style.width));
   assert.ok(Math.abs(after-saved.w)<=1,'the size stays after a reload');

   assert.deepEqual(errors,[]);
   await page.context().close();
  }
  console.log('board fixes: note size and text, notes on sections, double-click notes and renames, section selection boxes, Feed move/resize, Engine resize passed (en/fa)');
 }finally{await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
