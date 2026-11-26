using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace TenerifeDesktop
{
    public sealed class TenerifeWorld : MonoBehaviour
    {
        private const int Tile=160, Cell=32, RoadCell=8;
        internal IslandData Data { get; private set; }
        internal GroundGrid Ground { get; private set; }
        private readonly Dictionary<Vector2Int,List<Segment>> roadGrid=new();
        private readonly Dictionary<Vector2Int,List<RoadTriangle>> roadSurfaces=new();
        private readonly Dictionary<Vector2Int,List<Blocker>> blockers=new();
        private readonly Dictionary<Vector2Int,TileProps> decorations=new();
        private readonly Dictionary<Vector2Int,TerrainTile> terrain=new();
        private readonly Dictionary<string,Mesh> meshes=new();
        private readonly Dictionary<string,Material> materials=new();
        private readonly Plane[] planes=new Plane[6];
        private readonly Queue<Vector2Int> unload=new();
        private readonly Queue<(Vector2Int cell,int divisions)> terrainWork=new();
        private Vector2Int lastTile=new(int.MinValue,int.MinValue);
        private Material groundMaterial;
        private Transform terrainParent;
        private Camera player;
        private Light sun;
        private Color coastColor,forestColor;
        private float forest;

        private struct Segment
        {
            public Road road;
            public RoadPoint a,b;
        }
        private readonly struct RoadTriangle
        {
            public readonly Vector3 origin,a,b;
            public readonly float inverseArea;

            public RoadTriangle(Vector3 first,Vector3 second,Vector3 third,float area)
            {
                origin=third;
                a=first-third;
                b=second-third;
                inverseArea=1/area;
            }

            public float Height(float x,float z)
            {
                x-=origin.x;
                z-=origin.z;
                float u=(x*b.z-z*b.x)*inverseArea,v=(a.x*z-a.z*x)*inverseArea;
                return u>=-.0001f&&v>=-.0001f&&u+v<=1.0001f?origin.y+u*a.y+v*b.y:float.NegativeInfinity;
            }
        }
        public struct Surface
        {
            public Road road;
            public float distance,y,s;
            public Vector3 forward;
        }
        private sealed class TerrainTile
        {
            public int divisions;
            public GameObject root;
            public Mesh mesh;
        }
        private sealed class Batch
        {
            public Matrix4x4[] transforms;
            public MaterialPropertyBlock colors;
            public Mesh mesh;
            public Material material;
            public bool shade;
        }
        private sealed class TileProps
        {
            public Bounds bounds;
            public readonly List<Batch> batches=new();
        }

        public void Build(Camera active)
        {
            player=active;
            Data=IslandData.Load();
            Ground=new GroundGrid(Resources.Load<TextAsset>("Tenerife/Ground").bytes);
            terrainParent=new GameObject("Relieful insulei").transform;
            terrainParent.SetParent(transform,false);
            foreach (var road in Data.roads)
                for (int i=1;i<road.points.Length;i++)
                {
                    var a=road.points[i-1];
                    var b=road.points[i];
                    Vector2Int min=Index(Mathf.Min(a.x,b.x)-36,Mathf.Min(a.z,b.z)-36,Cell);
                    Vector2Int max=Index(Mathf.Max(a.x,b.x)+36,Mathf.Max(a.z,b.z)+36,Cell);
                    for(int z=min.y;z<=max.y;z++)
                        for(int x=min.x;x<=max.x;x++)
                            Add(roadGrid,new Vector2Int(x,z),new Segment{road=road,a=a,b=b});
                }
            foreach (var blocker in Data.obstacles) StoreBlocker(blocker);
            foreach (var geo in Data.mesh) meshes[geo.name]=geo.Create();
            CreateMaterials();
            BuildDecoration();
            BuildRoads();
            BuildWater();
            BuildSigns();
            BuildLighting();
        }

        private static Vector2Int Index(float x,float z,int cell) =>
            new Vector2Int(Mathf.FloorToInt(x/cell),Mathf.FloorToInt(z/cell));

        private static void Add<T>(Dictionary<Vector2Int,List<T>> grid,Vector2Int key,T value)
        {
            if(!grid.TryGetValue(key,out var values)) grid[key]=values=new List<T>();
            values.Add(value);
        }

        private void StoreBlocker(Blocker body) => Add(blockers,Index(body.x,body.z,Cell),body);
        internal Mesh MeshAsset(string name) => meshes[name];

        public Surface Nearest(Vector3 position,bool main=false)
        {
            Surface result=default;
            result.distance=float.PositiveInfinity;
            if(!roadGrid.TryGetValue(Index(position.x,position.z,Cell),out var segments)) return result;
            float distanceSquared=float.PositiveInfinity;
            var p=new Vector2(position.x,position.z);
            foreach (var candidate in segments)
            {
                if(main&&!candidate.road.main)continue;
                var a=new Vector2(candidate.a.x,candidate.a.z);
                var b=new Vector2(candidate.b.x,candidate.b.z);
                var span=b-a;
                float t=Mathf.Clamp01(Vector2.Dot(p-a,span)/Mathf.Max(.0001f,span.sqrMagnitude));
                float distance=(p-a-span*t).sqrMagnitude;
                if(distance>=distanceSquared)continue;
                distanceSquared=distance;
                result.road=candidate.road;
                result.y=Mathf.Lerp(candidate.a.y,candidate.b.y,t);
                result.s=Mathf.Lerp(candidate.a.s,candidate.b.s,t);
                result.forward=Vector3.Lerp(candidate.a.Forward,candidate.b.Forward,t).normalized;
            }
            result.distance=Mathf.Sqrt(distanceSquared);
            return result;
        }

        public float Elevation(Vector3 p)
        {
            float height=Ground.At(p.x,p.z);
            if(roadSurfaces.TryGetValue(Index(p.x,p.z,RoadCell),out var triangles))
                foreach(var triangle in triangles)height=Mathf.Max(height,triangle.Height(p.x,p.z));
            return height;
        }

        public bool Blocked(Vector3 point,float radius)
        {
            if(point.x<=Ground.MinX+6||point.x>=Ground.MaxX-6||point.z<=Ground.MinZ+6||point.z>=Ground.MaxZ-6)return true;
            var cell=Index(point.x,point.z,Cell);
            for(int dz=-1;dz<=1;dz++)for(int dx=-1;dx<=1;dx++)
            {
                if(!blockers.TryGetValue(cell+new Vector2Int(dx,dz),out var entries))continue;
                foreach(var obstacle in entries)if(obstacle.Contains(point.x,point.z,radius))return true;
            }
            foreach(var water in Data.relief.basins)
                if(point.y<water.y-.18f&&water.Contains(point.x,point.z))return true;
            return point.y<.14f;
        }

        private static Texture2D Texture(string key) => Resources.Load<Texture2D>("Tenerife/Textures/"+key);
        internal static Color ReadColor(string code,Color fallback) => ColorUtility.TryParseHtmlString(code??"",out var color)?color:fallback;

        private void CreateMaterials()
        {
            groundMaterial=new Material(Shader.Find("Tenerife/Relief"));
            foreach (var pair in new[]{("_Soil","earth"),("_Grass","grass"),("_Basalt","basalt"),("_Sand","beach")})
                groundMaterial.SetTexture(pair.Item1,Texture(pair.Item2+"_color"));
            materials["stucco"]=PropMaterial("stucco");
            materials["roof"]=PropMaterial("roof",.88f);
            materials["basalt"]=PropMaterial("basalt",.37f);
            materials["concrete"]=PropMaterial("paving",.62f);
            materials["bark"]=PropMaterial("bark",1.03f);
            materials["glass"]=PropMaterial(null,.5f,.75f,.25f);
            materials["steel"]=PropMaterial(null,.5f,.38f,.29f);
            materials["paint"]=PropMaterial(null,.5f,.16f);
            materials["asphalt"]=PropMaterial("asphalt",.47f,.12f);
            materials["gravel"]=PropMaterial("earth",.55f,.12f);
            materials["foliage"]=PropMaterial(null,.5f,.08f,0,true);
            materials["foliage"].SetTexture("_MainTex",Texture("foliage"));
            materials["foliage"].SetFloat("_Cutoff",.30f);
            meshes["box"]=PrimitiveMesh(PrimitiveType.Cube);
            meshes["cylinder"]=PrimitiveMesh(PrimitiveType.Cylinder);
            meshes["ball"]=PrimitiveMesh(PrimitiveType.Sphere);
            meshes["roof"]=Gable();
            meshes["foliage"]=LeafCluster();
        }

        internal static Material PropMaterial(string map=null,float size=.45f,float gloss=.16f,float metallic=0,bool uv=false)
        {
            var material=new Material(Shader.Find("Tenerife/Instanced")) {enableInstancing=true};
            if(map!=null)
            {
                material.SetTexture("_MainTex",Texture(map+"_color"));
                material.SetTexture("_BumpMap",Texture(map+"_normal"));
            }
            material.SetFloat("_WorldScale",size);
            material.SetFloat("_Mapped",uv?1:0);
            material.SetFloat("_Gloss",gloss);
            material.SetFloat("_Metallic",metallic);
            return material;
        }

        private static Mesh PrimitiveMesh(PrimitiveType kind)
        {
            var root=GameObject.CreatePrimitive(kind);
            var mesh=root.GetComponent<MeshFilter>().sharedMesh;
            Destroy(root);
            return mesh;
        }

        private static Mesh Gable()
        {
            var mesh=new Mesh {name="Canarian clay roof",vertices=new[]{
                new Vector3(-.5f,0,-.5f),new Vector3(-.5f,0,.5f),new Vector3(0,1,.5f),
                new Vector3(0,1,-.5f),new Vector3(.5f,0,-.5f),new Vector3(.5f,0,.5f)
            },triangles=new[]{0,1,2,0,2,3,3,2,5,3,5,4,1,5,2,0,3,4}};
            mesh.RecalculateNormals();
            return mesh;
        }

        private static Mesh LeafCluster()
        {
            var vertices=new List<Vector3>();var uv=new List<Vector2>();var triangles=new List<int>();
            for(int i=0;i<12;i++)
            {
                float angle=i*2.399963f;
                var direction=new Vector3(Mathf.Cos(angle),0,Mathf.Sin(angle));
                var cross=new Vector3(-direction.z,0,direction.x)*.28f;
                var center=direction*(.12f+i%3*.072f)+Vector3.up*((i%4)*.13f-.26f);
                int start=vertices.Count;
                vertices.Add(center-cross);vertices.Add(center+cross);
                vertices.Add(center+cross+direction*.11f+Vector3.up*.57f);
                vertices.Add(center-cross+direction*.11f+Vector3.up*.57f);
                uv.AddRange(new[]{new Vector2(.012f,.51f),new Vector2(.485f,.51f),new Vector2(.485f,.98f),new Vector2(.012f,.98f)});
                triangles.AddRange(new[]{start,start+1,start+2,start,start+2,start+3});
            }
            var mesh=new Mesh{name="Laurisilva cards",vertices=vertices.ToArray(),uv=uv.ToArray(),triangles=triangles.ToArray()};
            mesh.RecalculateNormals();mesh.RecalculateTangents();
            return mesh;
        }

        private (Mesh,Material,bool) Visual(string kind)
        {
            return kind switch
            {
                "roof" => (meshes["roof"],materials["roof"],true),
                "rock" or "pathStone" => (meshes["basalt"],materials["basalt"],true),
                "lava" => (meshes["lava"],materials["basalt"],true),
                "cliffColumn" => (meshes["cliffColumn"],materials["basalt"],true),
                "houseStone" or "houseTrim" => (meshes["box"],materials["concrete"],true),
                "houseGlass" => (meshes["box"],materials["glass"],false),
                "post" or "rail" => (meshes["box"],materials["steel"],true),
                "trunk" or "forestLaurelWood" or "fallenWood" => (meshes["trunk"],materials["bark"],true),
                "forestTrunk" or "forestTrunkB" => (meshes["forestTrunk"],materials["bark"],true),
                "forestTrunkFar" => (meshes["forestTrunkFar"],materials["bark"],false),
                "forestCrown" or "forestCrownB" => (meshes["forestCrown"],materials["foliage"],true),
                "forestCrownFar" => (meshes["forestCrownFar"],materials["foliage"],false),
                "canopy" or "shrub" or "forestBrush" or "fern" or "pine" or "palm" => (meshes["foliage"],materials["foliage"],false),
                _ => (meshes["box"],materials["stucco"],true)
            };
        }

        private void BuildDecoration()
        {
            var grouped=new Dictionary<Vector2Int,Dictionary<string,List<Prop>>>();
            void Include(Prop prop,bool natural)
            {
                if(prop.kind=="grass"||prop.kind=="shadow"||prop.kind=="forestBase")return;
                var key=Index(prop.x,prop.z,Tile);
                if(!grouped.TryGetValue(key,out var kinds)) grouped[key]=kinds=new Dictionary<string,List<Prop>>();
                if(!kinds.TryGetValue(prop.kind,out var props)) kinds[prop.kind]=props=new List<Prop>();
                props.Add(prop);
                if(natural)
                {
                    if(prop.kind=="trunk"||prop.kind.StartsWith("forestTrunk",StringComparison.Ordinal))
                        StoreBlocker(new Blocker{x=prop.x,z=prop.z,radius=prop.kind=="trunk"?prop.w*.49f:prop.h*.025f});
                    if(prop.kind=="rock"&&prop.w>2.6f) StoreBlocker(new Blocker{x=prop.x,z=prop.z,radius=prop.w*.36f});
                }
            }
            foreach(var prop in Data.props) Include(prop,false);
            foreach(var prop in Data.natural) Include(prop,true);
            foreach(var entry in grouped)
            {
                var cell=entry.Key;
                var tile=new TileProps{bounds=new Bounds(new Vector3((cell.x+.5f)*Tile,270,(cell.y+.5f)*Tile),new Vector3(2*Tile,820,2*Tile))};
                foreach(var kind in entry.Value)
                {
                    var (mesh,material,shade)=Visual(kind.Key);
                    var props=kind.Value;
                    for(int start=0;start<props.Count;start+=1023)
                    {
                        int count=Mathf.Min(1023,props.Count-start);
                        var transforms=new Matrix4x4[count];
                        var colors=new Vector4[count];
                        for(int i=0;i<count;i++)
                        {
                            var p=props[start+i];
                            Vector3 size=new Vector3(p.w,p.h,p.d);
                            Quaternion orientation=Quaternion.Euler(0,p.angle*Mathf.Rad2Deg,0);
                            if(p.kind=="fallenWood")orientation*=Quaternion.Euler(90,0,0);
                            transforms[i]=Matrix4x4.TRS(new Vector3(p.x,p.y,p.z),orientation,size);
                            Color tint=ReadColor(p.color,Color.white);
                            colors[i]=QualitySettings.activeColorSpace==ColorSpace.Linear?tint.linear:tint;
                        }
                        var block=new MaterialPropertyBlock();
                        block.SetVectorArray("_Tint",colors);
                        tile.batches.Add(new Batch{transforms=transforms,colors=block,mesh=mesh,material=material,shade=shade});
                    }
                }
                decorations[cell]=tile;
            }
        }

        public void Refresh(Vector3 observer)
        {
            var center=Index(observer.x,observer.z,Tile);
            if(center!=lastTile)
            {
                lastTile=center;
                terrainWork.Clear();
                unload.Clear();
                foreach(var entry in terrain)
                    if(Mathf.Abs(entry.Key.x-center.x)>10||Mathf.Abs(entry.Key.y-center.y)>9)unload.Enqueue(entry.Key);
                for(int radius=0;radius<=10;radius++)
                {
                    int divisions=radius<=1?40:radius<=3?20:radius<=5?10:5;
                    for(int z=-Mathf.Min(9,radius);z<=Mathf.Min(9,radius);z++)
                    for(int x=-radius;x<=radius;x++)
                    {
                        if(Mathf.Max(Mathf.Abs(x),Mathf.Abs(z))!=radius)continue;
                        var cell=center+new Vector2Int(x,z);
                        if((cell.x+1)*Tile<Ground.MinX||cell.x*Tile>Ground.MaxX||
                           (cell.y+1)*Tile<Ground.MinZ||cell.y*Tile>Ground.MaxZ)continue;
                        if(terrain.TryGetValue(cell,out var current)&&current.divisions==divisions)continue;
                        terrainWork.Enqueue((cell,divisions));
                    }
                }
            }
            double start=Time.realtimeSinceStartupAsDouble;
            for(int i=0;i<8&&terrainWork.Count>0&&(i==0||Time.realtimeSinceStartupAsDouble-start<.0025);i++)
            {
                var (cell,divisions)=terrainWork.Dequeue();
                BuildTerrain(cell,divisions);
            }
            for(int i=0;i<8&&unload.Count>0;i++)RemoveTerrain(unload.Dequeue());
        }

        private void RemoveTerrain(Vector2Int cell)
        {
            var tile=terrain[cell];
            Destroy(tile.mesh);Destroy(tile.root);
            terrain.Remove(cell);
        }

        private void BuildTerrain(Vector2Int cell,int divisions)
        {
            int row=divisions+1;
            int planeVertices=row*row;
            var vertices=new Vector3[planeVertices+4*row];
            var normals=new Vector3[vertices.Length];
            var colors=new Color32[vertices.Length];
            var indices=new int[(divisions*divisions+4*divisions)*6];
            int index=0;
            float step=Tile/(float)divisions;
            for(int z=0;z<row;z++)for(int x=0;x<row;x++)
            {
                int v=x+z*row;
                float wx=cell.x*Tile+x*step,wz=cell.y*Tile+z*step;
                vertices[v]=new Vector3(wx,Ground.At(wx,wz),wz);
                normals[v]=new Vector3(Ground.At(wx-2,wz)-Ground.At(wx+2,wz),4,Ground.At(wx,wz-2)-Ground.At(wx,wz+2)).normalized;
                colors[v]=Ground.Land(wx,wz);
                if(x<divisions&&z<divisions)
                {
                    indices[index++]=v;indices[index++]=v+row;indices[index++]=v+1;
                    indices[index++]=v+1;indices[index++]=v+row;indices[index++]=v+row+1;
                }
            }
            int Border(int side,int i) => side switch
            {
                0=>i,1=>i*row+divisions,2=>divisions*row+divisions-i,_=>(divisions-i)*row
            };
            for(int side=0;side<4;side++)
            {
                int first=planeVertices+side*row;
                for(int i=0;i<row;i++)
                {
                    int a=Border(side,i);
                    vertices[first+i]=vertices[a]-Vector3.up*18;
                    normals[first+i]=normals[a];
                    colors[first+i]=colors[a];
                    if(i==divisions)continue;
                    int b=Border(side,i+1),lower=first+i;
                    indices[index++]=a;indices[index++]=b;indices[index++]=lower;
                    indices[index++]=b;indices[index++]=lower+1;indices[index++]=lower;
                }
            }
            var mesh=new Mesh{name="Ground "+cell,vertices=vertices,normals=normals,colors32=colors,triangles=indices};
            mesh.RecalculateBounds();
            if(terrain.TryGetValue(cell,out var tile))
            {
                tile.root.GetComponent<MeshFilter>().sharedMesh=mesh;
                Destroy(tile.mesh);
                tile.mesh=mesh;
                tile.divisions=divisions;
            }
            else terrain[cell]=new TerrainTile{mesh=mesh,root=Attach(terrainParent,mesh,groundMaterial),divisions=divisions};
        }

        internal static GameObject Attach(Transform parent,Mesh mesh,Material material)
        {
            var node=new GameObject(mesh.name);
            node.transform.SetParent(parent,false);
            node.AddComponent<MeshFilter>().sharedMesh=mesh;
            node.AddComponent<MeshRenderer>().sharedMaterial=material;
            return node;
        }

        private void BuildRoads()
        {
            Material asphalt=materials["asphalt"],gravel=materials["gravel"];
            var white=materials["paint"];
            white.SetColor("_Tint",ReadColor("#ede5cf",Color.white));
            foreach(var road in Data.roads)
            {
                Ribbon(road.points,-road.half,0,.051f,road.surface=="asphalt"?asphalt:gravel,"Drum "+road.surface,support:true);
                Ribbon(road.points,0,road.half,.051f,road.surface=="asphalt"?asphalt:gravel,"Drum "+road.surface,support:true);
                Ribbon(road.points,-road.half-1.15f,-road.half,.051f,gravel,"Acostament",support:true,blendLeft:true);
                Ribbon(road.points,road.half,road.half+1.15f,.051f,gravel,"Acostament",support:true,blendRight:true);
                if(!road.main)continue;
                Ribbon(road.points,-road.half+.25f,-road.half+.36f,.069f,white,"Marcaj exterior");
                Ribbon(road.points,road.half-.36f,road.half-.25f,.069f,white,"Marcaj exterior");
                var dashes=new List<RoadPoint>();
                for(float s=18;s<road.length-10;s+=9.6f)
                {
                    dashes.Add(road.At(s));dashes.Add(road.At(s+3.9f));
                }
                Ribbon(dashes.ToArray(),-.058f,.058f,.071f,white,"Marcaj discontinuu",2);
            }
        }

        private void Ribbon(RoadPoint[] points,float left,float right,float raise,Material material,string label,int group=0,
            bool support=false,bool blendLeft=false,bool blendRight=false)
        {
            var vertices=new Vector3[points.Length*2];var indices=new List<int>((points.Length-1)*6);
            for(int i=0;i<points.Length;i++)
            {
                var p=points[i];
                Vector3 normal=new Vector3(-p.dz,0,p.dx);
                vertices[2*i]=p.Position+normal*left+Vector3.up*(raise-Mathf.Abs(left)*.012f);
                vertices[2*i+1]=p.Position+normal*right+Vector3.up*(raise-Mathf.Abs(right)*.012f);
                if(blendLeft)vertices[2*i].y=Ground.At(vertices[2*i].x,vertices[2*i].z)-.01f;
                if(blendRight)vertices[2*i+1].y=Ground.At(vertices[2*i+1].x,vertices[2*i+1].z)-.01f;
                if(i==0||group>0&&i%group==0)continue;
                int a=2*i-2;
                indices.Add(a);indices.Add(a+1);indices.Add(a+2);
                indices.Add(a+1);indices.Add(a+3);indices.Add(a+2);
                if(support)
                {
                    IndexRoad(vertices[a],vertices[a+1],vertices[a+2]);
                    IndexRoad(vertices[a+1],vertices[a+3],vertices[a+2]);
                }
            }
            var mesh=new Mesh{name=label,vertices=vertices,triangles=indices.ToArray()};
            mesh.RecalculateNormals();
            Attach(transform,mesh,material).GetComponent<MeshRenderer>().shadowCastingMode=ShadowCastingMode.Off;
        }

        private void IndexRoad(Vector3 a,Vector3 b,Vector3 c)
        {
            float area=(a.x-c.x)*(b.z-c.z)-(a.z-c.z)*(b.x-c.x);
            if(Mathf.Abs(area)<.00001f)return;
            var triangle=new RoadTriangle(a,b,c,area);
            var min=Index(Mathf.Min(a.x,Mathf.Min(b.x,c.x)),Mathf.Min(a.z,Mathf.Min(b.z,c.z)),RoadCell);
            var max=Index(Mathf.Max(a.x,Mathf.Max(b.x,c.x)),Mathf.Max(a.z,Mathf.Max(b.z,c.z)),RoadCell);
            for(int z=min.y;z<=max.y;z++)
            for(int x=min.x;x<=max.x;x++)Add(roadSurfaces,new Vector2Int(x,z),triangle);
        }

        private void BuildWater()
        {
            var ocean=Water(0,new Color(.026f,.135f,.19f));
            var sea=GameObject.CreatePrimitive(PrimitiveType.Plane);
            sea.name="Atlantic";sea.transform.SetParent(transform,false);
            sea.transform.position=new Vector3(-1650,0,-50);sea.transform.localScale=new Vector3(900,1,900);
            sea.GetComponent<Renderer>().sharedMaterial=ocean;
            Destroy(sea.GetComponent<Collider>());
            foreach(var basin in Data.relief.basins)
            {
                int n=basin.boundary.Length;
                var vertices=new Vector3[n+1];var uv=new Vector2[n+1];var triangles=new int[n*3];
                vertices[0]=new Vector3(basin.x,basin.y,basin.z);uv[0]=new Vector2(.5f,.5f);
                for(int i=0;i<n;i++)
                {
                    var point=basin.boundary[i];
                    vertices[i+1]=new Vector3(point.x,basin.y,point.z);
                    uv[i+1]=new Vector2(.5f+(point.x-basin.x)/basin.rx*.5f,.5f+(point.z-basin.z)/basin.rz*.5f);
                    triangles[i*3]=0;triangles[i*3+1]=(i+1)%n+1;triangles[i*3+2]=i+1;
                }
                var mesh=new Mesh{name=basin.name,vertices=vertices,uv=uv,triangles=triangles};
                mesh.RecalculateNormals();
                Attach(transform,mesh,Water(1,basin.sea?new Color(.033f,.24f,.23f):new Color(.054f,.167f,.16f)));
            }
            var stream=Water(2,Color.white);
            foreach(var fall in Data.relief.cascades)
            {
                var right=new Vector3(fall.dz,0,-fall.dx).normalized*fall.width*.5f;
                var bottom=new Vector3(fall.x,fall.y,fall.z);
                var top=bottom+Vector3.up*fall.drop+new Vector3(-fall.dx,0,-fall.dz)*.55f;
                var quad=new Mesh{name=fall.name,vertices=new[]{bottom-right,bottom+right,top-right,top+right},
                    uv=new[]{Vector2.zero,Vector2.right,Vector2.up,Vector2.one},triangles=new[]{0,2,1,1,2,3}};
                quad.RecalculateNormals();Attach(transform,quad,stream);
            }
        }

        private static Material Water(float mode,Color tint)
        {
            var mat=new Material(Shader.Find("Tenerife/Waterways"));
            mat.SetFloat("_Mode",mode);mat.SetColor("_Tint",tint);
            return mat;
        }

        private void BuildSigns()
        {
            foreach(var sign in Data.signs)
            {
                var p=Data.roads[0].At(sign.s);
                var cross=new Vector3(-p.dz,0,p.dx);
                var position=p.Position+cross*(sign.side*7.7f);
                position.y=Elevation(position);
                var root=Attach(transform,meshes["box"],materials["steel"]);
                root.name=sign.title;
                root.transform.SetPositionAndRotation(position+Vector3.up*1.08f,Quaternion.identity);
                root.transform.localScale=new Vector3(.11f,2.2f,.11f);
                var panel=Attach(transform,meshes["box"],materials["steel"]);
                panel.transform.SetPositionAndRotation(position+Vector3.up*2.27f,Quaternion.LookRotation(p.Forward));
                panel.transform.localScale=new Vector3(3,1.12f,.16f);
                var material=new Material(materials["steel"]);
                material.SetColor("_Tint",ReadColor(sign.color,Color.gray));
                panel.GetComponent<Renderer>().sharedMaterial=material;
                var lettering=new GameObject(sign.title+" text");
                lettering.transform.SetParent(transform,false);
                lettering.transform.SetPositionAndRotation(panel.transform.position-p.Forward*.087f,Quaternion.LookRotation(p.Forward));
                var text=lettering.AddComponent<TextMesh>();
                text.text=sign.title+"\n"+sign.caption;text.color=Color.white;text.fontSize=65;text.characterSize=.030f;
                text.anchor=TextAnchor.MiddleCenter;text.alignment=TextAlignment.Center;
            }
        }

        private void BuildLighting()
        {
            coastColor=ReadColor("#adc2c7",Color.white);
            forestColor=ReadColor("#a6ac9b",Color.white);
            RenderSettings.fog=true; RenderSettings.fogMode=FogMode.ExponentialSquared;
            RenderSettings.fogColor=coastColor;RenderSettings.fogDensity=.00072f;
            RenderSettings.ambientMode=AmbientMode.Trilight;
            RenderSettings.ambientSkyColor=ReadColor("#b5c9df",Color.white)*.74f;
            RenderSettings.ambientEquatorColor=ReadColor("#938e78",Color.white)*.62f;
            RenderSettings.ambientGroundColor=ReadColor("#655849",Color.gray)*.39f;
            var hdri=Texture("Atlantic");
            var sky=Shader.Find("Skybox/Panoramic");
            if(hdri&&sky)
            {
                var dome=new Material(sky);
                dome.SetTexture("_MainTex",hdri);
                dome.SetFloat("_Rotation",56);
                dome.SetFloat("_Exposure",.86f);
                RenderSettings.skybox=dome;
                DynamicGI.UpdateEnvironment();
            }
            var source=new GameObject("Atlantic sunlight");
            source.transform.SetParent(transform,false);
            source.transform.rotation=Quaternion.Euler(35,-54,0);
            sun=source.AddComponent<Light>();sun.type=LightType.Directional;sun.intensity=1.78f;
            sun.color=ReadColor("#fff1d2",Color.white);sun.shadows=LightShadows.Soft;
            sun.shadowBias=.05f;sun.shadowNormalBias=.32f;
            RenderSettings.sun=sun;
            QualitySettings.shadowDistance=130;
            QualitySettings.shadowCascades=2;
        }

        private void LateUpdate()
        {
            if(!player||Ground==null)return;
            var p=player.transform.position;
            forest=Mathf.Lerp(forest,Ground.Land(p.x,p.z).r/255f,1-Mathf.Exp(-Time.deltaTime*1.8f));
            RenderSettings.fogDensity=.00068f+.0035f*forest;
            RenderSettings.fogColor=Color.Lerp(coastColor,forestColor,forest);
            GeometryUtility.CalculateFrustumPlanes(player,planes);
            var center=Index(p.x,p.z,Tile);
            for(int z=center.y-5;z<=center.y+5;z++)for(int x=center.x-5;x<=center.x+5;x++)
            {
                if(!decorations.TryGetValue(new Vector2Int(x,z),out var tile)||!GeometryUtility.TestPlanesAABB(planes,tile.bounds))continue;
                foreach(var batch in tile.batches)
                    Graphics.DrawMeshInstanced(batch.mesh,0,batch.material,batch.transforms,batch.transforms.Length,batch.colors,
                       batch.shade?ShadowCastingMode.On:ShadowCastingMode.Off,true,0,player,LightProbeUsage.Off);
            }
        }
    }
}
