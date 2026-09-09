import*as THREE from'three';

const clamp=(n,min,max)=>Math.max(min,Math.min(n,max));

export class PulseScene{
  constructor(canvas,{compact=false}={}){
    this.canvas=canvas;this.compact=compact;this.energy=.15;this.burstEnergy=0;this.pointer={x:0,y:0};this.scroll=0;
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(42,1,.1,100);this.camera.position.z=compact?5.4:6.5;
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
    this.group=new THREE.Group();this.scene.add(this.group);this.rings=[];this.satellites=[];
    const count=compact?900:1400,positions=new Float32Array(count*3);
    for(let i=0;i<count;i++){const r=1.45+Math.random()*1.25,a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1);positions[i*3]=r*Math.sin(b)*Math.cos(a);positions[i*3+1]=r*.7*Math.sin(b)*Math.sin(a);positions[i*3+2]=r*Math.cos(b)}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.points=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xa8f0c3,size:compact?.023:.019,transparent:true,opacity:.66,blending:THREE.AdditiveBlending,depthWrite:false}));this.group.add(this.points);
    for(let i=0;i<5;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.35+i*.22,.006,5,180),new THREE.MeshBasicMaterial({color:i%2?0xd8ff8f:0x6eb28a,transparent:true,opacity:.11+i*.018,blending:THREE.AdditiveBlending}));ring.rotation.set(Math.random()*2,Math.random()*2,Math.random()*2);this.rings.push(ring);this.group.add(ring)}
    for(let i=0;i<3;i++){const dot=new THREE.Mesh(new THREE.SphereGeometry(.025+i*.005,8,8),new THREE.MeshBasicMaterial({color:i===1?0xd8ff8f:0xa8f0c3}));this.satellites.push(dot);this.group.add(dot)}
    this.core=new THREE.Mesh(new THREE.IcosahedronGeometry(.58,2),new THREE.MeshBasicMaterial({color:0x9fe9ba,wireframe:true,transparent:true,opacity:.42,blending:THREE.AdditiveBlending}));this.group.add(this.core);
    this.halo=new THREE.Mesh(new THREE.RingGeometry(.72,.74,96),new THREE.MeshBasicMaterial({color:0xd8ff8f,transparent:true,opacity:.14,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));this.group.add(this.halo);
    this.clock=new THREE.Clock();this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.resize();new ResizeObserver(()=>this.resize()).observe(canvas);this.animate();
  }
  setEnergy(value){this.energy=clamp(value,.08,1.4)}
  setPointer(x,y){this.pointer.x=clamp(x,-1,1);this.pointer.y=clamp(y,-1,1)}
  setScroll(value){this.scroll=clamp(value,0,1)}
  burst(){this.burstEnergy=1}
  resize(){const box=this.canvas.getBoundingClientRect();if(!box.width||!box.height)return;this.renderer.setSize(box.width,box.height,false);this.camera.aspect=box.width/box.height;this.camera.updateProjectionMatrix()}
  animate(){
    const t=this.clock.getElapsedTime(),motion=this.reduced?0:1,pulse=1+Math.sin(t*2.25)*.025*motion+this.energy*.1+this.burstEnergy*.2;
    this.burstEnergy*=.94;this.group.rotation.y+=(this.pointer.x*.22+this.scroll*.55-this.group.rotation.y)*.025*motion;this.group.rotation.x+=(-this.pointer.y*.14+Math.sin(t*.12)*.17-this.group.rotation.x)*.025*motion;
    this.group.position.y+=(this.scroll*-.5-this.group.position.y)*.025;this.camera.position.x+=(this.pointer.x*.25-this.camera.position.x)*.025;this.camera.position.y+=(-this.pointer.y*.16-this.camera.position.y)*.025;
    this.points.rotation.z=-t*.035*motion;this.points.material.opacity=.54+this.energy*.16+this.burstEnergy*.18;this.core.scale.setScalar(pulse);this.core.rotation.x=t*.22*motion;this.core.rotation.y=t*.18*motion;
    this.halo.scale.setScalar(1+this.energy*.12+this.burstEnergy*.8);this.halo.material.opacity=.1+this.burstEnergy*.32;this.halo.lookAt(this.camera.position);
    this.rings.forEach((ring,i)=>{ring.rotation.z+=.0007*(i+1)*(1+this.energy)*motion;ring.scale.setScalar(1+this.burstEnergy*(.16+i*.035))});
    this.satellites.forEach((dot,i)=>{const speed=.38+i*.13,rad=1.52+i*.31;dot.position.set(Math.cos(t*speed+i*2.1)*rad,Math.sin(t*(speed*.72)+i)*rad*.5,Math.sin(t*speed+i*2.1)*.55);dot.scale.setScalar(1+this.energy*.7+this.burstEnergy*2)});
    this.renderer.render(this.scene,this.camera);requestAnimationFrame(()=>this.animate());
  }
}

export class VaultFlowScene{
  constructor(canvas,providerCount=4){
    this.canvas=canvas;this.providerCount=providerCount;this.pointer={x:0,y:0};this.target={x:0,y:0};this.active=-1;this.clock=new THREE.Clock();
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(40,1,.1,100);this.camera.position.z=6.3;
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
    this.group=new THREE.Group();this.scene.add(this.group);this.nodes=[];this.links=[];
    const starPositions=new Float32Array(850*3);
    for(let i=0;i<850;i++){const r=2.2+Math.random()*2.2,a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1);starPositions[i*3]=r*Math.sin(b)*Math.cos(a);starPositions[i*3+1]=r*.7*Math.sin(b)*Math.sin(a);starPositions[i*3+2]=r*Math.cos(b)}
    const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));this.stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0x9fe9ba,size:.018,transparent:true,opacity:.58,blending:THREE.AdditiveBlending,depthWrite:false}));this.group.add(this.stars);
    this.core=new THREE.Mesh(new THREE.IcosahedronGeometry(.72,2),new THREE.MeshBasicMaterial({color:0xa8f0c3,wireframe:true,transparent:true,opacity:.52,blending:THREE.AdditiveBlending}));this.group.add(this.core);
    this.halo=new THREE.Mesh(new THREE.RingGeometry(.9,.91,96),new THREE.MeshBasicMaterial({color:0xd8ff8f,transparent:true,opacity:.16,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));this.group.add(this.halo);
    for(let i=0;i<providerCount;i++){const angle=-Math.PI/2+i*Math.PI*2/providerCount,r=1.72;const node=new THREE.Mesh(new THREE.SphereGeometry(.11,12,12),new THREE.MeshBasicMaterial({color:0x648b76,transparent:true,opacity:.72,blending:THREE.AdditiveBlending}));node.position.set(Math.cos(angle)*r,Math.sin(angle)*r*.68,Math.sin(angle*1.7)*.28);this.nodes.push(node);this.group.add(node);const points=new Float32Array([0,0,0,node.position.x,node.position.y,node.position.z]);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(points,3));const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0x6eb28a,transparent:true,opacity:.16,blending:THREE.AdditiveBlending}));this.links.push(line);this.group.add(line)}
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.resize();new ResizeObserver(()=>this.resize()).observe(canvas);this.animate();
  }
  setStep(step){this.active=step-1;this.nodes.forEach((node,i)=>{const on=this.active<0||i===this.active;node.material.color.set(on?0xd8ff8f:0x648b76);node.material.opacity=on?.95:.35});this.links.forEach((line,i)=>line.material.opacity=this.active<0?.16:i===this.active?.72:.08)}
  setPointer(x,y){this.target.x=clamp(x,-1,1);this.target.y=clamp(y,-1,1)}
  drag(dx,dy){this.pointer.x+=dx*.008;this.pointer.y+=dy*.008;this.target.x=clamp(this.pointer.x,-1,1);this.target.y=clamp(this.pointer.y,-1,1)}
  resize(){const box=this.canvas.getBoundingClientRect();if(!box.width||!box.height)return;this.renderer.setSize(box.width,box.height,false);this.camera.aspect=box.width/box.height;this.camera.updateProjectionMatrix()}
  animate(){const t=this.clock.getElapsedTime(),motion=this.reduced?0:1;this.pointer.x+=(this.target.x-this.pointer.x)*.06;this.pointer.y+=(this.target.y-this.pointer.y)*.06;this.group.rotation.y+=(this.pointer.x*.32+Math.sin(t*.16)*.12-this.group.rotation.y)*.025*motion;this.group.rotation.x+=(-this.pointer.y*.18+Math.cos(t*.13)*.08-this.group.rotation.x)*.025*motion;this.stars.rotation.z=t*.012*motion;this.core.rotation.x=t*.18*motion;this.core.rotation.y=-t*.22*motion;this.core.scale.setScalar(1+Math.sin(t*2)*.035);this.halo.lookAt(this.camera.position);this.halo.scale.setScalar(1+Math.sin(t*1.3)*.08);this.nodes.forEach((node,i)=>node.scale.setScalar(1+Math.sin(t*2.2+i)*.18));this.renderer.render(this.scene,this.camera);requestAnimationFrame(()=>this.animate())}
}
