Shader "Ruta del Viento/Atlantic"
{
    Properties
    {
        _HeightTex ("Seabed elevation", 2D) = "black" {}
        _SkyReflection ("Reflected sky", Cube) = "grey" {}
        _SkyRotation ("Sky rotation", Vector) = (1,0,0,0)
        _TerrainRect ("Terrain origin and size", Vector) = (-600,-240,1700,1680)
        _Elevation ("Minimum, range, sea level", Vector) = (-58,335,0.18,0)
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Geometry+2" "RenderType"="Opaque" }
        Pass
        {
            Name "Atlantic"
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma target 3.0
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "CoastAtmosphere.hlsl"

            TEXTURE2D(_HeightTex);
            SAMPLER(sampler_HeightTex);
            TEXTURECUBE(_SkyReflection); SAMPLER(sampler_SkyReflection);
            CBUFFER_START(UnityPerMaterial)
                float4 _TerrainRect;
                float4 _Elevation;
                float4 _SkyRotation;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 positionWS : TEXCOORD0; };

            Varyings Vert(Attributes input)
            {
                Varyings output;
                output.positionWS = TransformObjectToWorld(input.positionOS.xyz);
                output.positionCS = TransformWorldToHClip(output.positionWS);
                return output;
            }

            void Wave(float2 p, float2 direction, float frequency, float speed, float amplitude, float footprint, inout float2 slope)
            {
                float phase = dot(p, direction) * frequency - _Time.y * speed;
                slope += direction * (cos(phase) * amplitude * (1 - smoothstep(.30, 1.45, footprint * frequency)));
            }

            half4 Frag(Varyings input) : SV_Target
            {
                float2 p = input.positionWS.xz;
                float2 uv = (p - _TerrainRect.xy) / _TerrainRect.zw;
                float border = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
                float seabed = SAMPLE_TEXTURE2D(_HeightTex, sampler_HeightTex, saturate(uv)).r * _Elevation.y + _Elevation.x;
                float depth = max(0.0, lerp(34.0, _Elevation.z - seabed, smoothstep(0.0, .018, border)));
                float footprint = max(length(ddx(p)), length(ddy(p)));
                float drift = _Time.y;
                float2 chop = float2(CoastNoise(p * .047 + drift * .028), CoastNoise(p.yx * .055 + 38 - drift * .036));
                float grain = CoastNoise(p * .163 + float2(-.036,.039) * drift);
                float2 warped = p + (chop - .5) * 7.6 + float2(.95, -.55) * (grain - .5);
                float2 slope = 0;
                Wave(warped, float2(.91,.415), .39, .78, .127, footprint, slope);
                Wave(warped, float2(.74,-.672), .69, 1.03, .085, footprint, slope);
                Wave(warped, float2(-.21,.978), 1.21, 1.46, .069, footprint, slope);
                Wave(warped, float2(.96,-.28), 2.72, 2.11, .058, footprint, slope);
                Wave(warped, float2(.53,.848), 4.3, 2.79, .052, footprint, slope);
                slope *= lerp(.63, 1.18, chop.x);

                float3 n = normalize(float3(-slope.x, 1, -slope.y));
                float3 v = GetWorldSpaceNormalizeViewDir(input.positionWS);
                float fresnel = .022 + .74 * pow(1.0 - saturate(dot(n, v)), 5.0);
                float3 h = normalize(v + GetMainLight().direction);
                float ndh = saturate(dot(n, h));
                float specular = .49 * pow(ndh, 108.0) + .055 * pow(ndh, 34.0);

                float3 shoal = float3(.048,.238,.210);
                float3 abyss = float3(.012,.062,.101);
                float3 bottom = float3(.245,.257,.174) * (.81 + .36 * chop.y);
                float3 color = lerp(lerp(bottom, shoal, smoothstep(.05, 2.7, depth)), abyss, smoothstep(2.5, 14.0, depth));
                color *= .87 + .16 * chop.x + .09 * grain + .22 * slope.x;
                float3 reflectionDir = reflect(-v, n);
                reflectionDir.y = max(.045, reflectionDir.y);
                float c = _SkyRotation.x, s = _SkyRotation.y;
                reflectionDir.xz = float2(c * reflectionDir.x + s * reflectionDir.z, -s * reflectionDir.x + c * reflectionDir.z);
                float3 reflection = min(float3(1.5,1.55,1.7), SAMPLE_TEXTURECUBE_LOD(_SkyReflection, sampler_SkyReflection, reflectionDir, 3.8).rgb * .70);
                color = lerp(color, max(reflection, float3(.086,.17,.24)), fresnel) + specular * float3(1.0,.90,.71);

                float2 surf = p * .39 + float2(-.044,.025) * drift;
                float lace = CoastNoise(surf) * .57 + CoastNoise(surf * 2.46 + chop * 3.0) * .43;
                float advance = .48 + .38 * sin(drift * 1.27 + chop.y * 5.2);
                float foamEdge = 1 - smoothstep(.055, .49, abs(depth - advance + (lace - .5) * .55));
                float moreSurf = 1 - smoothstep(.06, .31, abs(depth - (1.14 + advance * 1.04) + (lace - .44) * .70));
                float foam = foamEdge * smoothstep(.20,.61,lace) * .76 + moreSurf * smoothstep(.39,.73,lace) * .50;
                foam += (1 - smoothstep(.13, .68, depth)) * smoothstep(.47,.67,lace) * .36;
                color = lerp(color, float3(.73,.82,.78), saturate(foam));

                return half4(CoastHaze(color, input.positionWS), 1);
            }
            ENDHLSL
        }
    }
}
