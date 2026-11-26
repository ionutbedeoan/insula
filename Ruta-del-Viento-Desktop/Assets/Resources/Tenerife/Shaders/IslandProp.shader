Shader "Tenerife/Instanced" {
 Properties {
   _MainTex ("Culoare", 2D)="white" {}
   _BumpMap ("Normală", 2D)="bump" {}
   _Tint ("Tentă",Color)=(1,1,1,1)
   _WorldScale ("Scară textură în lume",Float)=.45
   _Mapped ("Folosește UV",Float)=0
   _Cutoff ("Decupare",Float)=0
   _Gloss ("Netezime",Range(0,1))=.19
   _Metallic ("Metal",Range(0,1))=0
 }
 SubShader {
  Tags { "RenderType"="Opaque" }
  Cull Off
  CGPROGRAM
  #pragma target 3.0
  #pragma surface surf Standard vertex:vert addshadow fullforwardshadows
  #pragma multi_compile_instancing
  sampler2D _MainTex,_BumpMap;
  half _WorldScale,_Mapped,_Cutoff,_Gloss,_Metallic;
  UNITY_INSTANCING_BUFFER_START(Props)
    UNITY_DEFINE_INSTANCED_PROP(fixed4,_Tint)
  UNITY_INSTANCING_BUFFER_END(Props)
  struct Input { float3 worldPos; float3 outward; float2 uv_MainTex; };
  void vert(inout appdata_full v,out Input o){
    UNITY_INITIALIZE_OUTPUT(Input,o);
    o.outward=UnityObjectToWorldNormal(v.normal);
  }
  void surf(Input IN,inout SurfaceOutputStandard o) {
    float3 n=abs(IN.outward),p=IN.worldPos;
    float2 tex=lerp((n.y>max(n.x,n.z)?p.xz:n.x>n.z?p.zy:p.xy)*_WorldScale,IN.uv_MainTex,_Mapped);
    fixed4 c=tex2D(_MainTex,tex);
    clip(c.a-_Cutoff);
    fixed4 tint=UNITY_ACCESS_INSTANCED_PROP(Props,_Tint);
    o.Albedo=c.rgb*tint.rgb;
    o.Normal=UnpackNormal(tex2D(_BumpMap,tex));
    o.Smoothness=_Gloss;
    o.Metallic=_Metallic;
    o.Alpha=1;
    o.Occlusion=.95;
  }
  ENDCG
 }
 Fallback "Diffuse"
}
