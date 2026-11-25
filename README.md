# Insula uitată · The Forgotten Island

Un joc de explorare fără violență, în care refaci traseul unei expediții topografice din 1986. Ediția 1.5 pornește în română. Din **Setări → Limbă** poți trece oricând pe engleză. Jocul, jurnalul, indiciile și mecanismele sunt disponibile în ambele limbi.

## Cum pornești jocul

Deschide **The-Forgotten-Island-Mobile.html** într-un browser desktop cu WebGL 2. Jocul, modelele și sunetele sunt incluse în fișier. Dacă browserul restricționează accesul la salvare pentru fișiere locale, pornește proiectul prin Vite. Calitatea grafică pornește pe **Ridicată** pe desktop și pe telefon. Opțiunile salvate au prioritate. Presetul **Scăzută** reduce rezoluția și vegetația de la nivelul solului.

| Comandă | Acțiune |
| --- | --- |
| WASD, Shift, Spațiu | Deplasare, alergare, săritură |
| Mouse sau săgeți | Orientează privirea |
| E | Interacționează cu reperul indicat |
| F | Vorbește cu Inès când e aproape |
| V | Schimbă între persoana întâi și a treia |
| M | Hartă topografică |
| J, I sau Tab | Jurnal, inventar |
| G | Începe activitatea disponibilă la un reper de teren |
| N | Deschide carnetul naturalistului |
| H | Arată sau ascunde indiciul obiectivului curent |
| Escape | Pauză sau închide panoul |

Inès Vidal începe lângă barcă. Urmează singură potecile, se oprește să ia notițe și revine pe coastă. Cu **M** îi poți vedea poziția cât timp se află în apropiere. Pe hartă poți mări cu rotița sau cu butoanele și poți deplasa imaginea prin tragere. Salvarea preia progresul din versiunea anterioară atunci când rulezi pe aceeași origine în browser.

Panoul **Următorul pas** afișează automat indiciile de pe plajă și până la deschiderea casetei din tabără. Poți comuta afișarea indiciilor oricând cu **H** sau cu butonul **?** pe telefon.

Pe traseu găsești trei observații de faună, două stații de fotografie și un jalon de maree. Sunt activități opționale, cu progres salvat separat în carnet. Caută diamantele de pe hartă. Pădurea umedă, ravena, coasta vulcanică și plaja sudică au vegetație și materiale distincte.

## Pe telefon

Pornește jocul într-un browser cu WebGL 2. Modul tactil se activează automat când dispozitivul are atingerea ca metodă principală de control. În format orizontal ai mai mult spațiu pentru scenă.

- Ține apăsate săgețile mari pentru mers înainte, înapoi și lateral. Glisează cu celălalt deget pe scenă pentru a privi în jur.
- Butonul auriu din dreapta preia acțiunea tastei **E**. Textul arată ce poți examina, deschide sau lua. Butoanele separate apar când poți vorbi cu Inès sau când este disponibilă o observație de teren.
- Folosește **+ / −** pentru zoom-ul camerei și **↥** pentru săritură. Harta, jurnalul, inventarul și pauza au butoane proprii.
- Caseta folosește o tastatură numerică pe ecran. Luneta și foaia din arhivă se pot trage cu degetul. Dacă mișcarea sacadează, alege presetul **Mobil** din setările grafice.

Dacă aplicația Fișiere afișează HTML-ul doar ca previzualizare, pornește proiectul pe calculator:

```sh
npm install
npm run dev -- --host 0.0.0.0
```

Conectează telefonul și calculatorul la aceeași rețea Wi-Fi și deschide pe telefon adresa **Network** afișată de Vite. Folosește aceeași adresă la revenirea în joc pentru a păstra accesul la salvarea locală.

## Noutăți în 1.4

- Traseul plajă–pădure–tabără include bolovani, butuci și trunchiuri scanate, frunze căzute, pământ uzat și pânză de cort cu cute.
- Spuma se formează în jurul stâncilor ude, iar nisipul își schimbă culoarea ușor după val. Umbrele joase ancorează decorul.
- Inès își adaptează pașii la pantă și măsoară, consultă notițe sau urmărește repere, în funcție de oprire.
- În turn privești prin lunetă direct spre panourile din lume. Trage cu mouse-ul în lentilă sau folosește reglajul cu săgețile.
- Consultă cele două planșe din tabără și turn. La masa de lucru din arhivă le poți suprapune cu mouse-ul sau cu cele două reglaje înainte de a citi mesajul final. Salvările care au înregistrat deja mesajul rămân finalizate.

## Noutăți în 1.3

- Trunchiurile, bolovanii ieșiți din sol și buștenii blochează mersul și alergarea. Pe lângă margini, jucătorul poate aluneca lateral și ocoli. Pietricelele joase rămân traversabile.
- Pe lângă palmieri, insula are lauri, arbori-dragon, ficuși și pini insulari, cu trunchiuri ramificate, rădăcini și texturi de frunziș separate. Straturile de sub copaci includ plante cu frunze curbate și smocuri de iarbă în grupuri.
- Valurile ridică suprafața oceanului, spuma se deplasează spre plajă, iar bazinul cascadei are curenți, stropi și unde animate. Setarea **Scăzută** păstrează animația pe o plasă mai ușoară.
- Dacă o salvare veche te plasează în interiorul unui obstacol nou, jocul caută o poziție liberă în apropiere. Poziția corectată păstrează orientarea, timpul și progresul.

## Pornire din surse

Folosește Node.js **22.18+**. Din dosarul extras:

```sh
npm install
npm run dev
```

Deschide adresa pe care o afișează Vite. Pentru verificare și build:

```sh
npm run check
npm test
npm run build
```

Versiunea portabilă se află în `dist/The-Forgotten-Island.html`. Arhiva include și o copie la rădăcină. Notele de licență se găsesc în build.

## Verificare în browser și randări de inspecție

Cu serverul local pornit, instalează Chromium pentru Playwright prin `npx playwright install chromium` și rulează `npm run test:browser`. Poți seta `ISLAND_HEADED=1` pentru a urmări parcurgerile și `ISLAND_TEST_URL` pentru un port diferit. Testul folosește comenzile jocului, inclusiv mersul, documentele, puzzle-urile, harta, dialogul lui Inès și carnetul naturalistului. Detaliile despre executarea testelor din această ediție se găsesc în **TEST_REPORT.md**. Pentru verificarea interfeței și comenzilor în Firefox fără WebGL:

```sh
npx playwright install firefox
node tests/build-browser-frame.mjs ../island-browser-test
ISLAND_BROWSER_FIXTURE=../island-browser-test npm run test:browser
```

Modul de verificare afișează un cadru 2D. Jocul standard folosește WebGL 2. Pe Windows, setează variabila de mediu în PowerShell cu `$env:ISLAND_BROWSER_FIXTURE="../island-browser-test"` înainte de comanda npm.

Dosarul `randari-inspectie/` include capturi WebGL, randări Blender din modelele jocului și un cadru redat cu shaderul oceanului în OpenGL ES. Scripturile din `tests/` pot extrage geometria și pot compila materialele pe un driver OpenGL ES 3.

## Componente

- `src/world-data.ts`, `src/content.ts`, `src/landmarks.ts` · teren, trasee, repere și indiciile expediției
- `src/scene.tsx`, `src/vegetation.tsx`, `src/foliage-geometry.ts`, `src/water.tsx`, `src/island-materials.ts`, `src/structures.tsx` · geometrie, materiale, lumină și apă
- `src/character.tsx`, `src/surveyor.ts`, `src/player.tsx`, `src/navigation.ts` · personajele, mersul, camerele și traseul lui Inès
- `src/progress.ts`, `src/app.tsx`, `src/map.tsx`, `src/puzzles.tsx`, `src/i18n.ts`, `src/story-ro.ts` · progres, interfață și localizare

Jocul folosește materiale fotografice și ferigi CC0 de la Poly Haven, geometrie facială decupată din MakeHuman și resurse originale. Consultă **ASSETS_1_2.md** pentru surse și **DESIGN_1_2.md** pentru plan. **PLAN.md** și **GAME_DESIGN.md** documentează prima ediție. **UPDATE_PLAN.md** consemnează obiectivele actualizării.
