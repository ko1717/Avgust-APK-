#!/usr/bin/env node
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', 'portal-ui-walkthrough');
const base = 'https://gen-lang-client-0175464290.web.app/';

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

async function clickNav(page, label) {
  await page.evaluate(name => {
    const btn = [...document.querySelectorAll('button')].find(
      b => b.textContent?.trim().startsWith(name)
    );
    btn?.click();
  }, label);
}

async function main() {
  await mkdir(outDir, {recursive: true});
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
    await page.waitForSelector('.farm-portal, .fp-gate', {timeout: 90000});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({
      path: path.join(outDir, `farm-portal-inicio-${vp.name}.png`),
      fullPage: true
    });

    await clickNav(page, 'Informes');
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({
      path: path.join(outDir, `farm-portal-informes-${vp.name}.png`),
      fullPage: true
    });

    await clickNav(page, 'Agendar');
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(outDir, `farm-portal-agendar-panel-${vp.name}.png`),
      fullPage: true
    });

    await page.close();
  }

  await browser.close();
  console.log(`Screenshots saved under ${outDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
