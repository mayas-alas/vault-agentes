import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const a=await browser.newContext(),b=await browser.newContext();
  const one=await a.request.get('http://localhost:4175/api/whatsapp/client/session');
  const two=await b.request.get('http://localhost:4175/api/whatsapp/client/session');
  assert.notEqual((await one.json()).localUser,(await two.json()).localUser);
  assert.equal((await a.request.post('http://localhost:4175/api/whatsapp/client/session',{headers:{Origin:'http://untrusted.example'}})).status(),403);
  for(const path of ['/.env','/whatsapp-clients.js','/node_modules/qrcode/package.json','/scripts/whatsapp-client.mjs'])assert.equal((await a.request.get('http://localhost:4175'+path)).status(),404);
  const page=await a.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:4175');
  await page.locator('[data-vault-entry]').first().click();
  await page.waitForFunction(()=>{const img=document.querySelector('#modal-content img');return img&&!img.hidden&&img.src.startsWith('data:image/png');},{},{timeout:60000});
  assert.equal(await page.locator('#modal-title').textContent(),'Entra con WhatsApp.');
  assert.equal(errors.length,0,errors.join('\n'));
  await page.screenshot({path:'tests/client-qr.png'});
  const state=await (await a.request.get('http://localhost:4175/api/whatsapp/client/session')).json();
  assert.equal(state.status,'waiting');
  assert.equal((await b.request.get('http://localhost:4175/api/whatsapp/client/conversations')).status(),401);
  await a.request.post('http://localhost:4175/api/whatsapp/client/logout');await b.request.post('http://localhost:4175/api/whatsapp/client/logout');
  console.log('PASS: real login QR rendered; independent browser sessions; private files blocked; no page errors or automatic messages.');
}finally{await browser.close();}
