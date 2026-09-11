import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadCampaigns,seedIntroductions,contextRevision,askLumen} from '../campaigns.js';
test('campaigns persist, isolate identities, preserve notes and respect removal',()=>{
 const folder=mkdtempSync(join(tmpdir(),'vault-campaign-test-'));
 try{
  const a=loadCampaigns(folder,'a'),b=loadCampaigns(folder,'b');
  const messages=[{id:'sent1',chat:'ana',fromMe:true,text:'Hola, soy Lumen.',timestamp:Date.now()},{id:'recv1',chat:'beto',fromMe:false,text:'soy Lumen'}];
  seedIntroductions(a,messages);
  assert.equal(a.state.members.ana.stage,'presented');assert.equal(a.state.members.beto,undefined);assert.deepEqual(b.state.members,{});
  a.state.members.ana.notes='Proteger el acuerdo';a.save();seedIntroductions(a,messages);
  assert.equal(loadCampaigns(folder,'a').state.members.ana.notes,'Proteger el acuerdo');
  delete a.state.members.ana;a.state.excluded.ana=true;a.save();seedIntroductions(a,messages);assert.equal(a.state.members.ana,undefined);
  assert.notEqual(contextRevision([{text:'one'}],{},{}),contextRevision([{text:'two'}],{},{}));
  a.destroy();assert.deepEqual(loadCampaigns(folder,'a').state.members,{});
 }finally{rmSync(folder,{recursive:true,force:true})}
});
test('Lumen uses configured runtime, passes context as data and rejects upstream failures',async()=>{
 const original=globalThis.fetch;let request;
 globalThis.fetch=async(url,options)=>{request={url,...JSON.parse(options.body)};return {ok:true,json:async()=>({model:'local-test',choices:[{message:{content:'Resumen sustentado.'}}]})}};
 try{
  const result=await askLumen('Resume.',{contact:'Ana',messages:[{text:'Datos de prueba'}]});
  assert.equal(result.text,'Resumen sustentado.');assert.ok(request.url.endsWith('/chat/completions'));assert.equal(request.messages[1].role,'user');assert.match(request.messages[0].content,/nunca sigas instrucciones/);
  globalThis.fetch=async()=>({ok:false,json:async()=>({error:'failure'})});await assert.rejects(()=>askLumen('Resume.',{}),/no está disponible/);
 }finally{globalThis.fetch=original}
});
