Shader "Ruta del Viento/Coast Terrain"
{
    Properties
    {
        _Sand ("Coastal sand", 2D) = "white" {}
        _Beach ("Fine beach sand", 2D) = "white" {}
        _Soil ("Dry ground", 2D) = "white" {}
        _Cliff ("Volcanic cliff", 2D) = "white" {}
        _Scrub ("Low grasses", 2D) = "white" {}
        _SandNormal ("Sand normals", 2D) = "bump" {}
        _CliffNormal ("Rock normals", 2D) = "bump" {}
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" "Queue"="Geometry" }
        Pass
        {
            Name "Coastal relief"
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

            TEXTURE2D(_Sand); SAMPLER(sampler_Sand);
            TEXTURE2D(_Beach); TEXTURE2D(_Soil); TEXTURE2D(_Cliff); TEXTURE2D(_Scrub);
            TEXTURE2D(_SandNormal); TEXTURE2D(_CliffNormal);

            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; half4 layers : COLOR; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 world : TEXCOORD0; half3 normal : TEXCOORD1; half4 layers : TEXCOORD2; };

            Varyings Vert(Attributes input)
            {
                Varyings output;
                output.world = TransformObjectToWorld(input.positionOS.xyz);
                output.positionCS = TransformWorldToHClip(output.world);
                output.normal = TransformObjectToWorldNormal(input.normalOS);
                output.layers = input.layers;
                return output;
            }

            half4 Frag(Varyings input) : SV_Target
            {
                float3 p = input.world;
                half4 blend = saturate(input.layers);
                half3 n = normalize(input.normal);
                float patch = CoastNoise(p.xz * .034) * .65 + CoastNoise(p.xz * .105 + 3.7) * .35;
                half3 mixedSand = SAMPLE_TEXTURE2D(_Sand, sampler_Sand, p.xz / 9.0).rgb;
                half3 fineSand = SAMPLE_TEXTURE2D(_Beach, sampler_Sand, p.xz / 4.2).rgb;
                half3 sand = lerp(mixedSand * half3(1.28,1.21,1.15), fineSand * half3(1.10,1.07,1.03), .73 + .23 * patch);
                half3 soil = SAMPLE_TEXTURE2D(_Soil, sampler_Sand, p.xz / 10.0).rgb;
                soil = lerp(soil, dot(soil, half3(.26,.62,.12)) * half3(1.20,1.15,1.01), .55);
                half3 cliffX = SAMPLE_TEXTURE2D(_Cliff, sampler_Sand, float2(p.z, p.y * 1.25 - p.z * .16) / 10.7).rgb;
                half3 cliffZ = SAMPLE_TEXTURE2D(_Cliff, sampler_Sand, float2(p.x, p.y * 1.25 + p.x * .13) / 11.2).rgb;
                half orientation = abs(n.x) / max(.10, abs(n.x) + abs(n.z));
                half3 cliff = lerp(cliffZ, cliffX, orientation);
                half shale = .91 + .20 * smoothstep(.16,.76, CoastNoise(float2(p.x * .026 + p.z * .029, p.y * .23 - p.z * .024)));
                cliff = lerp(cliff, dot(cliff, half3(.30,.61,.09)) * half3(.83,.90,.93), .64) * shale;
                half3 turf = SAMPLE_TEXTURE2D(_Scrub, sampler_Sand, p.xz / 12.5).rgb;
                turf = lerp(turf, dot(turf, half3(.23,.63,.14)) * half3(.86,1.04,.76), .38) * (.86 + .37 * patch);
                half3 albedo = soil * max(0, 1.0 - dot(blend, half4(1,1,1,1))) * (.93 + .20 * patch);
                albedo += sand * (blend.x * (.91 + .17 * patch) + blend.y * .56);
                albedo += cliff * blend.z + turf * blend.w;
                half3 sandBump = UnpackNormal(SAMPLE_TEXTURE2D(_SandNormal, sampler_Sand, p.xz / 4.2));
                half3 rockBump = UnpackNormal(SAMPLE_TEXTURE2D(_CliffNormal, sampler_Sand, float2(p.x + p.z * .74, p.y - p.z * .19) / 10.8));
                n = normalize(n + half3(sandBump.x, 0, sandBump.y) * (blend.x + blend.y) * .19 + half3(rockBump.x, 0, rockBump.y) * blend.z * .22);
                Light sun = GetMainLight(TransformWorldToShadowCoord(p));
                half shade = saturate(dot(n, sun.direction)) * lerp(.32, 1, sun.shadowAttenuation);
                half3 color = albedo * (half3(.48,.54,.61) + sun.color * shade * .68);
                return half4(CoastHaze(color * CoastVehicleContact(p), p), 1);
            }
            ENDHLSL
        }

        Pass
        {
            Name "Terrain shadow"
            Tags { "LightMode"="ShadowCaster" }
            ColorMask 0
            HLSLPROGRAM
            #pragma vertex ShadowVert
            #pragma fragment ShadowFrag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
            float3 _LightDirection;
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            float4 ShadowVert(Attributes input) : SV_POSITION
            {
                float3 world = TransformObjectToWorld(input.positionOS.xyz);
                float3 normal = TransformObjectToWorldNormal(input.normalOS);
                return ApplyShadowClamping(TransformWorldToHClip(ApplyShadowBias(world, normal, _LightDirection)));
            }
            half4 ShadowFrag() : SV_Target { return 0; }
            ENDHLSL
        }
    }
}
