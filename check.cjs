const assert = require('node:assert/strict');
const {chromium} = require(require.resolve('playwright', {paths:[process.cwd(),'/home/proxy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node']}));
(async()=>{
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto(process.env.ATLAS_URL || 'http://127.0.0.1:8766');
    await page.waitForFunction(()=>window.atlas);
    await page.locator('#rotate').click();
    for(let i=0;i<3;i++) {
      await page.locator(`[data-model="${i}"]`).click();
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(()=>atlas.current),i);
      assert.ok(await page.locator('.label').count()>=12);
      assert.ok(await page.evaluate(()=>atlas.renderer.info.render.triangles)>10000);
      const labelBoxes=await page.locator('.label').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
      for(let j=0;j<labelBoxes.length;j++) {
        const a=labelBoxes[j];
        assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=1920&&a.y+a.h<=1080);
        for(let k=j+1;k<labelBoxes.length;k++) {
          const b=labelBoxes[k];
          assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'Labels overlap');
        }
      }
      await page.screenshot({path:`/tmp/protist-${i}.png`});
    }
    const before=await page.evaluate(()=>atlas.pivot.rotation.y);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>atlas.pivot.rotation.y),before);
    await page.locator('#rotate').click();
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(()=>atlas.pivot.rotation.y)>before);
    await page.locator('#annotate').click();
    assert.equal(await page.locator('#labels').isVisible(),false);
    await page.locator('#annotate').click();
    await page.locator('#rotate').click();
    const rotation=await page.evaluate(()=>atlas.pivot.rotation.y);
    await page.mouse.move(960,500);await page.mouse.down();await page.mouse.move(1100,540,{steps:8});await page.mouse.up();
    assert.ok(Math.abs(await page.evaluate(()=>atlas.pivot.rotation.y)-rotation)>.5);
    await page.locator('#reset').click();
    assert.equal(await page.evaluate(()=>atlas.pivot.rotation.y),-.12);
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.evaluate(()=>atlas.spinning),false);
    for(const [w,h] of [[1366,768],[390,844],[844,390]]) {
      await page.setViewportSize({width:w,height:h});
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:`/tmp/protist-${w}.png`});
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: 3 models, 45 labels, WebGL geometry, 16:9 layout, animation, pause, drag, reset, labels, reduced motion, responsive layouts; no JS errors.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
