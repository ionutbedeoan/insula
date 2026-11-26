using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Rendering;

namespace TenerifeDesktop
{
    [Serializable] public sealed class IslandData
    {
        public Road[] roads;
        public Prop[] props, natural;
        public Blocker[] obstacles;
        public Region[] regions;
        public Sign[] signs;
        public Find[] finds;
        public Relief relief;
        public Geometry[] mesh;

        public static IslandData Load()
        {
            var asset = Resources.Load<TextAsset>("Tenerife/Island");
            if (!asset) throw new InvalidOperationException("Exportul Tenerife/Island lipsește.");
            return JsonUtility.FromJson<IslandData>(asset.text);
        }
    }

    [Serializable] public sealed class Region { public string name, kind; public float at; }
    [Serializable] public sealed class Sign { public string title, caption, color; public float s, side; }
    [Serializable] public sealed class Find { public string id, title, text; public float x, z; }
    [Serializable] public sealed class Relief { public Basin[] basins; public Cascade[] cascades; }
    [Serializable] public sealed class MapPoint { public float x, z; }
    [Serializable] public sealed class Basin
    {
        public string id, name;
        public float x,z,rx,rz,y,depth,seed;
        public bool sea;
        public MapPoint[] boundary;

        public bool Contains(float px,float pz)
        {
            float u=(px-x)/rx,v=(pz-z)/rz;
            if (Mathf.Abs(u)>1.13f || Mathf.Abs(v)>1.13f) return false;
            float a=Mathf.Atan2(v,u);
            float edge=1+.072f*Mathf.Sin(a*3+seed)+.046f*Mathf.Sin(a*7-seed);
            return u*u+v*v<edge*edge;
        }
    }
    [Serializable] public sealed class Cascade
    {
        public string name;
        public float x,z,dx,dz,y,drop,width;
    }
    [Serializable] public sealed class RoadPoint
    {
        public float x,y,z,dx,dz,s;
        public Vector3 Position => new Vector3(x,y,z);
        public Vector3 Forward => new Vector3(dx,0,dz);
    }
    [Serializable] public sealed class Road
    {
        public float half,length;
        public bool main;
        public string surface;
        public RoadPoint[] points;

        public RoadPoint At(float meters)
        {
            float distance=Mathf.Clamp(meters,0,length);
            int lo=0,hi=points.Length-1;
            while (hi-lo>1)
            {
                int mid=(hi+lo)/2;
                if (points[mid].s<distance) lo=mid; else hi=mid;
            }
            var a=points[lo];
            var b=points[hi];
            float t=Mathf.InverseLerp(a.s,b.s,distance);
            var p=Vector3.Lerp(a.Position,b.Position,t);
            var forward=Vector3.Lerp(a.Forward,b.Forward,t).normalized;
            return new RoadPoint {x=p.x,y=p.y,z=p.z,dx=forward.x,dz=forward.z,s=distance};
        }
    }
    [Serializable] public sealed class Prop
    {
        public string kind,color;
        public float x,y,z,w,h,d,angle;
    }
    [Serializable] public sealed class Blocker
    {
        public float x,z,radius,halfX,halfZ,angle;
        public bool Contains(float px,float pz,float padding)
        {
            float ox=px-x,oz=pz-z;
            if (halfX<=0||halfZ<=0)
            {
                float r=radius+padding;
                return ox*ox+oz*oz<r*r;
            }
            float c=Mathf.Cos(angle),s=Mathf.Sin(angle);
            return Mathf.Abs(ox*c-oz*s)<halfX+padding && Mathf.Abs(ox*s+oz*c)<halfZ+padding;
        }
    }
    [Serializable] public sealed class Geometry
    {
        public string name;
        public float[] p,n,uv;
        public int[] i;
        public FaceGroup[] groups;

        public Mesh Create()
        {
            var vertices=new Vector3[p.Length/3];
            for (int k=0;k<vertices.Length;k++) vertices[k]=new Vector3(p[k*3],p[k*3+1],p[k*3+2]);
            var mesh=new Mesh {name=name,vertices=vertices};
            if (uv!=null&&uv.Length==vertices.Length*2)
            {
                var coordinates=new Vector2[vertices.Length];
                for (int k=0;k<coordinates.Length;k++) coordinates[k]=new Vector2(uv[k*2],1-uv[k*2+1]);
                mesh.uv=coordinates;
            }
            if (groups!=null&&groups.Length>0)
            {
                var triangles=new SortedDictionary<int,List<int>>();
                foreach (var group in groups)
                {
                    if (!triangles.TryGetValue(group.material,out var list)) triangles[group.material]=list=new List<int>();
                    for (int k=group.start;k<group.start+group.count;k++) list.Add(i[k]);
                }
                mesh.subMeshCount=triangles.Count;
                int index=0;
                foreach (var pair in triangles) mesh.SetTriangles(pair.Value,index++);
            }
            else mesh.triangles=i;
            if (n!=null&&n.Length==p.Length)
            {
                var normals=new Vector3[vertices.Length];
                for (int k=0;k<normals.Length;k++) normals[k]=new Vector3(n[3*k],n[3*k+1],n[3*k+2]);
                mesh.normals=normals;
            }
            else mesh.RecalculateNormals();
            if (mesh.uv.Length==vertices.Length) mesh.RecalculateTangents();
            mesh.RecalculateBounds();
            return mesh;
        }
    }
    [Serializable] public sealed class FaceGroup { public int start,count,material; }

    public sealed class GroundGrid
    {
        private readonly int x0,z0,step,width,height;
        private readonly byte[] data;
        public float MinX=>x0;
        public float MaxX=>x0+step*(width-1);
        public float MinZ=>z0;
        public float MaxZ=>z0+step*(height-1);

        public GroundGrid(byte[] bytes)
        {
            data=bytes;
            using (var reader=new BinaryReader(new MemoryStream(bytes,false)))
            {
                x0=reader.ReadInt32(); z0=reader.ReadInt32(); step=reader.ReadInt32();
                width=reader.ReadInt32(); height=reader.ReadInt32();
            }
            if (step<=0||width<2||height<2||bytes.Length!=20+width*height*5)
                throw new InvalidDataException("Grila de teren Tenerife este invalidă.");
        }

        public float At(float x,float z)
        {
            float u=Mathf.Clamp((x-x0)/step,0,width-1f),v=Mathf.Clamp((z-z0)/step,0,height-1f);
            int i=Mathf.Min(width-2,Mathf.FloorToInt(u)),j=Mathf.Min(height-2,Mathf.FloorToInt(v));
            int offset=20+(i+j*width)*5;
            float a=Height(offset),b=Height(offset+5);
            int below=offset+width*5;
            float c=Height(below),d=Height(below+5);
            float xWeight=u-i,zWeight=v-j;
            return xWeight+zWeight<=1
                ? a*(1-xWeight-zWeight)+b*xWeight+c*zWeight
                : d*(xWeight+zWeight-1)+b*(1-zWeight)+c*(1-xWeight);
        }

        public Color32 Land(float x,float z)
        {
            int ix=Mathf.Clamp(Mathf.RoundToInt((x-x0)/step),0,width-1);
            int iz=Mathf.Clamp(Mathf.RoundToInt((z-z0)/step),0,height-1);
            int offset=20+(ix+iz*width)*5;
            return new Color32(data[offset+2],data[offset+3],data[offset+4],255);
        }

        private float Height(int offset) => ((data[offset+1]<<8)|data[offset])*.02f-64f;
    }
}
