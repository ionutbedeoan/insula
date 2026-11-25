using UnityEngine;
using UnityEngine.Rendering;

namespace RutaDelViento
{
    internal sealed class DriveDust
    {
        private readonly CoastCar car;
        private readonly ParticleSystem particles;
        private float buildUp;

        internal DriveDust(CoastCar car, Shader shader, Transform parent)
        {
            this.car = car;
            var obj = new GameObject("Praf la anvelope");
            obj.transform.SetParent(parent, false);
            particles = obj.AddComponent<ParticleSystem>();
            particles.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = particles.main;
            main.playOnAwake = false;
            main.loop = true;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.maxParticles = 180;
            var emission = particles.emission;
            emission.enabled = false;
            var shape = particles.shape;
            shape.enabled = false;
            var scale = particles.sizeOverLifetime;
            scale.enabled = true;
            scale.size = new ParticleSystem.MinMaxCurve(1, AnimationCurve.Linear(0, .24f, 1, 1));
            var color = particles.colorOverLifetime;
            color.enabled = true;
            var fade = new Gradient();
            fade.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) },
                new[] { new GradientAlphaKey(.52f, 0), new GradientAlphaKey(1, .14f), new GradientAlphaKey(0, 1) });
            color.color = new ParticleSystem.MinMaxGradient(fade);
            var renderer = obj.GetComponent<ParticleSystemRenderer>();
            renderer.sharedMaterial = new Material(shader) { name = "Dust billboards" };
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            renderer.sortMode = ParticleSystemSortMode.Distance;
            particles.Play();
        }

        internal void Update(float dt)
        {
            if (car.Speed < 2.8f) return;
            buildUp += dt;
            if (buildUp < .042f) return;
            buildUp %= .042f;
            for (var i = 0; i < 2; i++)
            {
                if (!car.RearContact(i, out var hit, out var surface) || surface == CoastWorld.Grip.Asphalt) continue;
                var sand = surface == CoastWorld.Grip.Sand;
                var emitter = new ParticleSystem.EmitParams
                {
                    position = hit.point + Vector3.up * .11f,
                    velocity = car.Velocity * .16f - car.Transform.forward * 1.25f + Vector3.up * Random.Range(.3f, .9f),
                    startLifetime = Random.Range(.78f, 1.6f),
                    startSize = Random.Range(.62f, 1.54f),
                    startColor = sand ? new Color(.76f, .63f, .44f, .46f) : new Color(.57f, .51f, .41f, .34f),
                    rotation = Random.Range(0, 360)
                };
                particles.Emit(emitter, 1);
            }
        }
    }
}
