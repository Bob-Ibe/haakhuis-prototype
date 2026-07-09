/* ===================================================================
   Haakhuis Carnaval Atelier — data (v2, echte kledingstukken)
   6 modellen · 3 fotorealistische carnavalsjassen (ghost mannequin,
   4 aanzichten per sheet) · wisselbare onderdelen via foto-regio's:
   kraag / mouwen / middenstuk / zoom · kleurvarianten via hue-shift
   =================================================================== */

const MODELS = [
  { id: 'meisje',       naam: 'Meisje',       sub: '± 7 jaar',  type: 'child', img: 'assets/models/raw-meisje.jpg' },
  { id: 'jongen',       naam: 'Jongen',       sub: '± 7 jaar',  type: 'child', img: 'assets/models/raw-jongen.jpg' },
  { id: 'tienermeisje', naam: 'Tiener (m)',   sub: '± 15 jaar', type: 'teen',  img: 'assets/models/raw-tienermeisje.jpg' },
  { id: 'tienerjongen', naam: 'Tiener (j)',   sub: '± 15 jaar', type: 'teen',  img: 'assets/models/raw-tienerjongen.jpg' },
  { id: 'vrouw',        naam: 'Vrouw',        sub: 'volwassen', type: 'adult', img: 'assets/models/raw-vrouw.jpg' },
  { id: 'man',          naam: 'Man',          sub: 'volwassen', type: 'adult', img: 'assets/models/raw-man.jpg' },
];

/* lichaamsverhoudingen als fractie van de figuurhoogte */
const FRACTIONS = {
  adult: { headH: .135, shoulder: .175, waist: .415, hip: .50 },
  teen:  { headH: .150, shoulder: .190, waist: .425, hip: .51 },
  child: { headH: .185, shoulder: .215, waist: .445, hip: .53 },
};

/* zes kijkrichtingen: 4 gefotografeerde aanzichten + 2 gespiegelde */
const VIEWS = [
  { id: 'front',    crop: 0, mirror: false, label: 'Voorkant' },
  { id: 'threeq',   crop: 1, mirror: false, label: 'Schuin links' },
  { id: 'side',     crop: 2, mirror: false, label: 'Zijkant links' },
  { id: 'back',     crop: 3, mirror: false, label: 'Achterkant' },
  { id: 'side-r',   crop: 2, mirror: true,  label: 'Zijkant rechts' },
  { id: 'threeq-r', crop: 1, mirror: true,  label: 'Schuin rechts' },
];

/* ------------------------------------------------------------------
   De drie kledingstukken (echte productfoto's, zelfde silhouet)
   ------------------------------------------------------------------ */
const GARMENTS = [
  {
    id: 'prins', naam: 'Prinsenjas', sub: 'Koningsblauw & goudgalon',
    img: 'assets/garments/jas-prins.jpg',
    prijzen: { kraag: 29.95, mouwen: 64.95, midden: 109.00, zoom: 44.95 },
  },
  {
    id: 'harlekijn', naam: 'Harlekijnjas', sub: 'Rood & geel geruit',
    img: 'assets/garments/jas-harlekijn.jpg',
    prijzen: { kraag: 24.95, mouwen: 54.95, midden: 94.00, zoom: 39.95 },
  },
  {
    id: 'wiever', naam: 'Brokaatjas', sub: 'Bordeaux & goud brokaat',
    img: 'assets/garments/jas-wiever.jpg',
    prijzen: { kraag: 34.95, mouwen: 69.95, midden: 119.00, zoom: 49.95 },
  },
];

/* wisselbare onderdelen */
const GSLOTS = [
  { id: 'kraag',  naam: 'Kraag' },
  { id: 'mouwen', naam: 'Mouwen' },
  { id: 'midden', naam: 'Middenstuk' },
  { id: 'zoom',   naam: 'Zoom & panden' },
];

/* garen-kleurvarianten: hue-shift op de echte stof */
const KLEUREN = [
  { naam: 'Origineel',     filter: '' },
  { naam: 'Koel getint',   filter: 'hue-rotate(150deg) saturate(.92)' },
  { naam: 'Warm getint',   filter: 'hue-rotate(-115deg) saturate(.95)' },
];

/* ------------------------------------------------------------------
   Foto-regio's per onderdeel, genormaliseerd t.o.v. de garment-crop.
   feather = zijden met zachte overloop ('l','r','t','b'), zodat de
   naad tussen delen van verschillende jassen onzichtbaar blijft.
   Tekenvolgorde: midden → zoom → mouwen → kraag.
   ------------------------------------------------------------------ */
const REGIONS = {
  /* front, threeq en back gebruiken dezelfde indeling */
  front: {
    midden: [{ x0: .16, y0: .025, x1: .84, y1: 1,   feather: [] }],
    zoom:   [{ x0: .17, y0: .70,  x1: .83, y1: 1,   feather: ['t'] }],
    mouwen: [{ x0: 0,   y0: .015, x1: .315, y1: .82, feather: ['r', 'b'] },
             { x0: .685, y0: .015, x1: 1,   y1: .82, feather: ['l', 'b'] }],
    kraag:  [{ x0: .28, y0: 0,    x1: .72, y1: .135, feather: ['b'] }],
  },
  side: {
    midden: [{ x0: 0,   y0: .02, x1: 1,   y1: 1,   feather: [] }],
    zoom:   [{ x0: 0,   y0: .70, x1: 1,   y1: 1,   feather: ['t'] }],
    mouwen: [{ x0: .18, y0: .05, x1: .88, y1: .68,  feather: ['l', 'r', 'b'] }],
    kraag:  [{ x0: .05, y0: 0,   x1: .95, y1: .13,  feather: ['b'] }],
  },
};
const regionsFor = (viewId) => REGIONS[viewId.startsWith('side') ? 'side' : 'front'];

/* volgorde waarin de onderdelen over elkaar getekend worden */
const DRAW_ORDER = ['midden', 'zoom', 'mouwen', 'kraag'];

const garmentById = (id) => GARMENTS.find(g => g.id === id);
const euro = (n) => '€ ' + n.toFixed(2).replace('.', ',');
