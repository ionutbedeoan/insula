using System;
using UnityEngine;

namespace RutaDelViento
{
    internal sealed class DriveAudio
    {
        private readonly AudioSource engine, tires, ocean;
        private readonly AudioLowPassFilter tireFilter;
        private readonly CoastCar car;

        internal DriveAudio(CoastCar car, Transform root)
        {
            this.car = car;
            engine = Source("Motor GT", EngineLoop(), root);
            var noise = NoiseLoop();
            tires = Source("Contact anvelope", noise, root);
            ocean = Source("Briză și surf", noise, root);
            tireFilter = tires.gameObject.AddComponent<AudioLowPassFilter>();
            ocean.gameObject.AddComponent<AudioLowPassFilter>().cutoffFrequency = 480;
            ocean.pitch = .46f;
        }

        internal void Update(bool active, bool hood, float dt)
        {
            var speed = car.Speed;
            engine.pitch = Mathf.Clamp(car.Rpm / 2600f, .36f, 2.75f);
            var prior = 1 - Mathf.Exp(-dt * 6.5f);
            engine.volume = Mathf.Lerp(engine.volume, active ? (.15f + car.Load * .24f + speed * .0012f) * (hood ? 1 : .83f) : 0, prior);
            var rough = car.Surface == CoastWorld.Grip.Asphalt ? .27f : 1;
            tires.volume = Mathf.Lerp(tires.volume, active ? Mathf.Clamp01(speed / 19) * .16f * rough : 0, prior);
            tires.pitch = Mathf.Lerp(.57f, 1.3f, Mathf.Clamp01(speed / 34));
            tireFilter.cutoffFrequency = car.Surface == CoastWorld.Grip.Sand ? 420 : 1150;
            var p = car.Transform.position;
            var distance = Mathf.Abs(p.x - RouteData.CoastX(p.z));
            var target = active ? .029f + .102f * (1 - CoastWorld.Ramp(5, 170, distance)) + .046f * Mathf.Clamp01(speed / 36) : 0;
            var pulse = .82f + .18f * Mathf.Sin(Time.unscaledTime * .92f);
            ocean.volume = Mathf.Lerp(ocean.volume, target * pulse, prior);
        }

        private static AudioSource Source(string name, AudioClip loop, Transform parent)
        {
            var obj = new GameObject(name);
            obj.transform.SetParent(parent, false);
            var sound = obj.AddComponent<AudioSource>();
            sound.clip = loop;
            sound.loop = true;
            sound.volume = 0;
            sound.playOnAwake = false;
            sound.Play();
            return sound;
        }

        private static AudioClip EngineLoop()
        {
            const int sampleRate = 24000;
            var samples = new float[sampleRate];
            for (var i = 0; i < samples.Length; i++)
            {
                var revolution = i / (float)sampleRate * 2 * Mathf.PI * 44;
                var ignition = Mathf.Sin(revolution * 2) * .58f + Mathf.Sin(revolution * 4 + .6f) * .32f
                    + Mathf.Sin(revolution * 6 + .9f) * .16f + Mathf.Sin(revolution * 8) * .071f;
                var beat = .75f + .17f * Mathf.Sin(revolution) + .08f * Mathf.Cos(revolution * .5f);
                samples[i] = (float)Math.Tanh((ignition * beat + Mathf.Sin(revolution) * .29f) * 1.18f) * .59f;
            }
            var clip = AudioClip.Create("Harmonic GT engine loop", samples.Length, 1, sampleRate, false);
            clip.SetData(samples, 0);
            return clip;
        }

        private static AudioClip NoiseLoop()
        {
            const int sampleRate = 22050;
            var samples = new float[2 * sampleRate];
            var rng = new System.Random(1781);
            var filtered = 0f;
            for (var i = 0; i < samples.Length; i++)
            {
                var noise = (float)(rng.NextDouble() * 2 - 1);
                filtered = filtered * .85f + noise * .15f;
                samples[i] = .68f * filtered + .32f * noise;
            }
            for (var i = 0; i < 512; i++) samples[i] *= i / 512f;
            for (var i = 0; i < 512; i++) samples[^(i + 1)] *= i / 512f;
            var clip = AudioClip.Create("Road and sea wind loop", samples.Length, 1, sampleRate, false);
            clip.SetData(samples, 0);
            return clip;
        }
    }
}
