// Die Löcher (Bahnen) des Spiels.
// Das Spielfeld ist immer 400 breit und 700 hoch.
// start: wo der Ball beginnt, hole: wo das Loch ist,
// walls: Hindernisse als Rechtecke { x, y, w, h }.
// par: so viele Schläge braucht ein guter Spieler.

const HOLES = [
  {
    name: "Aufwärmen",
    par: 2,
    start: { x: 200, y: 600 },
    hole: { x: 200, y: 130 },
    walls: [],
  },
  {
    name: "Die Mauer",
    par: 3,
    start: { x: 100, y: 610 },
    hole: { x: 300, y: 110 },
    walls: [
      { x: 0, y: 340, w: 270, h: 24 },
    ],
  },
  {
    name: "Slalom",
    par: 4,
    start: { x: 320, y: 620 },
    hole: { x: 80, y: 100 },
    walls: [
      { x: 130, y: 470, w: 270, h: 22 },
      { x: 0, y: 300, w: 270, h: 22 },
      { x: 180, y: 180, w: 22, h: 120 },
    ],
  },
];
