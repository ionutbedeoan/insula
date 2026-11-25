"""Extract and normalize the head from the CC0 MakeHuman base mesh."""
import base64
import struct
import sys
from pathlib import Path

vertices, faces = [], []
group = ""
for line in Path(sys.argv[1]).read_text().splitlines():
    p = line.split()
    if not p: continue
    if p[0] == "v":
        vertices.append(tuple(map(float,p[1:4])))
    elif p[0] == "g":
        group = p[1]
    elif p[0] == "f" and group == "body":
        polygon = [int(a.split("/")[0])-1 for a in p[1:]]
        if all(vertices[i][1]>=6.43 and abs(vertices[i][0])<1.1 for i in polygon):
            for i in range(1,len(polygon)-1): faces.extend((polygon[0],polygon[i+1],polygon[i]))

unique = {value:index for index,value in enumerate(sorted(set(faces)))}
points = bytearray()
for vertex in unique:
    x,y,z = vertices[vertex]
    points.extend(struct.pack("<3h",round(x*.137*20000),round((y-7.28)*.114*20000),round((.56-z)*.111*20000)))
index = struct.pack(f"<{len(faces)}H", *(unique[i] for i in faces))
blob = lambda value: base64.b64encode(value).decode()
Path(sys.argv[2]).write_text(
    "// MakeHuman body mesh, CC0. Cropped to the head, quantized and repacked.\n"
    f"export const headPoints='{blob(points)}'\n"
    f"export const headTriangles='{blob(index)}'\n"
)
print(len(unique),len(faces)//3)
