using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace RutaDelViento.Editor
{
    public static class CoastProject
    {
        private const string ScenePath = "Assets/Generated/PlayaDelViento.unity";
        private const string Root = "Assets/Generated/";

        [InitializeOnLoadMethod]
        private static void OpenFirstScene()
        {
            if (Application.isBatchMode || Application.isPlaying) return;
            EditorApplication.delayCall += () =>
            {
                if (Application.isPlaying || File.Exists(ScenePath) && GraphicsSettings.defaultRenderPipeline is UniversalRenderPipelineAsset) return;
                PrepareScene();
            };
        }

        [MenuItem("Ruta del Viento/Prepare coastal scene")]
        private static void PrepareScene()
        {
            if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            ConfigureProject();
            if (File.Exists(ScenePath)) EditorSceneManager.OpenScene(ScenePath);
            else CreateScene();
        }

        [MenuItem("Ruta del Viento/Build Windows x64")]
        public static void BuildWindows()
        {
            ConfigureProject();
            if (!File.Exists(ScenePath)) CreateScene();
            var args = Environment.GetCommandLineArgs();
            var output = Array.IndexOf(args, "-ruta-output");
            var directory = Path.GetFullPath(output >= 0 && output + 1 < args.Length ? args[output + 1] : "Builds/Windows-Daylight");
            Directory.CreateDirectory(directory);
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                target = BuildTarget.StandaloneWindows64,
                locationPathName = Path.Combine(directory, "Ruta-del-Viento.exe"),
                options = BuildOptions.None
            });
            if (report.summary.result != BuildResult.Succeeded) throw new InvalidOperationException("Windows build: " + report.summary.result);
            File.Copy("THIRD_PARTY_NOTICES.md", Path.Combine(directory, "THIRD_PARTY_NOTICES.md"), true);
            Debug.Log($"Windows x64 build: {report.summary.outputPath} ({report.summary.totalSize / 1048576} MiB)");
        }

        private static void ConfigureProject()
        {
            Directory.CreateDirectory(Root);
            AssetDatabase.Refresh();
            PlayerSettings.companyName = "Insula uitată";
            PlayerSettings.productName = "Ruta del Viento";
            PlayerSettings.bundleVersion = "0.2.0";
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.defaultScreenWidth = 1280;
            PlayerSettings.defaultScreenHeight = 720;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.SplashScreen.show = false;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.StandaloneWindows64, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.StandaloneWindows64, new[] { GraphicsDeviceType.Direct3D11 });
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Standalone, ScriptingImplementation.Mono2x);

            var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(Root + "CoastURP.asset");
            if (!pipeline)
            {
                pipeline = UniversalRenderPipelineAsset.Create();
                pipeline.LoadBuiltinRendererData(RendererType.UniversalRenderer);
                if (AssetDatabase.LoadAssetAtPath<UniversalRendererData>("Assets/UniversalRenderer.asset"))
                    AssetDatabase.MoveAsset("Assets/UniversalRenderer.asset", Root + "CoastRenderer.asset");
                pipeline.supportsHDR = true;
                pipeline.shadowDistance = 106;
                pipeline.shadowCascadeCount = 2;
                pipeline.msaaSampleCount = 1;
                pipeline.renderScale = .84f;
                AssetDatabase.CreateAsset(pipeline, Root + "CoastURP.asset");
            }
            var firstPipeline = GraphicsSettings.defaultRenderPipeline != pipeline;
            GraphicsSettings.defaultRenderPipeline = pipeline;
            QualitySettings.renderPipeline = pipeline;
            if (firstPipeline)
            {
                const ImportAssetOptions reimport = ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate;
                AssetDatabase.ImportAsset("Assets/Resources/Coast/Art/CarConcept.glb", reimport);
            }
            var settings = new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/GraphicsSettings.asset")[0]);
            var shaders = settings.FindProperty("m_AlwaysIncludedShaders");
            foreach (var name in new[] { "Ruta del Viento/Coast Terrain", "Ruta del Viento/Road Surface", "Ruta del Viento/Coast Foliage" })
            {
                var shader = Shader.Find(name);
                if (!shader) throw new InvalidOperationException("Missing shader " + name);
                var found = false;
                for (var i = 0; i < shaders.arraySize; i++)
                {
                    var element = shaders.GetArrayElementAtIndex(i);
                    var prior = element.objectReferenceValue as Shader;
                    if (name.EndsWith("Coast Terrain", StringComparison.Ordinal) && prior && prior.name == "Universal Render Pipeline/Terrain/Lit")
                        element.objectReferenceValue = shader;
                    found |= element.objectReferenceValue == shader;
                }
                if (!found)
                {
                    shaders.InsertArrayElementAtIndex(shaders.arraySize);
                    shaders.GetArrayElementAtIndex(shaders.arraySize - 1).objectReferenceValue = shader;
                }
            }
            settings.FindProperty("m_FogStripping").intValue = 1;
            settings.FindProperty("m_FogKeepExp2").boolValue = true;
            settings.ApplyModifiedPropertiesWithoutUndo();
            SyncReflection();
            var grade = AssetDatabase.LoadAssetAtPath<VolumeProfile>(Root + "AtlanticGrade.asset");
            if (grade) ConfigureGrade(grade);
            AssetDatabase.SaveAssets();
        }

        private static void SyncReflection()
        {
            const string source = "Assets/Resources/Coast/Art/Sky.hdr";
            const string target = Root + "AtlanticReflection.hdr";
            if (File.Exists(target) && new FileInfo(source).Length == new FileInfo(target).Length
                && File.GetLastWriteTimeUtc(source) == File.GetLastWriteTimeUtc(target)) return;
            File.Copy(source, target, true);
            File.SetLastWriteTimeUtc(target, File.GetLastWriteTimeUtc(source));
            AssetDatabase.ImportAsset(target, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
        }

        private static void ConfigureGrade(VolumeProfile profile)
        {
            if (profile.TryGet<ColorAdjustments>(out var color))
            {
                color.postExposure.Override(.24f);
                color.contrast.Override(1f);
                color.saturation.Override(5f);
                EditorUtility.SetDirty(color);
            }
            if (profile.TryGet<Bloom>(out var bloom))
            {
                bloom.threshold.Override(1.37f);
                bloom.intensity.Override(.075f);
                EditorUtility.SetDirty(bloom);
            }
            if (profile.TryGet<Vignette>(out var vignette))
            {
                vignette.intensity.Override(.075f);
                vignette.smoothness.Override(.48f);
                EditorUtility.SetDirty(vignette);
            }
        }

        private static void CreateScene()
        {
            var profile = AssetDatabase.LoadAssetAtPath<VolumeProfile>(Root + "AtlanticGrade.asset");
            if (!profile)
            {
                profile = ScriptableObject.CreateInstance<VolumeProfile>();
                AssetDatabase.CreateAsset(profile, Root + "AtlanticGrade.asset");
                profile.Add<Tonemapping>().mode.Override(TonemappingMode.ACES);
                profile.Add<ColorAdjustments>();
                profile.Add<Bloom>();
                profile.Add<Vignette>();
                foreach (var component in profile.components) AssetDatabase.AddObjectToAsset(component, profile);
                ConfigureGrade(profile);
                EditorUtility.SetDirty(profile);
            }

            const string cubePath = Root + "AtlanticReflection.hdr";

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var game = new GameObject("Ruta del Viento").AddComponent<DriveGame>();
            var properties = new SerializedObject(game);
            properties.FindProperty("lit").objectReferenceValue = Shader.Find("Universal Render Pipeline/Lit");
            properties.FindProperty("water").objectReferenceValue = Shader.Find("Ruta del Viento/Atlantic");
            properties.FindProperty("sky").objectReferenceValue = Shader.Find("Skybox/Panoramic");
            properties.FindProperty("dust").objectReferenceValue = Shader.Find("Ruta del Viento/Dust");
            properties.FindProperty("grade").objectReferenceValue = profile;
            properties.FindProperty("reflections").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Cubemap>(cubePath);
            properties.ApplyModifiedPropertiesWithoutUndo();
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
        }
    }

    public sealed class CoastArtImporter : AssetPostprocessor
    {
        private void OnPreprocessTexture()
        {
            var importer = (TextureImporter)assetImporter;
            if (assetPath == "Assets/Generated/AtlanticReflection.hdr")
            {
                importer.textureShape = TextureImporterShape.TextureCube;
                importer.generateCubemap = TextureImporterGenerateCubemap.AutoCubemap;
                importer.mipmapEnabled = true;
                importer.maxTextureSize = 256;
                return;
            }
            if (!assetPath.StartsWith("Assets/Resources/Coast/Art/", StringComparison.Ordinal)) return;
            if (assetPath.EndsWith("Normal.jpg", StringComparison.Ordinal)) importer.textureType = TextureImporterType.NormalMap;
            if (assetPath.EndsWith("CanopyMask.png", StringComparison.Ordinal)) importer.sRGBTexture = false;
            importer.anisoLevel = 8;
            importer.wrapMode = assetPath.EndsWith("Sky.hdr", StringComparison.Ordinal) || assetPath.Contains("/Canopy")
                ? TextureWrapMode.Clamp : TextureWrapMode.Repeat;
        }

        private void OnPreprocessModel()
        {
            if (!assetPath.EndsWith("/BoulderScan.fbx", StringComparison.Ordinal)) return;
            var importer = (ModelImporter)assetImporter;
            importer.isReadable = true;
            importer.materialImportMode = ModelImporterMaterialImportMode.None;
        }
    }
}
