#!/usr/bin/env node
/**
 * Captures farm portal UI at desktop / tablet / phone widths.
 * Seeds a local invitation so the gate is bypassed without Firestore.
 */
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'artifacts', 'portal-ui-walkthrough');
const port = 3012;
const base = `http://127.0.0.1:${port}/`;

const mockInvitation = {
  id: 'inv_demo_walkthrough',
  code: 'ASEG-9999',
  token: 'demotokenwalkthrough',
  farm: 'Invepalmas',
  farmKey: 'invepalmas',
  clientName: 'Cliente Demo',
  status: 'active',
  createdAt: new Date().toISOString(),
  createdBy: 'AVGUST Demo'
};

const viewports = [
  {name: 'desktop-1440', width: 1440, height: 900},
  {name: 'tablet-834', width: 834, height: 1112},
  {name: 'phone-390', width: 390, height: 844}
];

function waitForServer(ms = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      try {
        const res = await fetch(base);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > ms) return reject(new Error('Dev server did not start'));
      setTimeout(tick, 500);
    };
    tick();
  });
}

async function main() {
  await mkdir(outDir, {recursive: true});

  const child = spawn('npx', ['vinext', 'dev', '--hostname', '127.0.0.1', '-p', String(port)], {
    cwd: root,
    stdio: 'ignore'
  });

  try {
    await waitForServer();
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: '/usr/local/bin/google-chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    for (const vp of viewports) {
      const page = await browser.newPage();
      await page.setViewport({width: vp.width, height: vp.height, deviceScaleFactor: 1});
      await page.evaluateOnNewDocument(
        (invKey, sessionKey, invitation) => {
          localStorage.setItem(invKey, JSON.stringify([invitation]));
          localStorage.setItem(sessionKey, JSON.stringify(invitation));
        },
        'care360:invitations',
        'care360:client_session',
        mockInvitation
      );

      await page.goto(base, {waitUntil: 'networkidle2', timeout: 120000});
      await new Promise(r => setTimeout(r, 2500));
      await page.screenshot({
        path: path.join(outDir, `farm-portal-inicio-${vp.name}.png`),
        fullPage: true
      });

      const informesBtn = await page.$('button.fp-sidebar-link:nth-child(2)');
      if (informesBtn) await informesBtn.click();
      else await page.evaluate(() => {
        const btn = [...document.querySelectorAll('.fp-mobile-nav button')].find(b => b.textContent?.includes('Informes'));
        btn?.click();
      });
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({
        path: path.join(outDir, `farm-portal-informes-${vp.name}.png`),
        fullPage: true
      });

      const fab = await page.$('.fp-assurance-fab');
      if (fab) await fab.click();
      await new Promise(r => setTimeout(r, 600));
      await page.screenshot({
        path: path.join(outDir, `farm-portal-agendar-panel-${vp.name}.png`),
        fullPage: true
      });

      await page.close();
    }

    await browser.close();
    console.log(`Screenshots saved under ${outDir}`);
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
