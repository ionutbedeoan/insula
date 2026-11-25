# Actualizarea insulei

1. Păstrez coordonatele indiciilor, ordinea puzzle-urilor și compatibilitatea salvărilor. Româna devine limba implicită. Engleza poate fi selectată din setări.
2. Îmbunătățesc relieful, materialele și marcajele potecilor. Adaug umbre locale, vegetație structurată în straturi și materiale procedurale pentru lemn, pânză, metal și rocă.
3. Refac apa și cascada cu valuri, reflexii, spumă și efecte de pulverizare.
4. Adaug un personaj autonom pe un traseu natural, în apropierea jucătorului de la început. Animez mersul și pauzele de observație. Adaug o cameră la persoana a treia pentru propriul personaj.
5. Refac harta cu altimetrie, zone descoperite, zoom, deplasare și repere de teren.
6. Verific regresiile din prima versiune și testez localizarea, animațiile, traseul personajului, camerele, harta și noua scenă. Încerc testele cu browser real și documentez separat orice limită a mediului.

## Ediția 1.3

1. Folosesc aceleași poziții și dimensiuni pentru modelele de decor și pentru coliziunile esențiale. Verific lovirea frontală la viteză, alunecarea la contact și recuperarea salvărilor vechi.
2. Păstrez distribuția deterministă și modelez coroane distincte pentru laur, arbore-dragon, ficus și pin. Verific frunzișul de aproape, din potecă și din tabără.
3. Construiesc o plasă de apă cu rezoluție mai mare lângă coastă. Validez deplasarea valurilor, spuma, reflexiile, pelicula umedă de pe nisip și animația cascadei.
4. Refac ambele parcurgeri în browser și inspectez cadrele randate. În raport consemnez separat validarea jocului și verificarea scenei cu OpenGL ES.

## Ediția 1.4

- Modelez manual primele priveliști ale traseului de la barcă la tabără. Folosesc repere scanate, margini de potecă neregulate și urme de uzură la sol. Păstrez accesul la documente și traseul lui Inès.
- Integrez umbrele locale, umezeala nisipului și reacția spumei în jurul stâncilor. Compar cadre de la nivelul jucătorului.
- Animez pașii lui Inès cu sprijin pe teren și adaug gesturi specifice stațiilor.
- Mut vederea lunetei în scena 3D. Unghiul ales comandă camera din turn, iar mecanismul păstrează soluția, indiciile și accesul din tastatură.
- Introduc două foi de hartă care pot fi comparate pe traseu și suprapuse în arhivă. Validez că jucătorul poate relua din salvare, poate reciti finalul și îl obține după suprapunere.
- Verific versiunea autonomă, testele de regresie, ambele parcurgeri și randarea cu instrumentele disponibile.
