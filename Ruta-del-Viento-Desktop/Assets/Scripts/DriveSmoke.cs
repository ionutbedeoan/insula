using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;

namespace RutaDelViento
{
    internal sealed class DriveSmoke
    {
        private readonly string output;
        private readonly RouteData route;
        private readonly CoastWorld world;
        private readonly CoastCar car;
        private readonly DriveCamera view;
        private readonly DriveGame game;
        private readonly bool picturesOnly;
        private readonly List<float> frameTimes = new();
        private readonly List<string> checks = new();
        private float phaseAge, driveAge, brakeStart, pauseProgress, pauseAge;
        private int phase, photoStage, lastCaptureFrame = -100;
        private bool done, hadGrip, hasCoastShot, hasClimbShot, hasTitleShot, wasFocused;
        internal bool HideHud { get; private set; }

        internal DriveSmoke(string output, RouteData route, CoastWorld world, CoastCar car, DriveCamera view, DriveGame game, bool picturesOnly)
        {
            this.output = Path.GetFullPath(output);
            this.route = route;
            this.world = world;
            this.car = car;
            this.view = view;
            this.game = game;
            this.picturesOnly = picturesOnly;
        }

        internal void Begin()
        {
            Directory.CreateDirectory(output);
            Debug.Log($"Drive verification started on {SystemInfo.graphicsDeviceName} at {Screen.width}×{Screen.height}.");
        }

        internal void SampleFrame(float dt)
        {
            if (done) return;
            var focused = Application.isFocused;
            if (phase == 5 && driveAge > 3f && !game.Finished && focused && wasFocused && Time.frameCount > lastCaptureFrame + 3)
                frameTimes.Add(dt);
            wasFocused = focused;
            if (phase != 8) return;
            pauseAge += dt;
            if (pauseAge < .45f) return;
            if (!Check(Mathf.Approximately(game.Progress, pauseProgress), "Pause freezes route progress")) return;
            game.TogglePause();
            Next(1);
        }

        internal CoastCar.Command Step()
        {
            if (done) return Stop();
            phaseAge += Time.fixedDeltaTime;
            switch (phase)
            {
                case 0:
                    if (phaseAge < 1.4f) return Stop();
                    if (!hasTitleShot)
                    {
                        hasTitleShot = true;
                        Capture("01-meniu");
                    }
                    if (phaseAge < 1.7f) return Stop();
                    if (!Check(car.Grounded == 4, "Four tires settle on the actual road mesh")) return Stop();
                    game.Restart(true);
                    if (picturesOnly)
                    {
                        car.Reset(route.At(121));
                        view.Cut();
                        Next(9);
                        return Stop();
                    }
                    game.TogglePause();
                    pauseProgress = game.Progress;
                    Next(8);
                    return Stop();
                case 1:
                    if (phaseAge < 5.5f) return FollowRoad(15f);
                    if (!Check(car.ForwardSpeed > 9 && game.Progress > route.start + 20, "Throttle advances the car on asphalt")) return Stop();
                    brakeStart = car.ForwardSpeed;
                    view.Cycle();
                    if (!Check(view.Mode == 1, "Camera cycles to the hood")) return Stop();
                    Next(2);
                    return Stop();
                case 2:
                    if (phaseAge < 2.4f) return Stop();
                    if (!Check(car.Speed < Mathf.Min(1.5f, brakeStart * .24f), "Brakes stop the car on asphalt")) return Stop();
                    Capture("02-capota");
                    Next(3);
                    return Stop();
                case 3:
                    if (phaseAge < 2.2f) return new CoastCar.Command(-1, 0, false);
                    if (!Check(car.ForwardSpeed < -1.65f && car.Gear == -1, "Reverse engages and moves backwards")) return Stop();
                    view.Cycle();
                    if (!Check(view.Mode == 2, "Camera cycles to the panorama")) return Stop();
                    if (!PlaceOnBeach()) return Stop();
                    Next(4);
                    return Stop();
                case 4:
                    hadGrip |= car.Grounded > 2 && car.Surface == CoastWorld.Grip.Sand;
                    if (phaseAge < 1.7f) return new CoastCar.Command(.34f, 0, false);
                    if (!Check(hadGrip && car.Speed > .5f, "Beach tires detect sand and deliver traction")) return Stop();
                    Capture("03-plaja");
                    Next(7);
                    return Stop();
                case 7:
                    if (phaseAge < .35f) return Stop();
                    game.Recover();
                    view.Cycle();
                    Next(6);
                    return Stop();
                case 6:
                    if (phaseAge < .8f) return Stop();
                    if (!Check(car.Grounded >= 3 && car.Surface == CoastWorld.Grip.Asphalt && view.Mode == 0,
                        "Recovery returns to asphalt and chase camera is available")) return Stop();
                    game.Restart(true);
                    Next(5);
                    return Stop();
                case 5:
                    driveAge += Time.fixedDeltaTime;
                    if (!hasCoastShot && game.Progress > 119) { hasCoastShot = true; Capture("04-coasta"); }
                    if (!hasClimbShot && game.Progress > 785) { hasClimbShot = true; Capture("05-urcare"); }
                    if (game.Finished)
                    {
                        Capture("06-sosire");
                        if (Check(game.Progress >= route.finish - .2f, $"The car drove all {route.finish - route.start:0} m and triggered the finish")) Next(10);
                        return Stop();
                    }
                    if (driveAge > 135 || car.RequiresRecovery)
                    {
                        Fail($"Route completion stopped at {game.Progress:0.0} m, speed {car.Speed:0.0} m/s, position {car.Transform.position}.");
                        return Stop();
                    }
                    return FollowRoad(19.2f);
                case 9:
                    return TakePictures();
                case 10:
                    if (phaseAge > .55f) Finish(true);
                    return Stop();
                default:
                    return Stop();
            }
        }

        private CoastCar.Command TakePictures()
        {
            if (phaseAge < (photoStage % 2 == 0 ? .78f : .22f)) return Stop();
            switch (photoStage++)
            {
                case 0:
                    Capture("02-coasta");
                    break;
                case 1:
                    car.Reset(route.At(206f, 1), false, .2f);
                    view.Cycle(); view.Cycle();
                    HideHud = true;
                    break;
                case 2:
                    Capture("03-plaja");
                    break;
                case 3:
                    car.Reset(route.At(790));
                    view.Cycle();
                    break;
                default:
                    Capture("04-urcare");
                    Next(10);
                    break;
            }
            phaseAge = 0;
            return Stop();
        }

        private bool PlaceOnBeach()
        {
            var shore = route.At(237, 1).Position;
            var best = float.PositiveInfinity;
            var wanted = Vector3.zero;
            for (var z = shore.z - 44; z < shore.z + 44; z += 2)
            for (var x = shore.x - 88; x < shore.x + 27; x += 2)
            {
                var y = world.Ground(x, z);
                if (y < 2.2f || y > 7.25f) continue;
                var p = new Vector3(x, y, z);
                if (route.Nearest(p).Offset < 8f) continue;
                var rise = Mathf.Abs(world.Ground(x + 2f, z) - y) + Mathf.Abs(world.Ground(x, z + 3f) - y);
                if (rise > .64f) continue;
                var score = (p - shore).sqrMagnitude + rise * 45;
                if (score >= best) continue;
                best = score;
                wanted = p;
            }
            if (!Check(float.IsFinite(best), "A drivable sand area adjoins the beach spur")) return false;
            car.Reset(new RouteData.Sample(wanted, Vector3.forward, 0), false, 0);
            view.Cut();
            return true;
        }

        private CoastCar.Command FollowRoad(float cruise)
        {
            var p = car.Transform.position;
            var current = route.Nearest(p, true);
            var along = float.IsFinite(current.Offset) ? current.Distance : game.Progress;
            var target = route.At(along + 8f + car.Speed * .29f);
            var aim = target.Position + target.Right * 1.72f - p;
            var heading = Vector3.SignedAngle(Vector3.ProjectOnPlane(car.Transform.forward, Vector3.up), Vector3.ProjectOnPlane(aim, Vector3.up), Vector3.up);
            var steer = Mathf.Clamp(heading / 21f, -1, 1);
            var bend = Vector3.Angle(target.Forward, route.At(target.Distance + 21).Forward);
            var speed = Mathf.Lerp(cruise, cruise * .62f, Mathf.InverseLerp(7, 37, bend));
            var throttle = Mathf.Clamp((speed - car.ForwardSpeed) * .21f, -.63f, .92f);
            return new CoastCar.Command(throttle, steer, false);
        }

        private void Capture(string name)
        {
            lastCaptureFrame = Time.frameCount;
            ScreenCapture.CaptureScreenshot(Path.Combine(output, name + ".png"));
        }
        private static CoastCar.Command Stop() => new(0, 0, true);
        private void Next(int value) { phase = value; phaseAge = 0; }

        private bool Check(bool value, string name)
        {
            if (!value) { Fail(name); return false; }
            checks.Add("PASS " + name);
            Debug.Log("PASS " + name);
            return true;
        }

        private void Fail(string reason)
        {
            checks.Add("FAIL " + reason);
            Debug.LogError("FAIL " + reason);
            Finish(false);
        }

        private void Finish(bool success)
        {
            done = true;
            var sorted = frameTimes.OrderBy(value => value).ToArray();
            var lines = new List<string> { $"GPU: {SystemInfo.graphicsDeviceName}", $"Resolution: {Screen.width}x{Screen.height}" };
            lines.AddRange(checks);
            if (sorted.Length > 0)
            {
                lines.Add($"Focused frames: {sorted.Length}; mean {1f / sorted.Average():0.0} FPS; p95 {sorted[(int)(sorted.Length * .95f)] * 1000f:0.0} ms; p99 {sorted[(int)(sorted.Length * .99f)] * 1000f:0.0} ms");
                lines.Add($"Route driving time: {driveAge:0.0} s");
            }
            lines.Add(success ? "RESULT PASS" : "RESULT FAIL");
            File.WriteAllLines(Path.Combine(output, "smoke.txt"), lines);
            Debug.Log(string.Join("\n", lines));
            Application.Quit(success ? 0 : 4);
        }
    }
}
