Shader "Ruta del Viento/Coast Foliage"
{
    Properties
    {
        _BaseMap ("Photographic leaves", 2D) = "white" {}
        _Mask ("Leaf silhouette", 2D) = "white" {}
        _BaseColor ("Leaf tint", Color) = (1,1,1,1)
        _Cutoff ("Leaf cutoff", Range(0,1)) = .35
        _Wind ("Breeze", Float) = .1
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="TransparentCutout" "Queue"="AlphaTest" }
        Cull Off
        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
        #include "CoastAtmosphere.hlsl"
        TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
        TEXTURE2D(_Mask); SAMPLER(sampler_Mask);
        CBUFFER_START(UnityPerMaterial)
            half4 _BaseColor;
            half _Cutoff;
            half _Wind;
        CBUFFER_END

        struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; half4 shade : COLOR; };
        struct Varyings { float4 positionCS : SV_POSITION; float3 world : TEXCOORD0; half3 normal : TEXCOORD1; float2 uv : TEXCOORD2; half shade : TEXCOORD3; };

        Varyings LeafVertex(Attributes input)
        {
            Varyings output;
            output.world = TransformObjectToWorld(input.positionOS.xyz);
            float wave = sin(dot(output.world.xz, float2(.13,.08)) + _Time.y * 1.34)
                + .32 * sin(dot(output.world.xz, float2(.19,-.26)) + _Time.y * 2.1);
            output.world.xz += float2(.79,.47) * wave * _Wind * input.shade.a;
            output.normal = TransformObjectToWorldNormal(input.normalOS);
            output.uv = input.uv;
            output.shade = input.shade.r;
            output.positionCS = TransformWorldToHClip(output.world);
            return output;
        }

        void CutLeaf(float2 uv)
        {
            clip(SAMPLE_TEXTURE2D(_Mask, sampler_Mask, uv).r - _Cutoff);
        }
        ENDHLSL

        Pass
        {
            Name "Leaf light and transmission"
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex LeafVertex
            #pragma fragment Frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            half4 Frag(Varyings input, FRONT_FACE_TYPE face : FRONT_FACE_SEMANTIC) : SV_Target
            {
                CutLeaf(input.uv);
                half3 n = normalize(input.normal) * IS_FRONT_VFACE(face, 1, -1);
                Light sun = GetMainLight(TransformWorldToShadowCoord(input.world));
                half nl = dot(n, sun.direction);
                half diffuse = saturate(nl * .65 + .35);
                half transmission = saturate(-nl) * .37;
                half3 albedo = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, input.uv).rgb * _BaseColor.rgb;
                half3 light = half3(.56,.65,.59) + sun.color * (diffuse * .46 + transmission) * lerp(.28, 1, sun.shadowAttenuation);
                return half4(CoastHaze(albedo * light * lerp(.52, 1.11, input.shade), input.world), 1);
            }
            ENDHLSL
        }

        Pass
        {
            Name "Leaf shadow"
            Tags { "LightMode"="ShadowCaster" }
            ColorMask 0
            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex ShadowVert
            #pragma fragment ShadowFrag
            float3 _LightDirection;
            Varyings ShadowVert(Attributes input)
            {
                Varyings output = LeafVertex(input);
                output.positionCS = TransformWorldToHClip(ApplyShadowBias(output.world, output.normal, _LightDirection));
                output.positionCS = ApplyShadowClamping(output.positionCS);
                return output;
            }
            half4 ShadowFrag(Varyings input) : SV_Target { CutLeaf(input.uv); return 0; }
            ENDHLSL
        }
    }
}
