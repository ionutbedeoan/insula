using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace TenerifeDesktop
{
    public sealed partial class TenerifeGame : MonoBehaviour
    {
        private const string SaveKey="insula.drive.ruta-viento.unity.relief";
        private TenerifeWorld world;
        private Camera view;
        private Transform vehicle,body;
        private readonly Transform[] steering=new Transform[4],wheel=new Transform[4];
        private readonly HashSet<string> collection=new();
        private readonly List<(Find clue,GameObject marker)> markers=new();
        private Vector3 driver;
        private const float DriveStep=.0125f;
        private static readonly (float side,float along)[] Underbody=
            {(0,0),(-.96f,0),(.96f,0),(-.86f,-2.24f),(.86f,-2.24f),(-.86f,2.24f),(.86f,2.24f)};
        private Vector3 carPosition;
        private (Vector3 position,float yaw,float pitch,float bank,float spin) previousPose;
        private float heading,speed,pitch,roll,spin,steeringInput,renderedHeading,renderedPitch,sideSlip,elapsed,best,distance,walkYaw,walkPitch,orbit,look;
        private float frameTime,statusUntil;
        private bool intro=true,paused,onFoot,map,finds,finished,ceremony,radioOn;
        private int angle,impacts;
        private string surface="asfalt",status="";
        private AudioSource radio;
        private GUIStyle headingStyle,textStyle,help;
        private Texture2D mapTexture,fill;
        private Color ivory;
        private readonly Color panel=new(.051f,.092f,.097f,.94f);
        private readonly Color accent=new(.85f,.66f,.37f,1);
        private RenderPipelineAsset projectPipeline, qualityPipeline;
        private int previousFrameRate, previousVSync, previousShadowCascades;
        private float previousShadowDistance;

        private void Awake()
        {
            projectPipeline=GraphicsSettings.defaultRenderPipeline;
            qualityPipeline=QualitySettings.renderPipeline;
            // This scene uses Built-in surface shaders. Restore the coast's pipeline on exit.
            QualitySettings.renderPipeline=null;
            GraphicsSettings.defaultRenderPipeline=null;
            previousFrameRate=Application.targetFrameRate;
            previousVSync=QualitySettings.vSyncCount;
            previousShadowDistance=QualitySettings.shadowDistance;
            previousShadowCascades=QualitySettings.shadowCascades;
        }

        private void Start()
        {
            QualitySettings.vSyncCount=0;
            Application.targetFrameRate=60;
            var cameraObject=new GameObject("Tenerife camera");
            cameraObject.transform.SetParent(transform,false);
            view=cameraObject.AddComponent<Camera>();
            view.nearClipPlane=.12f;view.farClipPlane=4900;view.fieldOfView=60;view.allowHDR=true;
            cameraObject.AddComponent<AudioListener>();
            world=gameObject.AddComponent<TenerifeWorld>();
            world.Build(view);
            BuildVehicle();
            BuildFinds();
            var audio=Resources.Load<AudioClip>("Tenerife/BossaBossa");
            if(audio)
            {
                radio=gameObject.AddComponent<AudioSource>();
                radio.clip=audio;radio.loop=true;radio.volume=.36f;radio.spatialBlend=0;
            }
            foreach(var id in PlayerPrefs.GetString(SaveKey+".finds",PlayerPrefs.GetString("tenerife.desktop.collection.v1"))
                .Split(new[]{'|'},StringSplitOptions.RemoveEmptyEntries))
                collection.Add(id);
            best=PlayerPrefs.GetFloat(SaveKey+".best",PlayerPrefs.GetFloat("tenerife.desktop.record.v1",0));
            mapTexture=BuildMap();
            fill=Texture2D.whiteTexture;
            ivory=TenerifeWorld.ReadColor("#f0e7d4",Color.white);
            Place(13);
            world.Refresh(vehicle.position);
            UpdateCamera(1,true);
            StartVerification();
        }

        private void OnDestroy()
        {
            GraphicsSettings.defaultRenderPipeline=projectPipeline;
            QualitySettings.renderPipeline=qualityPipeline;
            Application.targetFrameRate=previousFrameRate;
            QualitySettings.vSyncCount=previousVSync;
            QualitySettings.shadowDistance=previousShadowDistance;
            QualitySettings.shadowCascades=previousShadowCascades;
        }

        private void BuildVehicle()
        {
            vehicle=new GameObject("Vento GT").transform;
            vehicle.SetParent(transform,false);
            body=new GameObject("Caroserie și suspensie").transform;
            body.SetParent(vehicle,false);
            var paint=CarMaterial("#ae2331",.57f,.82f);
            var roof=CarMaterial("#901827",.52f,.77f);
            var glass=CarMaterial("#2a4148",.70f,.91f);
            var trim=CarMaterial("#222629",.18f,.26f);
            var rim=CarMaterial("#9fa8aa",.76f,.61f);
            var tyre=CarMaterial("#1e1e20",0,.16f);
            var brake=CarMaterial("#5f6061",.65f,.46f);
            var lamps=CarMaterial("#ffa59b",.22f,.67f);
            var plate=CarMaterial("#d8d9cb",.1f,.52f);
            AddMesh(body,"car",paint);
            var cabin=AddMesh(body,"canopy",glass);
            cabin.GetComponent<Renderer>().sharedMaterials=new[]{glass,roof,glass};
            for(int i=0;i<4;i++)
            {
                float side=i%2==0?-1:1;
                var steeringHub=new GameObject("Pivot roată").transform;
                steeringHub.SetParent(body,false);
                steeringHub.localPosition=new Vector3(side*.915f,.369f,i<2?-1.36f:1.36f);
                steering[i]=steeringHub;
                var spinRoot=new GameObject("Jantă și cauciuc").transform;
                spinRoot.SetParent(steeringHub,false);
                wheel[i]=spinRoot;
                AddMesh(spinRoot,"tyre",tyre);
                AddMesh(spinRoot,"rim",rim).transform.localPosition=new Vector3(.143f*side,0,0);
                var disc=AddMesh(steeringHub,"disc",brake);
                disc.GetComponent<Renderer>().sharedMaterials=new[]{brake,brake,brake};
                disc.transform.localPosition=new Vector3(side*.081f,0,0);
                for(int j=0;j<5;j++)
                {
                    float turn=j*72;
                    var bar=Cube(spinRoot,new Vector3(side*.155f,Mathf.Cos(turn*Mathf.Deg2Rad)*.117f,Mathf.Sin(turn*Mathf.Deg2Rad)*.117f),
                        new Vector3(.044f,.23f,.053f),rim);
                    bar.transform.localRotation=Quaternion.Euler(turn,0,0);
                }
            }
            Cube(body,new Vector3(0,.39f,2.11f),new Vector3(1.82f,.22f,.32f),trim);
            Cube(body,new Vector3(0,.53f,2.20f),new Vector3(.47f,.14f,.055f),plate);
            foreach(float sign in new[]{-1f,1f})
            {
                Cube(body,new Vector3(sign*.675f,.69f,2.21f),new Vector3(.36f,.086f,.088f),lamps);
                Cube(body,new Vector3(sign*.59f,.69f,-2.08f),new Vector3(.53f,.069f,.11f),plate);
            }
        }

        private static Material CarMaterial(string color,float metal,float shiny)
        {
            var mat=TenerifeWorld.PropMaterial(null,.5f,shiny,metal);
            mat.SetColor("_Tint",TenerifeWorld.ReadColor(color,Color.gray));
            return mat;
        }

        private GameObject AddMesh(Transform parent,string name,Material material) =>
            TenerifeWorld.Attach(parent,world.MeshAsset(name),material);

        private static GameObject Cube(Transform parent,Vector3 position,Vector3 size,Material material)
        {
            var obj=GameObject.CreatePrimitive(PrimitiveType.Cube);
            Destroy(obj.GetComponent<Collider>());
            obj.transform.SetParent(parent,false);
            obj.transform.localPosition=position;obj.transform.localScale=size;
            obj.GetComponent<Renderer>().sharedMaterial=material;
            return obj;
        }

        private void BuildFinds()
        {
            var material=CarMaterial("#deb56a",.20f,.71f);
            foreach(var clue in world.Data.finds)
            {
                var marker=GameObject.CreatePrimitive(PrimitiveType.Sphere);
                marker.name=clue.title;
                marker.transform.SetParent(transform,false);
                Vector3 position=new Vector3(clue.x,0,clue.z);
                position.y=world.Elevation(position)+.4f;
                marker.transform.position=position;
                marker.transform.localScale=Vector3.one*.34f;
                marker.GetComponent<Renderer>().sharedMaterial=material;
                Destroy(marker.GetComponent<Collider>());
                marker.SetActive(false);
                markers.Add((clue,marker));
            }
        }

        private void Place(float meters)
        {
            var point=world.Data.roads[0].At(meters);
            var forward=point.Forward.normalized;
            var p=point.Position+new Vector3(-forward.z,0,forward.x)*1.96f;
            heading=Mathf.Atan2(forward.x,-forward.z);
            speed=0; distance=meters;spin=0;steeringInput=0;sideSlip=0;orbit=0;look=0;frameTime=0;
            carPosition=p;
            AlignCar(1,true);
            RememberPose();
            RenderCar(1);
            onFoot=false;
            UpdateCamera(1,true);
        }

        private void Update()
        {
            if(world==null)return;
            float dt=Mathf.Min(.10f,Time.deltaTime);
            if(Input.GetKeyDown(KeyCode.Escape)&&!intro&&!ceremony)
            {
                if(map||finds){map=false;finds=false;} else paused=!paused;
            }
            if(Input.GetKeyDown(KeyCode.Return)&&intro)intro=false;
            if(Input.GetKeyDown(KeyCode.M)&&!intro&&!ceremony){map=!map;finds=false;}
            if(Input.GetKeyDown(KeyCode.J)&&!intro&&!ceremony){finds=!finds;map=false;}
            if(Input.GetKeyDown(KeyCode.Tab)&&radio)
            {
                radioOn=!radioOn;
                if(radioOn){radio.UnPause();if(!radio.isPlaying)radio.Play();}else radio.Pause();
            }
            if(!intro&&!paused&&!map&&!finds&&!ceremony)
            {
                if(Input.GetKeyDown(KeyCode.C)&&!onFoot){angle=(angle+1)%3;orbit=0;}
                if(Input.GetKeyDown(KeyCode.F))SwitchMode();
                if(Input.GetKeyDown(KeyCode.R))Place(Mathf.Max(13,distance-4));
                if(Input.GetKeyDown(KeyCode.E)&&onFoot)PickUp();
                if(Input.GetMouseButton(1))
                {
                    float horizontal=Input.GetAxisRaw("Mouse X")*.032f;
                    if(onFoot)
                    {
                        walkYaw+=horizontal;
                        walkPitch=Mathf.Clamp(walkPitch-Input.GetAxisRaw("Mouse Y")*.027f,-.77f,.75f);
                    }
                    else
                    {
                        orbit=Mathf.Clamp(orbit+horizontal,-1.9f,1.9f);
                        look=Mathf.Clamp(look+Input.GetAxisRaw("Mouse Y")*.025f,-.46f,.47f);
                    }
                }
                float throttle=Axis(KeyCode.W,KeyCode.UpArrow,KeyCode.S,KeyCode.DownArrow);
                float turn=Axis(KeyCode.D,KeyCode.RightArrow,KeyCode.A,KeyCode.LeftArrow);
                bool brake=Input.GetKey(KeyCode.Space);
                frameTime+=dt;
                while(frameTime>=DriveStep)
                {
                    if(onFoot)Walk(DriveStep);
                    else
                    {
                        RememberPose();
                        Drive(DriveStep,throttle,turn,brake);
                    }
                    frameTime-=DriveStep;
                    if(ceremony)break;
                }
            }
            else frameTime=0;
            foreach(var (clue,marker) in markers)
            {
                bool show=onFoot&&!collection.Contains(clue.id)&&(marker.transform.position-driver).sqrMagnitude<676;
                if(marker.activeSelf!=show)marker.SetActive(show);
            }
            RenderCar(intro||paused||map||finds||ceremony||onFoot?1:Mathf.Clamp01(frameTime/DriveStep));
            UpdateCamera(dt,false);
            world.Refresh(onFoot?driver:carPosition);
        }

        private static float Axis(KeyCode up,KeyCode altUp,KeyCode down,KeyCode altDown) =>
            (Input.GetKey(up)||Input.GetKey(altUp)?1:0)-(Input.GetKey(down)||Input.GetKey(altDown)?1:0);
        private static Vector3 Direction(float yaw) => new Vector3(Mathf.Sin(yaw),0,-Mathf.Cos(yaw));
        private static Vector3 Across(Vector3 forward) => new Vector3(-forward.z,0,forward.x);

        private void Drive(float dt,float throttle,float steer,bool brake)
        {
            elapsed+=dt;
            steeringInput=steer;
            var old=carPosition;
            var road=world.Nearest(old);
            bool onRoad=road.road!=null&&road.distance<road.road.half+.63f;
            bool paved=onRoad&&road.road.surface=="asphalt";
            surface=paved?"asfalt":onRoad?"pietriș":"pământ";

            float max=paved?54:onRoad?37:28;
            float power=(paved?8.9f:7.5f)*(1-.67f*Mathf.SmoothStep(0,1,Mathf.Abs(speed)/max));
            if(throttle<0&&speed>2)
                speed=Mathf.MoveTowards(speed,0,13.5f*dt);
            else
                speed+=dt*throttle*power;
            if(brake)speed=Mathf.MoveTowards(speed,0,23*dt);
            speed*=Mathf.Exp(-dt*(throttle==0?.42f:.07f));
            speed=Mathf.Clamp(speed,-10,max);
            float steeringSensitivity=(paved?1:.76f)*.19f/(1+.012f*Mathf.Abs(speed));
            heading+=steer*speed*dt*steeringSensitivity;
            var forward=Direction(heading);
            sideSlip=Mathf.Lerp(sideSlip,-steer*speed*(paved?.036f:.10f),1-Mathf.Exp(-dt*7));
            var p=old+(forward*speed+Across(forward)*sideSlip)*dt;
            p.y=world.Elevation(p);
            bool blocked=Mathf.Abs(p.y-world.Elevation(old))>(.23f+Mathf.Abs(speed)*dt*.88f);
            if(!blocked)
                for(int offset=-1;offset<=1;offset++)
                {
                    Vector3 test=p+forward*(offset*1.38f);
                    test.y=world.Elevation(test);
                    if(world.Blocked(test,offset==0?.78f:.82f)){blocked=true;break;}
                }
            if(blocked)
            {
                if(Mathf.Abs(speed)>1.9f&&Time.time>statusUntil)
                { impacts++;Notify("Obstacol. Apasă R pentru revenire."); }
                speed=Mathf.MoveTowards(speed,0,35*dt);
            }
            else carPosition=p;

            // Retain the previous suspension height when rolling off a crest.
            carPosition.y=old.y;
            AlignCar(dt,false);
            spin-=speed*dt/.369f*Mathf.Rad2Deg;
            var main=world.Nearest(carPosition,true);
            if(main.road!=null&&main.distance<30)distance=main.s;
            if(!finished&&main.road!=null&&main.s>main.road.length-23&&main.distance<12)
            {
                finished=true;ceremony=true;
                if(!verifying&&(best<=0||elapsed<best))
                {best=elapsed;PlayerPrefs.SetFloat(SaveKey+".best",best);PlayerPrefs.Save();}
            }
        }

        private void AlignCar(float dt,bool instant)
        {
            var forward=Direction(heading)*1.36f;
            var right=Across(Direction(heading))*.915f;
            float fl=world.Elevation(carPosition+forward-right),fr=world.Elevation(carPosition+forward+right);
            float bl=world.Elevation(carPosition-forward-right),br=world.Elevation(carPosition-forward+right);
            float blend=instant?1:1-Mathf.Exp(-dt*19);
            float gradient=Mathf.Atan2(fl+fr-bl-br,5.44f)*Mathf.Rad2Deg;
            float bank=Mathf.Atan2(fr+br-fl-bl,3.66f)*Mathf.Rad2Deg-steeringInput*speed*.073f;
            pitch=Mathf.Lerp(pitch,Mathf.Clamp(gradient,-24,24),blend);
            roll=Mathf.Lerp(roll,Mathf.Clamp(bank,-22,22),blend);
            var rotation=Quaternion.LookRotation(-Direction(heading))*Quaternion.Euler(pitch,0,roll);
            float floor=SupportHeight(carPosition,rotation);
            carPosition.y=Mathf.Max(floor,Mathf.Lerp(carPosition.y,floor,blend));
        }

        private float SupportHeight(Vector3 position,Quaternion rotation)
        {
            float Support(float side,float along,float clearance)
            {
                var offset=rotation*new Vector3(side,clearance,-along);
                return world.Elevation(position+offset)-offset.y;
            }
            float height=Mathf.Max(
                Mathf.Max(Support(-.915f,1.36f,0),Support(.915f,1.36f,0)),
                Mathf.Max(Support(-.915f,-1.36f,0),Support(.915f,-1.36f,0)))+.018f;
            foreach(var (side,along) in Underbody)height=Mathf.Max(height,Support(side,along,.16f));
            return height;
        }

        private void RememberPose() => previousPose=(carPosition,heading,pitch,roll,spin);

        private void RenderCar(float blend)
        {
            var position=Vector3.Lerp(previousPose.position,carPosition,blend);
            renderedHeading=Mathf.Lerp(previousPose.yaw,heading,blend);
            renderedPitch=Mathf.Lerp(previousPose.pitch,pitch,blend);
            var direction=Quaternion.LookRotation(-Direction(renderedHeading));
            var tilt=Quaternion.Euler(renderedPitch,0,Mathf.Lerp(previousPose.bank,roll,blend));
            if(blend<1&&position!=carPosition)position.y=Mathf.Max(position.y,SupportHeight(position,direction*tilt));
            vehicle.SetPositionAndRotation(position,direction);
            body.localRotation=tilt;
            float rotation=Mathf.Lerp(previousPose.spin,spin,blend);
            for(int i=0;i<4;i++)
            {
                if(i<2)steering[i].localRotation=Quaternion.Euler(0,steeringInput*19f,0);
                wheel[i].localRotation=Quaternion.Euler(rotation,0,0);
            }
        }

        private void SwitchMode()
        {
            if(onFoot)
            {
                if((driver-carPosition).sqrMagnitude>19){Notify("Apropie-te de Vento GT.");return;}
                onFoot=false;orbit=0;look=0;
                return;
            }
            if(Mathf.Abs(speed)>1.6f){Notify("Oprește mașina înainte să cobori.");return;}
            var right=Across(Direction(heading));
            var next=carPosition+right*2.3f;
            next.y=world.Elevation(next);
            if(world.Blocked(next,.28f))
            {
                next=carPosition-right*2.3f;
                next.y=world.Elevation(next);
                if(world.Blocked(next,.28f)){Notify("Alege un loc liber pentru oprire.");return;}
            }
            onFoot=true;driver=next;walkYaw=heading;walkPitch=0;speed=0;
        }

        private void Walk(float dt)
        {
            float ahead=Axis(KeyCode.W,KeyCode.UpArrow,KeyCode.S,KeyCode.DownArrow);
            float side=Axis(KeyCode.D,KeyCode.RightArrow,KeyCode.A,KeyCode.LeftArrow);
            var forward=Direction(walkYaw);
            Vector3 stride=Vector3.ClampMagnitude(forward*ahead+Across(forward)*side,1f)*dt*
                (Input.GetKey(KeyCode.LeftShift)?6f:3.9f);
            var p=driver+stride;p.y=world.Elevation(p);
            if(Mathf.Abs(p.y-driver.y)>.18f||world.Blocked(p,.25f)||
                (p-carPosition).sqrMagnitude<2.42f)return;
            driver=p;
        }

        private void PickUp()
        {
            foreach(var (clue,marker) in markers)
            {
                if(collection.Contains(clue.id)||(driver-marker.transform.position).sqrMagnitude>6.5f)continue;
                collection.Add(clue.id);
                PlayerPrefs.SetString(SaveKey+".finds",string.Join("|",collection));PlayerPrefs.Save();
                Notify(clue.title);
                return;
            }
            Notify("Explorează împrejurimile pentru a găsi un obiect.");
        }

        private void Notify(string message){status=message;statusUntil=Time.time+2.5f;}

        private void UpdateCamera(float dt,bool instant)
        {
            if(!view||!vehicle)return;
            var p=vehicle.position;
            var forward=Direction(renderedHeading+orbit);
            Vector3 eye,target;
            if(onFoot)
            {
                eye=driver+Vector3.up*1.68f;target=eye+Direction(walkYaw)*10+Vector3.up*(Mathf.Tan(walkPitch)*10);
            }
            else if(angle==1)
            {
                var nose=Direction(renderedHeading);
                eye=p+nose*1.45f+Vector3.up*1.18f;
                target=eye+forward*16+Vector3.up*(.45f+look*7+Mathf.Tan(renderedPitch*Mathf.Deg2Rad)*16);
            }
            else
            {
                float setback=angle==2?11.4f:7.1f;
                eye=p-forward*setback+Vector3.up*(angle==2?5.4f:2.94f);
                eye.y=Mathf.Max(eye.y,world.Elevation(eye)+1.32f);
                target=p+forward*(angle==2?3.2f:6.6f)+Vector3.up*(1.08f+look*7);
            }
            float blend=instant?1:1-Mathf.Exp(-dt*(onFoot||angle==1?24:12));
            var cameraPosition=Vector3.Lerp(view.transform.position,eye,blend);
            cameraPosition.y=Mathf.Max(cameraPosition.y,world.Elevation(cameraPosition)+.75f);
            view.transform.position=cameraPosition;
            Vector3 aim=target-view.transform.position;
            if(aim.sqrMagnitude>.001f)view.transform.rotation=Quaternion.LookRotation(aim,Vector3.up);
            view.fieldOfView=Mathf.Lerp(view.fieldOfView,angle==2?68:58+Mathf.Abs(speed)*.13f,blend);
        }

        private Texture2D BuildMap()
        {
            const int w=360,h=490;
            var texture=new Texture2D(w,h,TextureFormat.RGBA32,false);
            var pixels=new Color32[w*h];
            for(int i=0;i<pixels.Length;i++)pixels[i]=new Color32(40,67,65,255);
            foreach(var road in world.Data.roads)
            {
                var color=road.main?new Color32(223,182,109,255):new Color32(148,175,159,255);
                for(int i=1;i<road.points.Length;i++)
                {
                    var a=MapUV(road.points[i-1].x,road.points[i-1].z);
                    var b=MapUV(road.points[i].x,road.points[i].z);
                    int steps=Mathf.Max(1,Mathf.CeilToInt(Vector2.Distance(a,b)*h*1.7f));
                    for(int j=0;j<=steps;j++)
                    {
                        var point=Vector2.Lerp(a,b,j/(float)steps);
                        int px=Mathf.Clamp((int)(point.x*w),1,w-2),py=Mathf.Clamp((int)(point.y*h),1,h-2);
                        pixels[px+py*w]=color;
                        if(road.main)pixels[px+1+py*w]=color;
                    }
                }
            }
            texture.SetPixels32(pixels);texture.Apply(false,true);
            return texture;
        }

        private static Vector2 MapUV(float x,float z) => new(Mathf.InverseLerp(-1000,950,x),Mathf.InverseLerp(-1720,1640,z));
        private void Styles()
        {
            if(headingStyle!=null)return;
            headingStyle=new GUIStyle(GUI.skin.label){fontSize=35,fontStyle=FontStyle.Bold,wordWrap=true};
            textStyle=new GUIStyle(GUI.skin.label){fontSize=15,wordWrap=true};
            help=new GUIStyle(GUI.skin.label){fontSize=13,wordWrap=true};
            foreach(var style in new[]{headingStyle,textStyle,help})style.normal.textColor=ivory;
        }

        private void PaintRect(Rect rect,Color color)
        {
            var previous=GUI.color;GUI.color=color;
            GUI.DrawTexture(rect,fill);GUI.color=previous;
        }

        private void OnGUI()
        {
            if(world==null||fill==null)return;
            Styles();
            var area=new Rect(20,20,331,93);
            PaintRect(area,panel);
            var region=world.Data.regions[0];
            foreach(var candidate in world.Data.regions)
                if(distance/world.Data.roads[0].length>=candidate.at)region=candidate;
            GUI.Label(new Rect(32,25,302,47),region.name,headingStyle);
            GUI.Label(new Rect(33,69,296,28),onFoot?"Pe jos":$"{Mathf.Abs(speed)*3.6f:0} km/h   ·   {surface}   ·   {distance/1000:0.00} km",textStyle);
            var bar=new Rect(34,102,298,3);
            PaintRect(bar,Color.gray);bar.width*=Mathf.Clamp01(distance/world.Data.roads[0].length);PaintRect(bar,accent);
            if(!intro)GUI.Label(new Rect(23,Screen.height-43,Screen.width-46,34),
                "WASD / săgeți   ·   Spațiu frână   ·   C cameră   ·   F urcă / coboară   ·   E colectează   ·   M hartă   ·   J jurnal   ·   R revenire   ·   Tab radio",help);
            if(Time.time<statusUntil)GUI.Label(new Rect(25,120,465,35),status,textStyle);
            if(map){DrawMap();return;}
            if(finds){DrawJournal();return;}
            if(!intro&&!paused&&!ceremony)return;
            float width=Mathf.Min(610,Screen.width-46);
            var dialog=new Rect((Screen.width-width)*.5f,Screen.height*.27f,width,Screen.height*.53f);
            PaintRect(dialog,panel);
            GUILayout.BeginArea(new Rect(dialog.x+25,dialog.y+18,dialog.width-50,dialog.height-36));
            if(ceremony)
            {
                GUILayout.Label("Mirador del Viento",headingStyle);
                GUILayout.Label($"Traseu complet · {TimeSpan.FromSeconds(elapsed):mm\\:ss} · {impacts} impacturi",textStyle);
                GUILayout.Label($"Record {TimeSpan.FromSeconds(best):mm\\:ss}",textStyle);
                if(GUILayout.Button("Continuă explorarea",GUILayout.Height(43)))ceremony=false;
            }
            else
            {
                GUILayout.Label(intro?"Explorează Tenerife":"Pauză",headingStyle);
                GUILayout.Label(intro?"De la plaja vulcanică la belvedere, prin Puerto Bruma și pădurea Alisio.":"Drumul, descoperirile și harta sunt disponibile din mașină sau pe jos.",textStyle);
                GUILayout.Space(16);
                if(GUILayout.Button(intro?"Pornește la drum":"Continuă",GUILayout.Height(44))){intro=false;paused=false;}
                if(!intro&&GUILayout.Button("Reia traseul",GUILayout.Height(38)))
                {elapsed=0;impacts=0;finished=false;paused=false;Place(13);}
            }
            GUILayout.EndArea();
        }

        private void DrawMap()
        {
            float height=Mathf.Min(Screen.height-135,530);
            var rect=new Rect((Screen.width-height*.76f)*.5f,58,height*.76f,height);
            PaintRect(new Rect(rect.x-14,rect.y-42,rect.width+28,rect.height+95),panel);
            GUI.Label(new Rect(rect.x,rect.y-39,rect.width,38),"Harta traseului",headingStyle);
            GUI.DrawTexture(rect,mapTexture,ScaleMode.StretchToFill);
            void Dot(float x,float z,Color color,float size)
            {
                var uv=MapUV(x,z);
                PaintRect(new Rect(rect.x+rect.width*uv.x-size/2,rect.y+rect.height*(1-uv.y)-size/2,size,size),color);
            }
            foreach(var lake in world.Data.relief.basins)Dot(lake.x,lake.z,new Color(.57f,.86f,.84f),7);
            var point=onFoot?driver:vehicle.position;
            Dot(point.x,point.z,Color.white,10);
            if(GUI.Button(new Rect(rect.x,rect.yMax+9,rect.width,31),"Înapoi"))map=false;
        }

        private void DrawJournal()
        {
            float width=Mathf.Min(590,Screen.width-45);
            var rect=new Rect((Screen.width-width)*.5f,85,width,Mathf.Min(455,Screen.height-145));
            PaintRect(rect,panel);
            GUILayout.BeginArea(new Rect(rect.x+22,rect.y+17,rect.width-44,rect.height-30));
            GUILayout.Label("Colecția insulei",headingStyle);
            foreach(var item in world.Data.finds)
                GUILayout.Label(collection.Contains(item.id)?item.title+"  ·  "+item.text:"◌  Descoperire în așteptare",textStyle);
            if(GUILayout.Button("Înapoi",GUILayout.Height(32)))finds=false;
            GUILayout.EndArea();
        }
    }
}
