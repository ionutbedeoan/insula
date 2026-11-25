using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering;

namespace RutaDelViento
{
    internal sealed class CoastCar
    {
        internal readonly struct Command
        {
            internal readonly float Throttle, Steer;
            internal readonly bool Handbrake;
            internal Command(float throttle, float steer, bool handbrake)
            {
                Throttle = throttle;
                Steer = steer;
                Handbrake = handbrake;
            }
        }

        private sealed class Wheel
        {
            internal WheelCollider physics;
            internal Transform model;
            internal CoastWorld.Grip surface;
            internal WheelHit hit;
            internal bool onGround;
        }

        private readonly CoastWorld world;
        private readonly Rigidbody body;
        private readonly Wheel[] wheels;
        private readonly Material tailLights;
        private float steering;
        private float resetAt;

        internal Transform Transform => body.transform;
        internal float Speed => body.linearVelocity.magnitude;
        internal float ForwardSpeed => Vector3.Dot(body.linearVelocity, Transform.forward);
        internal float Rpm { get; private set; } = 950;
        internal float Load { get; private set; }
        internal int Gear { get; private set; } = 1;
        internal CoastWorld.Grip Surface => wheels[2].onGround ? wheels[2].surface : wheels[0].surface;
        internal int Grounded => wheels.Count(wheel => wheel.onGround);
        internal Vector3 Velocity => body.linearVelocity;

        internal bool RearContact(int side, out WheelHit hit, out CoastWorld.Grip surface)
        {
            var wheel = wheels[2 + side];
            hit = wheel.hit;
            surface = wheel.surface;
            return wheel.onGround;
        }

        internal CoastCar(CoastWorld world, Transform root, Shader lit)
        {
            this.world = world;
            var obj = new GameObject("Carmine · GT de coastă") { layer = 10 };
            obj.transform.SetParent(root, false);
            body = obj.AddComponent<Rigidbody>();
            body.mass = 1390;
            body.linearDamping = .035f;
            body.angularDamping = 1.35f;
            body.centerOfMass = new Vector3(0, .37f, -.09f);
            body.interpolation = RigidbodyInterpolation.Interpolate;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            body.maxAngularVelocity = 6;
            var hull = obj.AddComponent<BoxCollider>();
            hull.center = new Vector3(0, .45f, .03f);
            hull.size = new Vector3(1.94f, .44f, 4.13f);
            hull.material = new PhysicsMaterial("Contact caroserie") { bounciness = .04f, dynamicFriction = .45f, staticFriction = .46f };

            var prefab = Resources.Load<GameObject>("Coast/Art/CarConcept");
            if (prefab == null) throw new InvalidOperationException("The GLB car was not imported.");
            var visual = UnityEngine.Object.Instantiate(prefab, obj.transform);
            visual.name = "Car Concept · Eric Chadwick";
            ConfigurePaint(visual, lit);
            var named = visual.GetComponentsInChildren<Transform>(true);
            var wheelNames = new[] { "WheelFrontL", "WheelFrontR", "WheelRearL", "WheelRearR" };
            wheels = new Wheel[wheelNames.Length];
            for (var i = 0; i < wheels.Length; i++)
            {
                var wheel = named.SingleOrDefault(item => item.name == wheelNames[i]);
                if (!wheel) throw new InvalidOperationException("Missing GLB wheel: " + wheelNames[i]);
                var anchor = Transform.InverseTransformPoint(wheel.position);
                // The model's hinge includes a steering pose. WheelCollider supplies the live pose.
                wheel.SetParent(Transform, true);
                var wheelObject = new GameObject(wheelNames[i] + " physics") { layer = 10 };
                wheelObject.transform.SetParent(Transform, false);
                wheelObject.transform.localPosition = new Vector3(anchor.x, anchor.y + .132f, anchor.z);
                var collider = wheelObject.AddComponent<WheelCollider>();
                collider.radius = .378f;
                collider.mass = 28;
                collider.suspensionDistance = .265f;
                collider.suspensionSpring = new JointSpring { spring = 44200, damper = 4900, targetPosition = .53f };
                collider.forceAppPointDistance = .22f;
                collider.wheelDampingRate = .78f;
                collider.ConfigureVehicleSubsteps(8, 5, 3);
                wheels[i] = new Wheel { model = wheel, physics = collider, surface = CoastWorld.Grip.Asphalt };
            }
            var tail = Array.Find(named, item => item.name == "BodyTaillights");
            if (tail && tail.TryGetComponent<Renderer>(out var lamps)) tailLights = lamps.material;
        }

        private static void ConfigurePaint(GameObject visual, Shader lit)
        {
            var converted = new Dictionary<Material, Material>();
            foreach (var renderer in visual.GetComponentsInChildren<MeshRenderer>(true))
            {
                var slots = renderer.sharedMaterials;
                for (var index = 0; index < slots.Length; index++)
                {
                    var source = slots[index];
                    if (!source) continue;
                    if (!converted.TryGetValue(source, out var material))
                    {
                        var label = source.name;
                        material = new Material(lit) { name = label + " · Coast" };
                        var color = source.HasProperty("baseColorFactor") ? source.GetColor("baseColorFactor") : new Color(.24f, .24f, .25f);
                        color.a = 1;
                        var metallic = source.HasProperty("metallicFactor") ? source.GetFloat("metallicFactor") : .10f;
                        var smoothness = source.HasProperty("roughnessFactor") ? 1 - source.GetFloat("roughnessFactor") : .45f;
                        switch (label)
                        {
                            case "Paint 1 Carmine": color = CoastMaterials.ColorFromHex("#B6241D"); metallic = .51f; smoothness = .86f; break;
                            case "Paint 2 Carmine": color = CoastMaterials.ColorFromHex("#792321"); metallic = .33f; smoothness = .70f; break;
                            case "Glass": color = CoastMaterials.ColorFromHex("#2D414A"); metallic = .63f; smoothness = .89f; break;
                            case "Rim1": color = CoastMaterials.ColorFromHex("#849098"); metallic = .66f; smoothness = .55f; break;
                            case "Rim2": color = CoastMaterials.ColorFromHex("#3F4448"); metallic = .63f; smoothness = .43f; break;
                            case "Tireside":
                            case "Tiretread": color = CoastMaterials.ColorFromHex("#363637"); metallic = 0; smoothness = .20f; break;
                            case "Brakelight": color = CoastMaterials.ColorFromHex("#B82220"); metallic = .18f; smoothness = .78f; break;
                        }
                        material.SetColor("_BaseColor", color);
                        material.SetFloat("_Metallic", Mathf.Clamp01(metallic));
                        material.SetFloat("_Smoothness", Mathf.Clamp(smoothness, .15f, .90f));
                        if (label == "Glass") material.SetFloat("_Cull", 0);
                        if (source.HasProperty("baseColorTexture") && source.GetTexture("baseColorTexture") is Texture colorMap)
                            material.SetTexture("_BaseMap", colorMap);
                        if (source.HasProperty("normalTexture") && source.GetTexture("normalTexture") is Texture normals)
                        {
                            material.SetTexture("_BumpMap", normals);
                            material.SetFloat("_BumpScale", .30f);
                            material.EnableKeyword("_NORMALMAP");
                        }
                        if (label == "Brakelight" || label == "Signallight")
                        {
                            material.EnableKeyword("_EMISSION");
                            material.SetColor("_EmissionColor", color * .55f);
                        }
                        converted.Add(source, material);
                    }
                    slots[index] = material;
                }
                renderer.sharedMaterials = slots;
                renderer.shadowCastingMode = ShadowCastingMode.On;
            }
        }

        internal void Reset(RouteData.Sample at, bool rollingStart = false, float lateral = 1.96f)
        {
            var p = at.Position + at.Right * lateral + Vector3.up * .135f;
            var rotation = Quaternion.LookRotation(at.Forward, Vector3.up);
            body.position = p;
            body.rotation = rotation;
            body.transform.SetPositionAndRotation(p, rotation);
            body.linearVelocity = rollingStart ? at.Forward * 6.5f : Vector3.zero;
            body.angularVelocity = Vector3.zero;
            body.WakeUp();
            steering = 0;
            Load = 0;
            Gear = 1;
            Rpm = 950;
            resetAt = Time.time;
            foreach (var wheel in wheels)
            {
                wheel.physics.motorTorque = 0;
                wheel.physics.brakeTorque = 120;
                wheel.physics.steerAngle = 0;
                wheel.onGround = false;
            }
            Physics.SyncTransforms();
            UpdateVisuals();
        }

        internal void Step(Command command, float dt)
        {
            var v = ForwardSpeed;
            var speed = Mathf.Abs(v);
            var opposite = command.Throttle * v < -.4f;
            var braking = opposite || command.Handbrake;
            var demand = braking ? 0 : Mathf.Abs(command.Throttle);
            var drivingDirection = Mathf.Sign(command.Throttle);
            var speedSteer = Mathf.Lerp(31f, 9f, CoastWorld.Ramp(5f, 36f, speed));
            var desired = command.Steer * speedSteer;
            steering = Mathf.MoveTowards(steering, desired, dt * (Mathf.Abs(desired) < Mathf.Abs(steering) ? 130 : 92));
            Load = Mathf.MoveTowards(Load, demand, dt * 4.7f);
            TrackGears(speed, command.Throttle, dt);

            for (var i = 0; i < wheels.Length; i++)
            {
                var wheel = wheels[i];
                var collider = wheel.physics;
                var front = i < 2;
                wheel.onGround = collider.GetGroundHit(out wheel.hit);
                if (wheel.onGround) wheel.surface = world.Surface(wheel.hit.point, wheel.hit.collider.gameObject.layer);
                var sand = wheel.surface == CoastWorld.Grip.Sand;
                var gravel = wheel.surface == CoastWorld.Grip.Gravel;
                var grip = sand ? .55f : gravel ? .72f : 1.12f;
                collider.forwardFriction = Friction(grip, .39f, .91f);
                collider.sidewaysFriction = Friction(grip * (command.Handbrake && !front ? .54f : 1.12f), .2f, .61f);
                var steeringBias = front ? Mathf.Abs(steering) * .065f * ((steering > 0) == (collider.transform.localPosition.x > 0) ? 1 : -1) : 0;
                collider.steerAngle = front ? steering + Mathf.Sign(steering) * steeringBias : 0;
                var speedCap = drivingDirection < 0 ? 8.25f : sand ? 17f : gravel ? 25f : 43.3f;
                var torqueScale = 1 - CoastWorld.Ramp(speedCap * .78f, speedCap, speed);
                var slipScale = wheel.onGround ? 1 - .58f * CoastWorld.Ramp(.28f, .95f, Mathf.Abs(wheel.hit.forwardSlip)) : .35f;
                var wheelTorque = (front ? 420f : 700f) * Mathf.Lerp(1.05f, .55f, Mathf.Clamp01(speed / 46));
                collider.motorTorque = demand * drivingDirection * torqueScale * wheelTorque * slipScale;
                var service = opposite ? (front ? 2640 : 1660) * Mathf.Abs(command.Throttle) : 0;
                var parking = command.Handbrake ? (front ? 855 : 3290) : 0;
                var rolling = demand > .03f ? 0 : sand ? 146 : gravel ? 92 : 52;
                if (demand < .03f && speed < 1.6f) rolling += 110;
                collider.brakeTorque = service + parking + rolling;
            }
            Stabilize(wheels[0], wheels[1]);
            Stabilize(wheels[2], wheels[3]);
            if (Grounded > 0)
            {
                var drag = Surface == CoastWorld.Grip.Sand ? 25f : Surface == CoastWorld.Grip.Gravel ? 13f : 4f;
                body.AddForce(-body.linearVelocity * (drag + speed * .53f), ForceMode.Force);
                body.AddForce(-Transform.up * (speed * speed * .69f));
            }
            if (tailLights && tailLights.HasProperty("_EmissionColor"))
                tailLights.SetColor("_EmissionColor", new Color(1, .036f, .014f) * (braking ? 3.7f : .55f));
        }

        internal bool RequiresRecovery => Time.time > resetAt + 1.5f &&
            (Transform.position.y < CoastWorld.Waterline - .7f || Transform.position.sqrMagnitude > 3400000f ||
            Vector3.Dot(Transform.up, Vector3.up) < .20f && Speed < 2.5f);

        internal void UpdateVisuals()
        {
            foreach (var wheel in wheels)
            {
                wheel.physics.GetWorldPose(out var point, out var rotation);
                wheel.model.SetPositionAndRotation(point, rotation);
            }
        }

        private void TrackGears(float speed, float command, float dt)
        {
            var kph = speed * 3.6f;
            var gear = command < -.1f && ForwardSpeed < .55f ? -1 : kph < 36 ? 1 : kph < 63 ? 2 : kph < 94 ? 3 : kph < 123 ? 4 : kph < 145 ? 5 : 6;
            Gear = gear;
            var bottom = gear switch { 2 => 32, 3 => 59, 4 => 90, 5 => 119, 6 => 141, _ => 0 };
            var width = gear < 0 ? 30 : gear == 1 ? 38 : 35;
            var target = Mathf.Clamp(970 + (gear > 1 ? 1900 : 0) + 4400 * (kph - bottom) / width + 400 * Load, 920, 6900);
            Rpm = Mathf.Lerp(Rpm, target, 1 - Mathf.Exp(-dt * 8));
        }

        private static WheelFrictionCurve Friction(float stiffness, float slip, float asymptote)
        {
            return new WheelFrictionCurve
            {
                extremumSlip = slip, extremumValue = 1, asymptoteSlip = asymptote, asymptoteValue = .72f, stiffness = stiffness
            };
        }

        private void Stabilize(Wheel left, Wheel right)
        {
            var l = Travel(left);
            var r = Travel(right);
            var force = (l - r) * 6450f;
            if (left.onGround) body.AddForceAtPosition(left.physics.transform.up * -force, left.physics.transform.position);
            if (right.onGround) body.AddForceAtPosition(right.physics.transform.up * force, right.physics.transform.position);
        }

        private static float Travel(Wheel wheel)
        {
            if (!wheel.onGround) return 1;
            var local = wheel.physics.transform.InverseTransformPoint(wheel.hit.point);
            return Mathf.Clamp01((-local.y - wheel.physics.radius) / wheel.physics.suspensionDistance);
        }
    }
}
