/* ===================================================================
   Voorgebakken kalibratie (crops + lichaamsbreedtes per aanzicht).
   Hierdoor werkt het prototype ook zonder webserver (file://):
   de pixels hoeven dan niet meer runtime uitgelezen te worden.
   Gemeten met Engine._segment() op de originele sheets (2752×1536).
   Garment-entries staan onder CAL.garments.
   =================================================================== */

const SHEET = { w: 2752, h: 1536 };

const CAL = {
  models: {
    meisje: [
      { x: 0, y: 89, w: 594, h: 1466, bands: { head: { w: 275, c: 350 }, chest: { w: 342, c: 348 }, hip: { w: 338, c: 342 }, leg: { w: 208, c: 344 } } },
      { x: 599, y: 89, w: 625, h: 1466, bands: { head: { w: 244, c: 991 }, chest: { w: 267, c: 1014 }, hip: { w: 287, c: 1048 }, leg: { w: 173, c: 1003 } } },
      { x: 1300, y: 93, w: 612, h: 1462, bands: { head: { w: 212, c: 1694 }, chest: { w: 193, c: 1700 }, hip: { w: 177, c: 1696 }, leg: { w: 106, c: 1677 } } },
      { x: 1928, y: 89, w: 700, h: 1466, bands: { head: { w: 291, c: 2382 }, chest: { w: 354, c: 2379 }, hip: { w: 346, c: 2379 }, leg: { w: 212, c: 2379 } } },
    ],
    jongen: [
      { x: 0, y: 62, w: 643, h: 1429, bands: { head: { w: 177, c: 360 }, chest: { w: 385, c: 362 }, hip: { w: 421, c: 360 }, leg: { w: 252, c: 362 } } },
      { x: 628, y: 62, w: 612, h: 1429, bands: { head: { w: 201, c: 1048 }, chest: { w: 307, c: 1054 }, hip: { w: 330, c: 1018 }, leg: { w: 216, c: 1060 } } },
      { x: 1307, y: 62, w: 555, h: 1425, bands: { head: { w: 220, c: 1718 }, chest: { w: 197, c: 1730 }, hip: { w: 197, c: 1734 }, leg: { w: 114, c: 1740 } } },
      { x: 2144, y: 62, w: 480, h: 1421, bands: { head: { w: 177, c: 2384 }, chest: { w: 389, c: 2384 }, hip: { w: 417, c: 2386 }, leg: { w: 259, c: 2386 } } },
    ],
    tienermeisje: [
      { x: 0, y: 78, w: 577, h: 1413, bands: { head: { w: 157, c: 334 }, chest: { w: 338, c: 338 }, hip: { w: 342, c: 332 }, leg: { w: 208, c: 336 } } },
      { x: 834, y: 78, w: 352, h: 1409, bands: { head: { w: 161, c: 1004 }, chest: { w: 267, c: 991 }, hip: { w: 287, c: 1020 }, leg: { w: 181, c: 987 } } },
      { x: 1607, y: 78, w: 247, h: 1405, bands: { head: { w: 173, c: 1742 }, chest: { w: 216, c: 1728 }, hip: { w: 189, c: 1738 }, leg: { w: 110, c: 1734 } } },
      { x: 2196, y: 78, w: 405, h: 1405, bands: { head: { w: 161, c: 2396 }, chest: { w: 346, c: 2394 }, hip: { w: 358, c: 2396 }, leg: { w: 212, c: 2394 } } },
    ],
    tienerjongen: [
      { x: 0, y: 62, w: 647, h: 1438, bands: { head: { w: 169, c: 360 }, chest: { w: 377, c: 362 }, hip: { w: 432, c: 358 }, leg: { w: 259, c: 358 } } },
      { x: 630, y: 62, w: 638, h: 1433, bands: { head: { w: 185, c: 1040 }, chest: { w: 307, c: 1022 }, hip: { w: 346, c: 1058 }, leg: { w: 228, c: 1018 } } },
      { x: 1587, y: 62, w: 238, h: 1429, bands: { head: { w: 204, c: 1710 }, chest: { w: 177, c: 1692 }, hip: { w: 181, c: 1694 }, leg: { w: 114, c: 1689 } } },
      { x: 2148, y: 62, w: 489, h: 1429, bands: { head: { w: 169, c: 2388 }, chest: { w: 381, c: 2388 }, hip: { w: 432, c: 2390 }, leg: { w: 259, c: 2390 } } },
    ],
    vrouw: [
      { x: 18, y: 73, w: 550, h: 1482, bands: { head: { w: 138, c: 356 }, chest: { w: 342, c: 356 }, hip: { w: 377, c: 346 }, leg: { w: 212, c: 350 } } },
      { x: 691, y: 73, w: 524, h: 1482, bands: { head: { w: 157, c: 1026 }, chest: { w: 271, c: 1004 }, hip: { w: 299, c: 1038 }, leg: { w: 185, c: 997 } } },
      { x: 1480, y: 73, w: 401, h: 1482, bands: { head: { w: 181, c: 1714 }, chest: { w: 185, c: 1712 }, hip: { w: 173, c: 1734 }, leg: { w: 102, c: 1742 } } },
      { x: 2066, y: 73, w: 542, h: 1482, bands: { head: { w: 142, c: 2382 }, chest: { w: 350, c: 2384 }, hip: { w: 377, c: 2390 }, leg: { w: 212, c: 2390 } } },
    ],
    man: [
      { x: 0, y: 49, w: 700, h: 1506, bands: { head: { w: 142, c: 334 }, chest: { w: 401, c: 334 }, hip: { w: 421, c: 328 }, leg: { w: 271, c: 328 } } },
      { x: 682, y: 49, w: 700, h: 1506, bands: { head: { w: 157, c: 1038 }, chest: { w: 318, c: 1012 }, hip: { w: 334, c: 1071 }, leg: { w: 240, c: 1028 } } },
      { x: 1370, y: 49, w: 700, h: 1506, bands: { head: { w: 173, c: 1722 }, chest: { w: 201, c: 1704 }, hip: { w: 193, c: 1704 }, leg: { w: 122, c: 1692 } } },
      { x: 2058, y: 49, w: 700, h: 1506, bands: { head: { w: 142, c: 2410 }, chest: { w: 405, c: 2412 }, hip: { w: 409, c: 2418 }, leg: { w: 271, c: 2416 } } },
    ],
  },
  garments: {
    prins: [
      { x: 25, y: 228, w: 700, h: 1101, bands: { head: { w: 311, c: 375 }, chest: { w: 562, c: 375 }, hip: { w: 602, c: 375 }, leg: { w: 625, c: 375 } } },
      { x: 800, y: 228, w: 616, h: 1105, bands: { head: { w: 259, c: 1065 }, chest: { w: 480, c: 1077 }, hip: { w: 507, c: 1095 }, leg: { w: 511, c: 1128 } } },
      { x: 1570, y: 228, w: 339, h: 1110, bands: { head: { w: 181, c: 1730 }, chest: { w: 283, c: 1734 }, hip: { w: 267, c: 1730 }, leg: { w: 244, c: 1757 } } },
      { x: 2044, y: 228, w: 674, h: 1114, bands: { head: { w: 311, c: 2380 }, chest: { w: 562, c: 2380 }, hip: { w: 598, c: 2382 }, leg: { w: 598, c: 2382 } } },
    ],
    harlekijn: [
      { x: 25, y: 224, w: 709, h: 1114, bands: { head: { w: 236, c: 377 }, chest: { w: 562, c: 379 }, hip: { w: 602, c: 379 }, leg: { w: 633, c: 379 } } },
      { x: 800, y: 224, w: 616, h: 1114, bands: { head: { w: 208, c: 1083 }, chest: { w: 480, c: 1077 }, hip: { w: 507, c: 1095 }, leg: { w: 511, c: 1128 } } },
      { x: 1570, y: 224, w: 343, h: 1118, bands: { head: { w: 177, c: 1736 }, chest: { w: 279, c: 1740 }, hip: { w: 275, c: 1730 }, leg: { w: 240, c: 1759 } } },
      { x: 2043, y: 219, w: 682, h: 1126, bands: { head: { w: 212, c: 2382 }, chest: { w: 562, c: 2384 }, hip: { w: 602, c: 2384 }, leg: { w: 605, c: 2386 } } },
    ],
    wiever: [
      { x: 25, y: 200, w: 709, h: 1134, bands: { head: { w: 169, c: 379 }, chest: { w: 558, c: 377 }, hip: { w: 605, c: 377 }, leg: { w: 633, c: 379 } } },
      { x: 804, y: 204, w: 621, h: 1138, bands: { head: { w: 197, c: 1085 }, chest: { w: 476, c: 1079 }, hip: { w: 511, c: 1097 }, leg: { w: 519, c: 1132 } } },
      { x: 1574, y: 200, w: 343, h: 1142, bands: { head: { w: 169, c: 1728 }, chest: { w: 283, c: 1742 }, hip: { w: 275, c: 1734 }, leg: { w: 244, c: 1765 } } },
      { x: 2051, y: 199, w: 678, h: 1150, bands: { head: { w: 169, c: 2392 }, chest: { w: 558, c: 2390 }, hip: { w: 598, c: 2390 }, leg: { w: 602, c: 2392 } } },
    ],
  },
};
