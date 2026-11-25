import type { Item } from './content.ts'
import type { Language } from './i18n.ts'

const story:Record<string,readonly [title:string,text?:string]>={
  wreck:['Barca topografilor','Pe provă scrie ALBA III. Cineva a tras barca deasupra liniei celei mai înalte maree și a scos motorul. Pe lada de lângă potecă se află un dosar impermeabil.'],
  landing:['Jurnalul debarcării · 4 iunie 1986','Am deschis o bifurcație printre palmieri. Ia ramura din stânga spre adăpostul portocaliu. Caseta încuiată păstrează lentila de rezervă a lunetei. Pentru cifru, caută în lista echipamentului numerele instrumentelor din mesaj. — Mara Velea'],
  shell:['Etichetă din sidef','O etichetă cioplită dintr-o scoică marchează debarcaderul sudic. Semnul în creion corespunde celui de pe harta expediției.'],
  'south-view':['Digul Sudic','Spuma desenează marginea platformei scufundate. Grinzile rămase din ponton indică direcția continentului.'],
  'forest-note':['Biletul echipei de teren','Marcăm cu fanioane ocru potecile vechi. O ramificație trece în spatele palmierului căzut. Lăsați circuitul liber pentru geologi.'],
  'forest-secret':['Poiana Ferigilor','În depresiunea din spatele palmierului căzut se află un depozit de instrumente nemarcat pe hartă.'],
  compass:['Busolă de buzunar din alamă','Inelul busolei are șaisprezece gradații. Echipa folosea direcțiile vechi ca să poată păstra reperele existente.'],
  dispatch:['Mesajul de evacuare','Ordinea din mesaj este VÂNT • CLOPOT • SOARE. Folosiți lista echipamentului exact în această ordine. Barja pleacă la următorul reflux. Puneți lentila lunetei în caseta cu cifru.'],
  roster:['Lista echipamentului','VÂNT — anemometrul nr. 4. SOARE — heliograful nr. 2. CLOPOT — clopotul de semnal nr. 7. Relieful din ruine inventariază instrumente și mai vechi.'],
  lockbox:['Caseta cu cifru'],
  lens:['Lentila lunetei','Lentila obiectivului e lustruită și protejată cu pâslă. Montura rotundă se potrivește în suportul frontal al lunetei.'],
  plate:['Negativ pe sticlă','Placa deteriorată îi arată pe cartografi măsurând din turn. Pe panta sud-estică se văd două panouri de vizare.'],
  'west-view':['Platforma Vestică','Aici încep măsurătorile de vânt ale taberei. Deasupra falezei, alizeele întind stropii în dâre albe.'],
  keeper:['Însemnarea paznicului · 1893','Trimite semnalele în ordinea vremii: aerul se ridică, soarele arde puternic, apoi mareea scade. Din dreptul plăcii de est, mergi spre est-sud-est. Sub stânca despicată, camera de la mare se deschide doar la reflux. — L. Mureșan'],
  lamp:['Lampă indicatoare','O lampă de rezervă de joasă tensiune. În lunetă, ea luminează reticulul gravat.'],
  'falls-secret':['Trecătoarea Paznicului','Fisura din spatele cascadei ducea cândva apa la bancul de lucru al paznicilor.'],
  gauge:['Pluviometru de piatră','Gradațiile arată că paznicii țineau evidențe meteo cu mult înainte de sosirea expediției.'],
  'fall-view':['Belvederea de Bazalt','Două perdele de apă se întâlnesc în bazinul puțin adânc. O potecă îmbrăcată în mușchi continuă pe latura vestică.'],
  relief:['Relieful semaforului','△ Aer ascendent. ○ Soare puternic. ≋ Maree în scădere. ◇ Clopot de semnal. Cele patru gravuri codificau observațiile zilnice. Însemnarea paznicului păstrează ordinea pentru releu.'],
  relay:['Releul semaforului'],
  tile:['Placă de semafor din teracotă','Un zidar a trasat trei simboluri meteo pe această placă de probă. Clopotul a fost adăugat mai târziu.'],
  rivet:['Nit numerotat al turnului','Numărul lotului datează din timpul restaurării. La început aici era doar o scară de lemn fixată de creastă.'],
  'tower-log':['Fișa operatorului de lunetă','Montează lentila și lampa indicatoare. Privește spre sud-est. Cele două panouri de culoarea chihlimbarului trebuie să se suprapună în centrul reticulului. Crestătura deschisă din spate marchează stânca despicată.'],
  repair:['Panoul de service al lunetei'],
  sight:['Luneta de vizare'],
  'tower-view':['Balconul Semaforului','Deasupra coroanelor, cele două panouri de vizare se află pe diagonala lungă care coboară spre coastă.'],
  'north-secret':['Traversarea Nordică','Trepte săpate în piatră duc la un vechi punct de triangulație, sub creasta nordică a turnului.'],
  button:['Insignă emailată de semnalizare','O pasăre și o linie de maree sunt desenate în email albastru. Insigna a aparținut vechiului serviciu de coastă.'],
  bearing:['Placa topografică de est'],
  'coast-note':['Instrucțiunile roții mareei','Contragreutatea este în siguranță când apa se retrage. MAREE ÎNALTĂ și FLUX solicită balamalele de jos. APA STAȚIONARĂ lasă zăvorul blocat. Folosește setarea consemnată de paznic.'],
  'coast-secret':['Golful Adăpostit','O fâșie de nisip deschis este protejată de două ziduri de piatră întunecată. Numerele topografice se mai văd deasupra liniei mareelor mari.'],
  float:['Plutitor din plută','Plutitorul cu contragreutate mai păstrează o dungă topografică decolorată.'],
  'east-view':['Belvederea Capului Estic','Golful se întinde sub pereții de stâncă. Mai departe de țărm, verdele apei puțin adânci trece în indigo.'],
  bottle:['Flacon verde pentru instrumente','Cineva a refolosit carcasa unui instrument stricat ca să păstreze șuruburi de rezervă și note de reparație.'],
  tide:['Roata mareei a arhivei'],
  recorder:['Mareograf mecanic','Un ac acționat de ceasornic înregistra înălțimea apei pe role de hârtie. Aparatul a rezistat mai mult decât semaforul și barja expediției.'],
  final:['Ultimul mesaj al Marei','Insula n-a dispărut. Au dispărut foile ei topografice. Când s-a deschis noul far, biroul cartografic a copiat numai stațiile active și a șters-o pe aceasta. Măsurătorile noastre arată că vechii paznici urmăreau un banc de nisip mișcător, omis pe hărțile noi. Furtuna de iarnă ne-a lăsat fără combustibil și a grăbit evacuarea. Am sigilat aici documentele originale, așa cum făcuseră și paznicii. Dacă ai găsit mesajul, insula își poate recăpăta locul pe hartă.'],
}
export function localItem(item:Item,language:Language){
  const translated=language==='ro'?story[item.id]:undefined
  return { title:translated?.[0]??item.title,text:translated?.[1]??('text' in item?item.text:'') }
}
