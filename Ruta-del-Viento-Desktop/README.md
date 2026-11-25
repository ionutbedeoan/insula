# Ruta del Viento · Windows

Prototipul Unity parcurge 1.127 m din drumul original, de la Playa del Viento până la intrarea în San Bruma. Poți devia spre plajă sau intra pe străzile din Caleta Sur. Ediția Windows folosește Unity 6000.6.10f1 și Universal Render Pipeline.

Ediția 0.2 folosește lumină de zi, frunze cu texturi fotografice, materiale de asfalt și nisip mai detaliate, umbre de contact sub mașină și reflexii de cer pe apă.

## Pornește jocul

Deschide `Start-Ruta-del-Viento.cmd` sau `Builds/Windows-Daylight/Ruta-del-Viento.exe`. Păstrează executabilul alături de fișierele și directoarele din build. În meniu poți alege nivelul grafic **Echilibrat** sau **Detaliu**.

| Tastatură | Acțiune |
| --- | --- |
| `W` / `↑` | Accelerează |
| `S` / `↓` | Frânează și trece în marșarier după oprire |
| `A` `D` / `←` `→` | Direcție |
| `Spațiu` | Frână de mână |
| `C` | Schimbă între urmărire, capotă și panoramă |
| `M` | Afișează harta |
| `R` | Readuce mașina pe drum |
| `Esc` | Pauză |
| `F2` | Schimbă presetul grafic |

Mașina folosește patru `WheelCollider` cu suspensie, stabilizare și aderență pentru asfalt, pietriș și nisip. Jocul salvează local timpul de record și presetul grafic. Mai multe detalii despre asseturi și licențe se află în [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Construiește și verifică

Rulează comenzile de mai jos din `Ruta-del-Viento-Desktop`, după instalarea editorului prin Unity Hub și activarea licenței Unity.

```powershell
powershell -NoProfile -File .\tools\build-windows.ps1
powershell -NoProfile -File .\tools\test-windows.ps1
```

Alternativ, deschide acest director ca proiect Unity și folosește **Ruta del Viento → Build Windows x64**. Constructorul configurează URP și generează scena. `tools/test-windows.ps1` conduce în joc, verifică funcțiile principale, măsoară performanța și scrie rezultatele și capturile în `Builds/Verification`.

Pe laptopul de test, scriptul de build folosește automat pachetele Unity pregătite în `%LOCALAPPDATA%\RutaDelVientoUpm` pentru a evita eroarea Windows din Package Manager. Manifestul proiectului păstrează versiunile oficiale pentru instalările standard.

Datele incluse se pot reconstrui cu `node tools/export-route.mjs` și `node tools/fetch-art.mjs`. Exportul folosește spline-ul și funcțiile de teren din ediția web, cu distanțe și coordonate convertite în metri pentru Unity.
