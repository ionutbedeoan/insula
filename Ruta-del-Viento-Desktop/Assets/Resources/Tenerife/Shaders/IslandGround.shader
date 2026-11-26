Shader "Tenerife/Relief" {
 Properties {
  _Soil ("Pământ", 2D) = "white" {}
  _Grass ("Iarbă", 2D) = "white" {}
  _Basalt ("Bazalt", 2D) = "white" {}
  _Sand ("Nisip", 2D) = "white" {}
 }
 SubShader {
  Tags { "RenderType"="Opaque" }
  CGPROGRAM
  #pragma surface surf Standard vertex:vert fullforwardshadows
  #pragma target 3.0
  sampler2D _Soil,_Grass,_Basalt,_Sand;
  struct Input { float3 worldPos; float3 slope; float4 land; };
  void vert(inout appdata_full v,out Input o){
    UNITY_INITIALIZE_OUTPUT(Input,o);
    o.land=v.color;
    o.slope=UnityObjectToWorldNormal(v.normal);
  }
  void surf(Input IN,inout SurfaceOutputStandard o) {
    float3 p=IN.worldPos;
    float3 n=abs(normalize(IN.slope));
    float coastal=1.-smoothstep(4.,13.,p.y);
    float rocky=max(smoothstep(.13,.51,1.-n.y),smoothstep(430.,690.,p.y))*(1.-IN.land.g);
    float moss=saturate(IN.land.r*1.19+.26*sin(p.x*.071+p.z*.026)*sin(p.z*.049))* (1.-rocky);
    float2 tex=p.xz*.42+float2(.31,.24)*p.y;
    float2 cliff=(n.x>n.z?p.zy:p.xy)*.35;
    float3 soil=tex2D(_Soil,tex).rgb*float3(.70,.74,.57);
    float3 grass=tex2D(_Grass,tex*.82).rgb*float3(.72,.89,.56);
    float3 base=lerp(soil,grass,moss);
    float park=smoothstep(-.48,.54,sin(p.x*.19+p.z*.087)*sin(p.z*.37)-.03);
    base=lerp(base,lerp(soil*.73,grass*.74,park),IN.land.g*.94);
    float3 stone=tex2D(_Basalt,lerp(tex,cliff,1.-n.y)).rgb*float3(.69,.66,.67);
    stone*=.86+.18*sin(p.y*.70+.2*sin(p.z));
    base=lerp(base,stone,rocky);
    float wet=1.-smoothstep(.38,2.6,p.y);
    float3 beach=tex2D(_Sand,tex*1.38).rgb*lerp(float3(.79,.73,.63),float3(.255,.245,.258),IN.land.b);
    o.Albedo=lerp(base,beach*(1.-wet*.38),coastal*(1.-IN.land.g)*(1.-rocky));
    o.Smoothness=wet*coastal*.26;
    o.Occlusion=.96;
  }
  ENDCG
 }
 Fallback "Diffuse"
}
