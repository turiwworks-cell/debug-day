const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Board bugs that broke trust (5.29.1): drops near a folded section, things in
// a grown frame, groups, undo after a synced note, paste, Alt-drag, Reset
// appearance, the look of a note pasted into a section, two-way lines, elbow
// handles, lines on a section's board, and recovery copies before replacing data.
(async()=>{
 const h=await start();
 try{
  const {page,errors,context}=await h.context(false),f=await fixture(page,h.origin);
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:h.origin});
  page.setDefaultTimeout(10000);
  f.data.setup.preferences.language='en';
  const long=Array.from({length:28},(_,i)=>'line '+i).join('\n');
  f.data.setup.life={v:2,items:[
   {id:'p',type:'section',parent:'',x:40,y:60,w:420,h:300,text:'Project',color:'#9DD6FF',collapsed:true},
   {id:'n1',type:'sticky',parent:'',x:600,y:60,w:200,h:200,text:'Loose',color:'#FFE08A'},
   {id:'g',type:'section',parent:'',x:40,y:520,w:520,h:300,text:'Grown',color:'#FFA6D9'},
   {id:'long',type:'sticky',parent:'g',x:20,y:30,w:240,h:240,text:long,color:'#A8E6B8'},
   {id:'low',type:'sticky',parent:'',x:640,y:520,w:200,h:200,text:'Low',color:'#FFE08A'},
   {id:'s1',type:'sticky',parent:'',x:900,y:60,w:200,h:200,text:'Feed one',color:'#FFE08A',style:{textSize:30,textAlign:'center',opacity:0.7}},
   {id:'s2',type:'sticky',parent:'',x:900,y:400,w:200,h:200,text:'Feed two',color:'#FFE08A'},
   {id:'r',type:'section',parent:'',x:1150,y:1000,w:640,h:320,text:'Room',color:'#B3EFBD'},
   {id:'r1',type:'sticky',parent:'r',x:20,y:40,w:200,h:200,text:'Left',color:'#FFE08A'},
   {id:'r2',type:'sticky',parent:'r',x:400,y:40,w:200,h:200,text:'Right',color:'#FFE08A'},
  ],links:[{id:'two',from:'life:s1',to:'life:s2',style:'elbow',arrow:true,arrowStart:true,bend:{x:1300,y:900}},
   {id:'rl',from:'life:r1',to:'life:r2',style:'elbow',arrow:true,bend:{x:1550,y:2800}}],frame:{x:24,y:1600,w:1400,h:1400}};
  f.data.days[f.date].notes=[
   {id:'a',kind:'sticky',text:'Alpha',color:'#FFE299',x:1700,y:200},
   {id:'b',kind:'sticky',text:'Beta',color:'#FFE299',x:2000,y:200},
   {id:'c',kind:'sticky',text:'Gamma',color:'#FFE299',x:2300,y:200},
   {id:'big',kind:'sticky',text:'Big red',color:'#FFE299',x:1700,y:600},
  ];
  f.data.days[f.date].canvas={board4:{layouts:{mindmap:{}},locked:[],styles:{'sticky:big':{textSize:40,textAlign:'center',textColor:'#D9434A',width:240,height:240}},
   links:[{id:'ab',from:'sticky:a',to:'sticky:b',style:'elbow',arrow:true}]}};
  await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
  await page.reload();await page.waitForSelector('#qa',{state:'attached'});
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
   items=async()=>(await read()).setup.life.items,
   day=async()=>(await read()).days[f.date],
   node=(ref)=>page.locator(`[data-board-id="${ref}"]`),
   view=page.locator('.b2-viewport'),
   key=async(k)=>{await view.focus();await page.keyboard.press(k);await page.waitForTimeout(200);},
   settle=()=>page.waitForTimeout(350),
   drag=async(from,to,opts={})=>{
    if(opts.alt)await page.keyboard.down('Alt');
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    await page.mouse.move(to.x,to.y,{steps:10});await page.mouse.up();
    if(opts.alt)await page.keyboard.up('Alt');
    await settle();
   },
   grab=async(ref)=>{const b=await node(ref).boundingBox();return {x:b.x+b.width/2,y:b.y+Math.min(14,b.height/4)};},
   status=()=>page.locator('.b6 [role=status], .b2 [role=status]').allInnerTexts().then((l)=>l.join(' '));
  await page.locator('.views button').nth(1).click();
  await view.focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();

  // 1. A folded section takes only drops on its name bar.
  await page.locator('[data-life-jump]').click();await settle();
  await key('Shift+1');await settle();
  let pb=await node('life:p').boundingBox(),z=Number(await view.getAttribute('data-zoom'));
  assert.ok(pb.height<60*z+10,'Project is folded: '+JSON.stringify(pb));
  // Its unfolded area (300 tall) is empty board now: a note dropped there stays loose.
  const spot={x:pb.x+pb.width/2,y:pb.y+180*z};
  let g0=await grab('life:n1'),n1b=await node('life:n1').boundingBox();
  await drag(g0,{x:spot.x,y:spot.y-(n1b.height/2-(g0.y-n1b.y))});
  let n1=(await items()).find((i)=>i.id==='n1');
  assert.equal(n1.parent,'','dropped under a folded section, the note stays loose: '+JSON.stringify(n1));
  assert.equal(await node('life:n1').count(),1,'and stays in sight');
  // Dropped on the name bar on purpose: it goes in, and the board says so.
  g0=await grab('life:n1');n1b=await node('life:n1').boundingBox();pb=await node('life:p').boundingBox();
  await drag(g0,{x:pb.x+pb.width/2,y:pb.y+pb.height/2-(n1b.height/2-(g0.y-n1b.y))});
  n1=(await items()).find((i)=>i.id==='n1');
  assert.equal(n1.parent,'p','dropped on the folded section, it goes in');
  assert.match(await status(),/folded section “Project”/,'and the board says where it went');

  // 2. A section grown around a long note keeps that size; what sits in the grown part moves with it.
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find((i)=>i.id==='g').h>320);
  const G=(await items()).find((i)=>i.id==='g');
  const gb=await node('life:g').boundingBox();
  g0=await grab('life:low');const lowb=await node('life:low').boundingBox();
  const target={x:gb.x+gb.width*.75,y:gb.y+gb.height-60*z};
  await drag(g0,{x:target.x,y:target.y-(lowb.height/2-(g0.y-lowb.y))});
  let low=(await items()).find((i)=>i.id==='low');
  assert.equal(low.parent,'g','dropped in the grown part, the note joins the section: '+JSON.stringify([low,G]));
  assert.ok(low.y+low.h/2>300,'below its first height');
  const name=node('life:g').locator('.b4-node-title').first(),nb=await name.boundingBox();
  const lowBefore=await node('life:low').boundingBox();
  await drag({x:nb.x+8,y:nb.y+nb.height/2},{x:nb.x+8+120,y:nb.y+nb.height/2});
  const lowAfter=await node('life:low').boundingBox();
  assert.ok(Math.abs(lowAfter.x-lowBefore.x-120)<6,'moving the section takes it along: '+JSON.stringify([lowBefore,lowAfter]));

  // 3. Groups: adding to a group makes one group; any member grabs all of it.
  await key('Shift+2');await settle();
  const pick=async(ref,shift)=>{const b=await node(ref).boundingBox();if(shift)await page.keyboard.down('Shift');await page.mouse.click(b.x+b.width/2,b.y+b.height/2);if(shift)await page.keyboard.up('Shift');await page.waitForTimeout(120);};
  const selectedRefs=()=>page.locator('.b4-node[aria-selected="true"]').evaluateAll((l)=>l.map((e)=>e.dataset.boardId).sort());
  await key('Shift+1');await page.waitForTimeout(900);
  await pick('sticky:a');await pick('sticky:b',true);
  await key('Control+g');
  await pick('sticky:a');await pick('sticky:c',true);await key('Control+g');
  const groups=Object.values((await day()).canvas.board4.groups||{});
  assert.equal(groups.length,1,'one group: '+JSON.stringify(groups));
  assert.deepEqual([...groups[0]].sort(),['sticky:a','sticky:b','sticky:c']);
  await key('Escape');await pick('sticky:a');
  assert.deepEqual(await selectedRefs(),['sticky:a','sticky:b','sticky:c'],'grabbing the first selects all three');
  await key('Escape');await pick('sticky:c');
  assert.deepEqual(await selectedRefs(),['sticky:a','sticky:b','sticky:c'],'so does grabbing the third');
  // Ungroup for the rest of the test.
  await key('Control+Shift+g');await key('Escape');

  // 4. Undo takes back the move, not a note that came from another device since.
  const ax=(await day()).notes.find((n)=>n.id==='a').x;
  await pick('sticky:a');g0=await grab('sticky:a');
  await drag(g0,{x:g0.x,y:g0.y+120});
  assert.notEqual((await day()).notes.find((n)=>n.id==='a').y,200,'the note moved');
  const tab=await context.newPage();
  await tab.goto(h.origin);await tab.waitForSelector('#qa',{state:'attached'});
  await tab.evaluate((date)=>{const d=JSON.parse(localStorage.getItem('debug-day:v2'));d.days[date].notes.push({id:'phone',kind:'sticky',text:'From the phone',color:'#B3EFBD',x:2600,y:900});localStorage.setItem('debug-day:v2',JSON.stringify(d));},f.date);
  await page.waitForFunction(()=>!!document.querySelector('[data-board-id="sticky:phone"]'));
  await tab.close();
  await key('Control+z');await settle();
  const afterUndo=await day();
  assert.equal(afterUndo.notes.find((n)=>n.id==='a').y,200,'undo puts the note back');
  assert.equal(afterUndo.notes.find((n)=>n.id==='a').x,ax);
  assert.ok(afterUndo.notes.some((n)=>n.id==='phone'),'and the note from the phone stays');
  assert.equal(await node('sticky:phone').count(),1);

  // 5. Paste brings the last thing copied; from the menu it pastes straight away.
  await pick('sticky:c');await key('Control+c');
  await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));return navigator.clipboard.writeText('Meeting tomorrow');});
  // Empty board between the Engine and the Feed.
  const vb=await view.boundingBox(),empty=(k)=>({x:vb.x+vb.width*k,y:vb.y+vb.height*.33});
  await page.mouse.click(empty(.2).x,empty(.2).y,{button:'right'});
  await page.getByRole('menuitem',{name:/Paste here/}).click();await settle();
  let notes=(await day()).notes;
  assert.ok(notes.some((n)=>n.text==='Meeting tomorrow'),'the text copied last is pasted: '+JSON.stringify(notes.map((n)=>n.text)));
  assert.equal(notes.filter((n)=>n.text==='Gamma').length,1,'not the note copied before it');
  // The board's own copy, still the latest, goes straight in from the menu.
  await pick('sticky:c');await key('Control+c');
  await page.mouse.click(empty(.36).x,empty(.36).y,{button:'right'});
  await page.getByRole('menuitem',{name:/Paste here/}).click();await settle();
  assert.equal((await day()).notes.filter((n)=>n.text==='Gamma').length,2,'the copied note is pasted');
  assert.doesNotMatch(await status(),/Ctrl\/Cmd\+V/,'no extra key needed');

  // 6. Alt-drag drops a copy and leaves the original.
  const cBefore=(await day()).notes.find((n)=>n.id==='c');
  await key('Escape');await pick('sticky:c');g0=await grab('sticky:c');
  // While dragging, the original stays where it was and a see-through copy follows (5.39.1).
  await page.keyboard.down('Alt');await page.mouse.move(g0.x,g0.y);await page.mouse.down();
  await page.mouse.move(g0.x,g0.y+180,{steps:10});
  assert.equal(await page.locator('.dd-alt-original').count(),1,'the original stays in sight');
  if(process.env.DEBUG_DAY_SCREENSHOTS)await page.screenshot({path:require('node:path').join(process.env.DEBUG_DAY_SCREENSHOTS,'alt-drag.png')});
  assert.equal(await node('sticky:c').evaluate((el)=>el.classList.contains('dd-alt-ghost')&&getComputedStyle(el).opacity),'0.5','the copy-to-be is see-through');
  await page.mouse.up();await page.keyboard.up('Alt');await settle();
  assert.equal(await page.locator('.dd-alt-original').count(),0,'gone after the drop');
  assert.equal(await page.locator('.dd-alt-ghost').count(),0);
  notes=(await day()).notes;
  assert.deepEqual([notes.find((n)=>n.id==='c').x,notes.find((n)=>n.id==='c').y],[cBefore.x,cBefore.y],'the original stays');
  assert.equal(notes.filter((n)=>n.text==='Gamma').length,3,'and a copy is made');
  const copyC=notes.filter((n)=>n.text==='Gamma'&&n.id!=='c').find((n)=>Math.abs(n.x-cBefore.x)<16&&n.y>cBefore.y+60);
  assert.ok(copyC,'where it was dropped: '+JSON.stringify(notes.filter((n)=>n.text==='Gamma')));

  // 7 + 10. Cut two linked notes and paste them into a Feed section: the line and the look come along.
  const pasteAt=async(ref,fx,fy)=>{
   await page.locator('[data-life-jump]').click();await settle();await key('Shift+1');await page.waitForTimeout(900);
   // Ctrl+V pastes in the middle of the view: bring that spot of the section there.
   const b=await node(ref).boundingBox(),vb=await view.boundingBox(),c={x:vb.x+vb.width/2,y:vb.y+vb.height/2};
   await page.mouse.move(c.x,c.y);await page.mouse.wheel(b.x+b.width*fx-c.x,b.y+b.height*fy-c.y);await settle();
   await key('Control+v');await settle();
  };
  await key('Escape');await pick('sticky:a');await pick('sticky:b',true);await key('Control+x');
  await pasteAt('life:g',.75,.25);
  let life=await read();
  const pasted=life.setup.life.items.filter((i)=>['Alpha','Beta'].includes(i.text));
  assert.equal(pasted.length,2,'both notes are in the Feed: '+JSON.stringify(life.setup.life.items.map((i)=>i.text)));
  assert.ok(pasted.every((i)=>i.parent==='g'),'inside the section: '+JSON.stringify(pasted));
  const refs=new Set(pasted.map((i)=>'life:'+i.id));
  assert.ok((life.setup.life.links||[]).some((l)=>refs.has(l.from)&&refs.has(l.to)),'the line between them came along: '+JSON.stringify(life.setup.life.links));
  await key('Escape');await key('Shift+1');await page.waitForTimeout(900);
  await pick('sticky:big');await key('Control+x');
  await pasteAt('life:g',.3,.8);
  const big=(await items()).find((i)=>i.text==='Big red');
  assert.equal(big?.parent,'g','the note went into the section: '+JSON.stringify(big));
  assert.deepEqual({size:big.style?.textSize,align:big.style?.textAlign,color:big.style?.textColor},{size:40,align:'center',color:'#D9434A'},'the note keeps its look: '+JSON.stringify(big));

  // 9. Reset appearance really resets a Feed note: size, color, alignment and opacity.
  await key('Escape');await pick('life:s1');
  await page.locator('[data-board-id="life:s1"]').click({button:'right'});
  await page.getByRole('menuitem',{name:/Color & properties/}).click();
  await page.locator('.b6-properties').getByRole('button',{name:'Reset appearance'}).click();await settle();
  const s1=(await items()).find((i)=>i.id==='s1');
  assert.deepEqual(s1.style||{},{},'nothing of the old look is left: '+JSON.stringify(s1));
  await key('Escape');await key('Escape');

  // 11. Reversing a two-way line keeps both arrows.
  const wire=page.locator('[data-wire-id="two"] .b4-wire-hit');
  await wire.waitFor({state:'attached'});
  const wireMid=()=>wire.evaluate((p)=>{const q=p.getPointAtLength(p.getTotalLength()/2),m=p.getScreenCTM();return {x:m.a*q.x+m.c*q.y+m.e,y:m.b*q.x+m.d*q.y+m.f};});
  const wm=await wireMid();
  await page.mouse.click(wm.x,wm.y);await settle();
  await page.getByRole('button',{name:'Reverse direction'}).click();await settle();
  const two=(await read()).setup.life.links.find((l)=>l.id==='two');
  assert.ok(two.arrow&&two.arrowStart,'still two-way: '+JSON.stringify(two));

  // 12. An elbow's handle stays on the line: drag it along the line's free way and both move; across it, neither.
  const handle=page.locator('[data-wire-id="two"] .b4-wire-handle.bend');
  const line=page.locator('[data-wire-id="two"] .b4-wire-line');
  const onLine=async()=>{const hb=await handle.boundingBox(),c={x:hb.x+hb.width/2,y:hb.y+hb.height/2};return line.evaluate((p,c)=>{const m=p.getScreenCTM(),L=p.getTotalLength();let best=1e9;for(let i=0;i<=200;i++){const q=p.getPointAtLength(L*i/200);best=Math.min(best,Math.hypot(m.a*q.x+m.c*q.y+m.e-c.x,m.b*q.x+m.d*q.y+m.f-c.y));}return best;},c);};
  await handle.waitFor();
  assert.ok(await onLine()<4,'the handle sits on the line');
  for(const [dx,dy] of [[0,-70],[70,0]]){
   const hb=await handle.boundingBox();
   await drag({x:hb.x+hb.width/2,y:hb.y+hb.height/2},{x:hb.x+hb.width/2+dx,y:hb.y+hb.height/2+dy});
   if(!(await handle.count())){const m=await wireMid();await page.mouse.click(m.x,m.y);await settle();}
   assert.ok(await onLine()<4,'after a drag the handle is still on the line ('+dx+','+dy+')');
  }

  // 13. A line keeps its shape on a section's own board.
  const shape=()=>page.evaluate(()=>{const p=document.querySelector('[data-wire-id="rl"] .b4-wire-line').getBBox(),n=document.querySelector('[data-board-id="life:r1"]');return {x:Math.round(p.x-parseFloat(n.style.left)),y:Math.round(p.y-parseFloat(n.style.top)),w:Math.round(p.width),h:Math.round(p.height)};});
  await key('Escape');
  const onMain=await shape();
  await node('life:r').locator('[data-enter-section="r"]').click();await page.locator('.dd-room-bar').waitFor();await settle();
  assert.deepEqual(await shape(),onMain,'same line, same shape, on the section\'s board');
  await page.locator('.dd-room-bar [data-room-crumb="main"]').click();await page.locator('.dd-room-bar').waitFor({state:'detached'});await settle();

  // 15. No recovery copy, no replacing: import stops and says why.
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='debug-day:recovery')throw new DOMException('full','QuotaExceededError');return set.call(this,k,v);};});
  await key('Escape');await page.keyboard.press('Control+Shift+F').catch(()=>{});
  const before=await read();
  await page.evaluate(()=>document.querySelector('.foot .utilities button')?.click());
  const file=page.locator('input[type=file][accept*=json]');await file.waitFor({state:'attached'});
  const incoming=structuredClone(before);incoming.setup.focus='replaced';incoming.days[f.date].notes=[];
  await file.setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});
  await page.getByRole('button',{name:'Replace & Import'}).click();await settle();
  assert.match(await page.locator('.desc[style*="--bug"], p.desc').allInnerTexts().then((l)=>l.join(' ')),/nothing was replaced/,'the reason is shown');
  const after=await read();
  assert.equal(after.days[f.date].notes.length,before.days[f.date].notes.length,'nothing was replaced');

  assert.deepEqual(errors.filter((e)=>!/favicon|Failed to load resource/.test(e)),[]);
  console.log('board trust: folded sections, grown frames, groups, undo after sync, paste, Alt-drag, look kept in the Feed, two-way lines, elbow handles, recovery copies');
 }finally{await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
