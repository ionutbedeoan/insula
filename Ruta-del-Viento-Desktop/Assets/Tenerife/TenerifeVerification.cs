using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace TenerifeDesktop
{
    public sealed partial class TenerifeGame
    {
        private bool verifying;

        private void StartVerification()
        {
            verifying=Array.IndexOf(Environment.GetCommandLineArgs(),"-tenerife-verify")>=0;
            if(verifying)StartCoroutine(Verify());
        }

        private IEnumerator Verify()
        {
            yield return null;
            try
            {
                VerifySurfaceContact();
                VerifyDrive();
                VerifyDrivingViews();
            }
            catch(Exception error)
            {
                Debug.LogException(error);
                Application.Quit(1);
                yield break;
            }

            intro=false;paused=true;ceremony=false;finished=false;angle=0;
            var frames=new List<float>();
            var route=world.Data.roads[0];
            foreach(float start in new[]{36f,1240f,3210f,4310f})
            {
                Place(start);
                for(float warmup=Time.unscaledTime+.5f;Time.unscaledTime<warmup;)yield return null;
                float begin=Time.unscaledTime;
                while(Time.unscaledTime-begin<1.7f)
                {
                    var point=route.At(start+(Time.unscaledTime-begin)*50);
                    carPosition=point.Position;
                    heading=Mathf.Atan2(point.dx,-point.dz);
                    AlignCar(DriveStep,true);
                    yield return null;
                    frames.Add(Time.unscaledDeltaTime*1000);
                }
            }
            frames.Sort();
            Debug.Log($"Tenerife verification: {frames.Count} frames, median {frames[frames.Count/2]:F1} ms, "+
                $"p95 {frames[(int)((frames.Count-1)*.95f)]:F1} ms, max {frames[^1]:F1} ms.");
            Debug.Log("Tenerife verification passed.");
            Application.Quit(0);
        }

        private void VerifySurfaceContact()
        {
            // Raycasts against the actual render meshes provide an independent check on road support.
            const int probeLayer=31;
            foreach(var filter in GetComponentsInChildren<MeshFilter>())
            {
                if(!filter.name.StartsWith("Drum ",StringComparison.Ordinal)&&filter.name!="Acostament")continue;
                filter.gameObject.layer=probeLayer;
                filter.gameObject.AddComponent<MeshCollider>().sharedMesh=filter.sharedMesh;
            }
            Physics.SyncTransforms();
            float maximum=0;
            int samples=0;
            foreach(var road in world.Data.roads)
            foreach(float lane in new[]{-.5f*road.half,0,.5f*road.half})
            for(float meters=2;meters<road.length-1;meters+=2)
            {
                var point=road.At(meters);
                carPosition=point.Position+Across(point.Forward)*lane;
                heading=Mathf.Atan2(point.dx,-point.dz);
                AlignCar(DriveStep,true);
                var rotation=Quaternion.LookRotation(-Direction(heading))*Quaternion.Euler(pitch,0,roll);
                for(int index=0;index<4;index++)
                {
                    var tire=carPosition+rotation*new Vector3(index%2==0?-.915f:.915f,.001f,index<2?-1.36f:1.36f);
                    float surface=world.Ground.At(tire.x,tire.z);
                    if(Physics.Raycast(tire+Vector3.up*8,Vector3.down,out var hit,16,1<<probeLayer))
                        surface=Mathf.Max(surface,hit.point.y);
                    maximum=Mathf.Max(maximum,surface-tire.y);
                    samples++;
                }
            }
            if(maximum>.045f)throw new InvalidOperationException($"Tire penetration {maximum:F3} m.");
            Debug.Log($"Tenerife verification: {samples} tire contacts checked across 21 roads. Penetration {maximum:F3} m.");
        }

        private void VerifyDrive()
        {
            Place(13);
            var route=world.Data.roads[0];
            for(int tick=0;tick<46000&&!finished;tick++)
            {
                var aim=route.At(distance+6f+Mathf.Abs(speed)*.42f);
                var difference=aim.Position-carPosition;
                float desired=Mathf.Atan2(difference.x,-difference.z)*Mathf.Rad2Deg;
                float turn=Mathf.Clamp(Mathf.DeltaAngle(heading*Mathf.Rad2Deg,desired)*.095f,-1,1);
                Drive(DriveStep,speed<18f?1:0,turn,speed>20f);
            }
            if(!finished)throw new InvalidOperationException($"Route stopped after {distance:F1} m at {carPosition}, impacts {impacts}.");
            Debug.Log($"Tenerife verification: route complete at {distance:F1} m, {impacts} impacts.");
        }

        private void VerifyDrivingViews()
        {
            Place(13);
            for(angle=0;angle<3;angle++)
            {
                UpdateCamera(1,true);
                var eye=view.transform.position;
                if(eye.y<world.Elevation(eye)+.74f)throw new InvalidOperationException("Driving camera below terrain.");
            }
            angle=0;
            SwitchMode();
            if(!onFoot)throw new InvalidOperationException("Could not exit the car at the start.");
            UpdateCamera(1,true);
            SwitchMode();
            if(onFoot)throw new InvalidOperationException("Could not re-enter the car.");
        }
    }
}
