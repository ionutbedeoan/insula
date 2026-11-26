using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

namespace TenerifeDesktop
{
    public sealed class TenerifeTextureImport : AssetPostprocessor
    {
        private void OnPreprocessTexture()
        {
            if(!assetPath.StartsWith("Assets/Resources/Tenerife/Textures/",StringComparison.Ordinal))return;
            var texture=(TextureImporter)assetImporter;
            texture.mipmapEnabled=true;texture.anisoLevel=4;
            if(assetPath.EndsWith("_normal.jpg",StringComparison.Ordinal))
            {
                texture.textureType=TextureImporterType.NormalMap;
                texture.sRGBTexture=false;
            }
            if(assetPath.EndsWith(".hdr",StringComparison.Ordinal))
            {
                texture.textureCompression=TextureImporterCompression.Uncompressed;
                texture.wrapMode=TextureWrapMode.Clamp;
            }
            if(assetPath.EndsWith("foliage.png",StringComparison.Ordinal))
            {
                texture.alphaIsTransparency=true;
                texture.wrapMode=TextureWrapMode.Clamp;
            }
        }
    }

    public static class TenerifeBuild
    {
        private const string Scene="Assets/Scenes/ExploreazaTenerife.unity";
        private const string OutputDirectory="Builds/Windows-Tenerife";

        [MenuItem("Tenerife/Deschide scena")]
        public static void Open()
        {
            if(EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
                EditorSceneManager.OpenScene(Scene);
        }

        [MenuItem("Tenerife/Build Windows")]
        public static void Windows()
        {
            VerifyAssets();
            var product=PlayerSettings.productName;
            var company=PlayerSettings.companyName;
            var pipeline=GraphicsSettings.defaultRenderPipeline;
            var quality=ProjectSetting("QualitySettings");
            var graphics=ProjectSetting("GraphicsSettings");
            var overrides=quality.FindProperty("m_QualitySettings");
            var previous=new UnityEngine.Object[overrides.arraySize];
            for(int i=0;i<previous.Length;i++)
                previous[i]=overrides.GetArrayElementAtIndex(i).FindPropertyRelative("customRenderPipeline").objectReferenceValue;
            var instancing=graphics.FindProperty("m_InstancingStripping").intValue;
            try
            {
                PlayerSettings.productName="Exploreaza Tenerife";
                PlayerSettings.companyName="Insula Uitata";
                for(int i=0;i<previous.Length;i++)
                    overrides.GetArrayElementAtIndex(i).FindPropertyRelative("customRenderPipeline").objectReferenceValue=null;
                quality.ApplyModifiedPropertiesWithoutUndo();
                GraphicsSettings.defaultRenderPipeline=null;
                graphics.Update();
                // Prop meshes are instantiated at runtime and need their instancing variants.
                graphics.FindProperty("m_InstancingStripping").intValue=2;
                graphics.ApplyModifiedPropertiesWithoutUndo();

                Directory.CreateDirectory(OutputDirectory);
                var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{
                    scenes=new[]{Scene},locationPathName=Path.Combine(OutputDirectory,"Exploreaza Tenerife.exe"),
                    target=BuildTarget.StandaloneWindows64,options=BuildOptions.StrictMode
                });
                if(report.summary.result!=BuildResult.Succeeded)
                    throw new InvalidOperationException("Unity nu a terminat buildul: "+report.summary.result);
                const string notices="THIRD_PARTY_NOTICES.md";
                File.Copy(notices,Path.Combine(OutputDirectory,notices),true);
            }
            finally
            {
                quality.Update();
                for(int i=0;i<previous.Length;i++)
                    overrides.GetArrayElementAtIndex(i).FindPropertyRelative("customRenderPipeline").objectReferenceValue=previous[i];
                quality.ApplyModifiedPropertiesWithoutUndo();
                graphics.Update();
                graphics.FindProperty("m_InstancingStripping").intValue=instancing;
                graphics.ApplyModifiedPropertiesWithoutUndo();
                GraphicsSettings.defaultRenderPipeline=pipeline;
                PlayerSettings.productName=product;
                PlayerSettings.companyName=company;
                AssetDatabase.SaveAssets();
            }
        }

        private static SerializedObject ProjectSetting(string name) =>
            new(AssetDatabase.LoadAllAssetsAtPath($"ProjectSettings/{name}.asset")[0]);

        public static void VerifyAssets()
        {
            var world=IslandData.Load();
            var ground=new GroundGrid(Resources.Load<TextAsset>("Tenerife/Ground").bytes);
            if(world.roads.Length!=21||world.relief.basins.Length!=4||world.relief.cascades.Length!=4||
                Mathf.Abs(world.roads[0].length-5477.94f)>.12f||
                !Shader.Find("Tenerife/Relief")||!Shader.Find("Tenerife/Instanced")||!Shader.Find("Tenerife/Waterways"))
                throw new InvalidDataException("Lipsesc elemente din scena exportată.");
            foreach(var pond in world.relief.basins)
                if(ground.At(pond.x,pond.z)>=pond.y-.22f)
                    throw new InvalidDataException("Fundul bazinului este deasupra apei: "+pond.name);
            Debug.Log("Tenerife: resursele comune au fost validate.");
        }
    }
}
