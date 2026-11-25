using System;
using System.Collections.Generic;
using UnityEngine;

namespace RutaDelViento
{
    internal sealed class CoastMaterials
    {
        private readonly Shader lit;
        private readonly Dictionary<string, Texture2D> textures = new();
        internal readonly Material Asphalt, Shoulder, WhitePaint, Rock, Bark, Leaf, Canopy, Grass, Roof, Shade, Metal, Glass;
        internal readonly Shader WaterShader, SkyShader;

        internal CoastMaterials(Shader lit, Shader water, Shader sky)
        {
            this.lit = lit;
            WaterShader = water;
            SkyShader = sky;
            var road = Shader.Find("Ruta del Viento/Road Surface");
            Asphalt = Create("Asfalt uzat", "#D8D4CD", .14f, "RoadAggregate", .55f, road);
            Shoulder = Create("Pietriș de acostament", "#CCBE9E", .08f, "Sand", .63f, road);
            Shoulder.SetFloat("_Gravel", 1);
            WhitePaint = Create("Muchii de indicatoare", "#E3E0D4", .22f, null, 0, road);
            Rock = Create("Bazalt alterat", "#777B7A", .08f, "Boulder", .74f);
            Bark = Create("Scoarță solară", "#8A775C", .13f, "Bark", .8f);
            Leaf = Foliage("Palmieri de coastă", "#748A43", .15f);
            Canopy = Foliage("Frunze de laur", "#CADCB4", .10f);
            Canopy.SetTexture("_BaseMap", Texture("CanopyColor"));
            Canopy.SetTexture("_Mask", Texture("CanopyMask"));
            Canopy.SetFloat("_Cutoff", .47f);
            Grass = Foliage("Ierburi de coastă", "#A39255", .12f);
            Roof = Create("Țiglă de teracotă", "#B86D4E", .23f, "Tiles", .85f);
            Shade = Create("Lemn ars și antracit", "#322E26", .26f, "Plaster", .35f);
            Metal = Create("Oțel zincat", "#A5AAAB", .37f, null);
            Metal.SetFloat("_Metallic", .44f);
            Glass = Create("Geamuri albastre", "#465F62", .81f, null);
            Glass.SetFloat("_Metallic", .36f);
        }

        private static Material Foliage(string name, string hex, float wind)
        {
            var material = new Material(Shader.Find("Ruta del Viento/Coast Foliage")) { name = name };
            material.SetColor("_BaseColor", ColorFromHex(hex));
            material.SetFloat("_Wind", wind);
            return material;
        }

        internal Texture2D Texture(string resource)
        {
            if (textures.TryGetValue(resource, out var t)) return t;
            t = Resources.Load<Texture2D>("Coast/Art/" + resource);
            if (!t) throw new InvalidOperationException("Missing art texture: " + resource);
            t.anisoLevel = 8;
            textures.Add(resource, t);
            return t;
        }

        internal Material Create(string name, string color, float smoothness, string texture, float normalStrength = 1, Shader shader = null)
        {
            var material = new Material(shader ? shader : lit) { name = name, enableInstancing = true };
            material.SetColor("_BaseColor", ColorFromHex(color));
            material.SetFloat("_Smoothness", smoothness);
            if (texture != null)
            {
                material.SetTexture("_BaseMap", Texture(texture));
                material.SetTexture("_BumpMap", Texture(texture + "Normal"));
                material.SetFloat("_BumpScale", normalStrength);
                material.EnableKeyword("_NORMALMAP");
            }
            return material;
        }

        internal static Color ColorFromHex(string color) => ColorUtility.TryParseHtmlString(color, out var value) ? value : Color.white;
    }
}
