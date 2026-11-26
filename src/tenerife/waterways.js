// Shared outlines become the browser water meshes and the Unity export.
function tenerifeWaterBoundary(basin,count) {
  return Array.from({length:count},(_,i)=>{
    const a=i*Math.PI*2/count;
    const r=1+.072*Math.sin(a*3+basin.seed)+.046*Math.sin(a*7-basin.seed);
    return [basin.x+Math.cos(a)*basin.rx*r,basin.z+Math.sin(a)*basin.rz*r];
  });
}

function tenerifeReliefScenery() {
  const random=MA(293164);
  const stone=['#3b3b3b','#554d47','#675a4e','#484446','#6a6056'];
  for(const road of DA.slice(13,16)){
    for(let i=2;i<road.points.length-2;i++){
      const p=road.points[i];
      const angle=Math.atan2(-p.dx,-p.dz);
      for(const side of [-1,1]){
        const offset=side*(road.half+.81);
        const x=p.x-p.dz*offset,z=p.z+p.dx*offset,near=Ws(x,z);
        if(near&&near.road!==road&&near.distance<near.road.half+1.1)continue;
        const y=Math.max(Ts(x,z,near)+.08,p.y+.02);
        const length=(road.points[i+1].s-road.points[i-1].s)*.52;
        ii('houseTrim',x,y,z,1.48,.16,length,'#a6a297',angle);
        if(i%8!==3||side===-1)continue;
        ii('post',x,y+2.0,z,.10,4.0,.1,'#3e4848',angle);
        ii('houseTrim',x,y+4.04,z,.31,.17,.60,'#686d69',angle);
        ii('houseTrim',x,y+3.94,z,.23,.045,.44,'#e3d4ab',angle);
      }
    }
  }
  for(let z=-913;z<=-344;z+=7+random()*5){
    const strength=tenerifeCliffWeight(z);
    if(strength<.18)continue;
    const coast=Vg(z),x=coast+9+random()*9;
    const top=Ts(x+19,z);
    if(top<16)continue;
    const height=top*(.78+random()*.18), width=7+random()*13,depth=8+random()*13;
    ii('cliffColumn',x,height*.43-.7,z,width,height,depth,stone[Math.floor(random()*stone.length)],random()*.65);
    if(random()>.41)ii('lava',x-12-random()*12,1.1,z+random()*13,7+random()*9,3.4+random()*4,8+random()*11,stone[1],random()*6);
  }

  for(const basin of tenerifeRelief.basins){
    const outline=tenerifeWaterBoundary(basin,basin.sea?24:33);
    for(let i=0;i<outline.length;i++){
      const [x,z]=outline[i];
      if(random()<.19||(!basin.sea&&i%3===0))continue;
      const r=Ws(x,z);
      if(r&&r.distance<r.road.half+2.3)continue;
      const y=Ts(x,z,r),w=basin.sea?2.3+random()*3.6:2.6+random()*4.2;
      ii('lava',x,Math.max(y,basin.y-.44)+(basin.sea?.22:.28),z,w,
        basin.sea?.8+random()*1.55:1+random()*2.1,w*(.5+random()*.55),stone[i%stone.length],random()*6.28);
    }
  }

  for(const [index,fall] of tenerifeRelief.cascades.entries()){
    for(let i=-2;i<=2;i++){
      if(i===0)continue;
      const x=fall.x-fall.dx*2.8-fall.dz*i*fall.width*.43;
      const z=fall.z-fall.dz*2.8+fall.dx*i*fall.width*.43;
      const f=.64-Math.abs(i)*.095;
      ii('lava',x,fall.y+fall.drop*.29*f,z,5.7+random()*5.6,
        fall.drop*f,4.3+random()*3.4,stone[(i+index+9)%stone.length],.28*i);
      if(i%2===0)ii('forestBrush',x,fall.y+fall.drop*.31*f,z,3.9,2.6,3.5,'#687c47',i);
    }
  }

  // Short pedestrian paths connect the designated gravel lay-bys to the water.
  const paths=[[-777,1397,-796,1387],[-77,-708,-83,-726],[-389,-590,-391,-604]];
  for(const [ax,az,bx,bz] of paths){
    const n=Math.ceil(Math.hypot(bx-ax,bz-az)/1.1);
    for(let i=0;i<=n;i++){
      const x=ax+(bx-ax)*i/n,z=az+(bz-az)*i/n;
      const y=Ts(x,z);
      if(y<.2||tenerifeWetBlocked(x,z,y))continue;
      ii('pathStone',x,y+.055,z,1.4+.25*random(),.13,.85+.34*random(),stone[i%3],random()*1.2);
    }
  }
}

function tenerifeCliffMesh() {
  const positions=[],indices=[],colors=[],sides=9;
  const rings=[[-.52,.96],[-.29,.92],[.03,.97],[.27,.90],[.48,.83]];
  const rng=MA(468);
  const ribs=Array.from({length:sides},()=>.76+rng()*.31);
  for(let j=0;j<rings.length;j++){
    const [height,radius]=rings[j];
    for(let i=0;i<sides;i++){
      const a=2*Math.PI*i/sides;
      const r=ribs[i]*radius*(.91+.1*rng())*.56;
      const c=.69+.23*rng();
      positions.push(Math.sin(a)*r+(j-2)*.028,height+.04*(rng()-.5),Math.cos(a)*r);
      colors.push(c,c*.97,c*.92);
      if(j){
        const p=(j-1)*sides+i,q=(j-1)*sides+(i+1)%sides;
        indices.push(p,q,q+sides,p,q+sides,p+sides);
      }
    }
  }
  for(let i=1;i<sides-1;i++)indices.push(sides*4,sides*4+i,sides*4+i+1);
  const geo=new Mt();
  geo.setAttribute('position',new nt(positions,3));
  geo.setAttribute('color',new nt(colors,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function tenerifeInstallReliefArt() {
  cO.cliffColumn=tenerifeCliffMesh();
  uO.cliffColumn=new St({vertexColors:true,roughness:.97});
  cO.pathStone=cO.rock;uO.pathStone=uO.rock;
  const textures=Object.fromEntries(['color','normal','arm'].map(key=>
    [key,tenerifeTexture(tenerifeArtAssets[key],key==='color')]));
  tenerifeSurface(uO.cliffColumn,'layered-basalt',tenerifeStandardSurface([2,1],.32,.83,.68,`
    float bedding=sin((tfWorld.y+tfWorld.x*.115+tfWorld.z*.054)*.68+tfNoise(tfWorld.xz*.17)*2.3);
    float column=tfNoise(tfWorld.xz*.76);
    float veins=smoothstep(.5,.88,bedding)*(.21+.18*column);
    diffuseColor.rgb*=mix(vec3(.82,.88,.93),vec3(1.6,1.53,1.44),column)*(1.-veins);
  `),textures);
}

const tenerifeWaterVertex = `
  varying vec3 rockWater;
  varying vec2 flowUV;
  void main(){
    flowUV=uv; rockWater=(modelMatrix*vec4(position,1.)).xyz;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }
`;

function tenerifeBasinMaterial(basin,time) {
  return new Jr({
    uniforms:{time,sea:{value:basin.sea?1:0}},
    vertexShader:tenerifeWaterVertex,
    fragmentShader:`
      uniform float time,sea;
      varying vec3 rockWater;
      varying vec2 flowUV;
      void main(){
        vec2 p=rockWater.xz;
        float a=sin(dot(p,vec2(.89,.44))-time*1.96);
        float b=sin(dot(p,vec2(.41,-.78))-time*2.66);
        float ripple=sin(dot(p,vec2(2.80,1.23))+a*.63-time*3.);
        float coast=smoothstep(.49,.999,length(flowUV*2.-1.));
        vec3 n=normalize(vec3(.037*a+.019*ripple,1.,.039*b));
        float view=1.-max(0.,dot(normalize(cameraPosition-rockWater),n));
        vec3 deep=mix(vec3(.026,.112,.115),vec3(.009,.147,.163),sea);
        vec3 clear=mix(vec3(.085,.233,.161),vec3(.042,.365,.299),sea);
        float glint=pow(max(0.,dot(reflect(-vec3(-.55,.56,.46),n),normalize(cameraPosition-rockWater))),66.);
        vec3 color=mix(deep,clear,coast*.88)+vec3(.52,.69,.73)*pow(view,5.)*.32;
        color+=vec3(.22,.40,.33)*pow(max(0.,ripple*b),7.)*coast*.29;
        color+=glint*vec3(.73,.68,.53)*.55;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function tenerifeFallMaterial(time, veil) {
  return new Jr({
    uniforms:{time,veil:{value:veil?1:0}}, side:qn,transparent:true,depthWrite:false,
    vertexShader:tenerifeWaterVertex,
    fragmentShader:`
      varying vec2 flowUV;
      varying vec3 rockWater;
      uniform float time,veil;
      void main(){
        float str=sin(flowUV.x*112.+sin(flowUV.y*20.+time*1.74)*1.3);
        float flow=sin(flowUV.y*56.+time*13.+str*1.3)*sin(flowUV.y*32.+time*11.);
        float fog=1.-smoothstep(0.,.40,flowUV.y);
        float edges=flowUV.x+.028*sin(flowUV.y*38.+time*1.41)+.021*sin(flowUV.y*91.-time*.8);
        float edge=smoothstep(.0,.19,edges)*smoothstep(.0,.19,1.-edges);
        float crest=1.-smoothstep(.86,1.,flowUV.y);
        float foam=smoothstep(-.18,.81,str*.50+flow*.48+fog*.46);
        vec3 c=mix(vec3(.12,.31,.34),vec3(.78,.89,.91),foam);
        gl_FragColor=vec4(c,(.31+.61*foam)*edge*crest*(veil>.5?fog*.51:.94));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}

function tenerifeBasinMesh(basin) {
  const points=tenerifeWaterBoundary(basin,46);
  const p=[basin.x,basin.y,basin.z],uv=[.5,.5],indices=[];
  for(let i=0;i<points.length;i++){
    const [x,z]=points[i];
    p.push(x,basin.y,z);
    uv.push(.5+(x-basin.x)/basin.rx*.5,.5+(z-basin.z)/basin.rz*.5);
    indices.push(0,(i+1)%points.length+1,i+1);
  }
  const geo=new Mt();
  geo.setAttribute('position',new nt(p,3));
  geo.setAttribute('uv',new nt(uv,2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

function TenerifeWaterways(){
  const time=ee.useMemo(()=>({value:0}),[]);
  const basins=ee.useMemo(()=>tenerifeRelief.basins.map(basin=>({
    basin,geometry:tenerifeBasinMesh(basin),material:tenerifeBasinMaterial(basin,time)
  })),[time]);
  const cascades=ee.useMemo(()=>({
    stream:tenerifeFallMaterial(time,false),spray:tenerifeFallMaterial(time,true)
  }),[time]);
  rs(({clock})=>{time.value=clock.elapsedTime;});
  ee.useEffect(()=>()=>{for(const {geometry,material} of basins){geometry.dispose();material.dispose();}
    cascades.stream.dispose();cascades.spray.dispose();
  },[basins,cascades]);
  return E.jsxs('group',{children:[
    ...basins.map(({basin,geometry,material})=>E.jsx('mesh',{geometry,material,renderOrder:2},basin.id)),
    ...tenerifeRelief.cascades.flatMap((fall,i)=>{
      const angle=Math.atan2(fall.dx,fall.dz);
      return [
        E.jsx('mesh',{position:[fall.x,fall.y+fall.drop*.51,fall.z],rotation:[0,angle,0],
          material:cascades.stream,renderOrder:4,children:E.jsx('planeGeometry',{args:[fall.width,fall.drop*1.02,3,1]})},'water'+i),
        E.jsx('mesh',{position:[fall.x+fall.dx*1.6,fall.y+fall.drop*.21,fall.z+fall.dz*1.6],rotation:[0,angle-.23,0],
          material:cascades.spray,renderOrder:5,children:E.jsx('planeGeometry',{args:[fall.width*1.8,fall.drop*.48,1,1]})},'spray'+i)
      ];
    })
  ]});
}

function tenerifeMapCoast() {
  const shore=[];
  for(let z=-1830;z<=1780;z+=32)shore.push(Math.round(Vg(z))+' '+z);
  return 'M -1250 -1830 L '+shore.join(' L ')+' L -1250 1780 Z';
}

function tenerifeMapLandmarks() {
  const points=[
    ['Puerto Bruma',-634,350],['Mirador del Acantilado',-817,-660],['Arena Negra',-809,1226],
    ['Charcos de Lava',-801,1398],['Laguna del Pinar',-388,-594],['Lago del Alisio',-58,-738],
    ['Montaña del Pinar',-445,-1062],['Montaña del Alisio',244,-624],['Volcán del Viento',795,-1410]
  ];
  return [...tenerifeRelief.basins.map(basin=>E.jsx('ellipse',{
    cx:basin.x,cy:basin.z,rx:basin.rx,ry:basin.rz,fill:'#8ebec4',stroke:'#4a838c',strokeWidth:5
  },basin.id)),...points.map(([label,x,z])=>E.jsxs('g',{children:[
    E.jsx('circle',{cx:x-12,cy:z-13,r:11,fill:'#e3b268',stroke:'#213333',strokeWidth:4}),
    E.jsx('text',{x:x+8,y:z,fill:'#fff3da',stroke:'#213333',strokeWidth:8,paintOrder:'stroke',fontSize:42,children:label})
  ]},label))];
}
