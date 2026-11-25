# Resursele ediției 1.2

## Materiale fotografice

Texturile de mai jos provin din Poly Haven și sunt [CC0](https://polyhaven.com/license). În joc sunt incluse versiunile redimensionate ale hărților de culoare și normale, în două atlase WebP. Pot fi reconstruite cu `scripts/material-atlas.py` și fișierele originale.

- [Forest Floor](https://polyhaven.com/a/forest_floor)
- [Mossy Rock](https://polyhaven.com/a/mossy_rock)
- [Rock Boulder Dry](https://polyhaven.com/a/rock_boulder_dry)
- [Weathered Planks](https://polyhaven.com/a/weathered_planks)
- [Palm Bark](https://polyhaven.com/a/palm_bark)
- [Sand 01](https://polyhaven.com/a/sand_01)

## Vegetație

- [Fern 02](https://polyhaven.com/a/fern_02), Poly Haven, CC0. Trei clump-uri din scanare, cu textura de culoare și masca de frunză ambalate pentru versiunea portabilă.

## Personaje

Capul derivă din [mesh-ul de bază MakeHuman](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj). Mesh-ul a fost decupat și cuantizat. MakeHuman distribuie resursele grafice cu licență [CC0](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.ASSETS.md). Restul personajelor, echipamentul și fauna sunt modelate procedural în proiect.

## Referințe de design

- [Parcul Rural Anaga](https://turismo.aytolalaguna.es/anaga/)
- [InstancedMesh în Three.js](https://threejs.org/docs/pages/InstancedMesh.html)
- [Materiale PBR în Three.js](https://threejs.org/docs/pages/MeshStandardMaterial.html)
- [Khronos KTX](https://www.khronos.org/ktx/). Documentat pentru o compresie GPU ulterioară. Ediția portabilă curentă folosește atlase WebP încorporate.

## Modele pentru traseul din ediția 1.4

| Resursă | Utilizare |
| --- | --- |
| [Tree Stump 01](https://polyhaven.com/a/tree_stump_01) | Butuci cu rădăcini lângă potecă |
| [Dead Tree Trunk 02](https://polyhaven.com/a/dead_tree_trunk_02) | Trunchiuri putrezite la intrarea în pădure |
| [Boulder 01](https://polyhaven.com/a/boulder_01) | Bolovani de la plajă și stânca despicată |

Modelele și texturile sunt distribuite de Poly Haven sub licența [CC0](https://polyhaven.com/license). Ediția de joc folosește geometrii simplificate în Blender, texturi WebP, normal maps și date încorporate în HTML. Scripturile de pregătire sunt în `scripts/decimate-opening-scans.py` și `scripts/pack-opening-scans.py`.
