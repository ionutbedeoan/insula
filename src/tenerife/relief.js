// Metres in the shared Tenerife world grid. Unity consumes an export of this terrain.
const tenerifeRelief = {
  mountains: [
    {id:'ladera', name:'Montaña del Alisio', x:294,z:-622,rx:275,rz:390,rise:133},
    {id:'pinar', name:'Montaña del Pinar', x:-447,z:-1065,rx:202,rz:290,rise:149}
  ],
  volcano:{id:'volcan',name:'Volcán del Viento',x:951,z:-1420,rx:452,rz:444,rise:369},
  cliffs:{name:'Acantilados del Poniente',from:-894,to:-375,height:142},
  beaches:[
    {name:'Playa de la Arena Negra',z:1244,span:167,width:63},
    {name:'Caleta de Obsidiana',z:1422,span:50,width:32}
  ],
  basins:[
    {id:'charco',name:'Charcos de Lava',x:-790,z:1395,rx:10.9,rz:19,y:.78,depth:2.1,sea:true,seed:3},
    {id:'charquito',name:'Charco del Viento',x:-784,z:1436,rx:7.7,rz:11.5,y:1.20,depth:2.0,sea:true,seed:5},
    {id:'alisio',name:'Lago del Alisio',x:-118,z:-731,rx:47,rz:35,y:267.1,depth:7.1,sea:false,seed:11},
    {id:'pinar',name:'Laguna del Pinar',x:-360,z:-608,rx:35,rz:26,y:224.5,depth:5.7,sea:false,seed:17}
  ],
  cascades:[
    {name:'Salto del Alisio',x:-74,z:-731,dx:-1,dz:.09,y:267.1,drop:24,width:8.4},
    {name:'Cascada de La Ladera',x:-123,z:-761,dx:.11,dz:1,y:267.1,drop:15,width:6.1},
    {name:'Cascada del Pinar',x:-329,z:-604,dx:-1,dz:-.15,y:224.5,drop:19,width:6.9}
  ],
  towns:[
    {name:'San Bruma',x:-499,z:368,rx:127,rz:153,y:91,slope:-.023},
    {name:'Puerto Bruma',x:-627,z:338,rx:99,rz:89,y:92.9,slope:.015},
    {name:'Caleta Sur',x:-536,z:1210,rx:113,rz:82,y:23.8,slope:-.04},
    {name:'Lomo del Pinar',x:-224,z:-463,rx:119,rz:94,y:230.6,slope:.035}
  ]
};
const tenerifeLots = new Map();
const tenerifeLotCell = 32;

function tenerifeSaturate(a,b,value) {
  const t=Math.min(1,Math.max(0,(value-a)/(b-a)));
  return t*t*(3-2*t);
}

function tenerifePlateauWeight(town,x,z) {
  return 1-tenerifeSaturate(.63,1.28,Math.hypot((x-town.x)/town.rx,(z-town.z)/town.rz));
}

function tenerifeTownWeight(x,z) {
  return Math.max(...tenerifeRelief.towns.map(town=>tenerifePlateauWeight(town,x,z)));
}

function tenerifeMountainAt(m,x,z) {
  const dx=(x-m.x)/m.rx,dz=(z-m.z)/m.rz;
  return Math.exp(-(dx*dx+dz*dz)*1.65);
}

function tenerifeCliffWeight(z) {
  return tenerifeSaturate(tenerifeRelief.cliffs.from-125,tenerifeRelief.cliffs.from+66,z)*
    (1-tenerifeSaturate(tenerifeRelief.cliffs.to-40,tenerifeRelief.cliffs.to+110,z));
}

function tenerifeBlackBeach(x,z,coast) {
  const distance=x-coast;
  return Math.max(...tenerifeRelief.beaches.map(beach=>
    (1-tenerifeSaturate(.70,1.20,Math.abs(z-beach.z)/beach.span))*
    (1-tenerifeSaturate(beach.width*.57,beach.width,distance))*
    tenerifeSaturate(-15,-3,distance)));
}

function tenerifeBasinRadius(basin,x,z) {
  const u=(x-basin.x)/basin.rx,v=(z-basin.z)/basin.rz;
  const angle=Math.atan2(v,u);
  return Math.hypot(u,v)/(1+.072*Math.sin(angle*3+basin.seed)+.046*Math.sin(angle*7-basin.seed));
}

function tenerifeSurfaceWater(x,z) {
  return tenerifeRelief.basins.find(basin=>Math.abs(x-basin.x)<basin.rx*1.2&&
    Math.abs(z-basin.z)<basin.rz*1.2&&tenerifeBasinRadius(basin,x,z)<1);
}

function tenerifeWetBlocked(x,z,ground) {
  const basin=tenerifeSurfaceWater(x,z);
  return Boolean(basin&&ground<basin.y-.18);
}

function tenerifeGeology(base,x,z,coast) {
  const t=tenerifeSaturate(18,180,x-coast);
  const mountain=tenerifeRelief.mountains.reduce((sum,m)=>{
    const a=tenerifeMountainAt(m,x,z);
    const ridge=Math.sin((x+z*.34)*.023)*Math.cos((z-x*.18)*.022);
    return sum+m.rise*a*(.94+.13*ridge);
  },0);
  const v=tenerifeRelief.volcano, vx=(x-v.x)/v.rx, vz=(z-v.z)/v.rz;
  const angle=Math.atan2(vz,vx), distance=Math.hypot(vx,vz)/(1+.11*Math.sin(angle*5)+.055*Math.sin(angle*12));
  const rim=Math.pow(Math.max(0,1-distance/1.31),1.65);
  const crater=Math.exp(-((distance/.145)**2))*.37;
  const gullies=Math.sin(angle*18+distance*.84)*Math.sin(distance*Math.PI)*.053;
  let y=base+t*(mountain+v.rise*(rim-crater+Math.max(0,gullies)*rim));
  const q=x-coast-5*Math.sin(z*.069)-3*Math.sin(z*.13);
  const cliff=tenerifeCliffWeight(z);
  if(cliff>.01&&q>1&&q<214){
    const face=tenerifeSaturate(2,21,q)*(1-tenerifeSaturate(74,208,q));
    const bench=face*(tenerifeRelief.cliffs.height+16*Math.sin(z*.024)+8*Math.sin(z*.093))-.6;
    y+=Math.max(0,bench-y)*cliff;
  }
  for(const town of tenerifeRelief.towns){
    const weight=tenerifePlateauWeight(town,x,z);
    y+=(town.y+town.slope*(z-town.z)-y)*weight;
  }
  const black=tenerifeBlackBeach(x,z,coast);
  if(black>.01){
    const beachGrade=Math.min(10.5,Math.max(-8,(x-coast-3)*.135))+.26*Math.sin(z*.069);
    y+=(beachGrade-y)*black*.93;
  }
  for(const basin of tenerifeRelief.basins){
    if(Math.abs(x-basin.x)>basin.rx*1.8||Math.abs(z-basin.z)>basin.rz*1.8)continue;
    const r=tenerifeBasinRadius(basin,x,z);
    const mix=1-tenerifeSaturate(1.06,1.72,r);
    const contour=basin.y-basin.depth*(1-tenerifeSaturate(.07,.98,r))+
      tenerifeSaturate(.92,1.16,r)*(basin.sea?1.5:3.6);
    y+=(contour-y)*mix;
  }
  for(const fall of tenerifeRelief.cascades){
    const dx=x-fall.x,dz=z-fall.z;
    if(Math.abs(dx)>42||Math.abs(dz)>42)continue;
    const upstream=-dx*fall.dx-dz*fall.dz;
    const across=Math.abs(dx*fall.dz-dz*fall.dx);
    const shelf=tenerifeSaturate(.4,4.9,upstream)*
      (1-tenerifeSaturate(17,38,upstream))*(1-tenerifeSaturate(fall.width*.51,fall.width*2.4,across));
    const lip=fall.y+fall.drop+.43*Math.sin(across*.79)+.72*Math.sin(upstream*.19);
    y+=Math.max(0,lip-y)*shelf;
  }
  return y;
}

function tenerifeForestBiome(original,x,z,coast) {
  const grass=Math.max(...tenerifeRelief.mountains.map(m=>tenerifeMountainAt(m,x,z)))*.94;
  const coastal=tenerifeSaturate(36,150,x-coast);
  return Math.max(original,grass*coastal)*(1-tenerifeTownWeight(x,z)*.94);
}

function tenerifeRegisterLot(x,z,width,depth,angle,nearest,base) {
  const y=nearest?nearest.y-.19:base;
  const c=Math.cos(angle),s=Math.sin(angle),halfX=width*.5+1.7,halfZ=depth*.5+1.7;
  const pad={x,z,y,c,s,halfX,halfZ};
  const span=Math.hypot(halfX,halfZ)+11;
  const loX=Math.floor((x-span)/tenerifeLotCell),hiX=Math.floor((x+span)/tenerifeLotCell);
  const loZ=Math.floor((z-span)/tenerifeLotCell),hiZ=Math.floor((z+span)/tenerifeLotCell);
  for(let iz=loZ;iz<=hiZ;iz++)for(let ix=loX;ix<=hiX;ix++){
    const key=ix+','+iz;
    if(!tenerifeLots.has(key))tenerifeLots.set(key,[]);
    tenerifeLots.get(key).push(pad);
  }
  return y;
}

function tenerifeLotAt(x,z) {
  const lots=tenerifeLots.get(Math.floor(x/tenerifeLotCell)+','+Math.floor(z/tenerifeLotCell));
  let mix=0,level=0;
  if(!lots?.length)return null;
  for(const lot of lots){
    const dx=x-lot.x,dz=z-lot.z;
    const u=Math.abs(dx*lot.c-dz*lot.s)-lot.halfX;
    const v=Math.abs(dx*lot.s+dz*lot.c)-lot.halfZ;
    const weight=1-tenerifeSaturate(0,9.4,Math.hypot(Math.max(0,u),Math.max(0,v)));
    if(weight>mix){mix=weight;level=lot.y;}
  }
  return mix>0?{mix,level}:null;
}

function tenerifeGradedGround(x,z,y,road) {
  const lot=tenerifeLotAt(x,z);
  if(!lot)return y;
  const roadClearance=road?tenerifeSaturate(road.road.half+.8,road.road.half+2.3,road.distance):1;
  return y+(lot.level-y)*lot.mix*roadClearance;
}

function tenerifeGroundAt(x,z,natural,road) {
  if(!road)return tenerifeGradedGround(x,z,natural);
  const basin=tenerifeSurfaceWater(x,z);
  // The broad road embankment must taper more quickly along pool and lake shores.
  const edge=basin?8:36;
  const blend=tenerifeSaturate(road.road.half+3,road.road.half+edge,road.distance);
  const grade=road.y-.32;
  return tenerifeGradedGround(x,z,grade+(natural-grade)*blend,road);
}

function tenerifeReliefRoutes(mainPoint,makeRoad) {
  const road=(points,width=3.7,surface='asphalt')=>makeRoad(points,width,surface);
  return [
    road([[-574,93,291],[-602,93.1,286],[-639,93.5,286],[-679,94,287],[-690,95,312],[-690,95.8,360],[-681,96.2,385],[-643,95.4,389],[-611,94,389],[-576,92,388]],4.45),
    road([[-639,93.5,286],[-640,94,316],[-642,94.7,351],[-643,95.4,389]],3.8),
    road([[-690,95.8,360],[-664,95.4,354],[-642,94.7,351],[-622,94.5,352],[-606,94.7,369],[-611,94,389]],3.5),
    road([mainPoint(-670,1190),[-670,20.4,1160],[-691,16,1126],[-728,12,1100],[-760,9.1,1094],[-783,6.4,1118]],3.25,'gravel'),
    road([mainPoint(-705,1370),[-730,15.1,1374],[-757,9.5,1385],[-774,5.3,1393],[-777,4.8,1413],[-766,4.5,1432]],3.3,'gravel'),
    road([mainPoint(-494,-550),[-548,243,-590],[-600,221,-620],[-672,194,-638],[-730,176,-657],[-787,158,-661],[-820,149,-658]],3.55,'gravel'),
    road([[-91,269,-662],[-76,267.8,-679],[-75,271.4,-700],[-73,272.4,-713]],2.65,'gravel'),
    road([[-344,227,-525],[-357,226,-542],[-375,223.8,-558],[-379,224.1,-572],[-389,225,-590]],2.6,'gravel')
  ];
}

function tenerifeDistrict(addHouse, nearest, obstacles) {
  const buildings=[
    [-664,308,17,19,13.2],[-661,334,17.4,16.5,17.3],[-667,376,15,14,10.6],
    [-620,306,16,17,16],[-620,331,16,16.4,20],[-626,371,16,15,14.5],
    [-650,411,21,16,16.8],[-677,411,18.4,16,12.6],[-599,307,13.8,13,9.8],
    [-601,328,15,14,14.5],[-581,343,12.8,15,9.7],[-605,410,17,14,10.8]
  ];
  for(const [index,[x,z,w,d,h]] of buildings.entries()){
    const r=nearest(x,z);
    if(!r||r.distance<r.road.half+Math.max(w,d)*.5+2.2||
      obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.radius+Math.max(w,d)*.55+2.4))continue;
    addHouse(x,z,w,d,h,0,200+index,false);
  }
}
