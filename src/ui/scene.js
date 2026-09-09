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
