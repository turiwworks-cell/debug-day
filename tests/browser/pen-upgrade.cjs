const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const {start, fixture} = require(path.join(root,'tests/browser/harness.cjs'));
const results=[];
(async()=>{
 const h=await start();
 async function scenario(name,fn,{strokes,notes,life,mobile=false}={}) {
  if(process.env.REVIEW_ONLY&&!new RegExp(process.env.REVIEW_ONLY).test(name))return;
  const {page,context,errors}=await h.context(mobile);
  page.setDefaultTimeout(4500);
  try {
   const f=await fixture(page,h.origin);
   f.data.setup.life=life||{v:2,items:[],links:[]};
   const d=f.data.days[f.date];
   d.blocks=[];d.bugs=[];
   d.notes=notes||[{id:'n',kind:'sticky',text:'Test note',color:'#FFE299',x:100,y:250}];
   d.canvas={board4:{layouts:{mindmap:{}},locked:[],styles:{},links:[],strokes:strokes||[
    {id:'s1',pts:'420,250 300,0',color:'#0D99FF',width:4},
    {id:'s2',pts:'420,450 150,-80 150,80',color:'#F24822',width:4},
   ]}};
   await page.evaluate(({data,date})=>{
    localStorage.setItem('debug-day:v2',JSON.stringify(data));
    localStorage.setItem('debug-day:ui',JSON.stringify({view:'board'}));
    localStorage.setItem('debug-day:board-view:'+date,JSON.stringify({camera:{x:70,y:100,z:0.8},mode:'mindmap'}));
   },f);
   await page.reload();await page.waitForSelector('.b2-viewport');
   const view=page.locator('.b2-viewport');
   const settle=()=>page.waitForTimeout(130);
   async function key(k){await view.focus();await page.keyboard.press(k);await settle();}
   await key('Control+Shift+F');await settle();
   async function screen(x,y){return page.evaluate(({x,y})=>{
    const el=document.querySelector('.b2-viewport'),r=el.getBoundingClientRect();
    const m=document.querySelector('.b2-world').style.transform.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px.*scale\(([-\d.]+)\)/);
    return {x:r.x+(+m[1])+x*(+m[3]),y:r.y+(+m[2])+y*(+m[3])};
   },{x,y});}
   async function click(x,y,opts){const p=await screen(x,y);await page.mouse.click(p.x,p.y,opts);await settle();}
   async function draw(points){const pp=await Promise.all(points.map(p=>screen(...p)));await page.mouse.move(pp[0].x,pp[0].y);await page.mouse.down();for(const p of pp.slice(1))await page.mouse.move(p.x,p.y,{steps:5});await page.mouse.up();await settle();}
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')));
   const day=async()=>(await read()).days[f.date];
   const selected=()=>page.locator('.dd-ink g.selected').count();
   const check=(condition,detail)=>{if(!condition)throw Error(detail);};
   const detail=await fn({page,view,f,key,screen,click,draw,day,read,selected,settle,check});
   results.push({name,status:'observed',detail,errors});
  }catch(e){results.push({name,status:'error',error:e.message,errors});}
  await context.close();
 }
 try {
  await scenario('select-all-drawings-delete-undo',async({page,key,selected,day,check})=>{
   await key('p');await page.locator('[data-pen-select-all]').click();
   check(await selected()===2,'not two selected');await key('Delete');
   check(!(await day()).canvas.board4.strokes?.length,'not deleted');
   check((await day()).notes.length===1,'note was deleted');
   await key('Control+z');check((await day()).canvas.board4.strokes.length===2,'undo failed');
   return 'Both drawings deleted together, note preserved, one Undo restored both';
  });
  await scenario('shift-straight-line-and-color-panel',async({page,key,draw,day,check})=>{
   await key('p');check(await page.locator('.b6-properties').count()===1,'panel not open');
   const hex=page.getByRole('textbox',{name:'Hex color',exact:true});await hex.fill('#123456');await hex.press('Enter');
   await page.keyboard.down('Shift');await draw([[450,550],[520,510],[620,560],[750,520]]);await page.keyboard.up('Shift');
   const s=(await day()).canvas.board4.strokes.at(-1);
   check(s.color==='#123456','custom color not saved');check(s.pts.split(' ').length===2,'Shift did not produce 2 point line');
   return s;
  });
  await scenario('bbox-resize-and-persistence',async({page,click,day,check,settle})=>{
   await click(550,250);
   check(await page.locator('[data-ink-handle]').count()===8,'not eight handles');
   const before=(await day()).canvas.board4.strokes.find(s=>s.id==='s1').pts;
   const handle=await page.locator('[data-ink-handle="e"]').boundingBox();
   await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+80,handle.y+handle.height/2,{steps:6});await page.mouse.up();await settle();
   const after=(await day()).canvas.board4.strokes.find(s=>s.id==='s1').pts;
   check(after!==before,'resize did not persist');await page.reload();await page.waitForSelector('.b2-viewport');check((await day()).canvas.board4.strokes.find(s=>s.id==='s1').pts===after,'reload changed geometry');
   return {before,after};
  });
  await scenario('marquee-select-drawings-and-delete',async({page,screen,selected,key,day,check})=>{
   const a=await screen(380,200),b=await screen(760,480);
   await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await page.mouse.up();await page.waitForTimeout(200);
   check(await selected()===2,'marquee did not select both');await key('Delete');check(!(await day()).canvas.board4.strokes?.length,'marquee delete failed');return 'passed';
  });
  await scenario('pen-panel-after-note-selection',async({page,click,key,day,draw})=>{
   await click(170,320);await key('p');
   const initial={noteSelected:await page.locator('.b4-node.selected').count(),penActive:await page.locator('.dd-ink-capture').count(),properties:await page.locator('.b6-properties').allTextContents()};
   await page.locator('[data-pen-properties]').click();await page.waitForTimeout(120);
   const firstToggle=await page.locator('.b6-properties').allTextContents();
   await page.locator('[data-pen-properties]').click();await page.waitForTimeout(120);
   const secondToggle=await page.locator('.b6-properties').allTextContents();

   const hex=page.getByRole('textbox',{name:'Hex color',exact:true});await hex.fill('#123456');await hex.press('Enter');
   await draw([[450,550],[650,550]]);const d=await day();
   return {initial,firstToggle,secondToggle,noteColorAfterPenPanelEdit:d.notes[0].color,newStrokeColor:d.canvas.board4.strokes.at(-1).color};
  });
  await scenario('ctrl-a-in-pen-mode',async({page,key,selected,day})=>{
   await key('p');await key('Control+a');
   const selection={drawings:await selected(),notes:await page.locator('.b4-node.selected').count(),penActive:await page.locator('.dd-ink-capture').count()};
   await key('Delete');return {selection,remainingNotes:(await day()).notes.length,remainingStrokes:(await day()).canvas.board4.strokes?.length||0};
  });
  await scenario('ctrl-a-in-pen-mode-with-existing-note-selection',async({page,key,click,selected,day})=>{
   await click(170,320);await key('p');await key('Control+a');
   const selection={drawings:await selected(),notes:await page.locator('.b4-node.selected').count(),penActive:await page.locator('.dd-ink-capture').count()};
   await key('Delete');return {selection,remainingNotes:(await day()).notes.length,remainingStrokes:(await day()).canvas.board4.strokes?.length||0};
  });
  await scenario('multi-selection-click-second-stroke',async({page,key,click,selected})=>{
   await click(550,250);
   async function point(id){return page.locator(`[data-stroke-id="${id}"] .dd-ink-hit`).evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()/2),m=el.getScreenCTM();return {x:p.x*m.a+m.e,y:p.y*m.d+m.f};});}
   // The rendered curve does not go through its middle control point.
   const p=await point('s2');await page.keyboard.down('Shift');await page.mouse.click(p.x,p.y);await page.keyboard.up('Shift');await page.waitForTimeout(150);
   const a=await selected();const target=await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.outerHTML,p);
   await page.keyboard.down('Shift');await page.mouse.click(p.x,p.y);await page.keyboard.up('Shift');await page.waitForTimeout(150);
   return {afterAdding:a,afterRemoving:await selected(),target};
  });
  await scenario('hand-tool-over-selected-bbox',async({page,click,key,screen,day})=>{
   await click(550,250);await key('h');
   const before=await page.locator('.b2-world').evaluate(e=>e.style.transform);
   const p=await screen(550,250);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+80,p.y+40,{steps:6});await page.mouse.up();await page.waitForTimeout(150);
   const after=await page.locator('.b2-world').evaluate(e=>e.style.transform);
   return {before,after,stroke:(await day()).canvas.board4.strokes[0].pts};
  });
  await scenario('mixed-selection-arrow-nudge',async({page,key,day,selected})=>{
   await key('Control+a');const before=await day();await key('ArrowRight');const after=await day();
   return {selectedDrawings:await selected(),noteBefore:before.notes[0].x,noteAfter:after.notes[0].x,strokeBefore:before.canvas.board4.strokes[0].pts,strokeAfter:after.canvas.board4.strokes[0].pts};
  });
  await scenario('mixed-selection-color-and-undo',async({page,key,day,selected,click})=>{
   await key('Control+a');
   // Open the existing note properties with the selection toolbar.
   const props=page.locator('.b4-selectionbar').getByRole('button',{name:/properties/i}).first();
   await props.click();
   const hex=page.getByRole('textbox',{name:'Hex color',exact:true});await hex.fill('#123456');await hex.press('Enter');await page.waitForTimeout(150);
   const styled=await day();await key('Control+z');const undo=await day();await key('Control+z');const undoTwice=await day();
   return {styled,undo,undoTwice};
  });
  await scenario('selected-drawing-switch-to-pen-and-draw-inside-bbox',async({page,click,key,draw,day})=>{
   await click(550,250);await key('p');await draw([[450,250],[650,250]]);return {count:(await day()).canvas.board4.strokes.length,strokes:(await day()).canvas.board4.strokes};
  });
  await scenario('space-drag-from-bbox-pans-or-moves',async({page,click,screen,day})=>{
   await click(550,250);const before=await day();const cameraBefore=await page.locator('.b2-world').evaluate(e=>e.style.transform);
   await page.keyboard.down('Space');const p=await screen(550,250);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+80,p.y+40,{steps:6});await page.mouse.up();await page.keyboard.up('Space');await page.waitForTimeout(150);
   return {cameraBefore,cameraAfter:await page.locator('.b2-world').evaluate(e=>e.style.transform),before:before.canvas.board4.strokes,after:(await day()).canvas.board4.strokes};
  });
  await scenario('erase-far-away-short-stroke',async({page,key,click,day})=>{
   await key('p');await page.locator('.dd-pen-bar').getByRole('button',{name:/Eraser/}).click();
   await click(650,310);return (await day()).canvas.board4.strokes;
  },{strokes:[{id:'s1',pts:'420,250 300,80',color:'#0D99FF',width:4},{id:'dot',pts:'640,315 0,0',color:'#F24822',width:4}]});
  await scenario('eraser-at-stroke-limit-drops-untouched-stroke',async({page,key,click,draw,day})=>{
   const before=(await day()).canvas.board4.strokes;
   await key('p');await page.locator('.dd-pen-bar').getByRole('button',{name:/Eraser/}).click();await click(550,250);
   const after=(await day()).canvas.board4.strokes;
   const renderedLast=await page.locator('[data-stroke-id="extra600"]').count();
   await page.locator('.dd-pen-bar').getByRole('button',{name:/Eraser/}).click();await draw([[450,550],[650,550]]);
   const afterNextOperation=(await day()).canvas.board4.strokes;
   const lost=before.filter(s=>!afterNextOperation.some(a=>a.id===s.id)).map(s=>s.id);
   return {before:before.length,afterErase:after.length,renderedLastAfterErase:renderedLast,afterNextOperation:afterNextOperation.length,lostUntouchedIds:lost,lastPresent:afterNextOperation.some(s=>s.id==='extra600')};
  },{strokes:[{id:'s1',pts:'420,250 300,0',color:'#0D99FF',width:4},...Array.from({length:599},(_,i)=>({id:'extra'+(i+2),pts:`${2000+i*2},900 30,0`,color:'#F24822',width:4}))]});
  await scenario('shift-direction-lock',async({page,key,draw,day,check})=>{
   await key('p');await page.keyboard.down('Shift');
   await draw([[450,550],[500,550],[600,600],[750,500]]);await page.keyboard.up('Shift');
   const stroke=(await day()).canvas.board4.strokes.at(-1);
   const delta=stroke.pts.split(' ')[1].split(',').map(Number);
   check(delta[1]===0 && delta[0]===300, 'Shift changed its initial horizontal direction: '+stroke.pts);
   return stroke;
  });
  await scenario('mixed-drag-single-undo',async({page,key,screen,day,check})=>{
   await key('Control+a');const before=await day();
   const p=await screen(170,320);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+80,p.y+40,{steps:8});await page.mouse.up();await page.waitForTimeout(150);
   const after=await day();
   check(after.canvas.board4.strokes.find(s=>s.id==='s1').pts!==before.canvas.board4.strokes[0].pts,'mixed drag left strokes behind');
   await key('Control+z');const undone=await day();
   check(undone.notes[0].x===before.notes[0].x && undone.canvas.board4.strokes.find(s=>s.id==='s1').pts===before.canvas.board4.strokes[0].pts,'mixed drag undo was not atomic');
   return 'passed';
  });
  await scenario('mobile-pen-properties-custom-color',async({page,key,draw,day,check})=>{
   await key('p');await page.locator('[data-pen-properties]').click();
   const hex=page.getByRole('textbox',{name:'Hex color',exact:true});await hex.fill('#123456');await hex.press('Enter');
   await page.getByRole('button',{name:'Close properties',exact:true}).click();await draw([[60,520],[250,550]]);
   const s=(await day()).canvas.board4.strokes.at(-1);check(s.color==='#123456','mobile pen color was not applied');return s;
  },{mobile:true});
 } finally {await h.stop();}
 const assert = require('node:assert/strict');
 for (const result of results) {
   assert.equal(result.status, 'observed', result.name + ': ' + result.error);
   assert.deepEqual(result.errors, [], result.name);
 }
 const get = name => results.find(r => r.name === name).detail;
 assert.equal(get('pen-panel-after-note-selection').noteColorAfterPenPanelEdit, '#FFE299');
 assert.equal(get('pen-panel-after-note-selection').newStrokeColor, '#123456');
 assert.equal(get('ctrl-a-in-pen-mode-with-existing-note-selection').remainingNotes, 1);
 assert.equal(get('multi-selection-click-second-stroke').afterRemoving, 1);
 assert.equal(get('mixed-selection-arrow-nudge').strokeAfter, '421,250 300,0');
 const color = get('mixed-selection-color-and-undo');
 assert.equal(color.undo.notes[0].color, '#FFE299');
 assert.equal(color.undo.canvas.board4.strokes[0].color, '#0D99FF');
 const limit = get('eraser-at-stroke-limit-drops-untouched-stroke');
 assert.deepEqual(limit.lostUntouchedIds, []);
 assert.equal(limit.afterErase, 600);
 console.log('Pen upgrade: direction, selection, properties, undo, resize, capacity and mobile passed');

})().catch(e=>{console.error(e);process.exitCode=1;});
