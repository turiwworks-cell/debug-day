const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Board canvas feel (5.23): browser zoom never resizes the app, search opens the
// Board in full screen, zoomed out only the big sections keep their names, the
// "+" stays a small dot at one size on screen, and connectors are dark, rounded
// elbows with a filled arrow that turn blue under the pointer.
(async()=>{
 const h=await start();
 try {
  for(const [language,mobile] of [['en',false],['en',true]]){
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin),t=(en,fa)=>language==='fa'?fa:en;
   f.data.setup.preferences.language=language;
   f.data.days[f.date].notes=[
    {id:'a',kind:'sticky',text:'First idea',color:'#FFE299',x:1700,y:900},
    {id:'b',kind:'sticky',text:'Second idea',color:'#A8E6B8',x:2200,y:1200},
   ];
   f.data.days[f.date].canvas={board4:{layouts:{mindmap:{}},locked:[],styles:{},
    links:[{id:'w1',from:'sticky:a',to:'sticky:b',style:'elbow',arrow:true}]}};
   f.data.setup.life={v:2,items:[
    {id:'top',type:'section',parent:'',x:40,y:60,w:900,h:620,text:'Creative life',color:'#9DD6FF'},
    {id:'inner',type:'section',parent:'top',x:420,y:80,w:420,h:320,text:'Sketches',color:'#D3B8FF'},
   ],links:[],frame:{x:24,y:1600}};
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('.views',{state:'attached'});
   await page.evaluate(()=>{
    window.__zoomKey=null;window.__zoomWheel=null;
    window.addEventListener('keydown',(e)=>{if(e.ctrlKey&&['=','-','0','+'].includes(e.key))window.__zoomKey=e.defaultPrevented;});
    window.addEventListener('wheel',(e)=>{if(e.ctrlKey)window.__zoomWheel=e.defaultPrevented;},{passive:true});
   });
   // Off the Board, Ctrl+= never reaches the browser's own zoom.
   await page.locator('body').click({position:{x:4,y:4}});
   await page.keyboard.press('Control+Equal');
   assert.equal(await page.evaluate(()=>window.__zoomKey),true,'Ctrl+= is taken over in Plan');
   // Search opens the Board straight in full screen.
   await page.keyboard.press('Control+Space');
   await page.getByRole('combobox',{name:t('Search everything','جست‌وجوی همه‌چیز'),exact:true}).fill('First idea');
   await page.locator('.dd-command-modal').getByText('First idea',{exact:true}).first().click();
   await page.locator('.b6.focus-mode').waitFor();
   await page.waitForSelector('[data-board-id="sticky:a"][aria-selected="true"]');
   const viewport=page.locator('.b2-viewport'),zoom=async()=>Number(await viewport.getAttribute('data-zoom'));
   const key=async(k)=>{await viewport.focus();await page.keyboard.press(k);await page.waitForTimeout(60);};
   // Ctrl + = - 0 zoom and fit the Board, never the page.
   await key('0');assert.equal(await zoom(),1);
   await key('Control+Equal');assert.ok(await zoom()>1,'Ctrl+= zooms the Board in');
   assert.equal(await page.evaluate(()=>window.__zoomKey),true);
   await key('Control+Minus');await key('Control+Minus');assert.ok(await zoom()<1,'Ctrl+- zooms the Board out');
   const before=await zoom();await key('Control+Digit0');assert.notEqual(await zoom(),before,'Ctrl+0 fits the Board');
   if(!mobile){
    await key('0');
    const vb=await viewport.boundingBox();
    await page.mouse.move(vb.x+vb.width*.5,vb.y+vb.height*.5);
    await page.keyboard.down('Control');await page.mouse.wheel(0,-240);await page.keyboard.up('Control');
    await page.waitForFunction(()=>Number(document.querySelector('.b2-viewport').dataset.zoom)>1);
    assert.equal(await page.evaluate(()=>window.__zoomWheel),true,'Ctrl+wheel is the Board\'s zoom, not the page\'s');
   }
   // Connectors: dark, full strength, rounded elbows, filled arrow.
   const line=page.locator('[data-wire-id="w1"] .b4-wire-line');await line.waitFor({state:'attached'});
   assert.match(await line.getAttribute('d'),/Q/,'the elbow has rounded corners');
   assert.equal(await page.locator('#b4-arrow path').getAttribute('fill'),'context-stroke','a filled arrowhead');
   const wireStyle=()=>line.evaluate((e)=>{const s=getComputedStyle(e);return {w:parseFloat(s.strokeWidth),o:Number(s.opacity),c:s.stroke};});
   assert.equal((await wireStyle()).o,1,'no faded lines');
   await key('0');await key('-');await key('-');assert.equal(await zoom(),0.5);
   // Zoomed out a line thins a little (5.29.1) but stays about 2px on screen.
   {const w=(await wireStyle()).w;assert.ok(w>=3.9&&w<4.7,'zoomed out the line is readable, not heavy: '+w);}
   await key('0');
   if(!mobile){
    // Under the pointer it thickens in blue.
    // Bring a point of the board to the middle of the screen with a plain wheel (pan).
    const bringToCenter=async(point)=>{const vb=await viewport.boundingBox();await page.mouse.move(vb.x+vb.width/2,vb.y+vb.height/2);await page.mouse.wheel(point.x-(vb.x+vb.width/2),point.y-(vb.y+vb.height/2));await page.waitForTimeout(120);};
    const wireMid=()=>page.locator('[data-wire-id="w1"] .b4-wire-hit').evaluate((p)=>{const q=p.getPointAtLength(p.getTotalLength()/2),m=p.getScreenCTM();return {x:m.a*q.x+m.c*q.y+m.e,y:m.b*q.x+m.d*q.y+m.f};});
    await bringToCenter(await wireMid());
    const mid=await page.locator('[data-wire-id="w1"] .b4-wire-hit').evaluate((p)=>{const q=p.getPointAtLength(p.getTotalLength()/2),m=p.getScreenCTM();return {x:m.a*q.x+m.c*q.y+m.e,y:m.b*q.x+m.d*q.y+m.f};});
    await page.mouse.move(5,5);await page.waitForTimeout(200);
    const rest=await wireStyle();
    await page.mouse.move(mid.x,mid.y);await page.waitForTimeout(200);
    const hover=await wireStyle();
    const [r,g,bl]=hover.c.match(/\d+/g).map(Number);
    assert.ok(hover.c!==rest.c&&bl>r+60&&bl>g+60,'blue under the pointer: '+hover.c+' rest '+JSON.stringify(rest));
    assert.ok(hover.w>rest.w,'and thicker');
    await page.mouse.move(5,5);
    // The "+" beside a selected note: a small dot with one size and distance on screen.
    const note=page.locator('[data-board-id="sticky:a"]');
    let nb=await note.boundingBox();await bringToCenter({x:nb.x+nb.width/2,y:nb.y+nb.height/2});nb=await note.boundingBox();await page.mouse.click(nb.x+nb.width/2,nb.y+nb.height/2);
    const plus=note.locator('[data-add-near="right"]');await plus.waitFor();
    const measure=()=>plus.evaluate((e)=>{const r=e.getBoundingClientRect(),n=e.parentElement.getBoundingClientRect(),dot=getComputedStyle(e,'::before').transform;return {w:r.width,gap:r.left+r.width/2-n.right,dot};});
    const at1=await measure();
    await key('-');await key('-');assert.equal(await zoom(),0.5);
    const at05=await measure();
    for(const m of [at1,at05]){
     assert.ok(Math.abs(m.w-20)<1.5,'the "+" is 20px on screen: '+JSON.stringify(m));
     assert.ok(Math.abs(m.gap-16)<1.5,'16px from the note on screen: '+JSON.stringify(m));
     assert.match(m.dot,/matrix\(0\.3, 0, 0, 0\.3/,'a 6px dot at rest');
    }
    await plus.hover();await page.waitForTimeout(200);
    assert.match(await plus.evaluate((e)=>getComputedStyle(e,'::before').transform),/matrix\(1, 0, 0, 1/,'a full "+" under the pointer');
    await key('-');assert.equal(await zoom(),0.25);
    assert.equal(await plus.evaluate((e)=>getComputedStyle(e).display),'none','far out the "+" goes');
    await key('0');
   }
   // Section names (5.28): one rule at every zoom. A name shrinks with the board down to a
   // readable size and stays while there is room; it steps aside only when it would sit on a
   // bigger section's name (or its section is a speck), and comes back when there is room again.
   await page.locator('[data-life-jump]').click();await page.waitForTimeout(250);
   const top=page.locator('[data-life-id="top"]'),inner=page.locator('[data-life-id="inner"]');
   await inner.waitFor({state:'attached'});
   const labelShown=(loc)=>loc.locator(':scope > .b4-node-body').evaluate((e)=>getComputedStyle(e).visibility!=='hidden');
   const pillPx=(loc)=>loc.locator(':scope > .b4-node-body').evaluate((e)=>e.getBoundingClientRect().height);
   await page.keyboard.press('Escape');
   await key('0');
   assert.equal(await inner.getAttribute('data-label-hidden'),'false');
   assert.equal(await labelShown(inner),true,'at 100% the inner name shows');
   await key('-');await key('-');
   assert.equal(await zoom(),0.5);
   await page.waitForTimeout(200);
   assert.equal(await inner.getAttribute('data-label-hidden'),'false','at 50% there is still room for the inner name');
   assert.equal(await labelShown(inner),true);
   const half=await pillPx(top);
   assert.ok(half>=20&&half<=30,'the name pill stays readable, not huge: '+half);
   const fits=await inner.evaluate((el)=>{const b=el.querySelector(':scope > .b4-node-body').getBoundingClientRect(),r=el.getBoundingClientRect();return b.right<=r.right+1;});
   assert.ok(fits,'a name never runs past its section');
   await key('-');await key('-');
   assert.ok(await zoom()<0.5);
   await page.waitForTimeout(200);
   assert.equal(await inner.getAttribute('data-label-hidden'),'true','far out the smaller name steps aside instead of covering the bigger one');
   assert.equal(await labelShown(inner),false,'the inner name hides');
   assert.equal(await labelShown(top),true,'the big section keeps its name');
   assert.ok(await pillPx(top)<=30,'and it does not grow on screen');
   await key('=');await key('=');
   await page.waitForTimeout(200);
   assert.equal(await inner.getAttribute('data-label-hidden'),'false','zooming back in brings it back');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false,'no sideways scroll');
   assert.deepEqual(errors,[]);
   await page.context().close();
  }
  console.log('board canvas: zoom lock, search to full screen, nested section labels, "+" dots and connectors passed (en/fa, desktop/phone)');
 } finally {await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
