// Material and atmosphere upgrades for the pinned Tenerife renderer.
// Assets are resolved by Vite before this source is embedded in srcdoc.
const tenerifeArtTime = { value: 0 };
const tenerifeSkyMap = { value: null };
const tenerifeSkyReady = { value: 0 };
const tenerifeWeather = { value: 0 };
const tenerifeLightNames = ['Atlantic senin', 'Apus', 'Nori de coastă'];
const tenerifeLightPresets = [
  { sun: [-.69,.49,.53], color: '#ffdeb6', direct: 2.38, sky: '#c3d7ef', bounce: '#716d60', ambient: .78, fog: '#a1b9c0', density: .00056 },
  { sun: [-.58,.23,.78], color: '#ffb270', direct: 2.64, sky: '#bad1ef', bounce: '#6d6350', ambient: .63, fog: '#c3a99c', density: .00071 },
  { sun: [-.58,.50,.65], color: '#e3e7ed', direct: .65, sky: '#bfcbd6', bounce: '#827b6a', ambient: 1.11, fog: '#a3b5bd', density: .00091 },
];

function TenerifeLightButton() {
  const [mode, setMode] = ee.useState(tenerifeWeather.value);
  return E.jsx('button', {
    className: 'drive-chip', 'aria-label': 'Lumină · ' + tenerifeLightNames[mode],
    title: 'Lumină · ' + tenerifeLightNames[mode], type: 'button',
    onClick: () => { const next = (mode + 1) % 3; tenerifeWeather.value = next; setMode(next); },
    children: ['☼', '◒', '◇'][mode],
  });
}

function tenerifeTexture(uri, color) {
  const texture = new Ai();
  const img = new Image();
  img.onload = () => { texture.image = img; texture.needsUpdate = true; };
  texture.colorSpace = color ? bi : '';
  texture.flipY = false;
  texture.anisotropy = 2;
  img.src = uri;
  return texture;
}

// The generated OpenCV HDR is Radiance RGBE with scanline RLE. Decode it once
// so the existing Three.js PMREM can build the reflection map without a loader.
function tenerifeDecodeSky(uri) {
  const data = Uint8Array.from(atob(uri.slice(uri.indexOf(',') + 1)), c => c.charCodeAt(0));
  let offset = 0;
  const line = () => {
    const start = offset;
    while (offset < data.length && data[offset++] !== 10) { /* read a header line */ }
    return new TextDecoder().decode(data.subarray(start, offset - 1)).trim();
  };
  if (!line().startsWith('#?')) throw Error('Invalid Tenerife HDR header');
  let header;
  do { header = line(); } while (header && offset < data.length);
  const dimensions = /^-Y (\d+) \+X (\d+)$/.exec(line());
  if (!dimensions) throw Error('Unsupported Tenerife HDR orientation');
  const height = +dimensions[1], width = +dimensions[2], sample = new Uint8Array(width * 4);
  if (width !== 512 || height !== 256) throw Error('Unexpected Tenerife HDR dimensions');
  const rgba = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    if (data[offset] !== 2 || data[offset + 1] !== 2 || (data[offset + 2] << 8 | data[offset + 3]) !== width) {
      throw Error('Unsupported Tenerife HDR scanline');
    }
    offset += 4;
    for (let channel = 0; channel < 4; channel++) {
      let x = 0;
      while (x < width) {
        const code = data[offset++], count = code > 128 ? code - 128 : code;
        if (!(count > 0) || x + count > width || offset >= data.length) throw Error('Truncated Tenerife HDR');
        const value = code > 128 ? data[offset++] : 0;
        for (let i = 0; i < count; i++) sample[channel * width + x++] = code > 128 ? value : data[offset++];
      }
    }
    for (let x = 0; x < width; x++) {
      const out = ((height - 1 - y) * width + x) * 4;
      const exponent = sample[width * 3 + x];
      const factor = exponent ? 2 ** (exponent - 136) : 0;
      for (let c = 0; c < 3; c++) rgba[out + c] = sample[c * width + x] * factor;
      rgba[out + 3] = 1;
    }
  }
  // Three.js constants in the pinned renderer: RGBAFormat and FloatType.
  const result = new Pr(rgba, width, height, 1023, 1015);
  result.mapping = 303; // EquirectangularReflectionMapping
  result.magFilter = result.minFilter = pi;
  result.needsUpdate = true;
  return result;
}

function TenerifeAtmosphere({quality}) {
  const { scene, gl } = Wc();
  ee.useEffect(() => {
    const generator = new Vw(gl);
    let sky, reflection, room;
    try {
      sky = tenerifeDecodeSky(tenerifeArtAssets.sky);
      reflection = generator.fromEquirectangular(sky);
      tenerifeSkyMap.value = sky;
      tenerifeSkyReady.value = 1;
    } catch (error) {
      console.warn('Tenerife HDR fallback', error.message);
      sky?.dispose();
      sky = null;
      room = new HF();
      reflection = generator.fromScene(room, .025);
    }
    scene.environment = reflection.texture;
    return () => {
      scene.environment = null;
      tenerifeSkyMap.value = null;
      tenerifeSkyReady.value = 0;
      reflection.dispose();
      sky?.dispose();
      room?.dispose();
      generator.dispose();
    };
  }, [scene, gl]);
  const applied = ee.useRef(null);
  const shadowCenter = ee.useMemo(() => new q(Infinity,0,0), []);
  const forestSun = ee.useMemo(() => new q(.49,.36,-.79).normalize(), []);
  const fogTint = ee.useMemo(() => new Ue('#a6a698'), []);
  const forestBounce = ee.useMemo(() => new Ue('#645b45'), []);
  ee.useEffect(() => () => {
    scene.getObjectByName('Tenerife sunlight')?.target.removeFromParent();
  }, [scene]);
  rs(({ clock, scene: current, camera }) => {
    tenerifeArtTime.value = clock.elapsedTime;
    const sun = current.getObjectByName('Tenerife sunlight');
    const ambient = current.getObjectByName('Tenerife skylight');
    if (!sun||!ambient)return;
    const mode=tenerifeWeather.value, p=tenerifeLightPresets[mode];
    const forest=Math.round(tenerifeForestInfluence(camera.position.x,camera.position.z)*24)/24;
    const lightingChanged=applied.current?.sun!==sun||applied.current?.mode!==mode||applied.current?.quality!==quality;
    const changed=lightingChanged||applied.current?.forest!==forest;
    if(changed){
      tenerifeForestAir.value=forest;
      f0.set(...p.sun).normalize().lerp(forestSun,forest*.87).normalize();
      sun.color.set(forest>.25&&mode===0?'#ffedce':p.color);
      sun.intensity = p.direct*(1-.24*forest);
      ambient.color.set(p.sky).lerp(fogTint,forest*.60);
      ambient.groundColor.set(p.bounce).lerp(forestBounce,forest);
      ambient.intensity = p.ambient*(1-.27*forest);
      if(current.fog){
        current.fog.color.set(p.fog).lerp(fogTint,forest*.94);
        current.fog.density = p.density+forest*(mode===2?.0066:.0045);
      }
      current.environmentIntensity = (mode === 2 ? .62 : .48)*(1-.25*forest);
      applied.current = { sun, mode, quality, forest };
      sun.castShadow=quality;
      sun.shadow.mapSize.set(768,768);
      sun.shadow.radius=2.1;
      sun.shadow.bias=-.00026;
      sun.shadow.normalBias=.12;
      sun.shadow.autoUpdate=false;
      Object.assign(sun.shadow.camera,{left:-44,right:44,top:44,bottom:-44,near:.6,far:260});
      sun.shadow.camera.updateProjectionMatrix();
    }
    if(lightingChanged||quality&&shadowCenter.distanceToSquared(camera.position)>324){
      shadowCenter.copy(camera.position);
      if(!sun.target.parent)current.add(sun.target);
      sun.target.position.copy(camera.position);
      sun.target.position.y-=1.6;
      sun.position.copy(sun.target.position).addScaledVector(f0,135);
      sun.target.updateMatrixWorld(true);
      if(quality)sun.shadow.needsUpdate=true;
    }
  });
  return null;
}

const tenerifeAtlasCode = `
  uniform sampler2D tfColor,tfNormal,tfArm;
  varying vec3 tfWorld;
  varying vec3 tfSurfaceNormal;
  vec4 tfTile(sampler2D image, vec2 p, vec2 tile) {
    vec2 size=vec2(.25,.5), scale=size*.9375;
    vec2 uv=(tile+.03125+fract(p)*.9375)*size;
    vec2 dx=dFdx(p)*scale,dy=dFdy(p)*scale;
    float bound=min(1.,.008/max(.00001,max(length(dx),length(dy))));
    return textureGrad(image,uv,dx*bound,dy*bound);
  }
  vec3 tfFacing() {
    return abs(normalize(tfSurfaceNormal));
  }
  vec2 tfProjection(vec3 n, float scale) {
    vec3 a=abs(n);
    return (a.y>a.x&&a.y>a.z ? tfWorld.xz : a.x>a.z ? tfWorld.zy : tfWorld.xy)*scale;
  }
  vec3 tfBump(vec3 n,vec2 uv,vec3 bump,float amount,vec3 eye) {
    vec3 q0=dFdx(eye),q1=dFdy(eye);
    vec2 s0=dFdx(uv),s1=dFdy(uv);
    vec3 t=cross(q1,n)*s0.x+cross(n,q0)*s1.x;
    vec3 b=cross(q1,n)*s0.y+cross(n,q0)*s1.y;
    float scale=inversesqrt(max(max(dot(t,t),dot(b,b)),.00001));
    return normalize(n*max(bump.z,.40)+amount*scale*(t*bump.x+b*bump.y));
  }
  float tfHash(vec2 p) {vec3 a=fract(vec3(p.xyx)*.1031);a+=dot(a,a.yzx+33.33);return fract((a.x+a.y)*a.z);}
  float tfNoise(vec2 p) {vec2 i=floor(p),f=smoothstep(vec2(0.),vec2(1.),fract(p));return mix(mix(tfHash(i),tfHash(i+vec2(1.,0.)),f.x),mix(tfHash(i+vec2(0.,1.)),tfHash(i+1.),f.x),f.y);}
  float tfCoast(float z) {float a=(z-1550.)/151.,b=(z-1212.)/124.;return -930.+115.*sin(z*.0019)+63.*sin(z*.005+1.5)+24.*cos(z*.011)+152.*exp(-a*a)-69.*exp(-b*b);}
`;

const tenerifeTownShader=tenerifeRelief.towns.map(t=>
  `urban=max(urban,1.-smoothstep(.56,1.11,length((tfWorld.xz-vec2(${t.x.toFixed(1)},${t.z.toFixed(1)}))/vec2(${t.rx.toFixed(1)},${t.rz.toFixed(1)}))));`).join('\n');
const tenerifeGroundCode = `
  float cameraDistance=length(vViewPosition);
  vec3 terrainColor=diffuseColor.rgb;
  vec3 tfPbr=vec3(.78,.96,0.);
  vec3 tfDetail=vec3(0.,0.,1.);
  float tfStrength=0.;
  vec2 texUV=tfWorld.xz*.31;
  if(cameraDistance<220.) {
  vec3 slope=tfFacing();
  float loam=smoothstep(.21,.82,tfNoise(tfWorld.xz*.065));
  float coast=tfWorld.x-tfCoast(tfWorld.z);
  float urban=tfLot;
  ${tenerifeTownShader}
  float mountain=max(exp(-1.65*dot((tfWorld.xz-vec2(294.,-622.))/vec2(275.,390.),(tfWorld.xz-vec2(294.,-622.))/vec2(275.,390.))),
                     exp(-1.65*dot((tfWorld.xz-vec2(-447.,-1065.))/vec2(202.,290.),(tfWorld.xz-vec2(-447.,-1065.))/vec2(202.,290.))));
  float grass=max(smoothstep(.11,.46,tfWorld.y*.00056+diffuseColor.g-diffuseColor.r+.13),mountain*.88);
  float rock=max(smoothstep(.14,.54,1.-slope.y),smoothstep(415.,695.,tfWorld.y)*loam)*(1.-urban*.98);
  float black=max(1.-smoothstep(108.,194.,abs(tfWorld.z-1244.)),(1.-smoothstep(31.,64.,abs(tfWorld.z-1422.)))*.93);
  float beach=(1.-smoothstep(3.5,12.,tfWorld.y))*(1.-smoothstep(24.,67.,coast))*(1.-urban);
  vec2 tile=beach>.55?vec2(2.,0.):rock>.47?vec2(2.,1.):grass>.31?vec2(3.,0.):vec2(1.,0.);
  vec2 planar=tfWorld.xz+tfWorld.y*vec2(.17,.13);
  vec2 ravine=slope.x>slope.z?tfWorld.zy:tfWorld.xy;
  texUV=mix(planar,ravine,smoothstep(.32,.83,rock))*.31+
    vec2(tfNoise(tfWorld.xz*.018),tfNoise(-tfWorld.xz*.022))*1.6;
  float closeup=1.-smoothstep(55.,205.,cameraDistance);
  vec3 photo=tfTile(tfColor,texUV,tile).rgb;
  float tone=dot(photo,vec3(.28,.55,.17));
  float edge=min(abs(beach-.55)*4.5,min(abs(rock-.47)*4.,abs(grass-.31)*4.));
  float textureMix=mix(.07,.53,closeup)*mix(.26,1.,smoothstep(0.,.62,edge));
  vec3 base=mix(diffuseColor.rgb,photo,textureMix);
  float terrainGrain=.72+.35*tfNoise(tfWorld.xz*.033)+.18*loam;
  float dune=tfNoise(tfWorld.xz*.19);
  float wet=beach*(1.-smoothstep(.38,2.8,tfWorld.y+loam*.66+(dune-.5)*1.3));
  float turf=grass*(1.-rock);
  vec2 rippleUV=vec2(tfWorld.x+tfWorld.z*.18,tfWorld.z);
  float crest=sin(rippleUV.x*42.+2.7*sin(rippleUV.y*1.61)+dune*4.);
  float grainFade=(1.-smoothstep(.013,.14,fwidth(rippleUV.x)))*closeup;
  vec3 sand=mix(vec3(.121,.084,.053),vec3(.229,.171,.110),smoothstep(.16,.82,dune));
  vec3 basalt=mix(vec3(.023,.026,.030),vec3(.064,.058,.055),dune);
  sand=mix(sand,basalt,black)*(.92+.13*loam+.11*crest*grainFade);
  sand=mix(sand,photo*mix(.85,.23,black),.22);
  float dampBand=wet*.55+wet*.12*tfNoise(tfWorld.xz*3.);
  base=mix(base,sand,beach*.77)*(1.-dampBand);
  float forest=max((1.-smoothstep(-355.,20.,tfWorld.z))*smoothstep(-1100.,-845.,tfWorld.z)
              *smoothstep(-835.,-615.,tfWorld.x)*(1.-smoothstep(245.,455.,tfWorld.x)),mountain*.82);
  float grassland=smoothstep(.17,.61,loam+.23*dune)*.79+.2;
  vec3 urbanGrass=tfTile(tfColor,planar*.79,vec2(3.,0.)).rgb;
  vec3 urbanGround=mix(vec3(.078,.057,.038),vec3(.075,.133,.044),grassland);
  urbanGround=mix(urbanGround,urbanGrass*vec3(.39,.57,.30),.30);
  urbanGround*=.75+.42*dot(photo,vec3(.3,.6,.1))+.23*dune;
  base=mix(base,urbanGround,urban*.93);
  vec3 highBasalt=mix(vec3(.096,.076,.067),vec3(.055,.048,.052),smoothstep(440.,690.,tfWorld.y));
  base=mix(base,highBasalt*(.81+.58*dune)+photo*.10,rock*.74);
  float dapple=smoothstep(.26,.74,tfNoise(tfWorld.xz*vec2(.38,.19)+2.)*.68+tfNoise(tfWorld.xz*.76)*.32);
  base*=mix(vec3(1.),vec3(.59,.65,.48)+dapple*vec3(.37,.31,.24),forest*.86);
  terrainColor=mix(terrainColor,base*(terrainGrain+.16*tone)*(1.-.16*turf),
    1.-smoothstep(135.,220.,cameraDistance));
  tfPbr.g=.96-wet*.30;
  tfStrength=closeup*mix(.36,.78,rock);
  if(tfStrength>.002) {
    tfDetail=tfTile(tfNormal,texUV,tile).rgb*2.-1.;
    tfDetail.x+=crest*grainFade*beach*.11;
  }
  }
  diffuseColor.rgb=terrainColor;
`;

function tenerifeSurface(material, key, source, textures) {
  material.customProgramCacheKey = () => 'tenerife-pbr-' + key;
  material.onBeforeCompile = shader => {
    const plot=key==='terrain';
    shader.uniforms.tfColor = { value: textures.color };
    shader.uniforms.tfNormal = { value: textures.normal };
    shader.uniforms.tfArm = { value: textures.arm };
    shader.vertexShader = (plot?'attribute float plot; varying float tfLot;\n':'')+
      'varying vec3 tfWorld; varying vec3 tfSurfaceNormal;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 tfPosition=vec4(position,1.);
      #ifdef USE_INSTANCING
        tfPosition=instanceMatrix*tfPosition;
      #endif
      tfWorld=(modelMatrix*tfPosition).xyz;
      ${plot?'tfLot=plot;':''}
      tfSurfaceNormal=inverseTransformDirection(transformedNormal,viewMatrix);`);
    shader.fragmentShader = (plot?'varying float tfLot;\n':'')+tenerifeAtlasCode + shader.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + source)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=clamp(tfPbr.g,.39,.99);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nif(tfStrength>.002)normal=tfBump(normal,texUV,tfDetail,tfStrength,-vViewPosition);');
  };
}

function tenerifeStandardSurface(tile, scale, blend, normal, variation = '') {
  return `
    vec2 tile=vec2(${tile[0]}.,${tile[1]}.);
    vec2 texUV=tfProjection(tfFacing(),${scale});
    vec3 tfPhoto=tfTile(tfColor,texUV,tile).rgb;
    vec3 tfPbr=tfTile(tfArm,texUV,tile).rgb;
    vec3 tfDetail=tfTile(tfNormal,texUV,tile).rgb*2.-1.;
    float tfStrength=${normal}*(1.-smoothstep(70.,235.,length(vViewPosition)));
    float tfAo=mix(1.,tfPbr.r,.54);
    diffuseColor.rgb=mix(diffuseColor.rgb,tfPhoto*${blend},.72)*tfAo;
    ${variation}
  `;
}

function tenerifeInstallArt() {
  const textures = Object.fromEntries(['color','normal','arm'].map(key =>
    [key,tenerifeTexture(tenerifeArtAssets[key],key==='color')]));
  tenerifeSurface(OM,'terrain',tenerifeGroundCode,textures);
  for (const [material,key,tile,scale,tint,normal,variation] of [
    [_F,'road',[0,0],.39,1.12,.69,`
      float pits=tfNoise(tfWorld.xz*.18)*.64+tfNoise(tfWorld.xz*1.33)*.36;
      float repairs=smoothstep(.62,.80,pits);
      float joints=smoothstep(.79,.91,tfNoise(tfWorld.xz*vec2(.73,.42)));
      diffuseColor.rgb=(tfPhoto*.62+vec3(.077))*(.89+.25*tfNoise(tfWorld.xz*.065)-repairs*.14-joints*.08);
      float forest=(1.-smoothstep(-355.,20.,tfWorld.z))*smoothstep(-1100.,-845.,tfWorld.z)
                  *smoothstep(-835.,-615.,tfWorld.x)*(1.-smoothstep(245.,455.,tfWorld.x));
      float shadows=smoothstep(.30,.73,tfNoise(tfWorld.xz*vec2(.34,.16)+2.)*.63+tfNoise(tfWorld.xz*.74)*.37);
      diffuseColor.rgb*=1.-forest*shadows*.25;
    `],
    [$F,'tracks',[1,0],.49,.88,.67,''],
    [nO,'shoulder',[1,0],.58,.79,.67,''],
    [NM,'paving',[3,1],.54,.85,.63,''],
    [RM,'outcrop',[2,1],.46,.61,.84,`
      float rind=smoothstep(.39,.80,tfNoise(tfWorld.xz*.35));
      diffuseColor.rgb*=.76+.34*rind;
    `],
    [HM,'roof',[1,1],.83,.72,.65,`
      diffuseColor.rgb*=mix(vec3(.93,.57,.36),vec3(1.11,.81,.57),tfNoise(tfWorld.xz*.41));
    `],
    [Cx,'facade',[0,1],.52,.91,.43,`
      float materialTint=dot(diffuseColor.rgb,vec3(.3,.5,.2));
      diffuseColor.rgb=mix(diffuseColor.rgb*.96,tfPhoto*diffuseColor.rgb*1.47,smoothstep(.071,.19,materialTint)*.56);
      vec2 wall=tfProjection(tfFacing(),1.);
      float wallGrain=tfNoise(wall*2.7)*.54+tfNoise(wall*8.2)*.26+tfNoise(wall*.39)*.20;
      float stains=smoothstep(.46,.83,tfNoise(wall*vec2(2.6,.22)))*.61;
      diffuseColor.rgb*=.88+.28*wallGrain+.14*tfPbr.r-stains*.17;
    `],
  ]) {
    if (key==='road'||key==='tracks'||key==='shoulder') material.map=null;
    tenerifeSurface(material,key,tenerifeStandardSurface(tile,scale,tint,normal,variation),textures);
  }

  // Leaves sway in place. Tree bases and all collision points stay fixed.
  for (const [material,depth] of [[nw,.16],[Tx,.105]]) {
    const previous=material.onBeforeCompile;
    material.onBeforeCompile=shader=>{
      previous.call(material,shader);
      shader.uniforms.tfTime=tenerifeArtTime;
      shader.vertexShader='uniform float tfTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 base=instanceMatrix[3].xyz;
        float gust=sin(base.x*.085+base.z*.055+tfTime*1.45)+.34*cos(position.x*12.+tfTime*3.1);
        transformed.x+=gust*${depth}*max(.02,position.y+.13);
        transformed.z+=gust*${depth*.44}*max(.03,position.y+.26);
        #endif`);
    };
    material.customProgramCacheKey=()=> 'tenerife-wind-'+depth;
  }
  q4.color.set('#ad1520');
  q4.metalness=.54;
  q4.roughness=.171;
  q4.clearcoat=1;
  q4.clearcoatRoughness=.085;
  q4.envMapIntensity=1.12;
  W4.roughness=.105;
  TF.roughness=.095;
  W4.envMapIntensity=1.24;
  TF.envMapIntensity=1.24;
  tenerifeInstallSeaAndSky();
}

function tenerifeInstallSeaAndSky() {
  const atmosphere = `
    uniform vec3 sun;
    uniform float weather, skyReady, forestAir;
    uniform sampler2D photoSky;
    vec3 tfSky(vec3 d) {
      float h=max(d.y,0.), evening=1.-abs(weather-1.), gray=smoothstep(1.5,2.,weather);
      float scatter=pow(max(dot(d,sun),0.),9.);
      vec3 horizon=mix(vec3(.43,.63,.72),vec3(.80,.52,.32),evening*.77);
      vec3 zenith=mix(vec3(.075,.27,.53),vec3(.16,.23,.39),evening);
      vec3 c=mix(horizon,zenith,pow(h,.46))+scatter*vec3(.56,.31,.135);
      if(skyReady>.5){
        vec2 pano=vec2(atan(d.z,d.x)*.15915494+.64,asin(clamp(d.y,-1.,1.))*.31830989+.5);
        vec3 photo=texture2D(photoSky,vec2(fract(pano.x),max(.53,pano.y))).rgb;
        float light=dot(photo,vec3(.2126,.7152,.0722));
        float cloud=smoothstep(.24,1.35,log2(1.+light));
        vec3 cloudColor=mix(vec3(.68,.76,.81),vec3(.83,.52,.35),evening*.64);
        c=mix(c,cloudColor,cloud*smoothstep(.04,.22,h)*.84);
      }
      vec3 pineSky=mix(vec3(.81,.77,.63),vec3(.44,.49,.51),pow(h,.32));
      pineSky+=vec3(.15,.11,.067)*scatter;
      return mix(mix(c,vec3(.43,.51,.57),gray*.75),pineSky,forestAir*.72);
    }
  `;
  for(const material of [sO,V4]){
    material.uniforms.photoSky=tenerifeSkyMap;
    material.uniforms.skyReady=tenerifeSkyReady;
    material.uniforms.weather=tenerifeWeather;
    material.uniforms.forestAir=tenerifeForestAir;
  }
  sO.fragmentShader=`
    varying vec3 worldDir;
    ${atmosphere}
    void main(){
      vec3 d=normalize(worldDir);
      float sunCore=pow(max(dot(d,sun),0.),720.);
      vec3 c=tfSky(d)+vec3(2.0,1.04,.39)*sunCore*(1.-.73*smoothstep(1.,2.,weather));
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  V4.fragmentShader=`
    varying vec3 world;
    uniform vec3 eye;
    uniform float time;
    ${atmosphere}
    float tfCoast(float z){float a=(z-1550.)/151.,b=(z-1212.)/124.;return -930.+115.*sin(z*.0019)+63.*sin(z*.005+1.5)+24.*cos(z*.011)+152.*exp(-a*a)-69.*exp(-b*b);}
    void main(){
      vec2 p=world.xz;
      vec3 view=normalize(eye-world);
      float dist=length(eye-world);
      float chop=1.-smoothstep(300.,1600.,dist);
      float a=sin(dot(p,vec2(.095,.036))-time*1.03);
      float b=sin(dot(p,vec2(.041,-.107))-time*1.28);
      float c=cos(dot(p,vec2(.25,.149))-time*2.8+a*.7);
      float ripple=cos(dot(p,vec2(.66,-.23))-time*3.6+b*1.1)*chop;
      vec3 n=normalize(vec3(.027*a+.018*c+.012*ripple,1.,.054*b+.027*c-.011*ripple));
      float depth=tfCoast(p.y)-p.x;
      vec3 openSea=mix(vec3(.017,.138,.201),vec3(.012,.058,.097),smoothstep(28.,520.,depth));
      vec3 shallow=mix(vec3(.088,.23,.202),vec3(.024,.235,.211),smoothstep(-8.,29.,depth));
      vec3 tint=mix(shallow,openSea,smoothstep(12.,100.,depth));
      tint*=1.+a*.053+b*.066+c*.035;
      vec3 reflected=reflect(-view,n);
      float fres=.024+.72*pow(1.-max(0.,dot(view,n)),4.);
      vec3 color=mix(tint,tfSky(reflected),fres);
      float glint=pow(max(dot(reflect(-sun,n),view),0.),142.)*1.2;
      color+=glint*vec3(1.,.74,.43)*(1.-.65*smoothstep(1.,2.,weather));
      float shore=depth+3.+2.0*a+1.3*sin(p.y*.14);
      float swash=sin(shore*.53-time*1.55+b*.91);
      float fragmented=.5+.50*sin(p.y*.73+a*2.+c)*cos(shore*2.62+c);
      float reef=(1.-smoothstep(0.,33.,abs(shore)));
      float foam=reef*smoothstep(.68,.99,swash)*(.38+.53*fragmented)*chop;
      color=mix(color,vec3(.77,.84,.8),clamp(foam,0.,1.));
      float aerial=1.-exp(-dist*.00019);
      color=mix(color,tfSky(normalize(vec3(-view.x,.015,-view.z))),aerial*.79);
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
}

function tenerifeGrassGeometry() {
  const random=MA(3815), vertices=[],indices=[], colors=[];
  for(let i=0;i<9;i++){
    const a=random()*6.283, x=(random()-.5)*.64,z=(random()-.5)*.55;
    const height=.38+random()*.60, w=.02+random()*.035;
    const ux=Math.cos(a)*w,uz=Math.sin(a)*w,lean=.2+random()*.25;
    const off=vertices.length/3;
    vertices.push(x-ux,0,z-uz,x+ux,0,z+uz,x+ux*.62+lean*.28,height*.55,z+uz*.62+lean*.14,
      x-ux*.62+lean*.28,height*.55,z-uz*.62+lean*.14,x+lean,height,z+lean*.59);
    colors.push(.45,.49,.31,.48,.51,.33,.76,.79,.55,.78,.82,.58,1.,1.,.78);
    indices.push(off,off+1,off+2,off,off+2,off+3,off+3,off+2,off+4);
  }
  const geo=new Mt();
  geo.setAttribute('position',new nt(vertices,3));
  geo.setAttribute('color',new nt(colors,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function tenerifeRoadsideArt() {
  const random=MA(513255);
  for(const prop of LM)if(prop.kind==='rock'&&prop.y>266&&Math.sin(prop.x+prop.z)>.08) prop.kind='lava';
  const dry=['#92815a','#8b8158','#807650','#9e905e'];
  const green=['#73804d','#66794b','#537046','#7c8955'];
  // Strips along the existing road are scattered with patchy spacing and gaps.
  for(const road of DA) {
    for(let s=12;s<road.length-10;s+=3+random()*3){
      const p=pl(road,s);
      const wet=IM(p.x,p.z), shore=p.x-Vg(p.z);
      if(p.y>342&&random()>.20||wet<.25&&random()>.66)continue;
      for(const side of [-1,1]) {
        const offset=side*(road.half+1.5+random()*4.4);
        const x=p.x-p.dz*offset,z=p.z+p.dx*offset,nearest=Ws(x,z);
        if(nearest&&nearest.distance<nearest.road.half+1.4||s>1135&&s<1523&&road.main)continue;
        const y=Ts(x,z);
        if(y<.4||shore<1)continue;
        const palette=wet>.17?green:dry;
        const h=(wet>.17?.56:.39)*(.6+random()*.8);
        ii('grass',x,y-.045,z,.61+random()*.58,h,.67+random()*.6,palette[Math.floor(random()*4)],random()*6.28);
        if(s%38<5&&road.main&&p.y<130){
          const w=offset+side*1.65;
          const xx=p.x-p.dz*w,zz=p.z+p.dx*w;
          const by=Ts(xx,zz);
          ii('rock',xx,by+.13,zz,.55+random()*.55,.32,.56,'#5f5143',random()*6.28);
        }
      }
    }
  }
}

function tenerifeInstallGrass() {
  cO.grass=tenerifeGrassGeometry();
  for(const [kind,mesh] of Object.entries(tenerifeArtAssets.meshes)){
    const geometry=new Mt();
    geometry.setAttribute('position',new nt(mesh.p,3));
    geometry.setAttribute('normal',new nt(mesh.n,3));
    geometry.setIndex(mesh.i);
    cO[kind==='basalt'?'rock':kind]=geometry;
  }
  uO.lava=uO.rock;
  uO.grass=new St({ vertexColors:true, side:qn, roughness:.91 });
  uO.grass.onBeforeCompile=shader=>{
    shader.uniforms.tfTime=tenerifeArtTime;
    shader.vertexShader='uniform float tfTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 base=instanceMatrix[3].xyz;
      float wind=sin(base.x*.11+base.z*.087+tfTime*1.62);
      transformed.x+=.15*wind*position.y*position.y;
      transformed.z+=.084*wind*position.y;
      #endif`);
  };
}
