using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace RutaDelViento
{
    internal sealed class CoastWorld
    {
        internal const float Waterline = .18f;
        internal const int RoadLayer = 8;
        internal const int ObstacleLayer = 9;
        internal const int GroundMask = (1 << RoadLayer) | 1;

        internal enum Grip { Asphalt, Gravel, Sand }

        private readonly RouteData route;
        private readonly CoastMaterials art;
        private readonly Transform root;
        private Terrain terrain;
        private const float SkyRotation = 156;
        // Position of the sun in the 48-degree HDRI after the panorama's yaw.
        private static readonly Vector3 SunDirection = new(-.354f, .743f, .568f);

        internal CoastWorld(RouteData route, CoastMaterials art, Transform root, VolumeProfile profile, Cubemap reflections)
        {
            this.route = route;
            this.art = art;
            this.root = root;
            BuildLighting(profile, reflections);
            var raw = Resources.Load<TextAsset>("Coast/Heights").bytes;
            BuildTerrain(raw);
            BuildAtlantic(raw, reflections);
            BuildRoads();
            new CoastScenery(this, route, art, root).Build();
        }

        internal float Ground(float x, float z) => terrain.SampleHeight(new Vector3(x, 0, z)) + terrain.transform.position.y;

        internal Grip Surface(Vector3 point, int layer)
        {
            if (layer == RoadLayer) return Grip.Asphalt;
            return point.y < 9 || point.x - RouteData.CoastX(point.z) < 14 ? Grip.Sand : Grip.Gravel;
        }

        private void BuildLighting(VolumeProfile profile, Cubemap reflections)
        {
            var sky = new Material(art.SkyShader) { name = "Atlantic sky" };
            sky.SetTexture("_MainTex", art.Texture("Sky"));
            sky.SetFloat("_Exposure", 1.28f);
            sky.SetFloat("_Rotation", SkyRotation);
            RenderSettings.skybox = sky;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(.72f, .80f, .91f);
            RenderSettings.ambientEquatorColor = new Color(.59f, .61f, .57f);
            RenderSettings.ambientGroundColor = new Color(.39f, .36f, .30f);
            RenderSettings.ambientIntensity = 1f;
            RenderSettings.reflectionIntensity = .42f;
            if (reflections)
            {
                RenderSettings.defaultReflectionMode = DefaultReflectionMode.Custom;
                RenderSettings.customReflectionTexture = reflections;
            }
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = new Color(.65f, .76f, .82f);
            RenderSettings.fogDensity = .00066f;
            Shader.SetGlobalVector("_CoastHaze", new Vector4(.33f, .48f, .59f, .00086f));

            var light = new GameObject("Lumină de Atlantic").AddComponent<Light>();
            light.transform.SetParent(root, false);
            light.transform.rotation = Quaternion.LookRotation(-SunDirection);
            light.type = LightType.Directional;
            light.color = new Color(1f, .95f, .85f);
            light.intensity = 1.78f;
            light.shadows = LightShadows.Soft;
            light.shadowStrength = .78f;
            light.shadowBias = .17f;
            light.shadowNormalBias = .38f;
            RenderSettings.sun = light;

            var effects = new GameObject("Culoare și expunere").AddComponent<Volume>();
            effects.transform.SetParent(root, false);
            effects.isGlobal = true;
            effects.sharedProfile = profile;
        }

        private void BuildTerrain(byte[] raw)
        {
            var b = route.bounds;
            var data = new TerrainData
            {
                name = "Altitudini Ruta del Viento",
                heightmapResolution = b.resolution,
                size = new Vector3(b.width, b.height, b.depth),
                baseMapResolution = 128
            };
            var heights = new float[b.resolution, b.resolution];
            for (var z = 0; z < b.resolution; z++)
            for (var x = 0; x < b.resolution; x++)
            {
                var i = 2 * (z * b.resolution + x);
                heights[z, x] = (raw[i] | (raw[i + 1] << 8)) / 65535f;
            }
            data.SetHeights(0, 0, heights);
            var surface = Terrain.CreateTerrainGameObject(data);
            surface.name = "Teren cu straturi fotografice";
            surface.transform.SetParent(root, false);
            surface.transform.position = new Vector3(b.minX, b.minY, b.minZ);
            terrain = surface.GetComponent<Terrain>();
            terrain.drawHeightmap = false;
            BuildLandSurface(heights);
        }

        private void BuildLandSurface(float[,] heights)
        {
            var b = route.bounds;
            var material = new Material(Shader.Find("Ruta del Viento/Coast Terrain")) { name = "Sol și faleză Atlantic" };
            foreach (var map in new[] { "Sand", "Soil", "Cliff", "Scrub" }) material.SetTexture("_" + map, art.Texture(map));
            material.SetTexture("_Beach", art.Texture("BeachGrain"));
            material.SetTexture("_SandNormal", art.Texture("BeachGrainNormal"));
            material.SetTexture("_CliffNormal", art.Texture("CliffNormal"));
            const int tile = 128;
            const int step = 2;
            const int stride = tile / step + 1;
            var spacingX = b.width / (b.resolution - 1);
            var spacingZ = b.depth / (b.resolution - 1);
            var indices = new int[(stride - 1) * (stride - 1) * 6];
            for (var iz = 0; iz < stride - 1; iz++)
            for (var ix = 0; ix < stride - 1; ix++)
            {
                var p = iz * stride + ix;
                var i = (iz * (stride - 1) + ix) * 6;
                indices[i] = p; indices[i + 1] = p + stride; indices[i + 2] = p + 1;
                indices[i + 3] = p + 1; indices[i + 4] = p + stride; indices[i + 5] = p + stride + 1;
            }
            float At(int x, int z) => heights[Mathf.Clamp(z, 0, b.resolution - 1), Mathf.Clamp(x, 0, b.resolution - 1)] * b.height + b.minY;
            for (var bz = 0; bz < b.resolution - 1; bz += tile)
            for (var bx = 0; bx < b.resolution - 1; bx += tile)
            {
                var positions = new Vector3[stride * stride];
                var normals = new Vector3[positions.Length];
                var colors = new Color32[positions.Length];
                for (var iz = 0; iz < stride; iz++)
                for (var ix = 0; ix < stride; ix++)
                {
                    var gx = bx + ix * step;
                    var gz = bz + iz * step;
                    var x = b.minX + gx * spacingX;
                    var z = b.minZ + gz * spacingZ;
                    var y = At(gx, gz);
                    var normal = new Vector3((At(gx - 1, gz) - At(gx + 1, gz)) / (2 * spacingX), 1,
                        (At(gx, gz - 1) - At(gx, gz + 1)) / (2 * spacingZ)).normalized;
                    var index = iz * stride + ix;
                    positions[index] = new Vector3(x, y, z);
                    normals[index] = normal;
                    var slope = Mathf.Acos(normal.y) * Mathf.Rad2Deg;
                    var noise = Mathf.PerlinNoise(x * .037f + 14, z * .037f + 30);
                    var patch = Mathf.PerlinNoise(x * .0092f + 24, z * .0077f + 71);
                    var shore = Ramp(24, 86, x - RouteData.CoastX(z));
                    var sand = (1 - Ramp(7.5f, 21f, y + noise * 2.6f)) * (1 - Ramp(21, 43, slope)) * (1 - shore * .90f);
                    var wet = (1 - Ramp(.06f, 2.38f, y + (noise - .5f) * 1.28f)) * sand;
                    var rock = Ramp(22, 41, slope + (noise - .46f) * 23 + (patch - .42f) * 15) * (1 - sand);
                    var scrub = Ramp(.29f, .66f, patch * .70f + noise * .30f) * Ramp(6, 17, y) * (1 - sand - rock) * .99f;
                    colors[index] = new Color(sand - wet, wet, rock, scrub);
                }
                var mesh = new Mesh { name = "Relief de coastă", vertices = positions, normals = normals, colors32 = colors, triangles = indices };
                MeshObject("Teren · suprafață", mesh, material, root);
            }
        }

        private void BuildAtlantic(byte[] raw, Cubemap reflections)
        {
            var b = route.bounds;
            var height = new Texture2D(b.resolution, b.resolution, TextureFormat.R16, false, true)
            {
                name = "Atlantic depth reference", filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp
            };
            height.LoadRawTextureData(raw);
            height.Apply(false, true);
            var water = new Material(art.WaterShader);
            water.SetTexture("_HeightTex", height);
            water.SetVector("_TerrainRect", new Vector4(b.minX, b.minZ, b.width, b.depth));
            water.SetVector("_Elevation", new Vector4(b.minY, b.height, Waterline, 0));
            water.SetTexture("_SkyReflection", reflections);
            var angle = SkyRotation * Mathf.Deg2Rad;
            water.SetVector("_SkyRotation", new Vector4(Mathf.Cos(angle), Mathf.Sin(angle), 0, 0));
            var mesh = new Mesh { name = "Atlantic surface" };
            mesh.vertices = new[] { new Vector3(-8100, Waterline, -8100), new Vector3(8100, Waterline, -8100),
                new Vector3(-8100, Waterline, 8100), new Vector3(8100, Waterline, 8100) };
            mesh.triangles = new[] { 0, 2, 1, 1, 2, 3 };
            var ocean = MeshObject("Atlantic · valuri și spumă", mesh, water, root);
            ocean.GetComponent<MeshRenderer>().shadowCastingMode = ShadowCastingMode.Off;
        }

        private void BuildRoads()
        {
            var marked = new Material(art.Asphalt) { name = "Asfalt principal · marcaje uzate" };
            marked.SetFloat("_LaneLines", 1);
            var beach = new Material(art.Asphalt) { name = "Acces la plajă · nisip peste asfalt" };
            beach.SetTexture("_BeachGrain", art.Texture("BeachGrain"));
            beach.SetFloat("_SandEnd", route.roads[1].points[^1].s);
            for (var index = 0; index < route.roads.Length; index++)
            {
                var road = route.roads[index];
                var asphalt = RoadStrip(0, road.points[^1].s, road.half, 0, 0, index);
                var surface = index switch { 0 => marked, 1 => beach, _ => art.Asphalt };
                var roadObject = MeshObject(road.name, asphalt, surface, root);
                roadObject.layer = RoadLayer;
                roadObject.AddComponent<MeshCollider>().sharedMesh = asphalt;
                for (var side = -1; side <= 1; side += 2)
                {
                    var shoulder = RoadStrip(0, road.points[^1].s, .52f, side * (road.half + .44f), -.075f, index, side);
                    var shoulderObject = MeshObject("Margine de pietriș", shoulder, art.Shoulder, root);
                    shoulderObject.AddComponent<MeshCollider>().sharedMesh = shoulder;
                }
            }

        }

        private Mesh RoadStrip(float from, float to, float half, float shift, float lift, int roadIndex, int shoulder = 0)
        {
            var rows = Mathf.Max(2, Mathf.CeilToInt((to - from) / 1.3f) + 1);
            var mesh = new Mesh { name = "Road ribbon" };
            var p = new Vector3[rows * 3];
            var uv = new Vector2[p.Length];
            var edge = new Vector2[p.Length];
            var triangles = new int[(rows - 1) * 12];
            var t = 0;
            for (var i = 0; i < rows; i++)
            {
                var distance = Mathf.Lerp(from, to, i / (rows - 1f));
                var lane = route.At(distance, roadIndex);
                for (var j = 0; j < 3; j++)
                {
                    var lateral = shift + (j - 1) * half;
                    var point = lane.Position + lane.Right * lateral;
                    point.y += lift - Mathf.Abs(lateral) * .009f;
                    p[i * 3 + j] = point;
                    uv[i * 3 + j] = new Vector2(lateral / 4.2f, distance / 4.2f);
                    edge[i * 3 + j].x = shoulder < 0 ? 1 - j * .5f : j * .5f;
                    if (i == rows - 1 || j == 2) continue;
                    var a = i * 3 + j;
                    triangles[t++] = a; triangles[t++] = a + 3; triangles[t++] = a + 1;
                    triangles[t++] = a + 1; triangles[t++] = a + 3; triangles[t++] = a + 4;
                }
            }
            mesh.vertices = p;
            mesh.uv = uv;
            mesh.uv2 = edge;
            mesh.triangles = triangles;
            mesh.RecalculateNormals();
            mesh.RecalculateTangents();
            return mesh;
        }

        internal static float Ramp(float a, float b, float value) => Mathf.SmoothStep(0, 1, Mathf.InverseLerp(a, b, value));

        internal static GameObject MeshObject(string name, Mesh mesh, Material material, Transform parent)
        {
            var obj = new GameObject(name);
            obj.transform.SetParent(parent, false);
            obj.AddComponent<MeshFilter>().sharedMesh = mesh;
            obj.AddComponent<MeshRenderer>().sharedMaterial = material;
            return obj;
        }
    }
}
