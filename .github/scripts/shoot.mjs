// Headless screenshots of the 311 app (initial view + full report flow).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2] || 'screenshots';
fs.mkdirSync(outDir, { recursive: true });
const url = process.env.PREVIEW_URL || 'http://localhost:8080/index.html';
const log = [];
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});

async function open(name, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (!/GL Driver/.test(m.text())) log.push(`[${name}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => log.push(`[${name}] pageerror: ${e.message}`));
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); } catch (e) { log.push(`[${name}] goto: ${e.message}`); }
  await page.waitForTimeout(7000);
  return { ctx, page };
}
const shot = (page, n) => page.screenshot({ path: path.join(outDir, `${n}.png`) });

// Render test: add graphics directly (view SR + WGS84) and a GraphicsLayer.
{
  const { ctx, page } = await open('test', { width: 1000, height: 700 }, false);
  const r = await page.evaluate(() => new Promise((resolve) => {
    window.require(['esri/views/View', 'esri/Graphic', 'esri/layers/GraphicsLayer'], (View, Graphic, GraphicsLayer) => {
      const v = View.views.getItemAt(0);
      const c = v.center.clone();
      v.graphics.add(new Graphic({ geometry: c, symbol: { type: 'simple-marker', color: 'blue', size: 40 } }));
      const gl = new GraphicsLayer();
      const c2 = c.clone(); c2.x += 800;
      gl.add(new Graphic({ geometry: c2, symbol: { type: 'simple-marker', color: 'green', size: 40 } }));
      v.map.add(gl);
      resolve({ webgl: !!document.createElement('canvas').getContext('webgl2'), layers: v.map.allLayers.length });
    });
  }));
  log.push('[test] ' + JSON.stringify(r));
  await page.waitForTimeout(5000);
  await shot(page, 'test-graphics');
  await ctx.close();
}

// Desktop flow
{
  const { ctx, page } = await open('desktop', { width: 1440, height: 900 }, false);
  await shot(page, 'desktop-1-start');
  try {
    const box = await page.locator('#map').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(5000);
    await shot(page, 'desktop-2-pin');
    await page.click('#to-2');
    await page.waitForTimeout(600);
    await page.click('.tile >> nth=0');
    await shot(page, 'desktop-3-category');
    await page.click('#to-3');
    await page.fill('#f-desc', 'Large pothole in the right lane, about 2 ft wide.');
    await page.waitForTimeout(600);
    await shot(page, 'desktop-4-details');
    await page.click('#submit-btn');
    await page.waitForTimeout(3000);
    await shot(page, 'desktop-5-submit');
  } catch (e) { log.push(`[desktop] flow: ${e.message}`); }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'console.log'), log.join('\n') + '\n');
console.log(log.join('\n'));
