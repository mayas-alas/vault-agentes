import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';

// Exercise the actual launch arguments, replacing only the WhatsApp worker
// with cat so this regression check never links accounts or sends messages.
const source=readFileSync(new URL('../whatsapp-clients.js',import.meta.url),'utf8');
const prefix=source.match(/spawn\('wsl\.exe',\[(.*?)'node','--input-type=module'/s)?.[1];
assert.ok(prefix,'Worker launch arguments must be inspectable');
const args=[...prefix.matchAll(/'([^']*)'/g)].map(match=>match[1]);
args.push('cat');
const child=spawn('wsl.exe',args,{windowsHide:true});
let output='',error='';
child.stdout.on('data',chunk=>output+=chunk);
child.stderr.on('data',chunk=>error+=chunk);
const timer=setTimeout(()=>child.kill(),10000);
const result=new Promise((resolve,reject)=>{
  child.on('error',reject);
  child.on('close',code=>resolve(code));
});
child.stdin.on('error',()=>{});
child.stdin.end('vault-worker-input-probe\n');
try{
  assert.equal(await result,0,error);
  assert.equal(output.trim(),'vault-worker-input-probe','Podman must forward stdin to the WhatsApp worker');
  console.log('PASS: production worker launch forwards commands through WSL and Podman.');
}finally{clearTimeout(timer);}
