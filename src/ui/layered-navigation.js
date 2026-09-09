const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const topNav=$('[data-top-nav]');
const signalRail=$('[data-signal-rail]');
const chapterNav=$('[data-chapter-nav]');
const sectionLinks=$$('[data-section-link]');
const pageRoot=$('main#top');
const trackedSections=pageRoot?[pageRoot,...$$('section[id]',pageRoot)]:[];

function updateLayeredNavigation(){
  if(!topNav)return;
  const compact=scrollY>28;
  topNav.classList.toggle('is-scrolled',compact);
  if(signalRail){
    const railBox=signalRail.getBoundingClientRect();
    signalRail.classList.toggle('rail-leaving',railBox.top<topNav.offsetHeight+8);
  }
  const offset=topNav.offsetHeight+48;
  let current='top';
  trackedSections.forEach(section=>{if(section.getBoundingClientRect().top<=offset)current=section.id});
  const range=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  chapterNav?.style.setProperty('--journey-progress',Math.min(1,Math.max(0,scrollY/range)));
  document.body.dataset.currentSection=current;
  sectionLinks.forEach(link=>{
    const active=link.dataset.sectionLink===current;
    link.classList.toggle('is-active',active);
    if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
  });
}

let navigationFrame=0;
addEventListener('scroll',()=>{
  if(navigationFrame)return;
  navigationFrame=requestAnimationFrame(()=>{navigationFrame=0;updateLayeredNavigation()});
},{passive:true});
addEventListener('resize',updateLayeredNavigation,{passive:true});
updateLayeredNavigation();
