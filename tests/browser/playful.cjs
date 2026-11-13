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
  f.data.days[f.date].blocks[0].emo="sticker:heart";
  f.data.days[f.date].notes.push({id:"saved-emoji",kind:"emoji",text:"sticker:spark",label:"Little spark · جرقهٔ کوچولو",x:80,y:80});
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.evaluate(f=>{
    localStorage.setItem("debug-day:v2",JSON.stringify(f.data));
    localStorage.setItem("debug-day:board-view:"+f.date,JSON.stringify({camera:{x:24,y:160,z:.65},mode:"mindmap"}));
  },f);
  await page.reload();await page.waitForSelector("#qa",{state:"attached"});
  const nav=async index=>{await page.locator(".views button").nth(index).click();};
  try{
    await nav(0);
    await page.locator('[data-block-id="writing"] .dd-playful-emoji[data-symbol="sticker:heart"]:visible,[data-playful-task="writing"] .dd-playful-emoji[data-symbol="sticker:heart"]:visible').first().waitFor();
    await page.emulateMedia({reducedMotion:"reduce"});
    assert.equal(await page.locator('[data-symbol="sticker:heart"] .dd-sticker-character').first().evaluate(el=>getComputedStyle(el).animationName),"none");
    await page.emulateMedia({reducedMotion:"no-preference"});
    assert.equal((await read(page,f.date)).notes.find(n=>n.id==="saved-emoji").text,"sticker:spark");
    // Only explicit completion creates a small reaction; reopening never does.
    await page.evaluate(()=>{window.__bursts=0;new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.classList?.contains("dd-playful-burst"))window.__bursts++;}).observe(document.body,{childList:true});});
    // On the phone the Plan list opens from the Focus card first.
    if(mobile) await page.locator(".dd-current-task>.textbtn").click();
    const check=page.locator('[data-playful-task="writing"] .dd-engine-check, .cap-item[data-block-id="writing"]>.sq').first();
    await check.click();
    await page.waitForFunction(()=>window.__bursts===1);
    assert.equal((await read(page,f.date)).blocks[0].done,true);
    await check.click();assert.equal((await read(page,f.date)).blocks[0].done,false);
    assert.equal(await page.evaluate(()=>window.__bursts),1);

    await nav(1);
    assert.equal(await page.locator('[data-board-id="sticky:saved-emoji"]').count(),0);
    await page.locator('[data-board-id="b:writing"] [data-symbol="sticker:heart"]').waitFor();

    await nav(2);
    await page.locator('[data-review-task="writing"] [data-symbol="sticker:heart"]').waitFor();
    // Reduced motion also blocks reactions while checking a task in the day review.
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.locator('[data-review-task="writing"] .dd-review-check').click();
    assert.equal(await page.evaluate(()=>window.__bursts),1);
    await page.emulateMedia({reducedMotion:"no-preference"});
    await page.locator('[data-review-task="writing"] .dd-review-check').click();
    if(mobile){
      await nav(0);await page.locator(".dd-today-heading button").click();
      const count=await page.evaluate(()=>window.__bursts);
      await page.locator('[data-playful-task="writing"] [data-playful-complete]').click();
      await page.waitForFunction(count=>window.__bursts===count+1,count);
    }
    assert.equal((await read(page,f.date)).blocks[0].emo,"sticker:heart");
    assert.equal((await read(page,f.date)).notes.some(n=>n.id==="saved-emoji"),true);
    console.log("Playful interactions:",language,mobile?"phone":"desktop","passed");
  }catch(error){
    console.error("Playful failure context:",language,mobile,await page.locator("body").innerText().then(s=>s.slice(-4500)),errors);
    const preview=await page.screenshot({path:join(screenshots,"playful-failure-"+language+"-"+mobile+".png"),type:"png"});
    const jpeg=await page.screenshot({type:"jpeg",quality:35});
    if(process.env.DEBUG_DAY_LOG_PREVIEW)console.log("PLAYFUL_FAILURE_PREVIEW:"+jpeg.toString("base64"));
    throw error;
  }finally{await context.close();}
}
(async()=>{const h=await start();try{for(const language of ["en"])for(const mobile of [false,true])await scenario(h,mobile,language);}finally{await h.stop();}})().catch(error=>{console.error(error);process.exitCode=1;});

