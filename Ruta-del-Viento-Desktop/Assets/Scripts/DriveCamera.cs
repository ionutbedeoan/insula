using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace RutaDelViento
{
    internal sealed class DriveCamera
    {
        private readonly Camera camera;
        private readonly CoastCar car;
        private Vector3 velocity;
        private bool cut = true;
        internal int Mode { get; private set; }
        internal string Name => Mode == 0 ? "Urmărire" : Mode == 1 ? "Capotă" : "Panoramă";

        internal DriveCamera(CoastCar car, Transform root)
        {
            this.car = car;
            var obj = new GameObject("Cameră de condus") { tag = "MainCamera" };
            obj.transform.SetParent(root, false);
            camera = obj.AddComponent<Camera>();
            obj.AddComponent<AudioListener>();
            camera.nearClipPlane = .08f;
            camera.farClipPlane = 4300;
            camera.fieldOfView = 61;
            camera.clearFlags = CameraClearFlags.Skybox;
            camera.allowHDR = true;
            var data = camera.GetUniversalAdditionalCameraData();
            data.renderPostProcessing = true;
            data.antialiasing = AntialiasingMode.FastApproximateAntialiasing;
        }

        internal void Cycle()
        {
            Mode = (Mode + 1) % 3;
            Cut();
        }

        internal void Cut() { cut = true; velocity = Vector3.zero; }

        internal void Follow(float dt, bool title)
        {
            var carTransform = car.Transform;
            var center = carTransform.position;
            var flatForward = Vector3.ProjectOnPlane(carTransform.forward, Vector3.up).normalized;
            if (flatForward.sqrMagnitude < .1f) flatForward = Vector3.forward;
            var right = Vector3.Cross(Vector3.up, flatForward);
            var speed = Mathf.Clamp01(car.Speed / 36);
            Vector3 position, target;
            float fov;
            if (title)
            {
                var orbit = Mathf.Sin(Time.unscaledTime * .14f) * .6f;
                position = center - flatForward * 6.7f + right * (3.3f + orbit) + Vector3.up * 2.65f;
                target = center + flatForward * 4.35f - right * 1.6f + Vector3.up * .83f;
                fov = 57;
            }
            else if (Mode == 1)
            {
                position = carTransform.TransformPoint(new Vector3(-.24f, 1.23f, .22f));
                target = position + carTransform.forward * 22f + Vector3.up * .1f;
                fov = 69 + speed * 4;
            }
            else if (Mode == 2)
            {
                position = center - flatForward * 11.5f + right * 2.4f + Vector3.up * 6.8f;
                target = center + flatForward * 7.6f + Vector3.up * .8f;
                fov = 60 + speed * 4;
            }
            else
            {
                position = center - flatForward * (5.78f + speed * 1.27f) + right * .74f + Vector3.up * (2.89f + speed * .49f);
                target = center + flatForward * (7.25f + speed * 3.4f) + Vector3.up * .85f;
                fov = 61 + speed * 8;
            }

            if (Mode != 1 || title)
            {
                var pivot = center + Vector3.up * 1.06f;
                var direction = position - pivot;
                if (Physics.SphereCast(pivot, .31f, direction.normalized, out var hit, direction.magnitude,
                    CoastWorld.GroundMask | 1 << CoastWorld.ObstacleLayer, QueryTriggerInteraction.Ignore))
                    position = pivot + direction.normalized * Mathf.Max(.7f, hit.distance - .18f);
                if (Physics.Raycast(position + Vector3.up * 8, Vector3.down, out var floor, 10, CoastWorld.GroundMask, QueryTriggerInteraction.Ignore))
                    position.y = Mathf.Max(position.y, floor.point.y + .48f);
            }

            var t = camera.transform;
            var damping = 1 - Mathf.Exp(-dt * (Mode == 1 ? 19 : 9.3f));
            t.position = cut || Mode == 1 && !title ? position : Vector3.SmoothDamp(t.position, position, ref velocity, .12f, 160, dt);
            var wanted = Quaternion.LookRotation(target - t.position, Vector3.up);
            t.rotation = cut ? wanted : Quaternion.Slerp(t.rotation, wanted, damping);
            camera.fieldOfView = cut ? fov : Mathf.Lerp(camera.fieldOfView, fov, damping);
            cut = false;
        }
    }
}
