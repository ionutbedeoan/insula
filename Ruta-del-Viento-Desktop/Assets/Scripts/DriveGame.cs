using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace RutaDelViento
{
    public sealed class DriveGame : MonoBehaviour
    {
        [SerializeField] private Shader lit, water, sky, dust;
        [SerializeField] private VolumeProfile grade;
        [SerializeField] private Cubemap reflections;
        private RouteData route;
        private CoastCar car;
        private CoastWorld world;
        private DriveCamera view;
        private DriveAudio sound;
        private DriveDust effects;
        private DriveHud hud;
        private DriveSmoke smoke;
        private float progress, elapsed, safeDistance, best;
        private float nextSample, noticeUntil;
        private bool started, paused, finished, map, highQuality;
        private string notice;
        private CoastCar.Command command;

        private bool Driving => started && !paused && !finished;

        private IEnumerator Start()
        {
            Time.timeScale = 1;
            Time.fixedDeltaTime = .02f;
            Time.maximumDeltaTime = .12f;
            var args = Environment.GetCommandLineArgs();
            var smokeIndex = Array.IndexOf(args, "-ruta-smoke");
            if (smokeIndex >= 0) Application.runInBackground = true;
            highQuality = smokeIndex < 0 ? PlayerPrefs.GetInt("quality", 0) == 1 : Array.IndexOf(args, "-ruta-high") >= 0;
            ApplyQuality();
            route = RouteData.Load();
            hud = new DriveHud(route);
            // Give the startup screen one frame before constructing the scene.
            yield return null;
            var art = new CoastMaterials(lit, water, sky);
            world = new CoastWorld(route, art, transform, grade, reflections);
            car = new CoastCar(world, transform, lit);
            view = new DriveCamera(car, transform);
            sound = new DriveAudio(car, transform);
            effects = new DriveDust(car, dust, transform);
            best = PlayerPrefs.GetFloat("coast-best", 0);
            Restart(false);
            view.Follow(0, true);
            if (smokeIndex >= 0 && smokeIndex + 1 < args.Length)
            {
                var iconOnly = Array.IndexOf(args, "-ruta-pictures") >= 0;
                smoke = new DriveSmoke(args[smokeIndex + 1], route, world, car, view, this, iconOnly);
                smoke.Begin();
            }
            else Cursor.visible = true;
        }

        private void ApplyQuality()
        {
            QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = highQuality ? 60 : 30;
            if (GraphicsSettings.currentRenderPipeline is UniversalRenderPipelineAsset pipeline)
            {
                pipeline.renderScale = highQuality ? 1f : .84f;
                pipeline.shadowDistance = highQuality ? 172 : 106;
            }
        }

        private void Update()
        {
            if (car == null) return;
            if (smoke != null)
            {
                smoke.SampleFrame(Time.unscaledDeltaTime);
            }
            else
            {
                if (Input.GetKeyDown(KeyCode.Return) && (!started || finished)) Restart(true);
                if (Input.GetKeyDown(KeyCode.Escape) && started && !finished) TogglePause();
                if (Input.GetKeyDown(KeyCode.C) && Driving)
                {
                    view.Cycle();
                    Notify(view.Name);
                }
                if (Input.GetKeyDown(KeyCode.M) && Driving) map = !map;
                if (Input.GetKeyDown(KeyCode.R) && Driving) Recover();
                if (Input.GetKeyDown(KeyCode.F2)) ToggleQuality();
                var forward = Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow);
                var backward = Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow);
                var left = Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow);
                var right = Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow);
                command = new CoastCar.Command((forward ? 1 : 0) - (backward ? 1 : 0), (right ? 1 : 0) - (left ? 1 : 0),
                    Input.GetKey(KeyCode.Space) || forward && backward);
            }
            sound.Update(!paused && !finished, view.Mode == 1, Time.unscaledDeltaTime);
            if (Driving) effects.Update(Time.deltaTime);
        }

        private void FixedUpdate()
        {
            if (car == null) return;
            if (smoke != null) command = smoke.Step();
            car.Step(Driving ? command : new CoastCar.Command(0, 0, true), Time.fixedDeltaTime);
            if (!Driving) return;
            if (smoke == null && car.RequiresRecovery) Recover();
            elapsed += Time.fixedDeltaTime;
            if (Time.time < nextSample) return;
            nextSample = Time.time + .09f;
            var near = route.Nearest(car.Transform.position, true);
            if (near.Offset < 12f)
            {
                progress = Mathf.Clamp(near.Distance, route.start, route.finish);
                if (near.Offset < 3.8f) safeDistance = progress;
            }
            if (progress >= route.finish - .2f && near.Offset < 7f)
            {
                finished = true;
                if (smoke == null && (best <= 0 || elapsed < best))
                {
                    best = elapsed;
                    PlayerPrefs.SetFloat("coast-best", best);
                    PlayerPrefs.Save();
                }
                Cursor.visible = true;
            }
        }

        private void LateUpdate()
        {
            if (car == null) return;
            car.UpdateVisuals();
            var p = car.Transform.position;
            var forward = car.Transform.forward;
            Shader.SetGlobalVector("_CoastVehicle", new Vector4(p.x, p.y, p.z, 1));
            Shader.SetGlobalVector("_CoastVehicleForward", new Vector4(forward.x, 0, forward.z, 0));
            view.Follow(Time.unscaledDeltaTime, !started);
        }

        internal void Restart(bool drive)
        {
            started = drive;
            finished = false;
            paused = false;
            map = false;
            Time.timeScale = 1;
            nextSample = 0;
            elapsed = 0;
            progress = safeDistance = route.start;
            car.Reset(route.At(route.start));
            view.Cut();
            Cursor.visible = !drive;
        }

        internal void Recover()
        {
            car.Reset(route.At(Mathf.Max(route.start, Mathf.Min(safeDistance - 7f, route.finish - 9f))));
            view.Cut();
            Notify("Mașina a revenit pe traseu");
        }

        internal bool Finished => finished;
        internal float Progress => progress;

        internal void TogglePause()
        {
            paused = !paused;
            Time.timeScale = paused ? 0 : 1;
            Cursor.visible = paused;
        }

        internal void ToggleQuality()
        {
            highQuality = !highQuality;
            PlayerPrefs.SetInt("quality", highQuality ? 1 : 0);
            ApplyQuality();
            Notify(highQuality ? "Grafică · Detaliu" : "Grafică · Echilibrat");
        }

        private void Notify(string text) { notice = text; noticeUntil = Time.unscaledTime + 2.25f; }

        private void OnGUI()
        {
            if (hud == null) return;
            if (car == null) { hud.Loading(); return; }
            if (smoke != null && smoke.HideHud) return;
            if (started) hud.Drive(car, progress, elapsed, map, Time.unscaledTime < noticeUntil ? notice : null);
            if (!started) hud.Title(highQuality, () => Restart(true), ToggleQuality, Application.Quit);
            else if (paused) hud.Pause(highQuality, TogglePause, ToggleQuality, () => Restart(false), Application.Quit);
            else if (finished) hud.Finish(elapsed, best, () => Restart(true), () => Restart(false));
        }

        private void OnApplicationFocus(bool focused)
        {
            if (!focused && smoke == null && Driving) TogglePause();
        }
    }
}
