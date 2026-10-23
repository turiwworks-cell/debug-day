const assert = require("node:assert/strict");
const { mkdirSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { start, fixture } = require("./harness.cjs");
const screenshots=process.env.DEBUG_DAY_SCREENSHOTS || join(require("node:os").tmpdir(),"debug-day-screenshots");
mkdirSync(screenshots,{recursive:true});
const read=(page,date)=>page.evaluate(date=>JSON.parse(localStorage.getItem("debug-day:v2")).days[date],date);
async function scenario(h,mobile,language){
  const {page,context,errors}=await h.context(mobile),f=await fixture(page,h.origin);
  const t=(en,fa)=>language==="fa"?fa:en;
  page.setDefaultTimeout(9000);
  f.data.setup.preferences.language=language;f.data.setup.preferences.reducedMotion=false;
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.evaluate(f=>{
    localStorage.setItem("debug-day:v2",JSON.stringify(f.data));
    localStorage.setItem("debug-day:board-view:"+f.date,JSON.stringify({camera:{x:24,y:160,z:.65},mode:"mindmap"}));
  },f);
  await page.reload();await page.waitForSelector("#qa",{state:"attached"});
  const nav=async index=>{await page.locator(".views button").nth(index).click();};
  const dialog=()=>page.locator("dialog.dd-sticker-dialog[open]");
  const openDay=async()=>{await page.locator(".dd-day-stickers .dd-sticker-add:visible").first().click();await dialog().waitFor();};
  const choose=value=>dialog().locator('[data-choice="'+value+'"]');
  const within=async locator=>{
    const b=await locator.boundingBox(),v=page.viewportSize();
    assert.ok(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1,JSON.stringify({b,v}));
  };
  try{
    await nav(0);
    const baseline=JSON.stringify(await read(page,f.date));
    await openDay();
    assert.equal(await choose("sticker:spark").count(),1);
    assert.equal(await dialog().locator("[data-choice]").count(),8);
    assert.equal(await page.evaluate(()=>document.activeElement?.type),"search");
    await within(dialog());
    await dialog().getByRole("button",{name:t("Favorite Cloud break","علاقه‌مندی ابر آروم"),exact:true}).click();
    await dialog().getByRole("button",{name:t("Favorites","علاقه‌مندی‌ها"),exact:true}).click();
    assert.equal(await dialog().locator("[data-choice]").count(),1);
    await dialog().getByRole("searchbox").fill("ابر");
    assert.equal(await choose("sticker:cloud").count(),1);
    await page.keyboard.press("Escape");await dialog().waitFor({state:"hidden"});
    assert.equal(JSON.stringify(await read(page,f.date)),baseline,"browsing does not edit a day");
    assert.equal(await page.locator(".dd-sticker-add:visible").first().evaluate(el=>el===document.activeElement),true);
    await openDay();await page.mouse.click(2,2);await dialog().waitFor({state:"hidden"});
    await openDay();
    assert.equal(await dialog().getByRole("button",{name:t("Favorite Cloud break","علاقه‌مندی ابر آروم"),exact:true}).getAttribute("aria-pressed"),"true");
    await choose("sticker:spark").focus();await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.choice),language==="fa"?"sticker:coffee":"sticker:cloud");
    if(!mobile&&language==="en"){
      const screenshot=await dialog().screenshot({path:join(screenshots,"sticker-library-en.png"),type:"png"});
      // A compact JPEG in CI logs also permits visual review without a local browser.
      const preview=await dialog().screenshot({type:"jpeg",quality:40});
      console.log("PLAYFUL_PREVIEW:"+preview.toString("base64"));
    }
    await choose("sticker:spark").click();
    await page.waitForFunction(date=>JSON.parse(localStorage.getItem("debug-day:v2")).days[date].notes.some(n=>n.text==="sticker:spark"),f.date);
    let day=await read(page,f.date),symbol=day.notes.find(n=>n.text==="sticker:spark"),id=symbol.id;
    assert.match(symbol.label,/Little spark.*جرقه/);assert.equal(day.notes.length,2);
    const shelf=page.locator('[data-day-sticker="'+id+'"]:visible').first();
    await shelf.locator(".dd-sticker-character").waitFor();
    await page.waitForFunction(id=>{
      const el=document.querySelector('[data-day-sticker="'+id+'"] .dd-sticker-character');
      return el&&getComputedStyle(el).animationName!=="none";
    },id);
    await openDay();
    await dialog().getByRole("combobox").selectOption("writing");
    await choose("sticker:studio").click();
    await page.waitForFunction(date=>JSON.parse(localStorage.getItem("debug-day:v2")).days[date].blocks[0].emo==="sticker:studio",f.date);
    assert.equal((await read(page,f.date)).notes.length,2,"task icon adds no duplicate day note");
    await page.locator('[data-block-id="writing"] .dd-playful-emoji[data-symbol="sticker:studio"]:visible,[data-playful-task="writing"] .dd-playful-emoji[data-symbol="sticker:studio"]:visible').first().waitFor();

    await openDay();
    await dialog().getByRole("tab",{name:t("Emoji","ایموجی‌ها"),exact:true}).click();
    await dialog().getByRole("searchbox").fill("ریتم");
    assert.equal(await dialog().locator("[data-choice]").count(),1);
    await page.waitForFunction(()=>{
      const glyph=document.querySelector('[data-choice="🐢"] .dd-playful-emoji>span');
      return glyph&&getComputedStyle(glyph).animationName==="dd-emoji-breathe";
    });
    await dialog().getByRole("combobox").selectOption("long");
    await choose("🐢").click();
    assert.equal((await read(page,f.date)).blocks[1].emo,"🐢");
    assert.equal((await read(page,f.date)).notes.length,2);

    await openDay();
    await dialog().locator(".dd-sticker-motion").click();
    await page.waitForFunction(()=>document.documentElement.dataset.reduceMotion==="true");
    assert.equal(await choose("sticker:spark").locator(".dd-sticker-character").evaluate(el=>getComputedStyle(el).animationName),"none");
    await dialog().locator(".dd-sticker-motion").click();
    await page.waitForFunction(()=>document.documentElement.dataset.reduceMotion!=="true");
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.waitForFunction(()=>document.querySelector(".dd-sticker-motion")?.disabled);
    assert.equal(await choose("sticker:spark").locator(".dd-sticker-character").evaluate(el=>getComputedStyle(el).animationName),"none");
    await page.emulateMedia({reducedMotion:"no-preference"});
    await page.keyboard.press("Escape");

    if(mobile) await page.locator(".dd-current-task>.textbtn").click();
    else await page.locator('[data-block-id="writing"] .rn, .cap-item[data-block-id="writing"]').first().click();
    await page.locator(".dd-task-sticker>button").click();
    await choose("sticker:heart").click();
    assert.equal((await read(page,f.date)).blocks[0].emo,"sticker:heart");
    await page.reload();await nav(0);
    assert.equal((await read(page,f.date)).notes.find(n=>n.id===id).text,"sticker:spark");
    // Only explicit completion creates a small reaction; reopening never does.
    await page.evaluate(()=>{window.__bursts=0;new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.classList?.contains("dd-playful-burst"))window.__bursts++;}).observe(document.body,{childList:true});});
    const check=page.locator('[data-block-id="writing"] .row>.sq, .cap-item[data-block-id="writing"]>.sq').first();
    await check.click();
    await page.waitForFunction(()=>window.__bursts===1);
    assert.equal((await read(page,f.date)).blocks[0].done,true);
    await check.click();assert.equal((await read(page,f.date)).blocks[0].done,false);
    assert.equal(await page.evaluate(()=>window.__bursts),1);

    await nav(1);
    const node=()=>page.locator('[data-board-id="sticky:'+id+'"]');
    await node().waitFor();
    assert.equal(await node().locator('[data-symbol="sticker:spark"]').count(),1);
    await page.locator('[data-board-id="b:writing"] [data-symbol="sticker:heart"]').waitFor();
    await page.locator(".b4-modes button").nth(1).click();
    await page.waitForFunction(()=>document.querySelector(".b2-viewport").dataset.mode==="lanes");
    assert.equal(await node().getAttribute("aria-label"),t("Little spark","جرقهٔ کوچولو"));
    assert.equal(await node().locator('[data-symbol="sticker:spark"]').count(),1);
    await page.locator(".b4-modes button").nth(0).click();
    await page.locator(".b2-viewport").scrollIntoViewIfNeeded();

    // The modal keeps Board shortcuts away from the canvas and restores focus.
    await page.locator(".b2-viewport").focus();await page.keyboard.press("e");await dialog().waitFor();
    const beforeEscape=JSON.stringify(await read(page,f.date));await page.keyboard.press("Escape");
    assert.equal(JSON.stringify(await read(page,f.date)),beforeEscape);
    await page.getByRole("button",{name:t("Stickers & emoji","استیکر و ایموجی"),exact:true}).click();
    await dialog().waitFor();await within(dialog());await page.keyboard.press("Escape");

    if(mobile) await page.evaluate(()=>{
      window.__touchTrace=[];
      for(const type of ["pointerdown","pointerup","pointercancel","click","dblclick"])document.addEventListener(type,e=>{
        const el=e.target;
        window.__touchTrace.push({type,pointer:e.pointerType,target:el.tagName+"."+el.className,ref:el.closest?.("[data-board-id]")?.dataset.boardId,port:el.closest?.("[data-port]")?.dataset.port,x:e.clientX,y:e.clientY,selected:[...document.querySelectorAll(".b4-node.selected")].map(n=>n.dataset.boardId)});
      },true);
    });
    // Replacing from the board keeps the same object and its persisted size.
    if(mobile){
      await node().tap();
      await page.waitForFunction(id=>document.querySelector('[data-board-id="sticky:'+id+'"]')?.classList.contains("selected"),id);
      await page.getByRole("button",{name:t("Zoom to selection","زوم روی انتخاب"),exact:true}).click();
      await node().tap();await node().tap();
    }else await node().dblclick();
    await dialog().waitFor();assert.equal(await choose("sticker:spark").getAttribute("aria-pressed"),"true");
    await choose("sticker:cloud").click();
    await page.waitForFunction(({date,id})=>JSON.parse(localStorage.getItem("debug-day:v2")).days[date].notes.find(n=>n.id===id).text==="sticker:cloud",{date:f.date,id});
    day=await read(page,f.date);assert.equal(day.canvas.board4.styles["sticky:"+id].width,128);
    if(!mobile&&language==="en"){
      const old={x:day.notes.find(n=>n.id===id).x,y:day.notes.find(n=>n.id===id).y};
      const box=await node().boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
      await page.mouse.move(box.x+box.width/2+85,box.y+box.height/2+55,{steps:12});await page.mouse.up();
      await page.waitForFunction(({date,id,x})=>JSON.parse(localStorage.getItem("debug-day:v2")).days[date].notes.find(n=>n.id===id).x!==x,{date:f.date,id,x:old.x});
      assert.equal((await read(page,f.date)).canvas.board4.links.length,0,"moving a sticker creates no accidental join");
      await node().click({force:true});await page.keyboard.press("Control+d");
      await page.waitForFunction(date=>JSON.parse(localStorage.getItem("debug-day:v2")).days[date].notes.length===3,f.date);
      assert.equal((await read(page,f.date)).notes.at(-1).text,"sticker:cloud");
      await page.getByRole("button",{name:"Undo",exact:true}).click();
      assert.equal((await read(page,f.date)).notes.length,2);
      const viewport=await page.locator(".b2-viewport").boundingBox();
      await page.mouse.click(viewport.x+viewport.width-25,Math.min(viewport.y+viewport.height-100,page.viewportSize().height-120),{button:"right"});
      await page.getByRole("menuitem",{name:"Add sticker / emoji here",exact:true}).click();
      await choose("sticker:coffee").click();
      await page.waitForFunction(date=>JSON.parse(localStorage.getItem("debug-day:v2")).days[date].notes.length===3,f.date);
      assert.equal((await read(page,f.date)).notes.at(-1).text,"sticker:coffee");
      await page.getByRole("button",{name:"Undo",exact:true}).click();
      assert.equal((await read(page,f.date)).notes.length,2);
      const pending=page.waitForEvent("download");
      await page.getByRole("button",{name:"Export board SVG",exact:true}).click();
      const download=await pending,svg=readFileSync(await download.path(),"utf8");
      assert.match(svg,/dd-sticker-art/);assert.match(svg,/linearGradient/);assert.doesNotMatch(svg,/>sticker:cloud</);
    }

    await nav(2);
    await page.locator('.dd-review-day [data-day-sticker="'+id+'"] [data-symbol="sticker:cloud"]').waitFor();
    await page.locator('[data-review-task="writing"] [data-symbol="sticker:heart"]').waitFor();
    // Reduced motion also blocks reactions while checking a task in the day review.
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.locator('[data-review-task="writing"] .dd-review-check').click();
    assert.equal(await page.evaluate(()=>window.__bursts),1);
    await page.emulateMedia({reducedMotion:"no-preference"});
    await page.locator('[data-review-task="writing"] .dd-review-check').click();
    await nav(3);
    await page.locator('.dd-review-day [data-day-sticker="'+id+'"] [data-symbol="sticker:cloud"]').waitFor();
    await nav(0);
    await page.getByRole("button",{name:t("Search","جستجو"),exact:true}).click();
    await page.getByRole("combobox",{name:t("Search everything","جست‌وجوی همه‌چیز"),exact:true}).fill("Cloud break");
    await page.getByRole("listbox").getByRole("option").filter({hasText:"Cloud break"}).first().waitFor();
    await page.getByRole("button",{name:t("Close search","بستن جست‌وجو"),exact:true}).click();
    await page.evaluate(()=>document.documentElement.dataset.theme="dark");
    await openDay();await within(dialog());
    await page.screenshot({path:join(screenshots,"stickers-"+language+"-"+(mobile?"phone":"desktop")+"-dark.png")});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.keyboard.press("Escape");
    await page.locator('#plan [data-day-sticker="'+id+'"] .dd-day-sticker-remove').click();
    assert.equal((await read(page,f.date)).notes.some(n=>n.id===id),false);
    await nav(1);assert.equal(await node().count(),0);
    if(mobile){
      await nav(0);await page.locator(".dd-today-heading button").click();
      const count=await page.evaluate(()=>window.__bursts);
      await page.locator('[data-playful-task="writing"] [data-playful-complete]').click();
      await page.waitForFunction(count=>window.__bursts===count+1,count);
    }
    assert.equal((await read(page,f.date)).blocks[0].emo,"sticker:heart");
    assert.deepEqual(errors,[]);
    console.log("Playful interactions:",language,mobile?"phone":"desktop","passed");
  }catch(error){
    console.error("Touch event trace:",await page.evaluate(()=>window.__touchTrace||[]));
    console.error("Playful failure context:",language,mobile,await page.locator("body").innerText().then(s=>s.slice(-4500)),errors);
    const preview=await page.screenshot({path:join(screenshots,"playful-failure-"+language+"-"+mobile+".png"),type:"png"});
    const jpeg=await page.screenshot({type:"jpeg",quality:35});
    console.log("PLAYFUL_FAILURE_PREVIEW:"+jpeg.toString("base64"));
    throw error;
  }finally{await context.close();}
}
(async()=>{const h=await start();try{for(const language of ["en","fa"])for(const mobile of [false,true])await scenario(h,mobile,language);}finally{await h.stop();}})().catch(error=>{console.error(error);process.exitCode=1;});
