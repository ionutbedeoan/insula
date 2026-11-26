// This module is inserted into the pinned Tenerife scene before it is mounted.
const tenerifeForestAir = {value:0};

function tenerifeForestInfluence(x,z) {
  const original=ar(-1100,-845,z) * ar(20,-355,z) * ar(-835,-615,x) * ar(455,245,x);
  return Math.max(original,...tenerifeRelief.mountains.map(m=>.83*tenerifeSaturate(.04,.74,tenerifeMountainAt(m,x,z))))*
    (1-tenerifeTownWeight(x,z));
}

function tenerifePineMesh(seed, far) {
  const rng=MA(seed), bark=[], barkIndices=[], barkColors=[], foliage=[], uvs=[], leafIndices=[], leafNormals=[];
  const rings=far?4:7;
  const goldAngle=2.399963;
  const axis=new q(0,1,0);
  const stem=t=>new q(.035*t*t-.012*t, t, -.024*t*t);
  const wood=(points,radii,sides)=>{
    const start=bark.length/3;
    for(let j=0;j<points.length;j++){
      const tangent=points[Math.min(j+1,points.length-1)].clone().sub(points[Math.max(j-1,0)]).normalize();
      const normal=new q(1,.08,0).cross(tangent).normalize();
      const binormal=tangent.clone().cross(normal);
      for(let k=0;k<sides;k++){
        const angle=k*6.2831853/sides, radius=radii[j]*(.84+rng()*.29);
        const end=points[j].clone().addScaledVector(normal,Math.cos(angle)*radius).addScaledVector(binormal,Math.sin(angle)*radius);
        bark.push(end.x,end.y,end.z);
        const light=.62+rng()*.34+j*.013;
        barkColors.push(light,light*.95,light*.87);
        if(j){
          const a=start+(j-1)*sides+k, b=start+(j-1)*sides+(k+1)%sides;
          barkIndices.push(a,b,b+sides,a,b+sides,a+sides);
        }
      }
    }
  };
  const levels=Array.from({length:rings},(_,i)=>Math.pow(i/(rings-1),1.02));
  wood(levels.map(stem),levels.map(t=>.0195*Math.pow(1-t,1.15)+.0009+(t<.001?.008:0)),far?4:7);
  const card=(foot,tip,breadth,tilt)=>{
    const along=tip.clone().sub(foot).normalize(), sideways=along.clone().cross(axis).normalize();
    sideways.addScaledVector(axis,tilt).normalize().multiplyScalar(breadth);
    const start=foliage.length/3;
    const points=[foot.clone().addScaledVector(sideways,.72),foot.clone().addScaledVector(sideways,-.72),
      tip.clone().sub(sideways),tip.clone().add(sideways)];
    const normal=new q(along.x*.54,.81,along.z*.54).normalize();
    for(const pt of points){foliage.push(pt.x,pt.y,pt.z);leafNormals.push(normal.x,normal.y,normal.z);}
    // Bottom right cell of the existing foliage atlas contains pine needles.
    uvs.push(.511,.975,.979,.975,.979,.512,.511,.512);
    leafIndices.push(start,start+1,start+2,start,start+2,start+3);
  };
  const whorls=far?4:6;
  for(let i=0;i<whorls;i++){
    const y=.45+i*.49/Math.max(1,whorls-1)+rng()*.032;
    const branches=far?3:3+(i%3===0?1:0);
    for(let j=0;j<branches;j++){
      const angle=i*goldAngle+j*6.2831853/branches+(rng()-.5)*.56;
      const length=(.235-(y-.46)*.224)*(.62+rng()*.61);
      const delta=new q(Math.cos(angle)*length,0,Math.sin(angle)*length);
      const root=stem(y+rng()*.026), elbow=root.clone().addScaledVector(delta,.54);
      const tip=root.clone().add(delta);
      elbow.y+=.004-rng()*.025;
      tip.y+=.017+rng()*.052;
      if(!far||i%2===0)wood([root,elbow,tip],[.0074*(1-y)+.0022,.0033,.0011],far?3:4);
      const side=new q(-delta.z,0,delta.x).normalize();
      const crownWeight=.76+(y-.43)*1.07;
      card(elbow.clone().lerp(root,.25),tip.clone().addScaledVector(delta,.77).addScaledVector(axis,.046),
        length*.52*crownWeight,.56);
      if(y>.57){
        card(root.clone().lerp(tip,.26),tip.clone().addScaledVector(delta,.50).addScaledVector(axis,.107),
          length*.52*crownWeight,1.46);
      }
      for(const sign of [-1,1]){
        const twig=elbow.clone().lerp(tip,.19+rng()*.3);
        const edge=tip.clone().addScaledVector(side,length*sign*(.43+rng()*.28)).addScaledVector(axis,.027+rng()*.056);
        if(!far&&j%2===0&&sign===1)wood([twig,edge],[.0022,.0006],3);
        card(twig,edge.addScaledVector(delta,.27),length*.46*crownWeight,sign*.74);
      }
    }
  }
  const trunk=new Mt();
  trunk.setAttribute('position',new nt(bark,3));
  trunk.setAttribute('color',new nt(barkColors,3));
  trunk.setIndex(barkIndices);
  trunk.computeVertexNormals();
  const crown=new Mt();
  crown.setAttribute('position',new nt(foliage,3));
  crown.setAttribute('uv',new nt(uvs,2));
  crown.setAttribute('normal',new nt(leafNormals,3));
  crown.setIndex(leafIndices);
  return [trunk,crown];
}

function tenerifePine(parts,x,y,z,height,angle,far,palette) {
  const shade=['#3e4b2a','#52603a','#495636','#5b6541'][palette%4];
  const spread=height*(.91+(palette%5)*.071);
  const suffix=far?'Far':palette%2===0?'':'B';
  parts.push({kind:'forestTrunk'+suffix,x,y,z,w:spread,h:height,d:spread,color:'#6d5943',angle});
  parts.push({kind:'forestCrown'+suffix,x,y,z,w:spread,h:height,d:spread,color:shade,angle});
}

function tenerifeForestTile(detail,items) {
  const output=[];
  for(let i=0;i<items.length;i++){
    const item=items[i], previous=items[i-1];
    if(tenerifeSurfaceWater(item.x,item.z))continue;
    if(item.kind!=='canopy'||(detail&&previous?.kind!=='trunk')){
      output.push(item);
      continue;
    }
    const {x,y,z,w,h,angle}=item;
    const dense=tenerifeForestInfluence(x,z);
    const seed=(Math.floor(Math.abs(x*7+z*3.07))>>>0);
    if(dense<.18 || seed%100>dense*68){
      output.push(item);
      continue;
    }
    const ground=Ts(x,z);
    if(detail){
      // Keep the original collider and position for each replaced tree.
      output.pop();
      output.push({...previous,kind:'forestBase'});
    }
    const height=Math.min(23,Math.max(8.4,(y-ground+h*.41)*(1.46+seed%6*.09)));
    tenerifePine(output,x,ground-.08,z,height,angle,!detail,seed);
    if(detail&&items[i+1]?.kind==='canopy')i++;
    if(detail&&(seed%3===0)){
      const rng=MA(seed+481);
      const ox=x+2.6+rng()*1.9, oz=z-1.4+rng()*3.6;
      const road=Ws(ox,oz);
      if(!road||road.distance>road.road.half+1.35){
        const sy=Ts(ox,oz,road);
        output.push({kind:'grass',x:ox,y:sy-.04,z:oz,w:2.5,h:.7,d:2.1,color:'#6d7648',angle});
      }
    }
  }
  return output;
}

function tenerifeLocalScenery() {
  const original=LM.splice(0);
  for(let i=0;i<original.length;i++){
    const prop=original[i];
    const next=original[i+1];
    const inForest=prop.kind==='trunk'&&next?.kind==='canopy'&&tenerifeForestInfluence(prop.x,prop.z)>.14;
    if(!inForest){LM.push(prop);continue;}
    const {x,z,angle}=prop, ground=Ts(x,z);
    const seed=Math.floor(Math.abs(x*3.35+z*1.22));
    if(seed%7===0){LM.push({...prop,kind:'forestLaurelWood'});continue;}
    const height=Math.min(21,Math.max(10.6,(next.y-ground+next.h*.39)*(1.44+(seed%7)*.075)));
    tenerifePine(LM,x,ground-.08,z,height,angle,false,seed);
    i++;
    if(original[i+1]?.kind==='canopy')i++;
  }

  const rng=MA(37021);
  for(let meters=2290;meters<3505;meters+=11+rng()*9){
    const point=pl(xi,meters);
    for(const side of [-1,1]){
      const patch=Math.sin(meters*.038+side*1.9)*.5+.5;
      const rows=patch>.52?2:1;
      for(let row=0;row<rows;row++){
        const away=side*(16+row*19+rng()*16);
        const advance=(rng()-.5)*15;
        const x=point.x-point.dz*away+point.dx*advance,z=point.z+point.dx*away+point.dz*advance;
        const road=Ws(x,z);
        if(!road||road.distance<road.road.half+9||Oa.some(o=>Math.hypot(x-o.x,z-o.z)<o.radius+4.3))continue;
        const height=10+rng()*11;
        tenerifePine(LM,x,Ts(x,z,road)-.08,z,height,rng()*6.28,row>0,Math.floor(rng()*20));
        Oa.push({x,z,radius:height*.024+.06});
        for(let plant=0;plant<3;plant++){
          const a=rng()*6.283,reach=2.5+rng()*6.5;
          const bx=x+Math.cos(a)*reach,bz=z+Math.sin(a)*reach;
          const nearest=Ws(bx,bz);
          if(!nearest||nearest.distance<nearest.road.half+2.5)continue;
          const by=Ts(bx,bz,nearest),size=.65+rng()*1.3;
          ii('forestBrush',bx,by+.31,bz,size*1.48,size*.89,size*1.34,
            ['#626f43','#73804d','#84915b'][plant],a);
        }
      }
    }
  }
  const stones=['#6a645d','#716759','#796957','#534b43','#8a7865'];
  for(let i=0;i<490;i++){
    const z=1100+rng()*482, x=Vg(z)+1+rng()*92, ground=Ts(x,z), road=Ws(x,z);
    if(ground<.16||ground>10||road&&road.distance<road.road.half+2.25)continue;
    const deposit=.5+.5*Math.sin(z*.087+x*.19);
    if(deposit<.34+rng()*.31)continue;
    const size=.058+rng()**2*.42;
    ii('beachPebble',x,ground+size*.12,z,size,size*(.34+rng()*.31),size*(.57+rng()*.58),stones[i%5],rng()*6.28);
  }
  for(let meters=2270;meters<3480;meters+=15+rng()*9){
    const point=pl(xi,meters);
    const side=rng()>.52?1:-1;
    const gap=side*(8+rng()*10);
    const x=point.x-point.dz*gap,z=point.z+point.dx*gap;
    const road=Ws(x,z);
    if(road&&road.distance<road.road.half+3.5)continue;
    const y=Ts(x,z,road), angle=rng()*6.28;
    ii('fern',x,y+.06,z,1.8+rng()*2.3,.95+rng()*.48,2.3,'#6e854a',angle);
    ii('grass',x+.4,y-.02,z-.4,2.9,.53,2.4,'#737752',angle);
    if(rng()<.33)ii('fallenWood',x,y+.16,z,.34,.31,2.7+rng()*2.9,'#5d5040',angle);
  }
}

function tenerifeHouseFooting(put,offset,ground,width,depth,tint) {
  let low=ground-4.29;
  for(const x of [-width*.499,width*.499])for(const z of [-depth*.499,depth*.499]){
    const [worldX,worldZ]=offset(x,z);
    low=Math.min(low,Ts(worldX,worldZ)-.56);
  }
  const length=ground+.09-low;
  put('houseStone',[0,.09-length*.5,0,width,length,depth,tint]);
}

function tenerifeHouseDetails(x,z,w,d,h,angle,id) {
  const y=Ts(x,z), cs=Math.cos(angle), sn=Math.sin(angle);
  const brick=id%2===0?'#ac7956':'#998579';
  const trim=id%4===0?'#bf8d56':'#dfcdb2';
  const dark=id%4===0?'#405550':id%4===1?'#526359':'#554b40';
  const put=(kind,dx,dy,dz,width,height,depth,color=trim)=>{
    ii(kind,x+dx*cs+dz*sn,y+dy,z-dx*sn+dz*cs,width,height,depth,color,angle);
  };

  put('houseStone',0,.35,0,w+.07,.68,d+.07,brick);
  put('houseTrim',0,h-.12,0,w+.43,.23,d+.43,'#c4ae8d');
  if(id>=200){
    const floors=Math.max(3,Math.floor(h/3.2));
    put('houseTrim',0,h+.71,0,w*.46,1.4,d*.30,'#87796a');
    put('houseStone',0,.10,d*.5+.60,w+.85,.18,1.55,'#a9a39b');
    put('houseStone',0,.10,-d*.5-.60,w+.85,.18,1.55,'#a9a39b');
    for(const side of [-1,1]){
      for(let floor=1;floor<=floors;floor++){
        const fy=1.81+(floor-1)*(h-2.75)/floors;
        const edge=side*(d*.5+.10);
        put('houseTrim',0,fy-.92,edge,w+.11,.16,.35,'#c8b7a3');
        for(const fraction of [-.365,-.122,.122,.365]){
          const xx=fraction*w;
          put('houseTrim',xx,fy,edge,1.86,1.49,.155,'#69685f');
          put('houseGlass',xx,fy,edge+side*.074,1.62,1.24,.078,'#96aaa7');
          put('houseTrim',xx,fy,edge+side*.129,.07,1.28,.09,'#c4c1ad');
          if(floor>1&&Math.abs(fraction)>.30){
            put('houseTrim',xx,fy-.76,edge+side*.72,2.23,.16,1.26,'#9f907c');
            put('houseTrim',xx,fy-.39,edge+side*1.31,2.26,.67,.088,'#575d58');
          }
        }
        for(const span of [-d*.29,d*.05,d*.34]){
          put('houseTrim',side*(w*.5+.087),fy,span,.16,1.52,1.66,'#8b8174');
          put('houseGlass',side*(w*.5+.169),fy,span,.077,1.25,1.39,'#9aada5');
          put('houseTrim',side*(w*.5+.218),fy,span,.07,1.27,.059,'#c4c1ad');
        }
      }
    }
    return;
  }
  put('houseStone',w*.23,h+1.25,-d*.30,.66,1.04,.62,brick);
  put('houseTrim',w*.23,h+1.81,-d*.30,.85,.14,.8,'#796358');
  for(const side of [-1,1]){
    const front=side*(d*.5+.16);
    const face=front+side*.08;
    for(const dx of [-w*.3,w*.3]){
      for(const dy of [2.68,...h>7?[h-1.8]:[]]){
        put('houseTrim',dx,dy+.66,front,1.48,.12,.23);
        put('houseGlass',dx,dy,face,.84,1.06,.055,'#859f9e');
        put('houseTrim',dx,dy,face+side*.037,.047,1.08,.08,dark);
        put('houseTrim',dx,dy+.12,face+side*.037,.86,.045,.08,dark);
        put('houseTrim',dx,dy-.63,face,1.47,.115,.30);
        if(id%3!==2){
          for(const wing of [-1,1]){
            for(let slat=-3;slat<=3;slat++){
              put('houseTrim',dx+wing*.58,dy+slat*.134,face+side*.044,.32,.062,.088,dark);
            }
          }
        }
      }
    }
    put('houseStone',0,.21,side*(d*.5+.32),1.54,.19,.49,brick);
    put('houseTrim',0,2.25,face,1.48,.16,.21);
    put('houseTrim',.31,1.03,face+side*.04,.083,.10,.055,'#a27a45');
    if((id+side)%4===0){
      put('houseTrim',w*.30-.29,2.02,side*(d*.5+.32),.92,.23,.38,'#825440');
      put('shrub',w*.30-.29,2.13,side*(d*.5+.33),1.02,.48,.50,'#929e64');
    }
  }
}

function tenerifeInstallLocalArt() {
  const bark=new St({vertexColors:true,roughness:.94});
  const barkTexture=tenerifeTexture(tenerifeArtAssets.barkColor,true);
  const barkDetail=tenerifeTexture(tenerifeArtAssets.barkNormal,false);
  for(const texture of [barkTexture,barkDetail])texture.wrapS=texture.wrapT=zg;
  const barkSource=`
    vec2 texUV=tfProjection(tfFacing(),1.13);
    vec3 photo=texture2D(tfColor,texUV).rgb;
    vec3 tfDetail=texture2D(tfNormal,texUV).rgb*2.-1.;
    vec3 tfPbr=vec3(.91,.89,0.);
    float tfStrength=.74*(1.-smoothstep(13.,62.,length(vViewPosition)));
    float moss=smoothstep(.52,.79,tfNoise(tfWorld.xz*.72+tfWorld.y*.51));
    diffuseColor.rgb=mix(diffuseColor.rgb,photo*(.58+.75*diffuseColor.rgb),.70);
    diffuseColor.rgb*=mix(vec3(1.),vec3(.70,.85,.52),moss*.48);
  `;
  const barkMaps={color:barkTexture,normal:barkDetail,arm:barkDetail};
  tenerifeSurface(bark,'pine-bark',barkSource,barkMaps);
  const needle=new St({map:Og,side:qn,alphaTest:.31,roughness:1});
  needle.onBeforeCompile=shader=>{
    shader.uniforms.tfTime=tenerifeArtTime;
    shader.vertexShader='uniform float tfTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
      transformed.x+=.0065*pow(position.y,2.)*sin(tfTime*1.4+instanceMatrix[3].x*.094+position.z*16.);
      transformed.z+=.0035*position.y*cos(tfTime*1.15+instanceMatrix[3].z*.10);
      #endif`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      totalEmissiveRadiance+=diffuseColor.rgb*vec3(.14,.17,.10);`);
  };
  for(const [suffix,seed,far] of [['',413,false],['B',617,false],['Far',413,true]]){
    const [trunk,crown]=tenerifePineMesh(seed,far);
    cO['forestTrunk'+suffix]=trunk;
    cO['forestCrown'+suffix]=crown;
    uO['forestTrunk'+suffix]=bark;
    uO['forestCrown'+suffix]=needle;
  }
  // Collision silhouette remains in the tile data, while the pine supplies all visible wood.
  cO.forestBase=cO.trunk;
  uO.forestBase=new Mo({visible:false});
  cO.forestBrush=J4(16,'laurel');
  uO.forestBrush=nw;
  cO.forestLaurelWood=cO.trunk;
  uO.forestLaurelWood=new St({roughness:.94});
  tenerifeSurface(uO.forestLaurelWood,'laurel-bark',barkSource,barkMaps);
  cO.fallenWood=new Xr(.47,.5,1,7).rotateX(Math.PI/2);
  uO.fallenWood=uO.forestLaurelWood;
  cO.beachPebble=cO.rock;
  uO.beachPebble=uO.rock;
  for(const kind of ['houseTrim','houseStone','houseGlass'])cO[kind]=cO.box;
  uO.houseTrim=new St({roughness:.81});
  uO.houseGlass=new zA({color:'#789394',roughness:.18,metalness:.48,envMapIntensity:.82});
  const textures=Object.fromEntries(['color','normal','arm'].map(name=>[name,tenerifeTexture(tenerifeArtAssets[name],name==='color')]));
  // Reuse the normal-mapped basalt tile for dressed stone with a parallel mortar pattern.
  uO.houseStone=new St({roughness:.92});
  tenerifeSurface(uO.houseStone,'local-basalt',tenerifeStandardSurface([2,1],1.8,.87,.72,`
    vec3 n=tfFacing();
    float side=n.x>n.z?tfWorld.z:tfWorld.x;
    float row=floor(tfWorld.y*3.12);
    vec2 joints=fract(vec2(side*2.18+.51*mod(row,2.),tfWorld.y*3.12));
    float seam=min(min(joints.x,1.-joints.x),min(joints.y,1.-joints.y));
    diffuseColor.rgb*=mix(.52,1.,smoothstep(.02,.10,seam))*(.85+.26*tfHash(vec2(row,floor(side*2.18))));
  `),textures);
}
