# Ruta del Viento — raport de verificare

Testare pe 25 noiembrie 2026. Modul se deschide din meniul Insula uitată sau direct la ancora `#drive`. Derivă din commitul `326957e` din repo-ul utilizatorului.

## Livrabil

Traseul principal are 5,48 km și urcă aproximativ 420 m. Patru drumuri secundare însumează 1,19 km. Mașina are trei camere, tracțiune diferită pe asfalt, pietriș și teren, frână, marșarier, lumini de frână, recuperare și motor sintetizat. Instanțierea vegetației și a clădirilor, terenul pe secțiuni și rezoluția adaptivă reduc sarcina scenei.

Harta turistică Arona și unitățile de peisaj ale Cabildo de Tenerife au ghidat ordinea biotopurilor. Traseul și caroseria sunt originale. Jocul refolosește texturi din proiectul de bază, menționate în documentația de resurse.

## Verificare tehnică

- Instalare din arhiva sursă cu `npm ci`, build de producție și 43 de teste automate. Buildul refăcut a generat același HTML, verificat prin SHA-256.
- Regresiile de condus verifică lungimea, conexiunile ramificațiilor, frânarea, marșarierul, recuperarea, coliziunea cu o clădire și accesul prematur la final.
- Chromium cu profil mobil a pornit scena WebGL și a trecut verificările de accelerație cu direcție, eliberarea unui singur deget, anularea atingerii, hartă, revenire și orientare portret.
- WebKit cu profil mobil a pornit jocul de la adresa serverului livrat. Lansarea directă din fișierul HTML a trecut verificarea pe desktop.
- Drumul secundar spre plajă a fost condus cu tastatura până la capăt, fără coliziuni, apoi mașina a fost oprită cu frâna.

## Parcurgeri complete în browser

| Browser și intrare | Timp în joc | Coliziuni |
| --- | --- | --- |
| WebKit desktop, tastatură | 150.97 s | 0 |
| WebKit cu profil mobil, atingeri simultane | 151.49 s | 0 |

Ambele au folosit buildul WebGL de producție. Automatizarea a apăsat comenzile normale și a citit poziția afișată de joc. În ambele ture au fost verificate finalul, recordul local, revenirea la volan și accesul la meniul principal. Pe mobil, testul final a ridicat toate contactele active înainte de a apăsa butonul de continuare, așa cum ar face un jucător.

Am verificat și intrarea în modul auto din meniul obișnuit, revenirea în acel meniu și pornirea expediției originale în WebKit cu profil tactil.

## Rezolvări din testare

- Camera și relieful de la plecare lăsau oceanul ascuns. Linia țărmului și încadrarea au fost ajustate.
- Un fragment pentru textura terenului folosea un identificator rezervat în GLSL. A fost corectat și testat din nou în browser.
- Pilotul de test pierdea carosabilul când direcția răspundea prea brusc. Direcția a primit o creștere mai progresivă, iar unghiul maxim scade mai mult la viteză.
- La intersecția cu drumul de pietriș puteau apărea diferențe bruște de nivel. Stopurile erau parțial acoperite de caroserie. Am corectat tranziția de înălțime și poziția lămpilor.
- Am îndesit pădurea lângă carosabil, am adăugat trotuare și treceri în sat și am diferențiat sectorul de lavă cu aflorimente de bazalt.

## Limite de verificare

Testele au folosit browsere cu randare software în mediu automatizat. Hardware-ul iPhone și Android și FPS-ul pe dispozitiv fizic rămân de măsurat. Parcurgerea completă pe profil mobil este documentată în WebKit. În Chromium cu SwiftShader am verificat pornirea și comenzile. Încercarea de tur complet sub SwiftShader a rămas incompletă după ce pilotul automat a ieșit de pe carosabil.

Peisajul rămâne semi-realist stilizat. Fațadele și vegetația rămân simplificate pentru acest prim traseu. Traseul e gândit pentru condus liber, fără trafic simulat. Zona urbană este reprezentată de San Bruma și ramificațiile satului.
