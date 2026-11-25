# Insula uitată 1.5 · verificarea ediției mobile

## Controale și compatibilitate

Patru săgeți mari în stânga, glisare pentru privire, acțiune contextuală în dreapta, zoom, săritură, cameră, hartă, jurnal, inventar, natură, indiciu și pauză. Caseta are o tastatură numerică în joc. Modul tactil alege presetul Mobil la prima pornire și lasă alegerea utilizatorului în setări.

| Test | Rezultat |
| --- | --- |
| Compilare | TypeScript, 38 de teste automate și build Vite |
| Desktop | Două parcurgeri complete în Firefox, cu tastatură și mouse, folosind cadrul de diagnostic. Versiunea 1.4 publicată a rămas identică octet cu octet. |
| Mobil, comenzi | Chromium cu atingere și 844 × 390. Cele patru direcții, mers plus rotirea camerei simultan, oprirea la eliberare, zoom-ul, pauza și rotirea între 844 × 390 și 390 × 844. |
| Mobil, scenă reală | Chromium WebGL 2 cu randare software. Am pornit HTML-ul direct, am verificat presetul Mobil și deplasarea pe plajă printr-o săgeată tactilă. |
| Mobil, poveste | Cadrul de diagnostic cu controlerul real și atingeri Playwright. Toate cele șase puzzle-uri și finalul au fost parcurse fără tastatură. Am verificat încuietoarea, luneta, suprapunerea hărților, jurnalul și redeschiderea unei salvări finalizate. |

Cadrul de diagnostic folosește controlerul, coliziunile, harta, interfața și logica de producție, cu fundal 2D și ceas accelerat. Capturile sale documentează comenzile și interfețele. Nu sunt capturi de performanță grafică.

Verificarea directă pe un iPhone sau Android fizic și măsurarea FPS pe telefon rămân deschise.

Verificarea suplimentară cu WebKit pe Linux a confirmat că meniul tactil oferă presetul Mobil și că jocul WebGL 2 pornește cu cele patru comenzi. Această emulare nu înlocuiește Safari pe iOS fizic.
