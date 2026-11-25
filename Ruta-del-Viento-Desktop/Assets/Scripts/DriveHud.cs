using System;
using System.Collections.Generic;
using UnityEngine;

namespace RutaDelViento
{
    internal sealed class DriveHud
    {
        private static readonly Color Ink = new(.042f, .072f, .076f, .90f);
        private static readonly Color White = new(.97f, .95f, .87f);
        private static readonly Color Muted = new(.72f, .77f, .72f);
        private static readonly Color Gold = new(.96f, .71f, .39f);
        private readonly RouteData route;
        private readonly Dictionary<(int, bool, TextAnchor), GUIStyle> styles = new();
        private readonly Texture2D fade;
        private float width, height;

        internal DriveHud(RouteData route)
        {
            this.route = route;
            fade = new Texture2D(128, 1, TextureFormat.RGBA32, false) { name = "UI gradient", wrapMode = TextureWrapMode.Clamp };
            var pixels = new Color[128];
            for (var i = 0; i < pixels.Length; i++)
                pixels[i] = new Color(.027f, .051f, .06f, Mathf.Pow(1 - i / 127f, 1.65f) * .91f);
            fade.SetPixels(pixels);
            fade.Apply(false, true);
        }

        internal void Loading()
        {
            var saved = Begin();
            Fill(new Rect(0, 0, width, height), Ink);
            Text(new Rect(48, height - 98, width - 96, 40), "Se încarcă Ruta del Viento…", 23, White, true);
            GUI.matrix = saved;
        }

        internal void Title(bool quality, Action play, Action settings, Action quit)
        {
            var saved = Begin();
            GUI.DrawTexture(new Rect(0, 0, Mathf.Min(width * .68f, 1060), height), fade);
            var x = Mathf.Clamp(width * .05f, 36, 86);
            var y = height * .315f;
            var titleSize = width < 1120 ? 48 : 62;
            Fill(new Rect(x, y, 42, 2), Gold);
            Text(new Rect(x + 58, y - 11, 510, 24), "INSULA UITATĂ   /   COASTA ATLANTICĂ", 13, White, true);
            Text(new Rect(x - 3, y + 21, width - x * 2, 87), "Ruta del Viento", titleSize, White, true);
            Text(new Rect(x, y + 110, 495, 28), "Playa del Viento → San Bruma   ·   1,13 km", 18, Muted);
            if (Button(new Rect(x, y + 163, 238, 49), "Pornește   ↵", true)) play();
            if (Button(new Rect(x, y + 226, 238, 40), quality ? "Grafică   ·   Detaliu" : "Grafică   ·   Echilibrat", false)) settings();
            if (Button(new Rect(x, y + 274, 238, 39), "Ieșire", false)) quit();
            Text(new Rect(x, height - 56, width - 2 * x, 29), "WASD / săgeți   ·   Spațiu pentru frână   ·   C schimbă camera", 15, Muted);
            GUI.matrix = saved;
        }

        internal void Pause(bool quality, Action resume, Action settings, Action menu, Action quit)
        {
            var saved = Begin();
            Fill(new Rect(0, 0, width, height), new Color(.017f, .037f, .041f, .58f));
            var rect = new Rect((width - 406) * .5f, (height - 380) * .5f, 406, 380);
            Panel(rect);
            var x = rect.x + 34;
            Text(new Rect(x, rect.y + 25, 300, 54), "Pauză", 37, White, true);
            Text(new Rect(x, rect.y + 82, 338, 29), "C · Cameră      M · Hartă      R · Revenire", 14, Muted);
            if (Button(new Rect(x, rect.y + 129, 338, 46), "Continuă   ·   Esc", true)) resume();
            if (Button(new Rect(x, rect.y + 187, 338, 43), quality ? "Grafică   ·   Detaliu" : "Grafică   ·   Echilibrat", false)) settings();
            if (Button(new Rect(x, rect.y + 239, 338, 43), "Meniul principal", false)) menu();
            if (Button(new Rect(x, rect.y + 291, 338, 43), "Ieșire", false)) quit();
            GUI.matrix = saved;
        }

        internal void Finish(float time, float best, Action restart, Action menu)
        {
            var saved = Begin();
            Fill(new Rect(0, 0, width, height), new Color(.02f, .04f, .044f, .55f));
            var rect = new Rect((width - 448) * .5f, (height - 323) * .5f, 448, 323);
            Panel(rect);
            var x = rect.x + 35;
            Text(new Rect(x, rect.y + 26, 365, 28), "TRASEU PARCURS   /   1,13 KM", 14, Gold, true);
            Text(new Rect(x, rect.y + 55, 380, 57), "San Bruma", 44, White, true);
            Text(new Rect(x, rect.y + 128, 378, 29), $"Timp {Clock(time)}     ·     Record {Clock(best > 0 ? best : time)}", 19, Muted);
            if (Button(new Rect(x, rect.y + 181, 378, 46), "Pornește din nou   ↵", true)) restart();
            if (Button(new Rect(x, rect.y + 240, 378, 41), "Meniul principal", false)) menu();
            GUI.matrix = saved;
        }

        internal void Drive(CoastCar car, float progress, float time, bool map, string notice)
        {
            var saved = Begin();
            var fraction = Mathf.InverseLerp(route.start, route.finish, progress);
            var meter = new Rect(31, 30, 288, 70);
            Panel(meter);
            Text(new Rect(46, 38, 163, 26), "SAN BRUMA", 16, White, true);
            Text(new Rect(181, 39, 122, 24), $"{Mathf.Max(0, route.finish - progress) / 1000f:0.00} km", 17, White, false, TextAnchor.MiddleRight);
            Fill(new Rect(46, 78, 257, 3), new Color(.42f, .46f, .42f, .6f));
            Fill(new Rect(46, 78, 257 * fraction, 3), Gold);
            var speed = new Rect(width - 234, height - 178, 203, 146);
            Panel(speed);
            Text(new Rect(speed.x + 13, speed.y + 12, 111, 59), Mathf.RoundToInt(car.Speed * 3.6f).ToString("000"), 50, White, true);
            Text(new Rect(speed.x + 121, speed.y + 35, 70, 28), "km/h", 15, Muted);
            Fill(new Rect(speed.x + 15, speed.y + 83, 173, 3), new Color(.42f, .46f, .42f, .6f));
            Fill(new Rect(speed.x + 15, speed.y + 83, 173 * Mathf.Clamp01(car.Rpm / 6900), 3), Gold);
            var surface = car.Surface == CoastWorld.Grip.Sand ? "Nisip" : car.Surface == CoastWorld.Grip.Gravel ? "Pietriș" : "Asfalt";
            Text(new Rect(speed.x + 15, speed.y + 98, 129, 27), surface, 15, Muted);
            Text(new Rect(speed.x + 134, speed.y + 97, 52, 28), car.Gear < 0 ? "R" : car.Gear.ToString(), 23, Gold, true, TextAnchor.MiddleRight);
            Text(new Rect(width - 190, 38, 150, 30), Clock(time), 19, White, true, TextAnchor.MiddleRight);
            Text(new Rect(33, height - 44, 495, 20), "M  Hartă      C  Cameră      R  Revenire", 14, White);
            if (map) DrawMap(new Rect(31, 113, 286, 273), car.Transform.position, progress);
            if (notice != null)
            {
                var rect = new Rect((width - 400) * .5f, height - 83, 400, 41);
                Panel(rect);
                Text(rect, notice, 17, White, true, TextAnchor.MiddleCenter);
            }
            GUI.matrix = saved;
        }

        private void DrawMap(Rect rect, Vector3 position, float progress)
        {
            Panel(rect);
            Text(new Rect(rect.x + 15, rect.y + 9, 210, 28), "TRASEUL DE COASTĂ", 14, Muted, true);
            Vector2 At(Vector3 point) => new(rect.x + 24 + (point.x + 150) * .39f, rect.yMax - 21 - (point.z + 5) * .19f);
            for (var index = route.roads.Length - 1; index >= 0; index--)
            {
                var last = index == 0 ? route.finish : route.roads[index].points[^1].s;
                var prev = At(route.At(0, index).Position);
                for (var s = 18f; s < last + 18; s += 18)
                {
                    var next = At(route.At(Mathf.Min(s, last), index).Position);
                    Line(prev, next, index > 0 ? new Color(.35f, .46f, .45f) : s <= progress ? Gold : White, index == 0 ? 2.4f : 1.45f);
                    prev = next;
                }
            }
            var dot = At(position);
            if (rect.Contains(dot)) Fill(new Rect(dot.x - 4, dot.y - 4, 8, 8), Gold);
        }

        private Matrix4x4 Begin()
        {
            var previous = GUI.matrix;
            var scale = Mathf.Min(Screen.width / 1450f, Screen.height / 815f);
            width = Screen.width / scale;
            height = Screen.height / scale;
            GUI.matrix = previous * Matrix4x4.Scale(new Vector3(scale, scale, 1));
            return previous;
        }

        private static string Clock(float seconds)
        {
            var tenths = Mathf.FloorToInt(seconds * 10f);
            return $"{tenths / 600:00}:{tenths / 10 % 60:00}.{tenths % 10}";
        }

        private static void Panel(Rect rect)
        {
            Fill(rect, Ink);
            Fill(new Rect(rect.x, rect.y, rect.width, 1), new Color(.68f, .75f, .65f, .19f));
        }

        private bool Button(Rect rect, string label, bool primary)
        {
            var hover = rect.Contains(Event.current.mousePosition);
            Fill(rect, primary ? hover ? new Color(1f, .8f, .52f) : Gold : hover ? new Color(.16f, .23f, .21f, .98f) : Ink);
            Text(new Rect(rect.x + 17, rect.y, rect.width - 19, rect.height), label, 17, primary ? Ink : White, true);
            return GUI.Button(rect, GUIContent.none, GUIStyle.none);
        }

        private void Text(Rect rect, string value, int size, Color color, bool bold = false, TextAnchor align = TextAnchor.MiddleLeft)
        {
            if (!styles.TryGetValue((size, bold, align), out var style))
            {
                style = new GUIStyle(GUI.skin.label)
                {
                    fontSize = size, fontStyle = bold ? FontStyle.Bold : FontStyle.Normal, alignment = align, wordWrap = false,
                    padding = new RectOffset(0, 0, 0, 0)
                };
                styles.Add((size, bold, align), style);
            }
            style.normal.textColor = color;
            GUI.Label(rect, value, style);
        }

        private static void Fill(Rect rect, Color color)
        {
            var saved = GUI.color;
            GUI.color = color;
            GUI.DrawTexture(rect, Texture2D.whiteTexture);
            GUI.color = saved;
        }

        private static void Line(Vector2 a, Vector2 b, Color color, float size)
        {
            var saved = GUI.matrix;
            var angle = Mathf.Atan2(b.y - a.y, b.x - a.x) * Mathf.Rad2Deg;
            GUIUtility.RotateAroundPivot(angle, a);
            Fill(new Rect(a.x, a.y - size * .5f, Vector2.Distance(a, b) + .5f, size), color);
            GUI.matrix = saved;
        }
    }
}
