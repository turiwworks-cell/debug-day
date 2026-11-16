const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Board integrity (5.85.1): moving everything together keeps every line whole
// (bends move too, and Select all leaves the Engine's tasks on their lanes); the
// Engine carries the notes and sections that sit on it; a section made a little
// bigger keeps what lives outside its frame on its own board; and opening a
// section after a search opens that section, not the main board.
(async()=>{
 const h=await start();
 try{
  const {page,errors}=await h.context(false),f=await fixture(page,h.origin);
  page.setDefaultTimeout(10000);
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
   node=(id)=>page.locator(`[data-board-id="${id}"]`),
   world=(id)=>node(id).evaluate((e)=>({x:parseFloat(e.style.left),y:parseFloat(e.style.top),w:parseFloat(e.style.width),h:parseFloat(e.style.height)})),
   zoom=async()=>Number(await page.locator('.b2-viewport').getAttribute('data-zoom')),
   load=async(data)=>{await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),data);await page.reload();await page.waitForSelector('.views',{state:'attached'});await page.locator('.views button[data-panel="board"]').click();await page.locator('.b6').waitFor();await page.waitForTimeout(400);},
   drag=async(loc,dx,dy)=>{const b=await loc.boundingBox(),x=b.x+Math.min(40,b.width/2),y=b.y+Math.min(14,b.height/2);await page.mouse.move(x,y);await page.mouse.down();for(let i=1;i<=8;i++){await page.mouse.move(x+dx*i/8,y+dy*i/8);await page.waitForTimeout(16);}await page.mouse.up();await page.waitForTimeout(400);};
  const day=f.data.days[f.date];
  // Where today's Engine sits on a fresh board.
  await load(f.data);
  const engine=await world('section:engine');
  // 1. A note and a section placed on the Engine; two notes joined by a bent line; a
  // section with one note inside its frame and one that lives outside it, on its own board.
  const frame={x:engine.x+engine.w+600,y:engine.y};
  day.notes=[
   {id:'on',kind:'sticky',text:'On the Engine',color:'#FFE299',x:engine.x+engine.w-300,y:engine.y+engine.h-220},
   {id:'a',kind:'sticky',text:'Left idea',color:'#FFE299',x:engine.x,y:engine.y+engine.h+500},
   {id:'b',kind:'sticky',text:'Right idea',color:'#A8E6B8',x:engine.x+600,y:engine.y+engine.h+800},
  ];
  day.canvas={board4:{layouts:{mindmap:{}},locked:[],styles:{},links:[{id:'bent',from:'sticky:a',to:'sticky:b',style:'elbow',arrow:true,bend:{x:engine.x+400,y:engine.y+engine.h+700}}]}};
  f.data.setup.life={v:2,frame,links:[],items:[
   {id:'rider',type:'section',parent:'',out:true,x:engine.x+40-frame.x,y:engine.y+engine.h-300-frame.y-90,w:300,h:220,text:'Rides along',color:'#D3B8FF'},
   {id:'proj',type:'section',parent:'',x:40,y:60,w:600,h:420,text:'Projects',color:'#9DD6FF'},
   {id:'in',type:'sticky',parent:'proj',x:40,y:80,w:240,h:160,text:'Inside the frame'},
   {id:'away',type:'sticky',parent:'proj',x:-900,y:80,w:240,h:160,text:'On its own board'},
   {id:'music',type:'section',parent:'',x:900,y:60,w:500,h:400,text:'Music',color:'#FFA6D9'},
  ]};
  await load(f.data);

  // The Engine carries what sits on it.
  const note0=await world('sticky:on'),rider0=await world('life:rider'),engine0=await world('section:engine');
  await drag(page.locator('[data-engine-handle]'),200,120);
  const note1=await world('sticky:on'),rider1=await world('life:rider'),engine1=await world('section:engine');
  const ex=engine1.x-engine0.x,ey=engine1.y-engine0.y;
  assert.ok(ex>100&&ey>50,'the Engine moved');
  assert.ok(Math.abs(note1.x-note0.x-ex)<2&&Math.abs(note1.y-note0.y-ey)<2,'a note on the Engine moves with it');
  assert.ok(Math.abs(rider1.x-rider0.x-ex)<2&&Math.abs(rider1.y-rider0.y-ey)<2,'a section on the Engine moves with it');

  // Select all, drag: the bent line keeps its shape, and no task leaves its lane.
  let data=await read();const bend0=data.days[f.date].canvas.board4.links.find((l)=>l.id==='bent').bend;let a0=await world('sticky:a');
  await page.locator('.b2-viewport').focus();await page.keyboard.press('Shift+Digit1');await page.waitForTimeout(500);a0=await world('sticky:a');await page.keyboard.press('Control+a');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('[data-board-id^="b:"][aria-selected="true"],[data-board-id^="b:"].selected')].length),0,'Select all leaves the Engine tasks out');
  await drag(node('sticky:a'),160,100);
  data=await read();const bend1=data.days[f.date].canvas.board4.links.find((l)=>l.id==='bent').bend,a1=await world('sticky:a');
  assert.ok(a1.x-a0.x>20,'the notes moved');
  assert.ok(Math.abs((bend1.x-bend0.x)-(a1.x-a0.x))<2&&Math.abs((bend1.y-bend0.y)-(a1.y-a0.y))<2,'the bend moved with both ends');
  await page.keyboard.press('Escape');

  // A section made a little bigger keeps what lives on its own board.
  const grip=node('life:proj').locator('[data-resize][data-edge="se"]');
  await grip.scrollIntoViewIfNeeded().catch(()=>{});
  if(!(await grip.count())||!(await grip.isVisible())){await node('life:proj').locator('.b4-node-body').first().click();await page.waitForTimeout(200);}
  await drag(grip,30,20);
  data=await read();
  const proj=data.setup.life.items.find((i)=>i.id==='proj'),away=data.setup.life.items.find((i)=>i.id==='away');
  assert.ok(proj.w>600,'the section grew');
  assert.equal(away.parent,'proj','a note outside the frame still belongs to the section');
  assert.equal(await node('life:away').count(),0,'and it stays on the section\'s own board');

  // After a search, opening a section opens it.
  await page.keyboard.press('Control+Space');
  await page.getByRole('combobox',{name:'Search everything',exact:true}).fill('Right idea');
  await page.locator('.dd-command-modal').getByText('Right idea',{exact:true}).first().click();
  await page.waitForTimeout(600);
  for(const [id,name] of [['proj','Projects'],['music','Music']]){
   await node('life:'+id).locator('[aria-label="Enter section"]').dispatchEvent('pointerdown',{button:0,pointerType:'mouse'});
   await page.waitForTimeout(500);
   assert.equal(await page.locator('.dd-room-bar [aria-current=page]').textContent(),name,'opened '+name);
   await page.locator('[data-room-crumb="main"]').click();await page.waitForTimeout(400);
  }
  assert.deepEqual(errors.filter((e)=>!/ERR_TUNNEL|Failed to load resource/.test(e)),[]);
  console.log('Board integrity: lines keep their bends, the Engine carries its notes, sections keep their own board, sections open after a search');
 } finally{await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
