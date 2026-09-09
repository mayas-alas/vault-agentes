export class BrowserVoiceAdapter{
  constructor(){this.active=false;this.frame=0;this.run=0;this.stream=null;this.context=null;this.recognition=null;this.recorder=null;this.chunks=[]}
  async start({onLevel,onText,onState}){
    const run=++this.run;this.active=true;onState('listening');let recording=false;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      if(!this.active||run!==this.run){stream.getTracks().forEach(track=>track.stop());return{recording:false}}
      this.stream=stream;this.context=new AudioContext();const analyser=this.context.createAnalyser();analyser.fftSize=128;this.context.createMediaStreamSource(stream).connect(analyser);const data=new Uint8Array(analyser.frequencyBinCount),tick=()=>{if(!this.active||run!==this.run)return;analyser.getByteFrequencyData(data);onLevel(data.reduce((sum,value)=>sum+value,0)/data.length/110);this.frame=requestAnimationFrame(tick)};tick();recording=this.startRecorder(stream);
    }catch{if(!this.active||run!==this.run)return{recording:false};this.synthetic(onLevel,run);onState('fallback')}
    if(!this.active||run!==this.run)return{recording:false};const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(Recognition){this.recognition=new Recognition();this.recognition.lang='es-MX';this.recognition.continuous=true;this.recognition.interimResults=true;this.recognition.onresult=event=>{const result=event.results[event.results.length-1];onText(result[0].transcript,result.isFinal)};this.recognition.onerror=()=>onState('recognition-unavailable');this.recognition.onend=()=>{if(this.active&&run===this.run)try{this.recognition.start()}catch{}};try{this.recognition.start()}catch{}}
    return{recording};
  }
  startRecorder(stream){
    if(!window.MediaRecorder)return false;const candidates=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'],mime=candidates.find(value=>MediaRecorder.isTypeSupported?.(value));
    try{this.chunks=[];this.recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);this.recorder.ondataavailable=event=>{if(event.data.size)this.chunks.push(event.data)};this.recorder.start(250);return true}catch{this.recorder=null;return false}
  }
  synthetic(onLevel,run){const tick=()=>{if(!this.active||run!==this.run)return;onLevel(.24+Math.random()*.42);this.frame=requestAnimationFrame(tick)};tick()}
  async stop(){
    this.active=false;this.run++;cancelAnimationFrame(this.frame);this.recognition?.stop();this.recognition=null;const recorder=this.recorder;let audio=null;
    if(recorder&&recorder.state!=='inactive')audio=await new Promise(resolve=>{recorder.onstop=()=>{const blob=new Blob(this.chunks,{type:recorder.mimeType||'audio/webm'});resolve(blob.size?{blob,mime:blob.type}:null)};recorder.stop()});
    this.recorder=null;this.chunks=[];this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;await this.context?.close();this.context=null;return audio;
  }
  async speak(text,onEnd=()=>{}){
    const fallback=()=>{if(!('speechSynthesis'in window)){onEnd();return}speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='es-MX';utterance.rate=.97;utterance.pitch=.94;utterance.onend=onEnd;utterance.onerror=onEnd;speechSynthesis.speak(utterance)};
    try{const response=await fetch('/api/speech',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});if(!response.ok)throw new Error('remote voice unavailable');const url=URL.createObjectURL(await response.blob()),audio=new Audio(url),done=()=>{URL.revokeObjectURL(url);onEnd()};audio.onended=done;audio.onerror=()=>{URL.revokeObjectURL(url);fallback()};await audio.play()}catch{fallback()}
  }
}
