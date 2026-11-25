using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering;

namespace RutaDelViento
{
    internal sealed class CoastScenery
    {
        private readonly CoastWorld world;
        private readonly RouteData route;
        private readonly CoastMaterials art;
        private readonly Transform root;
        private readonly System.Random random = new(98051);
        private readonly Dictionary<(Material, int, int), List<CombineInstance>> batches = new();
        private Mesh cube, sphere, boulder;
        private Mesh[] palms, agaves, bushes, pebbles, crowns, grasses;
        private Material sage, aloe, olive;

        internal CoastScenery(CoastWorld world, RouteData route, CoastMaterials art, Transform root)
        {
            this.world = world;
            this.route = route;
            this.art = art;
            this.root = root;
        }

        internal void Build()
        {
            cube = Primitive(PrimitiveType.Cube);
            sphere = Primitive(PrimitiveType.Sphere);
            boulder = Resources.Load<GameObject>("Coast/Art/BoulderScan")?.GetComponentsInChildren<MeshFilter>(true)
                .Select(filter => filter.sharedMesh).Where(mesh => mesh && mesh.vertexCount >= 180)
                .OrderBy(mesh => mesh.vertexCount).FirstOrDefault() ?? sphere;
            pebbles = new[] { Pebble(6.3f), Pebble(12.1f), Pebble(30.4f) };
            sage = art.Create("Frunziș salin", "#687348", .22f, null);
            sage.SetFloat("_Cull", 0);
            aloe = art.Create("Frunze de agave", "#416D5D", .32f, null);
            aloe.SetFloat("_Cull", 0);
            olive = art.Create("Tufăriș de coastă", "#889363", .18f, null);
            olive.SetFloat("_Cull", 0);
            palms = new[] { PalmCrown(16), PalmCrown(19), PalmCrown(18) };
            agaves = new[] { Rosette(13, .85f), Rosette(19, 1.1f), Rosette(11, .65f) };
            bushes = new[] { Shrub(37), Shrub(58), Shrub(47) };
            crowns = new[] { CanopyCards(4507, 174), CanopyCards(1359, 152), CanopyCards(9327, 166), CanopyCards(5763, 82) };
            grasses = new[] { GrassTuft(15, .39f), GrassTuft(19, .47f), GrassTuft(13, .32f) };
            BuildBuildings();
            BuildRoadFurniture();
            Scatter();
            PlantRoadsideTrees();
            PlantCoastVerge();
            Flush();
        }

        private void PlantRoadsideTrees()
        {
            for (var i = 0; i < 96; i++)
            {
                var distance = Rand(235, 1210);
                var lane = route.At(distance);
                var offset = (i % 2 == 0 ? -1 : 1) * Rand(10, 47);
                var ground = lane.Position + lane.Right * offset;
                ground.y = world.Ground(ground.x, ground.z);
                if (ground.y < 13 || route.Nearest(ground).Offset < 8 || NearBuilding(ground, 4)) continue;
                var change = Mathf.Abs(world.Ground(ground.x + 2, ground.z) - ground.y)
                    + Mathf.Abs(world.Ground(ground.x, ground.z + 2) - ground.y);
                if (change > 2.35f) continue;
                var height = Rand(4.6f, 8.8f);
                var fork = ground + Vector3.up * (height * .51f);
                TreeBranch(ground, fork, height * .066f);
                var turn = Rand(0, 360);
                for (var j = 0; j < 6; j++)
                {
                    var yaw = turn + j * 137.5f;
                    var outward = Quaternion.Euler(0, yaw, 0) * Vector3.right;
                    var canopy = fork + outward * Rand(.7f, 2.1f) + Vector3.up * (height * Rand(.20f, .42f));
                    TreeBranch(fork, canopy, height * Rand(.014f, .023f));
                    var size = height * Rand(.29f, .43f);
                    Add(crowns[(i + j) % 3], art.Canopy, canopy, Quaternion.Euler(-12, yaw, 9), new Vector3(size, size * .72f, size));
                }
                CollisionBox("Trunchi · arbore de coastă", ground + Vector3.up * 1.3f, Quaternion.identity,
                    new Vector3(height * .067f, 2.6f, height * .067f));
            }
        }

        private void PlantCoastVerge()
        {
            var planting = new System.Random(2814);
            float Next(float lo, float hi) => Mathf.Lerp(lo, hi, (float)planting.NextDouble());
            foreach (var (at, side, height) in new (float, float, float)[]
            {
                (31, 12, 5.3f), (52, 19, 6.6f), (84, -13.5f, 5.6f), (99, 29, 7.1f), (123, 14, 5.9f),
                (147, 10.5f, 5.2f), (153, 29, 6.8f), (161, -11.6f, 4.4f), (184, 15, 5.5f),
                (203, 25, 6.4f), (243, 19, 5.2f), (279, 43, 5.7f)
            })
            {
                var lane = route.At(at);
                var p = lane.Position + lane.Right * side;
                p.y = world.Ground(p.x, p.z);
                if (p.y < 3.5f || route.Nearest(p).Offset < 8 || NearBuilding(p, 4)) continue;
                var fork = p + Vector3.up * (height * .58f) + lane.Forward * .32f;
                TreeBranch(p, fork, height * .074f);
                for (var cluster = 0; cluster < 6; cluster++)
                {
                    var yaw = cluster * 137.5f + Next(0, 28);
                    var q = Quaternion.Euler(0, yaw, 0);
                    var top = fork + q * Vector3.right * Next(.50f, 1.72f) + Vector3.up * (height * Next(.23f, .44f));
                    TreeBranch(fork, top, height * .022f);
                    var size = height * Next(.35f, .54f);
                    Add(crowns[cluster % 3], art.Canopy, top, q, new Vector3(size, size * .66f, size));
                }
                CollisionBox("Trunchi · coastă", p + Vector3.up * 1.3f, Quaternion.identity, new Vector3(.43f, 2.6f, .43f));
            }

            for (var i = 0; i < 58; i++)
            {
                var lane = route.At(Next(42, 1200));
                var p = lane.Position + lane.Right * (Next(48, 150) * (i % 5 == 0 ? -1 : 1));
                p.y = world.Ground(p.x, p.z);
                if (p.y < 10 || route.Nearest(p).Offset < 12 || NearBuilding(p, 5)) continue;
                var slope = Mathf.Abs(world.Ground(p.x + 2, p.z) - p.y) + Mathf.Abs(world.Ground(p.x, p.z + 2) - p.y);
                if (slope > 2.4f) continue;
                var h = Next(4, 7);
                var fork = p + Vector3.up * (h * .63f);
                TreeBranch(p, fork, h * .065f);
                for (var j = 0; j < 3; j++)
                {
                    var rotation = Quaternion.Euler(0, j * 120f + i * 83.7f, 0);
                    var top = fork + rotation * Vector3.right * (h * .16f) + Vector3.up * (h * .22f);
                    TreeBranch(fork, top, h * .02f);
                    Add(crowns[3], art.Canopy, top, rotation, new Vector3(h * .43f, h * .32f, h * .43f));
                }
            }

            for (var i = 0; i < 1475; i++)
            {
                var lane = route.At(Next(4, 1240));
                var p = lane.Position + lane.Right * (Next(6.3f, 32) * (i % 2 == 0 ? -1 : 1));
                p.y = world.Ground(p.x, p.z);
                if (p.y < 2.3f || route.Nearest(p).Offset < 6.05f || NearBuilding(p, 1.4f)) continue;
                if (Mathf.PerlinNoise(p.x * .122f, p.z * .092f) < .44f) continue;
                var rise = Mathf.Abs(world.Ground(p.x + 1, p.z) - p.y) + Mathf.Abs(world.Ground(p.x, p.z + 1) - p.y);
                if (rise > 1.06f) continue;
                var scale = Next(.65f, 1.46f);
                Add(grasses[i % 3], art.Grass, p - Vector3.up * .035f, Quaternion.Euler(0, Next(0, 360), 0), Vector3.one * scale);
            }

            for (var i = 0; i < 175; i++)
            {
                var roadIndex = i % 3 == 0 ? 1 : 0;
                var lane = route.At(Next(12, roadIndex == 0 ? 355 : 245), roadIndex);
                var side = i % 2 == 0 ? -1 : 1;
                var anchor = lane.Position + lane.Right * (Next(8, 28) * side);
                anchor.y = world.Ground(anchor.x, anchor.z);
                if (anchor.y < 2.85f || route.Nearest(anchor).Offset < 6.3f || NearBuilding(anchor, 2)) continue;
                var q = Quaternion.Euler(0, Next(0, 360), 0);
                var extent = Next(.49f, 1.64f);
                var color = i % 4 < 2 ? art.Canopy : sage;
                var mesh = color == art.Canopy ? crowns[3] : bushes[i % bushes.Length];
                Add(mesh, color, anchor - Vector3.up * .055f, q, new Vector3(extent, extent * .48f, extent));
                for (var j = 0; j < 4; j++)
                {
                    var tuft = anchor + q * Quaternion.Euler(0, j * 91f, 0) * Vector3.right * Next(.41f, 1.19f);
                    tuft.y = world.Ground(tuft.x, tuft.z);
                    if (route.Nearest(tuft).Offset < 6.25f) continue;
                    Add(grasses[j % grasses.Length], art.Grass, tuft, q, Vector3.one * Next(.82f, 1.55f));
                }
            }
        }

        private void TreeBranch(Vector3 start, Vector3 end, float width)
        {
            var q = Quaternion.FromToRotation(Vector3.up, end - start);
            Add(TrunkMesh, art.Bark, (start + end) * .5f, q, new Vector3(width, Vector3.Distance(start, end), width));
        }

        private void Scatter()
        {
            for (var i = 0; i < 2350; i++)
            {
                var distance = Rand(0, 1250);
                var lane = route.At(distance);
                var sign = i % 2 == 0 ? -1 : 1;
                var offset = sign * (7f + Mathf.Pow(Rand(0, 1), 1.65f) * 280f);
                var p = lane.Position + lane.Right * offset + lane.Forward * Rand(-16, 16);
                p.y = world.Ground(p.x, p.z);
                if (p.y < 2f || route.Nearest(p).Offset < 6.5f || NearBuilding(p, 4)) continue;
                var slope = Mathf.Abs(world.Ground(p.x + 2, p.z) - p.y) + Mathf.Abs(world.Ground(p.x, p.z + 2) - p.y);
                var turn = Rand(0, 360);
                var cluster = Mathf.PerlinNoise(p.x * .018f, p.z * .025f);
                if (slope > 1.9f || (i % 5 == 0 && cluster < .64f))
                {
                    var size = Rand(.32f, slope > 1.9f ? 4.8f : 1.35f);
                    Rock(p, size, turn, size > 1.6f && Mathf.Abs(offset) < 40);
                }
                else if (p.y < 35 && i % 8 == 0 && (cluster > .58f || Mathf.Abs(offset) < 32))
                {
                    Palm(p, Rand(4.4f, 8.6f), turn, i);
                }
                else if (cluster > .33f && (p.y > 8 || i % 3 == 0))
                {
                    var shape = i % 3;
                    var plant = i % 4 == 0 ? agaves[shape] : bushes[shape];
                    var size = Rand(.34f, p.y > 45 ? 2.35f : 1.45f);
                    Add(plant, i % 4 == 0 ? aloe : shape == 0 ? sage : olive, p,
                        Quaternion.Euler(0, turn, 0), new Vector3(size, size * Rand(.78f, 1.25f), size));
                }
            }

            for (var i = 0; i < 500; i++)
            {
                var z = Rand(-105, 610);
                var x = RouteData.CoastX(z) + Rand(2, 100);
                var y = world.Ground(x, z);
                var p = new Vector3(x, y, z);
                if (y < .1f || y > 14 || route.Nearest(p).Offset < 6.9f || NearBuilding(p, 3)) continue;
                if (i % 23 == 0 && y > 3.7f) Palm(p, Rand(4.3f, 7.5f), Rand(0, 360), i);
                else if (i % 4 == 0 || y < 5) Rock(p, i % 4 == 0 ? Rand(.85f, 3.3f) : Rand(.13f, .55f), Rand(0, 360), false);
                else if (y > 5) Add(agaves[i % 3], aloe, p, Quaternion.Euler(0, Rand(0, 360), 0), Vector3.one * Rand(.3f, 1.3f));
            }

            // The beach spur ends at a small sandy pull-off with an unobstructed exit.
            var spur = route.roads[1];
            var beach = route.At(spur.points[^1].s, 1);
            for (var i = 0; i < 10; i++)
            {
                var p = beach.Position + beach.Right * (i - 4.5f) * 2.2f + beach.Forward * 13f;
                p.y = world.Ground(p.x, p.z);
                if (p.y > 1) Rock(p, Rand(.24f, .6f), Rand(0, 360), false);
            }
        }

        private bool NearBuilding(Vector3 p, float margin)
        {
            foreach (var home in route.houses)
                if (Mathf.Abs(home.x - p.x) < home.width * .5f + margin && Mathf.Abs(home.z - p.z) < home.depth * .5f + margin) return true;
            return false;
        }

        private void BuildBuildings()
        {
            var wall = new[] { art.Create("Tencuială vanilie", "#EBD6B3", .18f, "Plaster"),
                art.Create("Tencuială albă", "#E5E0D1", .17f, "Plaster"),
                art.Create("Tencuială ocru", "#D8A378", .18f, "Plaster") };
            var shutter = art.Create("Obloane verzi", "#486052", .28f, "Bark");
            foreach (var house in route.houses)
            {
                var p = new Vector3(house.x, house.y, house.z);
                p.y = world.Ground(p.x, p.z) - .4f;
                var q = Quaternion.Euler(0, house.angle * Mathf.Rad2Deg, 0);
                var w = house.width;
                var h = house.height;
                var d = house.depth;
                void Part(Material material, Vector3 local, Vector3 size, float tilt = 0) => Add(cube, material, p + q * local, q * Quaternion.Euler(0, 0, tilt), size);
                Part(art.Rock, new Vector3(0, -.55f, 0), new Vector3(w + .4f, 2.3f, d + .4f));
                Part(wall[house.style % wall.Length], new Vector3(0, h * .5f, 0), new Vector3(w, h, d));
                Part(art.Shade, new Vector3(0, h - .15f, 0), new Vector3(w + .23f, .24f, d + .23f));
                for (var side = -1; side <= 1; side += 2)
                {
                    Part(art.Roof, new Vector3(side * w * .25f, h + .59f, 0), new Vector3(w * .55f + .42f, .26f, d + .74f), side * -17);
                    for (var row = 0; row < 2; row++)
                    for (var column = -1; column <= 1; column += 2)
                    {
                        var x = column * w * .28f;
                        var y = 2.05f + row * (h - 2.85f);
                        var z = side * (d * .5f + .052f);
                        Part(art.Shade, new Vector3(x, y, z), new Vector3(1.17f, 1.43f, .19f));
                        Part(art.Glass, new Vector3(x, y, z + side * .1f), new Vector3(.83f, 1.03f, .07f));
                        Part(shutter, new Vector3(x - .64f, y, z), new Vector3(.28f, 1.19f, .20f));
                        Part(shutter, new Vector3(x + .64f, y, z), new Vector3(.28f, 1.19f, .20f));
                        Part(art.Rock, new Vector3(x, y - .67f, z), new Vector3(1.41f, .16f, .44f));
                    }
                    Part(shutter, new Vector3(0, 1.39f, side * (d * .5f + .02f)), new Vector3(1.33f, 2.46f, .17f));
                }
                Part(art.Roof, new Vector3(0, h + 1.2f, 0), new Vector3(.44f, .25f, d + .75f));
                Part(wall[house.style % wall.Length], new Vector3(w * .17f, h + 1.29f, -d * .26f), new Vector3(.67f, 1.29f, .65f));
                CollisionBox("Clădire · Caleta Sur", p + Vector3.up * h * .5f, q, new Vector3(w, h + .5f, d));
            }
        }

        private void BuildRoadFurniture()
        {
            var board = art.Create("Indicatoare de coastă", "#204D4B", .34f, null);
            var post = art.Create("Borne de drum", "#E0DBCB", .21f, null);
            var reflector = art.Create("Reflectoare", "#D78442", .38f, null);
            RoadSign(36, 1, "PLAYA DEL VIENTO", "COSTA ATLÁNTICA", board);
            RoadSign(163, -1, "PLAYA DEL VIENTO", "ACCESO A LA PLAYA", board);
            RoadSign(339, 1, "CALETA SUR", "ENTRADA DEL PUEBLO", board);
            RoadSign(905, 1, "SAN BRUMA", "CARRETERA DEL MIRADOR", board);
            RoadSign(route.finish + 2, 1, "SAN BRUMA", "FIN DEL TRAMO", board);

            for (var at = 8f; at < 1225; at += 12f)
            {
                var lane = route.At(at);
                for (var side = -1; side <= 1; side += 2)
                {
                    var p = lane.Position + lane.Right * (side * 5.9f);
                    if (route.Nearest(p).Offset < 4.9f) continue;
                    p.y = world.Ground(p.x, p.z);
                    if (Mathf.Abs(p.y - lane.Position.y) > 1.6f) continue;
                    var q = Quaternion.LookRotation(lane.Forward);
                    Add(cube, post, p + Vector3.up * .43f, q, new Vector3(.14f, .86f, .15f));
                    Add(cube, art.Shade, p + Vector3.up * .69f, q, new Vector3(.16f, .24f, .17f));
                    Add(cube, side < 0 ? reflector : art.WhitePaint, p + Vector3.up * .69f - lane.Forward * .092f, q, new Vector3(.09f, .11f, .018f));
                }
            }

            foreach (var (from, to) in new[] { (50f, 147f), (231f, 301f), (542f, 665f), (748f, 920f), (1030f, 1115f) })
            {
                for (var at = from; at + 4 <= to; at += 4f)
                {
                    var a = route.At(at);
                    var b = route.At(at + 4);
                    var p = a.Position - a.Right * 5.65f;
                    var end = b.Position - b.Right * 5.65f;
                    if (route.Nearest(p).Offset < 4.95f || route.Nearest(end).Offset < 4.95f) continue;
                    var q = Quaternion.LookRotation(end - p);
                    var middle = (p + end) * .5f;
                    var length = Vector3.Distance(p, end) + .06f;
                    Add(cube, art.Metal, p + Vector3.up * .15f, q, new Vector3(.11f, 1.14f, .22f));
                    Add(cube, art.Metal, middle + Vector3.up * .61f, q, new Vector3(.105f, .31f, length));
                    Add(cube, art.Metal, middle + Vector3.up * .70f - a.Right * .073f, q, new Vector3(.08f, .07f, length));
                    Add(cube, art.Metal, middle + Vector3.up * .53f - a.Right * .073f, q, new Vector3(.08f, .07f, length));
                    CollisionBox("Parapet", middle + Vector3.up * .55f, q, new Vector3(.21f, .7f, length));
                }
            }
        }

        private void RoadSign(float at, int side, string title, string caption, Material board)
        {
            var lane = route.At(at);
            var p = lane.Position + lane.Right * (side * 7.15f);
            p.y = world.Ground(p.x, p.z);
            var q = Quaternion.LookRotation(new Vector3(lane.Forward.x, 0, lane.Forward.z));
            const float width = 3.65f;
            Add(cube, art.Metal, p + q * new Vector3(-1.28f, 1.43f, 0), q, new Vector3(.09f, 2.86f, .09f));
            Add(cube, art.Metal, p + q * new Vector3(1.28f, 1.43f, 0), q, new Vector3(.09f, 2.86f, .09f));
            Add(cube, art.WhitePaint, p + Vector3.up * 2.58f, q, new Vector3(width + .10f, 1.05f, .075f));
            Add(cube, board, p + q * new Vector3(0, 2.58f, -.045f), q, new Vector3(width, .95f, .075f));
            Label(title, p + q * new Vector3(0, 2.76f, -.085f), q, .215f, new Color(.96f, .94f, .84f));
            Label(caption, p + q * new Vector3(0, 2.43f, -.085f), q, .117f, new Color(.8f, .87f, .81f));
        }

        private void Label(string text, Vector3 position, Quaternion rotation, float size, Color color)
        {
            var obj = new GameObject(text);
            obj.transform.SetParent(root, false);
            obj.transform.SetPositionAndRotation(position, rotation);
            var label = obj.AddComponent<TextMesh>();
            label.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            obj.GetComponent<MeshRenderer>().sharedMaterial = label.font.material;
            label.text = text;
            label.anchor = TextAnchor.MiddleCenter;
            label.alignment = TextAlignment.Center;
            label.fontSize = 54;
            label.fontStyle = FontStyle.Bold;
            label.characterSize = size * .38f;
            label.color = color;
        }

        private void Rock(Vector3 ground, float size, float angle, bool collider)
        {
            var scale = new Vector3(size * Rand(.76f, 1.36f), size * Rand(.43f, .87f), size * Rand(.65f, 1.1f));
            var q = Quaternion.Euler(Rand(-14, 14), angle, Rand(-13, 13));
            var mesh = size > 2.5f ? boulder : pebbles[Mathf.FloorToInt(Mathf.Repeat(angle, 3))];
            var b = mesh.bounds;
            var fit = new Vector3(scale.x / b.size.x, scale.y / b.size.y, scale.z / b.size.z);
            var center = ground + Vector3.up * scale.y * .18f;
            Add(mesh, art.Rock, center - q * Vector3.Scale(b.center, fit), q, fit);
            if (collider) CollisionBox("Bolovan", center, q, scale * .72f);
        }

        private Mesh Pebble(float seed)
        {
            var mesh = UnityEngine.Object.Instantiate(sphere);
            mesh.name = "Weathered pebble";
            var vertices = mesh.vertices;
            for (var i = 0; i < vertices.Length; i++)
            {
                var p = vertices[i];
                var noise = Mathf.PerlinNoise(p.x * 4.6f + p.y * 1.9f + seed, p.z * 5.2f - p.y * 2.4f + seed);
                p *= .74f + noise * .53f;
                p.y = Mathf.Clamp(p.y + p.x * .19f, -.34f, .38f);
                vertices[i] = p;
            }
            mesh.vertices = vertices;
            mesh.RecalculateNormals();
            mesh.RecalculateTangents();
            mesh.RecalculateBounds();
            return mesh;
        }

        private void Palm(Vector3 ground, float height, float angle, int index)
        {
            var dir = Quaternion.Euler(0, angle, 0) * Vector3.right;
            var prev = ground - Vector3.up * .08f;
            const int links = 7;
            for (var i = 1; i <= links; i++)
            {
                var t = i / (float)links;
                var top = ground + Vector3.up * (t * height) + dir * (t * t * height * .15f);
                var q = Quaternion.FromToRotation(Vector3.up, top - prev);
                var diameter = (1 - t * .25f) * .067f * height;
                Add(TrunkMesh, art.Bark, (top + prev) * .5f, q, new Vector3(diameter, Vector3.Distance(top, prev) * 1.065f, diameter));
                prev = top;
            }
            Add(palms[index % palms.Length], art.Leaf, prev, Quaternion.Euler(0, angle, 0), Vector3.one * (height * .31f));
            if (route.Nearest(ground).Offset < 25) CollisionBox("Palmier", ground + Vector3.up * 1.15f, Quaternion.identity, new Vector3(.44f, 2.6f, .44f));
        }

        private Mesh trunkMesh;
        private Mesh TrunkMesh => trunkMesh ??= Cylinder();

        private static Mesh Cylinder()
        {
            var p = new Vector3[22];
            var uv = new Vector2[22];
            var t = new int[60];
            for (var i = 0; i <= 10; i++)
            {
                var a = i * Mathf.PI * .2f;
                p[i * 2] = new Vector3(Mathf.Cos(a) * .5f, -.5f, Mathf.Sin(a) * .5f);
                p[i * 2 + 1] = new Vector3(p[i * 2].x * .88f, .5f, p[i * 2].z * .88f);
                uv[i * 2] = new Vector2(i * .1f, 0);
                uv[i * 2 + 1] = new Vector2(i * .1f, .75f);
                if (i == 10) continue;
                var k = i * 2;
                t[i * 6] = k; t[i * 6 + 1] = k + 1; t[i * 6 + 2] = k + 2;
                t[i * 6 + 3] = k + 2; t[i * 6 + 4] = k + 1; t[i * 6 + 5] = k + 3;
            }
            var mesh = new Mesh { name = "Palm fibre trunk", vertices = p, uv = uv, triangles = t };
            mesh.RecalculateNormals(); mesh.RecalculateTangents();
            return mesh;
        }

        private Mesh PalmCrown(int leaves)
        {
            var verts = new List<Vector3>();
            var faces = new List<int>();
            var colors = new List<Color32>();
            for (var i = 0; i < leaves; i++)
            {
                var a = i * 2.39996f;
                var d = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                var cross = Vector3.Cross(Vector3.up, d);
                var length = Rand(.96f, 1.68f);
                var rise = i < leaves * .40f ? Rand(.71f, 1.10f) : Rand(.16f, .70f);
                var span = i < leaves * .65f ? .62f : .84f;
                Vector3 Spine(float t) => d * (length * t) + Vector3.up * (rise * Mathf.Sin(t * Mathf.PI * .90f) - t * t * span);
                for (var j = 0; j < 25; j++)
                {
                    var t = (j + .45f) / 25f;
                    var mid = Spine(t);
                    var leaflet = Mathf.Sin(t * Mathf.PI) * .36f * length;
                    AddBlade(verts, faces, Spine(j / 25f), Spine((j + 1.1f) / 25f), cross * (.020f * (1f - .82f * t)), .009f);
                    for (var k = 0; k < 5; k++) colors.Add(new Color(.79f, .79f, .79f, t));
                    for (var side = -1; side <= 1; side += 2)
                    {
                        var edge = mid + cross * (side * leaflet) + d * (leaflet * .52f) - Vector3.up * (leaflet * .32f);
                        AddBlade(verts, faces, mid, edge, d * Mathf.Lerp(.032f, .052f, Mathf.Sin(t * Mathf.PI)), .012f);
                        for (var k = 0; k < 5; k++) colors.Add(new Color(.59f + .27f * Mathf.Sin(i * 2.8f + j * .37f), 1, 1, t));
                    }
                }
            }
            var mesh = LeafMesh("Palm fronds", verts, faces);
            mesh.SetColors(colors);
            return mesh;
        }

        private static Mesh CanopyCards(int seed, int count)
        {
            var rnd = new System.Random(seed);
            float R(float a, float b) => Mathf.Lerp(a, b, (float)rnd.NextDouble());
            var atlas = new[] { new Rect(8, 13, 146, 405), new Rect(162, 14, 186, 393),
                new Rect(365, 24, 137, 352), new Rect(698, 12, 145, 416), new Rect(215, 580, 155, 441) };
            var positions = new Vector3[count * 4];
            var normals = new Vector3[positions.Length];
            var uv = new Vector2[positions.Length];
            var shade = new Color32[positions.Length];
            var faces = new int[count * 6];
            for (var i = 0; i < count; i++)
            {
                var yaw = i * 2.39996f;
                var outward = new Vector3(Mathf.Cos(yaw), 0, Mathf.Sin(yaw));
                var radius = Mathf.Pow(R(0, 1), .68f) * R(.58f, .99f);
                var center = outward * radius + Vector3.up * (R(.04f, .88f) * (1 - radius * .57f));
                var along = (outward + Vector3.up * R(-.48f, 1.2f)).normalized;
                var across = (Vector3.Cross(along, Vector3.up).normalized + Vector3.up * R(-.76f, .84f)).normalized;
                var length = along * R(.052f, .111f);
                var width = across * (length.magnitude * R(.39f, .65f));
                var normal = Vector3.Cross(across, along).normalized;
                var rect = atlas[i % atlas.Length];
                var u0 = rect.xMin / 1024f; var u1 = rect.xMax / 1024f;
                var v0 = 1 - rect.yMax / 1024f; var v1 = 1 - rect.yMin / 1024f;
                var color = new Color(R(.42f, .97f), 1, 1, Mathf.Lerp(.32f, 1, radius));
                var k = i * 4;
                positions[k] = center - width - length; positions[k + 1] = center + width - length;
                positions[k + 2] = center - width + length; positions[k + 3] = center + width + length;
                uv[k] = new Vector2(u0, v0); uv[k + 1] = new Vector2(u1, v0);
                uv[k + 2] = new Vector2(u0, v1); uv[k + 3] = new Vector2(u1, v1);
                for (var j = 0; j < 4; j++) { normals[k + j] = normal; shade[k + j] = color; }
                var f = i * 6;
                faces[f] = k; faces[f + 1] = k + 1; faces[f + 2] = k + 2;
                faces[f + 3] = k + 2; faces[f + 4] = k + 1; faces[f + 5] = k + 3;
            }
            return new Mesh { name = "Laurel crown", vertices = positions, normals = normals, uv = uv, colors32 = shade, triangles = faces };
        }

        private static Mesh GrassTuft(int blades, float height)
        {
            var positions = new List<Vector3>();
            var faces = new List<int>();
            var colors = new List<Color32>();
            for (var i = 0; i < blades; i++)
            {
                var a = i * 2.39996f;
                var d = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                var stem = i / (float)blades;
                var start = d * (.03f + .09f * stem);
                var tip = d * (.08f + .27f * stem) + Vector3.up * (height * (1.04f - .57f * stem));
                AddBlade(positions, faces, start, tip, Vector3.Cross(Vector3.up, d) * (.012f + stem * .011f), .041f);
                colors.Add(new Color(.37f, 1, 1, 0));
                for (var j = 0; j < 3; j++) colors.Add(new Color(.63f + stem * .12f, 1, 1, .48f));
                colors.Add(new Color(.86f + stem * .12f, 1, 1, 1));
            }
            var mesh = LeafMesh("Grass tussock", positions, faces);
            mesh.SetColors(colors);
            return mesh;
        }

        private Mesh Rosette(int leaves, float length)
        {
            var verts = new List<Vector3>();
            var faces = new List<int>();
            for (var i = 0; i < leaves; i++)
            {
                var a = i * 2.39996f;
                var d = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                var cross = Vector3.Cross(Vector3.up, d);
                var t = i / (float)leaves;
                var tip = (d * (.27f + .83f * t) + Vector3.up * (1.13f - .86f * t)) * (length * Rand(.7f, 1.17f));
                AddBlade(verts, faces, d * .06f, tip, cross * Rand(.072f, .115f), .095f);
            }
            return LeafMesh("Agave rosette", verts, faces);
        }

        private Mesh Shrub(int leaves)
        {
            var verts = new List<Vector3>();
            var faces = new List<int>();
            for (var i = 0; i < leaves; i++)
            {
                var a = i * 2.39996f;
                var d = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                var side = Vector3.Cross(Vector3.up, d);
                var width = Rand(.04f, .08f);
                var start = d * Rand(.06f, .42f) + Vector3.up * Rand(.025f, .24f);
                var tip = d * Rand(.27f, .84f) + Vector3.up * Rand(.29f, .74f);
                AddBlade(verts, faces, start, tip, side * width, .095f);
            }
            return LeafMesh("Saltbush", verts, faces);
        }

        private static void AddBlade(List<Vector3> verts, List<int> faces, Vector3 start, Vector3 tip, Vector3 halfWidth, float ridge)
        {
            var k = verts.Count;
            var mid = Vector3.Lerp(start, tip, .48f);
            verts.Add(start); verts.Add(mid - halfWidth); verts.Add(mid + Vector3.up * ridge); verts.Add(mid + halfWidth); verts.Add(tip);
            faces.Add(k); faces.Add(k + 1); faces.Add(k + 2);
            faces.Add(k); faces.Add(k + 2); faces.Add(k + 3);
            faces.Add(k + 2); faces.Add(k + 1); faces.Add(k + 4);
            faces.Add(k + 2); faces.Add(k + 4); faces.Add(k + 3);
        }

        private static Mesh LeafMesh(string name, List<Vector3> verts, List<int> faces)
        {
            var mesh = new Mesh { name = name };
            mesh.SetVertices(verts);
            mesh.SetTriangles(faces, 0);
            mesh.RecalculateNormals();
            return mesh;
        }

        private void Add(Mesh mesh, Material mat, Vector3 point, Quaternion rotation, Vector3 scale)
        {
            var key = (mat, Mathf.FloorToInt(point.x / 86), Mathf.FloorToInt(point.z / 86));
            if (!batches.TryGetValue(key, out var list)) batches.Add(key, list = new List<CombineInstance>());
            for (var i = 0; i < mesh.subMeshCount; i++)
                list.Add(new CombineInstance { mesh = mesh, subMeshIndex = i, transform = Matrix4x4.TRS(point, rotation, scale) });
        }

        private void Flush()
        {
            foreach (var (key, list) in batches)
            {
                var mesh = new Mesh { name = key.Item1.name, indexFormat = IndexFormat.UInt32 };
                mesh.CombineMeshes(list.ToArray());
                var obj = CoastWorld.MeshObject(key.Item1.name, mesh, key.Item1, root);
                if (key.Item1 == olive || key.Item1 == sage || key.Item1 == aloe || key.Item1 == art.Grass)
                    obj.GetComponent<MeshRenderer>().shadowCastingMode = ShadowCastingMode.Off;
            }
        }

        private void CollisionBox(string name, Vector3 position, Quaternion rotation, Vector3 size)
        {
            var obj = new GameObject(name) { layer = CoastWorld.ObstacleLayer };
            obj.transform.SetParent(root, false);
            obj.transform.SetPositionAndRotation(position, rotation);
            obj.AddComponent<BoxCollider>().size = size;
        }

        private static Mesh Primitive(PrimitiveType type)
        {
            var obj = GameObject.CreatePrimitive(type);
            var mesh = obj.GetComponent<MeshFilter>().sharedMesh;
            obj.SetActive(false);
            UnityEngine.Object.Destroy(obj);
            return mesh;
        }

        private float Rand(float from, float to) => Mathf.Lerp(from, to, (float)random.NextDouble());
    }
}
