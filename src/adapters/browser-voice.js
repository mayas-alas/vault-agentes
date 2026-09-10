export class BrowserVoiceAdapter{
constructor(){this.active=false;this.frame=0;this.run=0;this.recognitionText=''}
async start({onLevel,onText,onState}){
  const run=++this.run;this.active=true;this.recognitionText='';onState('requesting');
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    if(!this.active||run!==this.run){stream.getTracks().forEach(track=>track.stop());return false}
    this.stream=stream;this.context=new AudioContext();const analyser=this.context.createAnalyser();analyser.fftSize=128;this.context.createMediaStreamSource(stream).connect(analyser);
    const data=new Uint8Array(analyser.frequencyBinCount),tick=()=>{if(!this.active||run!==this.run)return;analyser.getByteFrequencyData(data);onLevel(data.reduce((a,b)=>a+b,0)/data.length/110);this.frame=requestAnimationFrame(tick)};tick();
    if(window.MediaRecorder){this.chunks=[];this.recorder=new MediaRecorder(stream);this.recorder.ondataavailable=event=>event.data.size&&this.chunks.push(event.data);this.recorder.start(250)}
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(Recognition){
      this.recognition=new Recognition();this.recognition.lang='es-MX';this.recognition.continuous=true;this.recognition.interimResults=true;
      this.recognition.onresult=event=>{let transcript='';for(let i=0;i<event.results.length;i++)transcript+=event.results[i][0].transcript+' ';this.recognitionText=transcript.trim();onText(this.recognitionText,event.results[event.results.length-1].isFinal)};
      this.recognition.onerror=()=>onState('recording');this.recognition.onend=()=>{if(this.active&&run===this.run)try{this.recognition.start()}catch{}};this.recognition.start();
    }
    onState('listening');return true;
  }catch(error){this.active=false;onState(error?.name==='NotAllowedError'?'denied':'error');return false}
}
async stop(){
  this.active=false;this.run++;cancelAnimationFrame(this.frame);try{this.recognition?.stop()}catch{}this.recognition=null;
  let blob;
  if(this.recorder&&this.recorder.state!=='inactive')blob=await new Promise(resolve=>{this.recorder.onstop=()=>resolve(new Blob(this.chunks,{type:this.recorder.mimeType||'audio/webm'}));this.recorder.stop()});
  this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;this.context?.close();this.context=null;this.recorder=null;
  if(blob?.size){try{const form=new FormData();form.append('model','auto');form.append('file',blob,blob.type.includes('ogg')?'voice.ogg':'voice.webm');const response=await fetch('/api/transcribe',{method:'POST',body:form});const data=await response.json();if(response.ok&&data.text?.trim())return data.text.trim()}catch{}}
  return this.recognitionText.trim();
}
speak(text,onEnd=()=>{}){if(!('speechSynthesis'in window)){onEnd();return}speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='es-MX';utterance.rate=.97;utterance.pitch=.94;utterance.onend=onEnd;speechSynthesis.speak(utterance)}
}
