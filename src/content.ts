import type { PlaceId } from './world-data.ts'

export type PuzzleId = 'lockbox' | 'relay' | 'repair' | 'sight' | 'bearing' | 'tide'
export type Kind = 'inspect' | 'note' | 'part' | 'puzzle' | 'view' | 'secret' | 'relic' | 'ending'
type Common = { id:string; title:string; x:number; z:number; area:PlaceId; lift?:number; reach?:number }
export type Item = Common & (
  | { kind:'note'|'inspect'|'view'|'secret'|'relic'|'part'|'ending'; text:string }
  | { kind:'puzzle'; puzzle:PuzzleId }
)

export const items: Item[] = [
  {id:'wreck',kind:'inspect',title:'The survey skiff',x:17,z:190,area:'beach',reach:6,text:'The bow says ALBA III. Someone dragged it above the highest tide and removed the outboard. There is a waterproof folio on the crate beside the path.'},
  {id:'landing',kind:'note',title:'Landing log · 4 June 1986',x:26,z:182,area:'beach',text:'We cut a fork into the palms. Take the left branch to the orange survey shelter. Its lockbox holds the spare scope lens. For the code, match the word in the dispatch to the instrument numbers on the camp roster. — Mara Velea'},
  {id:'shell',kind:'relic',title:'Nacre survey tag',x:42,z:191,area:'beach',text:'A tag carved from a broken shell identifies the south landing. The pencil mark matches the expedition map.'},
  {id:'south-view',kind:'view',title:'Southern Breakwater',x:9,z:207,area:'beach',text:'Foam traces the submerged shelf. The ribs of the dock point towards the mainland.'},
  {id:'forest-note',kind:'note',title:'Trail crew’s field slip',x:-24,z:133,area:'forest',text:'We are marking the old paths with amber pennants. One spur slips behind the fallen palm. Leave the loop clear for the geologists.'},
  {id:'forest-secret',kind:'secret',title:'Fern Hollow',x:-76,z:124,area:'forest',text:'A sunken pocket behind the fallen palm shelters an unmarked instrument cache.'},
  {id:'compass',kind:'relic',title:'Brass pocket compass',x:-78,z:123,area:'forest',text:'The bezel is cut for sixteen points. The survey crew repeated old bearings instead of replacing the island’s markers.'},
  {id:'dispatch',kind:'note',title:'Evacuation dispatch',x:-71,z:58,area:'camp',text:'Dispatch word: WIND • BELL • SUN. Use the equipment roster in that exact order. The work barge leaves on the next ebb. Pack the scope lens in the coded case.'},
  {id:'roster',kind:'note',title:'Equipment roster',x:-62,z:64,area:'camp',text:'WIND — anemometer No. 4. SUN — sun recorder No. 2. BELL — signal bell No. 7. The relief at the ruins catalogues still older instruments.'},
  {id:'lockbox',kind:'puzzle',title:'Survey lockbox',x:-64,z:60,area:'camp',puzzle:'lockbox'},
  {id:'lens',kind:'part',title:'Scope lens',x:-66,z:60,area:'camp',text:'A polished objective lens in a felt collar. Its round fitting matches the separate objective socket on the observation scope.'},
  {id:'plate',kind:'relic',title:'Glass negative',x:-65,z:52,area:'camp',text:'The damaged plate shows cartographers measuring from the tower, with two ranging boards visible on the southeast slope.'},
  {id:'west-view',kind:'view',title:'Western Shelf',x:-151,z:73,area:'camp',text:'The camp’s wind records begin here. Above the edge, trade winds pull spray into long white bands.'},
  {id:'keeper',kind:'note',title:'Keeper’s survey · 1893',x:-110,z:-57,area:'falls',text:'Send the signs in weather order: rising air, full sun, then the falling tide. At the east slate, walk east-southeast from the post. Under the split rock, the sea chamber opens only at ebb. — L. Mureșan'},
  {id:'lamp',kind:'part',title:'Indicator lamp',x:-124,z:-56,area:'falls',text:'A spare low-voltage lamp. The scope uses it to backlight the etched reticle.'},
  {id:'falls-secret',kind:'secret',title:'The Keeper’s Cut',x:-126,z:-94,area:'falls',text:'A narrow cleft behind the waterfall once carried water to the keepers’ workbench.'},
  {id:'gauge',kind:'relic',title:'Stone rain gauge',x:-129,z:-93,area:'falls',text:'Its graduations show the keepers maintained weather records well before the expedition arrived.'},
  {id:'fall-view',kind:'view',title:'Basalt Overlook',x:-131,z:-51,area:'falls',text:'Two separate curtains of water meet in the shallow bowl. A mossy footpath continues on their western side.'},
  {id:'relief',kind:'note',title:'Semaphore relief',x:-1,z:-44,area:'ruins',text:'△ Rising air. ○ Full sun. ≋ Falling tide. ◇ Signal bell. The four engravings once encoded daily observations. The keeper’s survey gives the order for the service relay.'},
  {id:'relay',kind:'puzzle',title:'Semaphore relay',x:6,z:-44,area:'ruins',puzzle:'relay'},
  {id:'tile',kind:'relic',title:'Terracotta semaphore tile',x:12,z:-37,area:'ruins',text:'A mason drew three weather symbols on this test tile. The bell was added later.'},
  {id:'rivet',kind:'relic',title:'Numbered tower rivet',x:70,z:-96,area:'tower',text:'The lot number dates it to the restoration. The original tower was just a timber ladder bolted to the ridge.'},
  {id:'tower-log',kind:'note',title:'Scope operator’s card',x:77.2,z:-105.5,area:'tower',lift:6.2,text:'Fit the objective lens and the indicator lamp. Sight southeast. The two amber ranging boards must merge in the middle of the reticle. The pale notch beyond them marks the split rock.'},
  {id:'repair',kind:'puzzle',title:'Scope service panel',x:79.2,z:-108,area:'tower',lift:6.2,puzzle:'repair',reach:3.1},
  {id:'sight',kind:'puzzle',title:'Ranging scope',x:78,z:-112,area:'tower',lift:6.2,puzzle:'sight',reach:3.2},
  {id:'tower-view',kind:'view',title:'The Signal Balcony',x:78,z:-110.5,area:'tower',lift:6.2,text:'Above the canopy, a pair of amber ranging boards straddles the long diagonal to the coast.'},
  {id:'north-secret',kind:'secret',title:'The Northern Traverse',x:105,z:-156,area:'tower',text:'Stone steps lead to an old triangulation point, hidden below the tower’s northern ridge.'},
  {id:'button',kind:'relic',title:'Enamel signal badge',x:107,z:-156,area:'tower',text:'A bird and a tide line are stamped in blue enamel. It belonged to the old coastal service.'},
  {id:'bearing',kind:'puzzle',title:'East survey slate',x:121,z:18,area:'coast',puzzle:'bearing'},
  {id:'coast-note',kind:'note',title:'Tide wheel instructions',x:154,z:34.5,area:'coast',text:'The counterweight is safest with water running out. HIGH and FLOOD load the lower hinges. SLACK leaves the bolt engaged. Use the setting recorded by the keeper.'},
  {id:'coast-secret',kind:'secret',title:'Pocket Cove',x:186,z:-16,area:'coast',text:'A pale ribbon of sand is protected by a double wall of dark stone. Survey numbers survive above the spring tide line.'},
  {id:'float',kind:'relic',title:'Cork marker float',x:186,z:-18,area:'coast',text:'The counterweighted float still carries a faded survey stripe.'},
  {id:'east-view',kind:'view',title:'East Head Lookout',x:184,z:-14,area:'coast',text:'The bay lies beneath tall rock shoulders. Far offshore, shallows fade from green to indigo.'},
  {id:'bottle',kind:'relic',title:'Green instrument bottle',x:111,z:65,area:'coast',text:'Someone reused a broken instrument case as a container for repair notes and spare screws.'},
  {id:'tide',kind:'puzzle',title:'Archive tide wheel',x:156,z:38,area:'coast',puzzle:'tide',reach:4.5},
  {id:'recorder',kind:'relic',title:'Mechanical tide recorder',x:171,z:35,area:'archive',text:'A clockwork stylus transferred water height onto these paper rolls. The recorder outlasted both the semaphore and the survey barge.'},
  {id:'final',kind:'ending',title:'Mara’s final dispatch',x:174.4,z:39.7,area:'archive',text:'The island did not vanish. Its survey sheets did. Once the new lighthouse opened, the chart office copied only the active stations and erased this one. Our field data proves the old keepers measured a shifting shoal that the newer charts missed. The winter storm cut our fuel and brought forward the evacuation. We sealed the originals here, as the keepers had done before us. If you found this, the island can finally go back on the chart.'}
]
export const itemsById = Object.fromEntries(items.map(item=>[item.id,item]))
export const relics = items.filter(item=>item.kind==='relic')
export const views = items.filter(item=>item.kind==='view')
export const secrets = items.filter(item=>item.kind==='secret')
export const puzzleIds: PuzzleId[] = ['lockbox','relay','repair','sight','bearing','tide']
