import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage();let linked=false,sent=null;
 await page.route('**/api/whatsapp/client/session',route=>route.fulfill({json:linked?{status:'connected',phone:'5215550000000'}:{status:'waiting',localUser:'test'}}));
 await page.route('**/api/whatsapp/client/conversations',route=>route.fulfill({json:{contacts:[{id:'test@s.whatsapp.net',name:'Ana'}],messages:[{chat:'test@s.whatsapp.net',name:'Ana',text:'Reunión mañana',fromMe:false}]}}));
 await page.route('**/api/whatsapp/client/send',async route=>{sent=route.request().postDataJSON();await route.fulfill({json:{ok:true,messageId:'fixture-1'}})});
 await page.route('**/api/whatsapp/client/logout',async route=>{linked=false;await route.fulfill({json:{ok:true}})});
 await page.goto('http://localhost:4175');
 assert.equal(await page.locator('[data-connect="whatsapp"]').count(),0);
 await page.locator('[data-vault-entry]').first().click();
 await page.waitForSelector('#client-status');assert.equal(await page.locator('#vault-experience').isVisible(),false);
 linked=true;await page.waitForSelector('#vault-experience',{state:'visible',timeout:10000});
 await page.keyboard.press('Control+k');await page.locator('#contact-search').fill('Ana');await page.locator('#contact-results button').click();
 await page.waitForSelector('#vault-guided-panel:not([hidden])');assert.match(await page.locator('#vault-guided-panel').textContent(),/Mensaje para Ana/);
 await page.locator('#send-message').fill('Hola Ana, soy Lumen.');await page.locator('#send-message').press('Control+Enter');
 await page.waitForFunction(()=>document.querySelector('#send-status')?.textContent.includes('WhatsApp aceptó'));
 assert.equal(sent.contactId,'test@s.whatsapp.net');assert.equal(sent.message,'Hola Ana, soy Lumen.');
 await page.locator('[data-logout]').click();await page.waitForSelector('#vault-experience',{state:'hidden'});
 const first=await context.request.get('http://localhost:4175/api/whatsapp/client/session');const before=(await first.json()).localUser;
 const cookies=await context.cookies();
 await context.request.post('http://localhost:4175/api/whatsapp/client/logout');
 const replay=await browser.newContext();await replay.addCookies(cookies);
 const after=await (await replay.request.get('http://localhost:4175/api/whatsapp/client/session')).json();assert.notEqual(after.localUser,before);
 console.log('PASS: QR gates vault, Ctrl+K opens a confirmed message composer, logout clears view, and cookie replay is revoked. WhatsApp UI uses controlled fixtures.');
}finally{await browser.close();}
