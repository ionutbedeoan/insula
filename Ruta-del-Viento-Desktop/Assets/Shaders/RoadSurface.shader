Shader "Ruta del Viento/Road Surface"
{
    Properties
    {
        _BaseMap ("Surface texture", 2D) = "white" {}
        _BaseColor ("Surface tint", Color) = (1,1,1,1)
        _BumpMap ("Asphalt normals", 2D) = "bump" {}
        _BumpScale ("Normal intensity", Float) = 0
        _Smoothness ("Smoothness", Range(0,1)) = .12
        _LaneLines ("Painted lines", Float) = 0
        _Gravel ("Gravel verge", Float) = 0
        _SandEnd ("Beach access end", Float) = 0
        _BeachGrain ("Beach sand", 2D) = "white" {}
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" "Queue"="Geometry" }
        Pass
        {
            Name "Road lighting"
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma target 3.0
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "CoastAtmosphere.hlsl"

            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
            TEXTURE2D(_BumpMap); SAMPLER(sampler_BumpMap);
            TEXTURE2D(_BeachGrain); SAMPLER(sampler_BeachGrain);
            CBUFFER_START(UnityPerMaterial)
                half4 _BaseColor;
                half _BumpScale;
                half _Smoothness;
                half _LaneLines;
                half _Gravel;
                float _SandEnd;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float4 tangentOS : TANGENT; float2 uv : TEXCOORD0; float2 edge : TEXCOORD1; };
            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 world : TEXCOORD0;
                half3 normal : TEXCOORD1;
                half3 tangent : TEXCOORD2;
                half3 bitangent : TEXCOORD3;
                float2 uv : TEXCOORD4;
                float edge : TEXCOORD5;
            };

            Varyings Vert(Attributes input)
            {
                Varyings output;
                output.world = TransformObjectToWorld(input.positionOS.xyz);
                output.positionCS = TransformWorldToHClip(output.world);
                VertexNormalInputs axes = GetVertexNormalInputs(input.normalOS, input.tangentOS);
                output.normal = axes.normalWS;
                output.tangent = axes.tangentWS;
                output.bitangent = axes.bitangentWS;
                output.uv = input.uv;
                output.edge = input.edge.x;
                return output;
            }

            half4 Frag(Varyings input) : SV_Target
            {
                if (_Gravel > .5)
                    clip(.79 + .24 * CoastNoise(input.world.xz * 8.7) - input.edge);
                float2 grainUV = input.uv * 1.55;
                half3 maps = UnpackNormalScale(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, grainUV), _BumpScale);
                half3 n = normalize(input.normal * maps.z + input.tangent * maps.x + input.bitangent * maps.y);
                Light sun = GetMainLight(TransformWorldToShadowCoord(input.world));
                half3 mineral = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, grainUV).rgb;
                half3 albedo = mineral * _BaseColor.rgb;
                if (_SandEnd > 0)
                {
                    float meter = input.uv.y * 4.2;
                    float blown = saturate((meter - (_SandEnd - 15)) / 13 + (CoastNoise(input.world.xz * 1.1) - .50) * .79);
                    half3 sand = SAMPLE_TEXTURE2D(_BeachGrain, sampler_BeachGrain, input.world.xz / 4.2).rgb;
                    albedo = lerp(albedo, sand, blown * blown);
                }
                if (_LaneLines > .5)
                {
                    float2 meter = input.uv * 4.2;
                    float k = CoastNoise(input.world.xz * .19);
                    float lateral = abs(meter.x);
                    float tire = max(1 - smoothstep(.13, .56, abs(lateral - 1.28)), 1 - smoothstep(.12, .55, abs(lateral - 2.81)));
                    albedo *= .93 + .14 * k - tire * (.06 + .075 * k);
                    float segment = floor(meter.y / 15.3);
                    float seed = CoastHash(float2(segment, 5.2));
                    float across = lerp(.96, 2.87, seed) * (seed < .5 ? -1 : 1);
                    float along = abs(frac(meter.y / 15.3) * 15.3 - 5.1 + k * .5);
                    float repair = (1 - smoothstep(.35, .55, abs(meter.x - across) + (k - .5) * .20))
                        * (1 - smoothstep(1.13, 1.34, along));
                    albedo *= 1 - repair * smoothstep(.54, .81, seed) * .20;
                    float aa = max(.007, fwidth(meter.x) * .67);
                    float edge = 1 - smoothstep(.051 - aa, .051 + aa, abs(lateral - 4.16));
                    float center = 1 - smoothstep(.065 - aa, .065 + aa, lateral);
                    float dash = abs(frac((meter.y - 1.85) / 10.5 + .5) - .5) * 10.5;
                    center *= 1 - smoothstep(1.58 - fwidth(meter.y), 1.58 + fwidth(meter.y), dash);
                    float wear = smoothstep(.07, .23, dot(mineral, float3(.30,.55,.15))) * (.78 + .18 * k);
                    albedo = lerp(albedo, half3(.73,.70,.61), saturate(max(edge, center)) * wear);
                }
                half light = saturate(dot(n, sun.direction)) * lerp(.35, 1, sun.shadowAttenuation);
                half3 result = albedo * (half3(.66,.70,.74) + .62 * light * min(sun.color, 2));
                return half4(CoastHaze(result * CoastVehicleContact(input.world), input.world), 1);
            }
            ENDHLSL
        }
    }
}
