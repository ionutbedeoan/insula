using System;
using System.Collections.Generic;
using UnityEngine;

namespace RutaDelViento
{
    [Serializable]
    internal sealed class RouteData
    {
        [Serializable] internal struct BoundsData
        {
            public float minX, minY, minZ, width, height, depth;
            public int resolution;
        }

        [Serializable] internal struct Point
        {
            public float x, y, z, s;
            internal Vector3 Position => new(x, y, z);
        }

        [Serializable] internal sealed class Road
        {
            public string name;
            public float half;
            public Point[] points;
        }

        [Serializable] internal struct House
        {
            public float x, y, z, width, depth, height, angle;
            public int style;
        }

        internal readonly struct Sample
        {
            internal readonly Vector3 Position, Forward, Right;
            internal readonly float Distance;

            internal Sample(Vector3 position, Vector3 forward, float distance)
            {
                Position = position;
                Forward = forward.normalized;
                Right = new Vector3(Forward.z, 0, -Forward.x).normalized;
                Distance = distance;
            }
        }

        internal readonly struct Projection
        {
            internal readonly float Offset, Distance, HalfWidth;
            internal Projection(float offset, float distance, float halfWidth)
            {
                Offset = offset;
                Distance = distance;
                HalfWidth = halfWidth;
            }
        }

        public float start, finish;
        public BoundsData bounds;
        public Road[] roads;
        public House[] houses;

        private const int CellSize = 24;
        private Dictionary<Vector2Int, List<(int road, int point)>> cells;

        internal static RouteData Load()
        {
            var asset = Resources.Load<TextAsset>("Coast/Route");
            var route = JsonUtility.FromJson<RouteData>(asset.text);
            route.IndexRoads();
            return route;
        }

        internal Sample At(float distance, int roadIndex = 0)
        {
            var points = roads[roadIndex].points;
            distance = Mathf.Clamp(distance, 0, points[^1].s);
            var lo = 0;
            var hi = points.Length - 1;
            while (hi - lo > 1)
            {
                var middle = (hi + lo) / 2;
                if (points[middle].s < distance) lo = middle;
                else hi = middle;
            }
            var position = Vector3.Lerp(points[lo].Position, points[hi].Position, Mathf.InverseLerp(points[lo].s, points[hi].s, distance));
            var forward = points[Mathf.Min(hi + 1, points.Length - 1)].Position - points[Mathf.Max(lo - 1, 0)].Position;
            return new Sample(position, forward, distance);
        }

        internal Projection Nearest(Vector3 position, bool mainOnly = false)
        {
            if (!cells.TryGetValue(Cell(position.x, position.z), out var candidates)) return new Projection(float.PositiveInfinity, 0, 0);
            var closest = float.PositiveInfinity;
            var distance = 0f;
            var half = 0f;
            foreach (var (road, point) in candidates)
            {
                if (mainOnly && road != 0) continue;
                var a = roads[road].points[point];
                var b = roads[road].points[point + 1];
                var dx = b.x - a.x;
                var dz = b.z - a.z;
                var ratio = Mathf.Clamp01(((position.x - a.x) * dx + (position.z - a.z) * dz) / (dx * dx + dz * dz));
                var x = position.x - a.x - ratio * dx;
                var z = position.z - a.z - ratio * dz;
                var offsetSquared = x * x + z * z;
                if (offsetSquared >= closest) continue;
                closest = offsetSquared;
                distance = Mathf.Lerp(a.s, b.s, ratio);
                half = roads[road].half;
            }
            return new Projection(Mathf.Sqrt(closest), distance, half);
        }

        internal static float CoastX(float z)
        {
            var originalZ = 1550 - z;
            var inlet = (originalZ - 1550) / 151;
            var headland = (originalZ - 1212) / 124;
            return -216 + 115 * Mathf.Sin(originalZ * .0019f) + 63 * Mathf.Sin(originalZ * .005f + 1.5f)
                + 24 * Mathf.Cos(originalZ * .011f) + 152 * Mathf.Exp(-inlet * inlet) - 69 * Mathf.Exp(-headland * headland);
        }

        private static Vector2Int Cell(float x, float z) => new(Mathf.FloorToInt(x / CellSize), Mathf.FloorToInt(z / CellSize));

        private void IndexRoads()
        {
            cells = new Dictionary<Vector2Int, List<(int, int)>>();
            for (var road = 0; road < roads.Length; road++)
            {
                var points = roads[road].points;
                for (var index = 0; index < points.Length - 1; index++)
                {
                    var a = points[index];
                    var b = points[index + 1];
                    var lo = Cell(Mathf.Min(a.x, b.x) - 32, Mathf.Min(a.z, b.z) - 32);
                    var hi = Cell(Mathf.Max(a.x, b.x) + 32, Mathf.Max(a.z, b.z) + 32);
                    for (var x = lo.x; x <= hi.x; x++)
                    for (var z = lo.y; z <= hi.y; z++)
                    {
                        var key = new Vector2Int(x, z);
                        if (!cells.TryGetValue(key, out var candidates)) cells.Add(key, candidates = new List<(int, int)>());
                        candidates.Add((road, index));
                    }
                }
            }
        }
    }
}
