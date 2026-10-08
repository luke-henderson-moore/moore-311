// Headless screenshots of the 311 app: sign-in gated submit flow.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2] || 'screenshots';
fs.rmSync(outDir, { recursive: true, force: true });
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
  page.on('popup', (p) => log.push(`[${name}] popup opened: ${p.url()}`));
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); } catch (e) { log.push(`[${name}] goto: ${e.message}`); }
  await page.waitForTimeout(7000);
  return { ctx, page };
}
const shot = (page, n) => page.screenshot({ path: path.join(outDir, `${n}.png`) });
const probe = async (page, tag) => {
  const r = await page.evaluate(() => ({
    signinBtnVisible: !document.getElementById('signin-btn').hidden,
    submitText: document.getElementById('submit-btn').textContent,
    authNote: document.getElementById('auth-note').hidden ? null : document.getElementById('auth-note').textContent,
    banner: document.getElementById('banner').hidden ? null : document.getElementById('banner').textContent,
    identityDialog: !!document.querySelector('.esri-identity-modal, .esri-identity-form, [class*="esri-identity"]'),
    dialogText: (document.querySelector('[class*="esri-identity"]') || {}).innerText || null
  }));
  log.push(`[probe ${tag}] ` + JSON.stringify(r));
};

// Desktop flow
{
  const { ctx, page } = await open('desktop', { width: 1440, height: 900 }, false);
  await probe(page, 'load');
  await shot(page, 'desktop-1-start');
  try {
    const box = await page.locator('#map').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(4000);
    await page.click('#to-2');
    await page.waitForTimeout(500);
    await page.click('.tile >> nth=0');
    await page.click('#to-3');
    await page.fill('#f-desc', 'Large pothole in the right lane, about 2 ft wide.');
    await page.waitForTimeout(600);
    await probe(page, 'step3');
    await shot(page, 'desktop-4-details');
    await page.click('#submit-btn');
    await page.waitForTimeout(4000);
    await probe(page, 'after-submit');
    await shot(page, 'desktop-5-signin');
  } catch (e) { log.push(`[desktop] flow: ${e.message}`); }
  await ctx.close();
}
// Mobile header
{
  const { ctx, page } = await open('mobile', { width: 390, height: 844 }, true);
  await shot(page, 'mobile-1-start');
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'console.log'), log.join('\n') + '\n');
console.log(log.join('\n'));
