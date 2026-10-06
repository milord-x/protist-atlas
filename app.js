'use strict';
const T = THREE;
const canvas = document.querySelector('#scene');
const stage = document.querySelector('#stage');
const labelLayer = document.querySelector('#labels');
const leaderLayer = document.querySelector('#leaders');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let renderer;
try {
  renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:true});
} catch (error) {
  document.querySelector('#error').hidden = false;
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.32;
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(34, 1, .1, 100);
camera.position.set(0, .6, 15);
camera.lookAt(0, .6, 0);
scene.add(new T.HemisphereLight(0xe7f7df, 0x29424a, 2.4));
function light(color, intensity, pos) {
  const l = new T.DirectionalLight(color, intensity);
  l.position.set(...pos);
  scene.add(l);
}
light(0xfff4ce, 3.5, [-4, 6, 8]);
light(0x8ccfe0, 2.4, [5, 2, -3]);
light(0xb9d78a, 1.2, [-3, -3, 1]);
const pivot = new T.Group();
scene.add(pivot);
const sphere = new T.SphereGeometry(1, 32, 24);
const smallSphere = new T.SphereGeometry(1, 12, 8);
const models = [];
let current = 0;
let spinning = !reducedMotion.matches;
let labelsVisible = true;
let zoom = 1;
let activeLabels = [];
let width = 1, height = 1;
let drag = null;
let selected = null;
let seed = 78;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function mat(color, opacity = 1, roughness = .36) {
  return new T.MeshPhysicalMaterial({color, roughness, metalness:.04, clearcoat:.45, clearcoatRoughness:.28, transparent:opacity < 1, opacity, depthWrite:opacity >= 1, side:T.DoubleSide});
}
function ell(parent, pos, size, material, detail = true) {
  const mesh = new T.Mesh(detail ? sphere : smallSphere, material);
  mesh.position.set(...pos);
  mesh.scale.set(...size);
  parent.add(mesh);
  return mesh;
}
function tube(parent, points, radius, material, segments = 70) {
  const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
  const mesh = new T.Mesh(new T.TubeGeometry(curve, segments, radius, 8, false), material);
  parent.add(mesh);
  return mesh;
}
function group(parent, pos = [0,0,0], rot = [0,0,0]) {
  const g = new T.Group();
  g.position.set(...pos);
  g.rotation.set(...rot);
  parent.add(g);
  return g;
}
function mark(model, name, target, side, color) {
  model.labels.push({name, target, side, color});
}
function anchor(parent, point) {
  const o = new T.Object3D();
  o.position.set(...point);
  parent.add(o);
  return o;
}
function shell(parent, rx, ry, rz, color, start = .95, span = Math.PI * 2 - 1.9, opacity = .46, taper = 0) {
  const points = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    const y = -Math.cos(t * Math.PI);
    const r = Math.sin(t * Math.PI) * (1 + taper * y);
    points.push(new T.Vector2(rx * r, ry * y));
  }
  const mesh = new T.Mesh(new T.LatheGeometry(points, 96, start, span), mat(color, opacity));
  mesh.scale.z = rz / rx;
  parent.add(mesh);
  for (const phi of [start, start + span]) {
    const edge = points.map(p => [p.x * Math.sin(phi), p.y, p.x * Math.cos(phi) * rz / rx]);
    tube(parent, edge, .024, mat(color, .95), 80);
  }
  return mesh;
}
function nucleus(parent, pos, radius, color = 0xc3a2d8) {
  const g = group(parent, pos);
  const outer = new T.Mesh(new T.SphereGeometry(radius, 48, 32, .1, Math.PI * 1.7), mat(color, .79));
  outer.rotation.y = Math.PI * .68;
  g.add(outer);
  const inner = ell(g, [.06,.01,.19], [radius*.41,radius*.41,radius*.41], mat(0x684676));
  for (let i = 0; i < 23; i++) {
    const a = i * 2.39996;
    const y = 1 - 2 * (i + .5) / 23;
    const r = Math.sqrt(1-y*y);
    const p = new T.Vector3(Math.cos(a)*r, y, Math.sin(a)*r);
    if (p.z > .78) continue;
    const pore = new T.Mesh(new T.TorusGeometry(.033, .009, 5, 10), mat(0xebccee));
    pore.position.copy(p.multiplyScalar(radius*1.007));
    pore.lookAt(p.clone().multiplyScalar(2));
    g.add(pore);
  }
  for (let j = 0; j < 4; j++) {
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const t = i/23;
      pts.push([Math.sin(t*9+j)*radius*.56, (t-.5)*radius*1.35, Math.cos(t*12+j)*radius*.2]);
    }
    tube(g, pts, .014, mat(0x8e6a99, .8), 40);
  }
  return {outer, inner, g};
}
function chloroplast(parent, pos, size, angle = 0) {
  const g = group(parent, pos, [0,0,angle]);
  const skin = ell(g, [0,0,0], size, mat(0x467934, .64));
  for (let i = -3; i <= 3; i++) {
    const y = i * size[1] * .23;
    const r = Math.sqrt(1 - (y / size[1]) ** 2);
    for (let k = 0; k < 3; k++) {
      ell(g, [(k-1)*size[0]*.48,y,.035], [size[0]*.33*r,.025,size[2]*.66*r], mat(i%2 ? 0xa7bf57 : 0x7c9e41));
    }
  }
  return {g,skin};
}
function mitochondrion(parent, pos, scale = 1, angle = 0) {
  const g = group(parent, pos, [0,0,angle]);
  g.scale.setScalar(scale);
  const skin = ell(g,[0,0,0],[.32,.16,.13],mat(0xd48d68,.84));
  const pts = [];
  for (let i=0;i<21;i++) pts.push([-.25+i*.025, Math.sin(i*1.6)*.085, .09]);
  tube(g,pts,.022,mat(0xffc58b),50);
  return skin;
}
function basal(parent, pos) {
  const g = group(parent,pos);
  for (let i=0;i<9;i++) {
    const a=i/9*Math.PI*2;
    tube(g,[[Math.cos(a)*.07,-.13,Math.sin(a)*.07],[Math.cos(a)*.07,.1,Math.sin(a)*.07]],.016,mat(0xe6cc80),4);
  }
  return g;
}
function granules(parent, count, rx, ry, rz, color, radius = .035) {
  const mesh = new T.InstancedMesh(smallSphere,mat(color,.75),count);
  const dummy = new T.Object3D();
  for(let i=0;i<count;i++) {
    let x,y,z;
    do {x=random()*2-1;y=random()*2-1;z=random()*2-1;} while(x*x+y*y+z*z > .83);
    dummy.position.set(x*rx,y*ry,z*rz);
    dummy.scale.setScalar(radius*(.6+random()*.8));
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
  }
  parent.add(mesh);
  return mesh;
}
function eyespot(parent,pos,size=.19) {
  const g=group(parent,pos,[0,0,-.18]);
  const skin=ell(g,[0,0,0],[size*.55,size*1.5,size*.45],mat(0xe96842));
  for(let i=0;i<17;i++) {
    const a=i*2.4,r=Math.sqrt(i/17)*size;
    ell(g,[Math.cos(a)*r*.45,Math.sin(a)*r*1.3,.075],[.025,.026,.02],mat(i%2 ? 0xff9b57 : 0xb63b27),false);
  }
  return skin;
}
function euglena() {
  const m={root:new T.Group(),labels:[],color:'#b8d38d'};
  const g=m.root;
  shell(g,1.03,2.45,.72,0xa9c76e,.99,Math.PI*2-1.98,.33,.11);
  shell(g,.99,2.41,.69,0x70966c,1.02,Math.PI*2-2.04,.16,.11);
  const ridgeMat=mat(0xc5d890,.5);
  for(let i=0;i<24;i++) {
    const pts=[];
    for(let j=0;j<=55;j++) {
      const t=j/55, y=-Math.cos(t*Math.PI), phi=1.05+i/24*(Math.PI*2-2.1)+.18*Math.sin(t*Math.PI*2);
      const r=Math.sin(t*Math.PI)*(1+.11*y);
      pts.push([1.045*r*Math.sin(phi),2.45*y,.73*r*Math.cos(phi)]);
    }
    tube(g,pts,.009,ridgeMat,55);
  }
  const locations=[[-.54,1.05,.13,.16],[.53,1.13,.02,-.25],[-.62,-.08,-.12,.12],[.62,-.18,-.04,-.14],[-.48,-1.05,.13,-.35],[.44,-1.2,.03,.22],[-.13,-1.77,-.01,.45],[.13,.45,-.47,-.1]];
  const chloros=locations.map(p=>chloroplast(g,p.slice(0,3),[.22,.47,.14],p[3]));
  const n=nucleus(g,[.05,-.25,.22],.53);
  const eye=eyespot(g,[-.43,1.62,.35],.17);
  const reservoir=ell(g,[.11,1.81,.04],[.23,.42,.2],mat(0x5eabac,.46));
  const channel=tube(g,[[.1,1.76,.04],[.07,2.07,.02],[.02,2.4,.03]],.09,mat(0x91cdd1,.45),32);
  const vac=ell(g,[.49,1.57,.18],[.24,.24,.24],mat(0xbce9dc,.48));
  for(let i=0;i<9;i++) {
    const a=i/9*Math.PI*2;
    ell(g,[.49+Math.cos(a)*.29,1.57+Math.sin(a)*.29,.12],[.065,.065,.065],mat(0x92cabc,.65),false);
  }
  const b=basal(g,[.05,1.49,.16]);
  const long=tube(g,[[.02,1.53,.07],[.02,2.4,.07],[.35,3.18,.14],[-.15,3.77,.11],[-.87,3.4,.12],[-1.24,2.42,.14],[-1.55,1.31,.08]],.031,mat(0xc7d8a1),120);
  const short=tube(g,[[.15,1.49,.12],[.27,1.77,.13],[.18,2.04,.12]],.025,mat(0xe5d597),30);
  let grain;
  for(let i=0;i<16;i++) {
    const y=-1.8+i*.21,x=Math.sin(i*4.7)*.42;
    const gr=ell(g,[x,y,.39],[.09,.12,.065],mat(0xe0dca0));
    gr.rotation.z=i;
    if(i===4)grain=gr;
  }
  const py=ell(chloros[4].g,[0,-.06,.14],[.085,.085,.065],mat(0xdec975));
  granules(g,260,.9,2.25,.6,0xa7b47a,.018);
  mark(m,'Ұзын талшық',anchor(g,[-.63,3.64,.12]),'left','#d3e6aa');
  mark(m,'Көзше',eye,'left','#f18a62');
  mark(m,'Базальды денешіктер',b,'left','#e6cc80');
  mark(m,'Пелликула',anchor(g,[-.93,.62,.31]),'left','#b8d38d');
  mark(m,'Пиреноид',py,'left','#dec975');
  mark(m,'Парамилон түйіршіктері',grain,'left','#e0dca0');
  mark(m,'Микротүтікшелер',anchor(g,[-.64,-1.62,-.2]),'left','#b8d38d');
  mark(m,'Өзек',anchor(g,[.02,2.25,.03]),'right','#91cdd1');
  mark(m,'Резервуар',reservoir,'right','#91cdd1');
  mark(m,'Жиырылғыш вакуоль',vac,'right','#bce9dc');
  mark(m,'Қысқа талшық',anchor(g,[.24,1.85,.13]),'right','#e5d597');
  mark(m,'Ядрошық',n.inner,'right','#c3a2d8');
  mark(m,'Ядро',anchor(n.g,[.35,-.2,.25]),'right','#c3a2d8');
  mark(m,'Хлоропласттар',chloros[5].skin,'right','#98b864');
  mark(m,'Плазмалық мембрана',anchor(g,[.61,-1.89,.15]),'right','#83bd9d');
  mark(m,'Цитоплазма',anchor(g,[.11,-1.54,.13]),'right','#a7b47a');
  return m;
}
function chlamydomonas() {
  const m={root:new T.Group(),labels:[],color:'#bfce84'};
  const g=m.root;
  g.position.y=-.25;
  shell(g,1.52,1.86,1.02,0xcbcf8d,.99,Math.PI*2-1.98,.29,-.11);
  shell(g,1.46,1.8,.98,0x8cab69,1.02,Math.PI*2-2.04,.19,-.11);
  const cup=shell(g,1.32,1.67,.87,0x567f32,1.13,Math.PI*2-2.26,.82,-.13);
  for(let i=0;i<19;i++) {
    const pts=[];
    for(let j=0;j<36;j++) {
      const t=.08+j/35*.81, y=-Math.cos(t*Math.PI),phi=1.17+i/18*(Math.PI*2-2.34);
      const r=Math.sin(t*Math.PI)*(1-.13*y);
      pts.push([1.27*r*Math.sin(phi),1.62*y,.84*r*Math.cos(phi)]);
    }
    tube(g,pts,.023,mat(i%2 ? 0xb4bc4f : 0x83a544),48);
  }
  const n=nucleus(g,[0,.16,.32],.52,0xe2ae79);
  n.inner.material=mat(0xa56342);
  const eye=eyespot(g,[-1.08,.7,.45],.22);
  const b1=basal(g,[-.19,1.57,.12]);
  basal(g,[.19,1.57,.12]);
  const flagMat=mat(0xdde3a5);
  const f1=[[-.19,1.57,.12],[-.25,2.14,.1],[-.83,2.65,.1],[-1.3,3.4,.04],[-.68,3.87,.02],[.07,3.54,-.03]];
  const f2=[[.19,1.57,.12],[.46,2.18,.1],[1.1,2.46,.11],[1.62,3.06,.06],[1.91,2.74,.04],[1.68,2.2,.04]];
  tube(g,f1,.037,flagMat,100);
  tube(g,f2,.037,flagMat,100);
  const vac=ell(g,[-.5,1.24,.37],[.16,.17,.15],mat(0xb8e4d1,.56));
  ell(g,[.49,1.22,.35],[.16,.17,.15],mat(0xb8e4d1,.56));
  const py=ell(g,[.05,-1.08,.46],[.29,.3,.24],mat(0xc6a554));
  let starch;
  for(let i=0;i<10;i++) {
    const a=i/10*Math.PI*2;
    const s=ell(g,[.05+Math.cos(a)*.37,-1.08+Math.sin(a)*.38,.48],[.13,.17,.12],mat(0xe3dfa7));
    s.rotation.z=-a+Math.PI*.5;
    if(i===0)starch=s;
  }
  const mito=mitochondrion(g,[-.66,-.35,.44],1,-.5);
  mitochondrion(g,[.66,.87,.17],.84,.8);
  const golgi=group(g,[.65,-.51,.46],[0,.3,-.2]);
  for(let i=0;i<6;i++) tube(golgi,[[-.24,i*.065,0],[-.15,i*.065-.04,.05],[0,i*.065-.055,.065],[.19,i*.065,.02]],.031,mat(i%2 ? 0x8eb5b6 : 0x69969b),25);
  for(let i=0;i<8;i++)ell(golgi,[.27+random()*.13,random()*.45,.02],[.04,.04,.04],mat(0x93b4b4),false);
  granules(g,270,1.33,1.68,.82,0xd5c993,.022);
  mark(m,'Талшықтар',anchor(g,[-1.19,3.4,.05]),'left','#dde3a5');
  mark(m,'Көзше',eye,'left','#f18a62');
  mark(m,'Жиырылғыш вакуоль',vac,'left','#b8e4d1');
  mark(m,'Митохондрия',mito,'left','#efb181');
  mark(m,'Хлоропласт',anchor(g,[-1.17,-.83,.21]),'left','#a2bc69');
  mark(m,'Пиреноид',py,'left','#c6a554');
  mark(m,'Базальды денешіктер',b1,'right','#e6cc80');
  mark(m,'Жасуша қабықшасы',anchor(g,[1.1,1.08,.35]),'right','#cbcf8d');
  mark(m,'Ядро',anchor(n.g,[.37,.23,.16]),'right','#e2ae79');
  mark(m,'Ядрошық',n.inner,'right','#e2ae79');
  mark(m,'Гольджи жиынтығы',anchor(golgi,[0,.16,.06]),'right','#93b4b4');
  mark(m,'Крахмал түйіршіктері',starch,'right','#e3dfa7');
  mark(m,'Цитоплазма',anchor(g,[.55,-1.18,.14]),'right','#d5c993');
  return m;
}
function cryptophyte() {
  const m={root:new T.Group(),labels:[],color:'#e9b186'};
  const g=m.root;
  shell(g,1.15,2.04,.71,0xdcb38b,.97,Math.PI*2-1.94,.33,.08);
  shell(g,1.1,1.99,.67,0xdeb986,1.02,Math.PI*2-2.04,.18,.08);
  for(let i=0;i<19;i++) {
    const y=-1.9+i*.2,r=Math.sqrt(Math.max(0,1-(y/2.04)**2));
    const pts=[];
    for(let j=0;j<=45;j++) {
      const a=1.03+j/45*(Math.PI*2-2.06);
      pts.push([1.16*r*Math.sin(a),y,.72*r*Math.cos(a)]);
    }
    tube(g,pts,.008,mat(0xe8c89e,.4),50);
  }
  const plastid=group(g,[.53,.02,-.02],[0,-.1,-.07]);
  const membranes=[];
  for(let i=0;i<4;i++) {
    const layer=shell(plastid,.44-i*.042,1.52-i*.05,.42-i*.042,[0xe5b274,0xc58a56,0xe48f52,0xc66039][i],.58+i*.2,Math.PI*2-1.16-i*.4,.59);
    membranes.push(layer);
  }
  for(let i=0;i<21;i++) {
    const y=-1.21+i*.12,r=Math.sqrt(1-(y/1.46)**2);
    ell(plastid,[.03,y,-.075],[.26*r,.026,.24*r],mat(i%3===0 ? 0xf5aa62 : 0xd87b45));
  }
  const leftPlastid=chloroplast(g,[-.57,-.18,-.14],[.3,1.29,.25],-.1);
  leftPlastid.skin.material=mat(0xb96c43,.83);
  leftPlastid.g.children.slice(1).forEach(o=>o.material=mat(0xe69456));
  const n=nucleus(g,[-.08,-1.12,.28],.43,0xb9b578);
  n.inner.material=mat(0x7f794f);
  const py=ell(plastid,[-.05,-.09,.14],[.18,.2,.17],mat(0xe6d198));
  const nm=ell(plastid,[.22,.68,.29],[.092,.14,.06],mat(0xddc4e9));
  ell(plastid,[.22,.68,.338],[.035,.05,.016],mat(0x9c72ac));
  const starch=ell(plastid,[.25,-.53,.27],[.085,.13,.07],mat(0xeee0c0));
  for(let i=0;i<7;i++)ell(plastid,[.23,1.01-i*.25,.27],[.043,.06,.036],mat(0xe9d5b2),false);
  const gullet=ell(g,[-.18,1.09,.25],[.26,.48,.19],mat(0xaab3a2,.52));
  const b=basal(g,[-.18,1.57,.14]);
  const f1=[[-.19,1.57,.14],[-.48,2.08,.18],[-.67,2.63,.16],[-.9,3.23,.12],[-.69,3.67,.12]];
  const f2=[[-.07,1.58,.14],[.2,2.28,.2],[.64,2.75,.19],[1.17,3.05,.18],[1.65,3.03,.13]];
  const flagMat=mat(0xe2cead);
  tube(g,f1,.03,flagMat,90);tube(g,f2,.028,flagMat,90);
  for(const points of [f1,f2]) {
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    for(let i=8;i<44;i++) {
      const t=i/45,p=curve.getPoint(t),tan=curve.getTangent(t);
      const side=new T.Vector3(-tan.y,tan.x,0).multiplyScalar(.14);
      for(const s of [-1,1])tube(g,[p.toArray(),p.clone().addScaledVector(side,s).add(new T.Vector3(0,.035,0)).toArray()],.0045,flagMat,3);
    }
  }
  let eject;
  for(let i=0;i<11;i++) {
    const y=.35+i*.107,x=-.37-Math.sin(i*.3)*.12;
    const ejectGroup=group(g,[x,y,.38],[0,0,.3]);
    const pts=[];
    for(let j=0;j<36;j++) {
      const a=j/35*Math.PI*6,r=.038*(1-j/45);
      pts.push([Math.cos(a)*r,j/35*.09,Math.sin(a)*r]);
    }
    tube(ejectGroup,pts,.009,mat(0xb3c6c4),40);
    if(i===4)eject=ejectGroup;
  }
  const rib=ell(plastid,[.27,.94,.3],[.028,.028,.028],mat(0xe8dcd0),false);
  granules(g,200,1.0,1.87,.59,0xcfc2a2,.017);
  mark(m,'Талшықтар',anchor(g,[-.86,3.17,.12]),'left','#e2cead');
  mark(m,'Талшық түктері',anchor(g,[-.51,2.58,.16]),'left','#e2cead');
  mark(m,'Жасуша ойысы',gullet,'left','#b3c6c4');
  mark(m,'Эжектосомалар',eject,'left','#b3c6c4');
  mark(m,'Пиреноид',py,'left','#e6d198');
  mark(m,'Пластида',leftPlastid.skin,'left','#e69456');
  mark(m,'Ядро',anchor(n.g,[-.23,-.09,.25]),'left','#b9b578');
  mark(m,'Перипласт',anchor(g,[-.72,-1.55,.18]),'left','#dcb38b');
  mark(m,'Базальды денешіктер',b,'right','#e6cc80');
  mark(m,'Рибосомалар',rib,'right','#e8dcd0');
  mark(m,'Нуклеоморф',nm,'right','#ddc4e9');
  mark(m,'Сыртқы жұп мембрана',anchor(plastid,[.36,.31,.21]),'right','#e5b274');
  mark(m,'Перипластидтік кеңістік',anchor(plastid,[.29,.14,.25]),'right','#e5b274');
  mark(m,'Ішкі жұп мембрана',anchor(plastid,[.21,-.28,.22]),'right','#e48f52');
  mark(m,'Крахмал түйіршіктері',starch,'right','#eee0c0');
  mark(m,'Плазмалық мембрана',anchor(g,[.72,-1.57,.18]),'right','#dcb38b');
  return m;
}
models.push(euglena(),chlamydomonas(),cryptophyte());
for(const m of models) {pivot.add(m.root);m.root.visible=false;}
function reset() {
  pivot.rotation.set(.06,-.12,-.17);
  zoom=1;
  resize();
}
function selectModel(index) {
  current=index;
  for(let i=0;i<models.length;i++)models[i].root.visible=i===index;
  document.querySelectorAll('[data-model]').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
  labelLayer.replaceChildren();leaderLayer.replaceChildren();selected=null;
  activeLabels=models[index].labels.map(item=>{
    const button=document.createElement('button');
    button.className='label '+item.side;
    button.textContent=item.name;
    button.style.setProperty('--color',item.color);
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('fill','none');path.setAttribute('stroke',item.color);path.setAttribute('stroke-width','.8');path.setAttribute('opacity','.4');
    const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.setAttribute('r','2.5');dot.setAttribute('fill',item.color);
    leaderLayer.append(path,dot);labelLayer.append(button);
    button.onmouseenter=button.onfocus=()=>{selected=item;path.setAttribute('opacity','1');path.setAttribute('stroke-width','1.5');dot.setAttribute('r','4');};
    button.onmouseleave=button.onblur=()=>{selected=null;path.setAttribute('opacity','.4');path.setAttribute('stroke-width','.8');dot.setAttribute('r','2.5');};
    return {...item,button,path,dot};
  });
  reset();
}
function resize() {
  width=stage.clientWidth;height=stage.clientHeight;
  renderer.setSize(width,height,false);
  camera.aspect=width/height;
  const vertical=8.0/zoom;
  const horizontal=width<600 ? 6.6/zoom : 10.1/zoom;
  camera.position.z=Math.max(vertical,horizontal/camera.aspect)/(2*Math.tan(T.MathUtils.degToRad(17)));
  camera.updateProjectionMatrix();
}
const projected=new T.Vector3();
function drawLabels() {
  if(!labelsVisible)return;
  const margin=width<600 ? 13 : Math.max(32,width*.077);
  const col=width<600 ? Math.min(112,width*.29) : Math.min(240,width*.21);
  for(const side of ['left','right']) {
    const list=activeLabels.filter(l=>l.side===side);
    const top=height*.15;
    const bottom=height*.89;
    for(let i=0;i<list.length;i++) {
      const l=list[i];
      l.target.getWorldPosition(projected);projected.project(camera);
      const px=(projected.x*.5+.5)*width,py=(-projected.y*.5+.5)*height;
      const y=top+(bottom-top)*i/Math.max(1,list.length-1);
      const left=side==='left';
      const x=left ? margin : width-margin-col;
      l.button.style.width=col+'px';
      l.button.style.left=x+'px';l.button.style.top=(y-l.button.offsetHeight/2)+'px';
      const end=left ? x+col+12 : x-12;
      const elbow=left ? end+Math.min(width*.038,58) : end-Math.min(width*.038,58);
      l.path.setAttribute('d',`M ${px.toFixed(1)} ${py.toFixed(1)} L ${elbow.toFixed(1)} ${y.toFixed(1)} L ${end.toFixed(1)} ${y.toFixed(1)}`);
      l.dot.setAttribute('cx',px);l.dot.setAttribute('cy',py);
    }
  }
}
function updateSpin() {
  document.querySelector('#rotate').setAttribute('aria-pressed',String(spinning));
  document.querySelector('#rotate').setAttribute('aria-label',spinning?'Айналуды тоқтату':'Айналдыру');
  document.querySelector('#play-icon').setAttribute('d',spinning?'M9 6v12M15 6v12':'m9 5 10 7-10 7Z');
}
function toggleLabels() {
  labelsVisible=!labelsVisible;
  labelLayer.hidden=!labelsVisible;leaderLayer.style.display=labelsVisible?'':'none';
  document.querySelector('#annotate').setAttribute('aria-pressed',String(labelsVisible));
}
async function fullScreen() {
  try {
    if(document.fullscreenElement)await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch(error) {
    document.querySelector('#fullscreen').title='Браузердің толық экран режимін қолданыңыз';
  }
}
document.querySelectorAll('[data-model]').forEach(b=>b.onclick=()=>selectModel(Number(b.dataset.model)));
document.querySelector('#rotate').onclick=()=>{spinning=!spinning;updateSpin();};
document.querySelector('#annotate').onclick=toggleLabels;
document.querySelector('#reset').onclick=reset;
document.querySelector('#fullscreen').onclick=fullScreen;
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{
  if(!drag)return;
  pivot.rotation.y+=(e.clientX-drag.x)*.007;
  pivot.rotation.x=T.MathUtils.clamp(pivot.rotation.x+(e.clientY-drag.y)*.005,-.7,.7);
  drag={x:e.clientX,y:e.clientY};
});
canvas.addEventListener('pointerup',()=>drag=null);
canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('lostpointercapture',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=T.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.001),.7,1.45);resize();},{passive:false});
window.addEventListener('resize',resize);
window.addEventListener('keydown',e=>{
  if(e.target.tagName==='BUTTON'&&['Space','Enter'].includes(e.code))return;
  if(e.code==='Space'){e.preventDefault();spinning=!spinning;updateSpin();}
  if(e.code==='KeyL')toggleLabels();
  if(e.code==='KeyR')reset();
  if(e.code==='KeyF')fullScreen();
  if(['ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();pivot.rotation.y+=e.code==='ArrowLeft'?-.12:.12;}
});
reducedMotion.addEventListener('change',e=>{spinning=!e.matches;updateSpin();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.querySelector('#error').hidden=false;});
canvas.addEventListener('webglcontextrestored',()=>location.reload());
let previous=performance.now();
function animate(now) {
  const dt=Math.min((now-previous)/1000,.05);previous=now;
  if(spinning&&!drag&&!selected&&!document.hidden)pivot.rotation.y+=dt*.085;
  renderer.render(scene,camera);
  drawLabels();
  requestAnimationFrame(animate);
}
selectModel(0);updateSpin();requestAnimationFrame(animate);
window.atlas={models,pivot,renderer,camera,selectModel,get current(){return current;},get spinning(){return spinning;},get labelsVisible(){return labelsVisible;}};
