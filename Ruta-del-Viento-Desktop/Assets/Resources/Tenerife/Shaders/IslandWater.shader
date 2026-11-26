Shader "Tenerife/Waterways" {
 Properties { _Mode ("Ocean / lac / cascadă",Float)=0 _Tint ("Apă",Color)=(.04,.25,.30,1) }
 SubShader {
  Tags { "RenderType"="Transparent" "Queue"="Transparent" }
  Blend SrcAlpha OneMinusSrcAlpha
  ZWrite Off
  Cull Off
  Pass {
   CGPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #pragma multi_compile_fog
   #include "UnityCG.cginc"
   float4 _Tint;
   float _Mode;
   struct vertexInput { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
   struct varyings {
     float4 pos:SV_POSITION; float3 world:TEXCOORD0; float2 uv:TEXCOORD1;
     UNITY_FOG_COORDS(2)
   };
   varyings vert(vertexInput v){
     varyings o; o.pos=UnityObjectToClipPos(v.vertex); o.world=mul(unity_ObjectToWorld,v.vertex).xyz; o.uv=v.uv;
     UNITY_TRANSFER_FOG(o,o.pos); return o;
   }
   fixed4 frag(varyings i):SV_Target{
     float now=_Time.y;
     float2 coord=i.world.xz;
     float a=sin(dot(coord,float2(.78,.34))-now*1.9);
     float b=sin(dot(coord,float2(.44,-.92))-now*2.31);
     float rip=sin(dot(coord,float2(2.2,1.65))-now*3.1+a*1.2);
     float3 normal=normalize(float3(.041*a+.012*rip,1.,.031*b));
     float3 view=normalize(_WorldSpaceCameraPos-i.world);
     float glance=pow(1.-max(0.,dot(normal,view)),4.);
     float3 sky=float3(.53,.68,.74);
     float edge=smoothstep(.41,1.,length(i.uv*2-1));
     float3 color=lerp(_Tint.rgb,sky,glance*.68)+.073*max(0.,a*b)*_Tint.rgb;
     if(_Mode>.5&&_Mode<1.5) color+=edge*float3(.025,.079,.058)+pow(max(0.,rip*b),6.)*edge*.052;
     float alpha=1.;
     if(_Mode>1.5){
       float streak=sin(i.uv.x*115.+sin(i.uv.y*21.+now)*1.3);
       float ribbons=sin(i.uv.y*54.+now*13.+streak*2.)*sin(i.uv.y*28.+now*8.);
       float foam=smoothstep(-.07,.94,streak*.47+ribbons*.52+.45*(1.-smoothstep(0.,.28,i.uv.y)));
       float sides=smoothstep(0.,.16,i.uv.x)*smoothstep(0.,.16,1.-i.uv.x);
       color=lerp(float3(.19,.37,.40),float3(.83,.93,.96),foam);
       alpha=sides*(.39+.60*foam);
     }
     fixed4 output=float4(color,alpha);
     UNITY_APPLY_FOG(i.fogCoord,output);
     return output;
   }
   ENDCG
  }
 }
}
