#ifndef RUTA_COAST_ATMOSPHERE
#define RUTA_COAST_ATMOSPHERE

float4 _CoastHaze;
float4 _CoastVehicle;
float4 _CoastVehicleForward;

half3 CoastHaze(half3 color, float3 worldPosition)
{
    float range = distance(_WorldSpaceCameraPos, worldPosition);
    float opticalDepth = range * _CoastHaze.w;
    return lerp(color, _CoastHaze.rgb, 1.0 - exp2(-opticalDepth * (opticalDepth + .37)));
}

half CoastVehicleContact(float3 p)
{
    float2 delta = p.xz - _CoastVehicle.xz;
    float2 heading = _CoastVehicleForward.xz;
    float2 fromBody = float2(dot(delta, float2(heading.y,-heading.x)), dot(delta, heading));
    float2 rounded = max(abs(fromBody) - float2(.57,1.39), 0.0) / float2(.62,.94);
    float blend = 1 - smoothstep(.09, 1.12, dot(rounded, rounded));
    float level = 1 - smoothstep(.12, .78, abs(p.y - _CoastVehicle.y));
    return 1 - blend * level * .49 * _CoastVehicle.w;
}

float CoastHash(float2 p)
{
    float3 q = frac(float3(p.xyx) * .1031);
    q += dot(q, q.yzx + 33.33);
    return frac((q.x + q.y) * q.z);
}

float CoastNoise(float2 p)
{
    float2 i = floor(p), f = frac(p);
    f = f * f * (3.0 - 2.0 * f);
    return lerp(lerp(CoastHash(i), CoastHash(i + float2(1, 0)), f.x),
        lerp(CoastHash(i + float2(0, 1)), CoastHash(i + 1), f.x), f.y);
}

#endif
