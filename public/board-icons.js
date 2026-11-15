// One icon set for every Board dock and menu. 20×20, 1.6 stroke, round ends.
// Each picture shows what the button does, and no two actions share a picture.
// Like SF Symbols (5.83), an icon can have layers: { d } is the line drawing,
// { fill } a soft tinted body under it (hierarchical), { solid } a filled part.
const dot = (x, y, r = 1) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const corners = "M3 7V4.5A1.5 1.5 0 014.5 3H7M13 3h2.5A1.5 1.5 0 0117 4.5V7M17 13v2.5a1.5 1.5 0 01-1.5 1.5H13M7 17H4.5A1.5 1.5 0 013 15.5V13";
export const DDboardIcons = {
  // Tools
  select: { solid: "M5.6 3.5l10 6.1c.6.4.5 1.3-.2 1.4l-4.4 1-2.2 3.9c-.3.6-1.3.5-1.4-.2L5.6 3.5z" },
  hand: "M7.2 10.6V5.3a1.3 1.3 0 012.6 0v4.3M9.8 9.6V3.9a1.3 1.3 0 012.6 0v5.7M12.4 9.6V5.4a1.3 1.3 0 012.6 0v6.4c0 2.9-2.3 5.2-5.2 5.2h-.4a4.8 4.8 0 01-3.9-2L4 12.1a1.3 1.3 0 012-1.7l1.2 1.3",
  task: { fill: "M6.5 3h7A3.5 3.5 0 0117 6.5v7a3.5 3.5 0 01-3.5 3.5h-7A3.5 3.5 0 013 13.5v-7A3.5 3.5 0 016.5 3z", d: "M6.5 3h7A3.5 3.5 0 0117 6.5v7a3.5 3.5 0 01-3.5 3.5h-7A3.5 3.5 0 013 13.5v-7A3.5 3.5 0 016.5 3zM6.7 10.2l2.3 2.3 4.4-4.8" },
  note: { fill: "M5.5 3h9A2.5 2.5 0 0117 5.5V11l-6 6H5.5A2.5 2.5 0 013 14.5v-9A2.5 2.5 0 015.5 3z", d: "M5.5 3h9A2.5 2.5 0 0117 5.5V11l-6 6H5.5A2.5 2.5 0 013 14.5v-9A2.5 2.5 0 015.5 3zM11 17v-3.5a2.5 2.5 0 012.5-2.5H17" },
  section: { fill: "M5.5 7.5h9A2.5 2.5 0 0117 10v4.5a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 013 14.5V10a2.5 2.5 0 012.5-2.5z", d: "M5.5 7.5h9A2.5 2.5 0 0117 10v4.5a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 013 14.5V10a2.5 2.5 0 012.5-2.5z", solid: "M4.6 2.9h3.8a1.25 1.25 0 010 2.5H4.6a1.25 1.25 0 010-2.5z" },
  sticker: { fill: "M10 2.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15z", d: "M10 2.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15zM6.8 11.6c1.7 2 4.7 2 6.4 0" + dot(7.6, 8, 0.4) + dot(12.4, 8, 0.4) },
  // View
  snap: "M4 3h4v7a2 2 0 004 0V3h4v7a6 6 0 01-12 0zM4 6.5h4M12 6.5h4",
  grid: [5, 10, 15].flatMap((y) => [5, 10, 15].map((x) => dot(x, y, 0.65))).join(""),
  map: { d: "M4.5 4h11A2 2 0 0117.5 6v8a2 2 0 01-2 2h-11a2 2 0 01-2-2V6a2 2 0 012-2z", solid: "M11.3 9.6h3.4a.6.6 0 01.6.6v3a.6.6 0 01-.6.6h-3.4a.6.6 0 01-.6-.6v-3a.6.6 0 01.6-.6z" },
  settings: "M3 6h8M15 6h2M13 4a2 2 0 110 4 2 2 0 010-4zM3 14h2M9 14h8M7 12a2 2 0 110 4 2 2 0 010-4z",
  fitAll: corners + dot(7.5, 8, 1) + dot(12.5, 8.5, 1) + dot(9.5, 12.5, 1),
  fit: corners + "M7.5 7.5h5v5h-5z",
  fitDay: corners + dot(10, 10, 2.4),
  expand: "M12 3h5v5M17 3l-5.5 5.5M8 17H3v-5M3 17l5.5-5.5",
  shrink: "M16 8h-4.5V3.5M11.5 8.5L17 3M4 12h4.5v4.5M8.5 11.5L3 17",
  zoom: { fill: "M8.5 3a5.5 5.5 0 110 11 5.5 5.5 0 010-11z", d: "M8.5 3a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM13 13l4 4" },
  zoomIn: "M8.5 3a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM13 13l4 4M8.5 6v5M6 8.5h5",
  minus: "M4 10h12",
  plus: "M10 4v12M4 10h12",
  // Places
  engine: "M8.4 4.2L8.6 2.1h2.8l.2 2.1 1.4.6 1.6-1.3 1.9 1.9-1.3 1.6.6 1.4 2.1.2v2.8l-2.1.2-.6 1.4 1.3 1.6-1.9 1.9-1.6-1.3-1.4.6-.2 2.1H8.6l-.2-2.1-1.4-.6-1.6 1.3-1.9-1.9 1.3-1.6-.6-1.4-2.1-.2V8.6l2.1-.2.6-1.4-1.3-1.6 1.9-1.9L7 4.8zM10 7.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z",
  leaf: { fill: "M4.5 15.5C4.5 8 8.5 3.5 16.5 3.5c0 8-4.5 12-12 12z", d: "M4.5 15.5C4.5 8 8.5 3.5 16.5 3.5c0 8-4.5 12-12 12zM4.5 15.5l6.5-6.5M3 17l1.5-1.5" },
  sections: "M4 3.5h2.5M10 4.5h7M4 3.5V16M4 10h3M10 10h7M4 16h3M10 16h7",
  enter: "M9 4H5a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-4M12 3h5v5M17 3l-7 7",
  goal: { fill: "M5 3.5h9.5l-2.3 3.2 2.3 3.3H5z", d: "M5 18V3M5 3.5h9.5l-2.3 3.2 2.3 3.3H5" },
  lines: { fill: "M6 2.8h5.5L15.5 7v8.7A1.5 1.5 0 0114 17.2H6a1.5 1.5 0 01-1.5-1.5V4.3A1.5 1.5 0 016 2.8z", d: "M6 2.8h5.5L15.5 7v8.7A1.5 1.5 0 0114 17.2H6a1.5 1.5 0 01-1.5-1.5V4.3A1.5 1.5 0 016 2.8zM11.5 2.8V7h4M7.5 10.3h5M7.5 13.3h3.5" },
  habit: "M16.5 10a6.5 6.5 0 11-2-4.7M16.5 3v3.2h-3.2M7.2 10.2l2 2 3.8-4",
  // History and help
  undo: "M7.5 4.5L4 8l3.5 3.5M4 8h8a4.5 4.5 0 010 9H9",
  redo: "M12.5 4.5L16 8l-3.5 3.5M16 8H8a4.5 4.5 0 000 9h3",
  help: { fill: "M10 2.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15z", d: "M10 2.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15zM7.7 7.6A2.4 2.4 0 0112.4 8c0 1.7-2.4 2-2.4 3.6" + dot(10, 14.2, 0.4) },
  info: { fill: "M10 2.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15z", d: "M10 2.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15zM10 9v5" + dot(10, 6.2, 0.4) },
  timer: { fill: "M10 5a6 6 0 110 12 6 6 0 010-12z", d: "M7.5 2h5M10 2v3M10 5a6 6 0 110 12 6 6 0 010-12zM10 8v3.4l2.1 1.3M14.8 4.6l1.3 1.3" },
  pauseDay: { fill: "M10 2.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15z", d: "M10 2.5a7.5 7.5 0 110 15 7.5 7.5 0 010-15zM8.2 7v6M11.8 7v6" },
  bell: { fill: "M10 2.8a4.7 4.7 0 014.7 4.7v3.2l1.6 2.8H3.7l1.6-2.8V7.5A4.7 4.7 0 0110 2.8z", d: "M10 2.8a4.7 4.7 0 014.7 4.7v3.2l1.6 2.8H3.7l1.6-2.8V7.5A4.7 4.7 0 0110 2.8zM8.2 15.8a1.9 1.9 0 003.6 0" },
  bellOff: { fill: "M10 2.8a4.7 4.7 0 014.7 4.7v3.2l1.6 2.8H3.7l1.6-2.8V7.5A4.7 4.7 0 0110 2.8z", d: "M10 2.8a4.7 4.7 0 014.7 4.7v3.2l1.6 2.8H3.7l1.6-2.8V7.5A4.7 4.7 0 0110 2.8zM8.2 15.8a1.9 1.9 0 003.6 0M3 3l14 14" },
  moon: { fill: "M16 12A7 7 0 018 3a7 7 0 108 9z", d: "M16 12A7 7 0 018 3a7 7 0 108 9z" },
  sun: { fill: "M10 6.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z", d: "M10 6.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6L16 16M4 16l1.4-1.4M14.6 5.4L16 4" },
  export: "M10 13V3M6.5 6.5L10 3l3.5 3.5M4 11v5a1 1 0 001 1h10a1 1 0 001-1v-5",
  download: "M10 3v10M6.5 9.5L10 13l3.5-3.5M4 15v1a1 1 0 001 1h10a1 1 0 001-1v-1",
  // Selection
  palette: { fill: "M10 2.5a7.5 7.5 0 100 15c1.3 0 1.8-.9 1.4-1.9-.5-1.1.1-2.1 1.3-2.1h1.8c2 0 3-1.2 3-3.3 0-4.3-3.3-7.7-7.5-7.7z", d: "M10 2.5a7.5 7.5 0 100 15c1.3 0 1.8-.9 1.4-1.9-.5-1.1.1-2.1 1.3-2.1h1.8c2 0 3-1.2 3-3.3 0-4.3-3.3-7.7-7.5-7.7z" + dot(6.3, 9.5, 0.6) + dot(8, 6.2, 0.6) + dot(12, 6.2, 0.6) },
  more: dot(4.5, 10, 0.6) + dot(10, 10, 0.6) + dot(15.5, 10, 0.6),
  lock: { fill: "M6 9h8a1.5 1.5 0 011.5 1.5v5.5a1.5 1.5 0 01-1.5 1.5H6A1.5 1.5 0 014.5 16v-5.5A1.5 1.5 0 016 9z", d: "M6 9h8a1.5 1.5 0 011.5 1.5v5.5a1.5 1.5 0 01-1.5 1.5H6A1.5 1.5 0 014.5 16v-5.5A1.5 1.5 0 016 9zM7 9V6.5a3 3 0 016 0V9M10 12.3v2" },
  unlock: { fill: "M6 9h8a1.5 1.5 0 011.5 1.5v5.5a1.5 1.5 0 01-1.5 1.5H6A1.5 1.5 0 014.5 16v-5.5A1.5 1.5 0 016 9z", d: "M6 9h8a1.5 1.5 0 011.5 1.5v5.5a1.5 1.5 0 01-1.5 1.5H6A1.5 1.5 0 014.5 16v-5.5A1.5 1.5 0 016 9zM7 9V6.5a3 3 0 015.6-1.5M10 12.3v2" },
  addStep: "M3 4h10M6 4v5.5A1.5 1.5 0 007.5 11H9M14 9v7M10.5 12.5h7",
  toPlan: "M2.5 10H8M5.5 7.5L8 10l-2.5 2.5M10 4h5.5A1.5 1.5 0 0117 5.5v9a1.5 1.5 0 01-1.5 1.5H10M11.8 10.2l1.6 1.6 2.6-3",
  collapse: "M5 7.5l5 5 5-5",
  expandDown: "M7.5 5l5 5-5 5",
  unframe: "M3 7V4.5A1.5 1.5 0 014.5 3H7M13 3h2.5A1.5 1.5 0 0117 4.5V7M17 13v2.5a1.5 1.5 0 01-1.5 1.5H13M7 17H4.5A1.5 1.5 0 013 15.5V13M7.5 10h5",
  sectionAdd: "M11 8H3v8.5a.5.5 0 00.5.5H10M4.5 2.5h4a1.5 1.5 0 010 3h-4a1.5 1.5 0 010-3zM15 10v7M11.5 13.5h7",
  noteAdd: "M4 3h12v6M4 3v14h6M15 11v6M12 14h6",
  bold: "M6 3.5h4.8a3.2 3.2 0 010 6.4H6zM6 9.9h5.7a3.3 3.3 0 010 6.6H6z",
  strike: "M3.5 10h13M13.6 6.2C13.1 4.8 11.8 4 10 4 7.9 4 6.4 5 6.4 6.7c0 1.4 1 2.3 3.6 3.3M6.6 13.6c.5 1.5 1.9 2.4 3.6 2.4 2.2 0 3.6-1 3.6-2.8",
  todo: "M3.5 5.5h5v5h-5zM5 8l1 1 1.6-1.8M11 8h5.5M3.5 14.5h5M11 14.5h5.5",
  // Lines
  connect: "M3 4h4.5v4.5H3zM12.5 11.5H17V16h-4.5zM7.5 6.2h2.5a1.5 1.5 0 011.5 1.5v3.8",
  weight: "M3 5h14M3 10h14M3 15h14M3 14.2h14M3 15.8h14",
  text: "M4.5 5.5V4.2c0-.4.3-.7.7-.7h9.6c.4 0 .7.3.7.7v1.3M10 3.5v13M7.8 16.5h4.4",
  dashed: "M3 10h2.6M8.7 10h2.6M14.4 10H17",
  straight: "M4 16L16 4" + dot(4, 16, 1) + dot(16, 4, 1),
  elbow: "M4 16v-5a1.5 1.5 0 011.5-1.5h9A1.5 1.5 0 0016 8V4",
  curve: "M3.5 16c7.5 0 5.5-12 13-12",
  arrowStart: "M17 10H3.5M7.5 6l-4 4 4 4",
  arrow: "M3 10h13.5M12.5 6l4 4-4 4",
  reverse: "M3 7h13M13 4l3 3-3 3M17 13H4M7 10l-3 3 3 3",
  branch: "M3 10h4M7 10c2.5 0 2.5-5 5.5-5H17M7 10c2.5 0 2.5 5 5.5 5H17" + dot(3, 10, 0.4),
  // Edit
  edit: "M4 13.5L3.2 17l3.5-.8L16.5 6.4a1.6 1.6 0 000-2.3l-.6-.6a1.6 1.6 0 00-2.3 0zM12 5l3 3",
  copy: { fill: "M8.5 7h6.5A1.5 1.5 0 0116.5 8.5V15a1.5 1.5 0 01-1.5 1.5H8.5A1.5 1.5 0 017 15V8.5A1.5 1.5 0 018.5 7z", d: "M8.5 7h6.5A1.5 1.5 0 0116.5 8.5V15a1.5 1.5 0 01-1.5 1.5H8.5A1.5 1.5 0 017 15V8.5A1.5 1.5 0 018.5 7zM4 13V5a1.5 1.5 0 011.5-1.5H13" },
  cut: "M7 7.5l9.5 9M7 12.5L16.5 3.5M5.5 3a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM5.5 12a2.5 2.5 0 110 5 2.5 2.5 0 010-5z",
  paste: "M7 4.5H4.5v13h11v-13H13M7 3h6v3H7z",
  duplicate: "M7 7h10v10H7zM3.5 12.5V3.5h9M12 9.5v5M9.5 12h5",
  // Linked copies: two arrows that keep each other in step.
  sync: "M15.4 7.8A5.8 5.8 0 004.7 7M4.6 12.2A5.8 5.8 0 0015.3 13M15.8 3.6v4.2h-4.2M4.2 16.4v-4.2h4.2",
  unsync: "M15.4 7.8A5.8 5.8 0 004.7 7M4.6 12.2A5.8 5.8 0 0015.3 13M15.8 3.6v4.2h-4.2M4.2 16.4v-4.2h4.2M3 3l14 14",
  trash: { fill: "M5.5 5.5l1 11a1 1 0 001 .9h5a1 1 0 001-.9l1-11z", d: "M3.5 5.5h13M8 5.5V3.8a.8.8 0 01.8-.8h2.4a.8.8 0 01.8.8v1.7M5.5 5.5l1 11a1 1 0 001 .9h5a1 1 0 001-.9l1-11M8.7 9v5M11.3 9v5" },
  opacity: "M10 2.5c-2.5 3.3-5.8 6.6-5.8 9.7a5.8 5.8 0 0011.6 0c0-3.1-3.3-6.4-5.8-9.7zM10 7v10",
  eyedropper: "M13 3l4 4-2 2-4-4zM12 7l-8 8v2h2l8-8",
  group: "M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z",
  ungroup: "M2.5 6V2.5H6M14 2.5h3.5V6M2.5 14v3.5H6M14 17.5h3.5V14M7 7h6v6H7z",
  front: "M7 7h10v10H7zM3 12V3h9",
  back: "M3 3h10v10H3zM7 17h10V7",
  forward: "M5 5h12v12H5zM2 10V2h8M8.5 11.5l2.5-2.5 2.5 2.5",
  backward: "M3 3h12v12H3zM7 18h11V7M6.5 8.5L9 11l2.5-2.5",
  align: "M4 3v14M7 6h10M7 10h6M7 14h10",
  left: "M3 3v14M6 6h10v3H6zM6 12h7v3H6z",
  centerX: "M10 2v16M4 5h12v3H4zM6 12h8v3H6z",
  right: "M17 3v14M4 6h10v3H4zM7 12h7v3H7z",
  top: "M3 3h14M6 6h3v10H6zM12 6h3v7h-3z",
  centerY: "M2 10h16M5 4h3v12H5zM12 6h3v8h-3z",
  bottom: "M3 17h14M6 4h3v10H6zM12 7h3v7h-3z",
  distributeX: "M3 3v14M17 3v14M6 6h2v8H6zM12 6h2v8h-2z",
  distributeY: "M3 3h14M3 17h14M6 6h8v2H6zM6 12h8v2H6z",
  sameWidth: "M5 5h10v3H5zM5 12h10v3H5zM2.5 3v14M17.5 3v14",
  sameHeight: "M5 5h3v10H5zM12 5h3v10h-3zM3 2.5h14M3 17.5h14",
  textLeft: "M3 4.5h14M3 8.5h9M3 12.5h14M3 16.5h9",
  textCenter: "M3 4.5h14M5.5 8.5h9M3 12.5h14M5.5 16.5h9",
  textRight: "M3 4.5h14M8 8.5h9M3 12.5h14M8 16.5h9",
  sendTo: "M2.5 5.5h9v9h-9zM11.5 10h6M15 7.5l2.5 2.5-2.5 2.5",
  // Small marks
  goBack: "M12.5 4.5L7 10l5.5 5.5",
  check: "M4 10l4 4 8-9",
  close: "M5 5l10 10M15 5L5 15",
  chevron: "M7.5 4.5l5.5 5.5-5.5 5.5",
  reset: "M4 4.5v5h5M4.3 9.5a6 6 0 111.4 5",
  play: "M6 3.5l10.5 6.5L6 16.5z",
  pause: "M6.5 4v12M13.5 4v12",
  eye: { fill: "M10 7.2a2.8 2.8 0 110 5.6 2.8 2.8 0 010-5.6z", d: "M2 10c5-7.5 11-7.5 16 0-5 7.5-11 7.5-16 0zM10 7.2a2.8 2.8 0 110 5.6 2.8 2.8 0 010-5.6z" },
  pin: "M6 3h8M7 3v6l-3 3h12l-3-3V3M10 12v6",
  deadline: { fill: "M4.5 4.5h11a1.5 1.5 0 011.5 1.5v9.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 15.5V6a1.5 1.5 0 011.5-1.5z", d: "M4.5 4.5h11a1.5 1.5 0 011.5 1.5v9.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 15.5V6a1.5 1.5 0 011.5-1.5zM3 8.5h14M7 3v3M13 3v3M10 10.6l1.6 1.6-1.6 1.6-1.6-1.6z" },
  // Board tools (5.34)
  draw: { fill: "M13.3 3.6a1.8 1.8 0 012.6 0l.5.5a1.8 1.8 0 010 2.6l-7.7 7.7-3.6 1 1-3.6z", d: "M13.3 3.6a1.8 1.8 0 012.6 0l.5.5a1.8 1.8 0 010 2.6l-7.7 7.7-3.6 1 1-3.6zM12 4.9l3.1 3.1M11.5 17.2h5.5" },
  comment: { fill: "M10 3c4.1 0 7 2.6 7 5.9s-2.9 5.9-7 5.9c-.8 0-1.6-.1-2.3-.3L4.2 16.3l.9-3C3.8 12.2 3 10.6 3 8.9 3 5.6 5.9 3 10 3z", d: "M10 3c4.1 0 7 2.6 7 5.9s-2.9 5.9-7 5.9c-.8 0-1.6-.1-2.3-.3L4.2 16.3l.9-3C3.8 12.2 3 10.6 3 8.9 3 5.6 5.9 3 10 3z" },
  comments: "M3 3h9.5a1.5 1.5 0 011.5 1.5v5a1.5 1.5 0 01-1.5 1.5H7l-3 2.5V11a1.5 1.5 0 01-1.5-1.5v-5A1.5 1.5 0 013 3zM16.5 7.5a1.5 1.5 0 011.5 1.5v5a1.5 1.5 0 01-1.5 1.5v2.5l-3-2.5H10",
  // A rounded tag leaning to the corner, with its hole (SF style, 5.80).
  tag: { fill: "M10.6 2.8h5a1.6 1.6 0 011.6 1.6v5a1.6 1.6 0 01-.47 1.13l-6.4 6.4a1.6 1.6 0 01-2.26 0L3.07 11.9a1.6 1.6 0 010-2.26l6.4-6.4A1.6 1.6 0 0110.6 2.8z", d: "M10.6 2.8h5a1.6 1.6 0 011.6 1.6v5a1.6 1.6 0 01-.47 1.13l-6.4 6.4a1.6 1.6 0 01-2.26 0L3.07 11.9a1.6 1.6 0 010-2.26l6.4-6.4A1.6 1.6 0 0110.6 2.8z" + dot(13.7, 6.3, 0.9) },
  photo: { fill: "M5 4.5h10A2 2 0 0117 6.5v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z", d: "M5 4.5h10A2 2 0 0117 6.5v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2zM3.4 13.4l3.8-3.8 3.3 3.3 1.9-1.9 4.3 4.1" + dot(13.5, 7.8, 1.1) },
  parentLook: "M6 3h10v10H6zM4 5v10h10" + "M2 7v10h10",
  // Shapes (5.59): a square in front of a circle, like FigJam.
  shape: { fill: "M4.5 8.5H10a1.5 1.5 0 011.5 1.5v5.5A1.5 1.5 0 0110 17H4.5A1.5 1.5 0 013 15.5V10a1.5 1.5 0 011.5-1.5z", d: "M4.5 8.5H10a1.5 1.5 0 011.5 1.5v5.5A1.5 1.5 0 0110 17H4.5A1.5 1.5 0 013 15.5V10a1.5 1.5 0 011.5-1.5zM8.1 8.5A4.5 4.5 0 1111.5 11.9" },
  // Text formatting (5.61).
  // A large A and a small a, like SF's "textformat" (5.80).
  textStyle: "M2 15.5L6.6 4.5h.3l4.6 11M3.7 11.6h6.1M17.6 15.5V11a2.1 2.1 0 00-4-.9M17.6 12.4h-2.2a1.6 1.6 0 000 3.2c1.2 0 2.2-1 2.2-2.2",
  italic: "M8.5 4h7M4.5 16h7M12 4L8 16",
  highlight: "M4 16.5h12M6 13.5l1.8-4.8 6-6 3 3-6 6-4.8 1.8zM12 4.5l3 3",
  link: "M8.6 11.4a3 3 0 004.2 0l2.6-2.6a3 3 0 00-4.2-4.2l-1 1M11.4 8.6a3 3 0 00-4.2 0l-2.6 2.6a3 3 0 004.2 4.2l1-1",
  listBullet: "M8 5h9M8 10h9M8 15h9" + "M3.6 5h.1M3.6 10h.1M3.6 15h.1",
  listNumber: "M8.5 5h8.5M8.5 10h8.5M8.5 15h8.5M3 3.5l1.2-.7V7M2.8 9.6a1 1 0 012 .3c0 .8-2 1.5-2 2.6h2.1M2.8 13.6h1.9l-1 1.2a1 1 0 11-.9 1.5",
  // The eyedropper (5.60): take a color from the board.
  eyedropper: "M13.5 3.2a2 2 0 012.8 2.8l-1.9 1.9.9.9-1.4 1.4-.9-.9-6.1 6.1H4.5v-2.4l6.1-6.1-.9-.9 1.4-1.4.9.9zM8.9 8.7l2.4 2.4",
  // Documents (5.63): a page with a folded corner and lines.
  document: { fill: "M6 2.8h5.5L15.5 7v8.7A1.5 1.5 0 0114 17.2H6a1.5 1.5 0 01-1.5-1.5V4.3A1.5 1.5 0 016 2.8z", d: "M6 2.8h5.5L15.5 7v8.7A1.5 1.5 0 0114 17.2H6a1.5 1.5 0 01-1.5-1.5V4.3A1.5 1.5 0 016 2.8zM11.5 2.8V7h4M7.5 10.3h5M7.5 13.3h5" },
};
// Older names still used across the Board, and what each now draws.
export const DDboardIconAliases = {
  sort: "select", cursor: "select", move: "hand", block: "task", sticky: "note", square: "section",
  smile: "sticker", bang: "sticker", spark: "sticker", feeling: "sticker", stickers: "sticker",
  magnet: "snap", gridDots: "grid", minimap: "map", gear: "settings", view: "settings",
  search: "zoom", fitSelection: "fit", list: "sections", life: "leaf",
  connector: "connect", line: "connect", tree: "branch", layers: "front", swap: "reverse",
  "?": "help", "▣": "lock", pen: "edit", arrange: "align", details: "info", step: "addStep",
};
function DDboardIconOf(name) {
  return DDboardIcons[DDboardIconAliases[name] || name] || DDboardIcons.more;
}
// One string per picture (its layers joined), so pictures can be compared.
export function DDboardIconPath(name) {
  const icon = DDboardIconOf(name);
  return typeof icon === "string" ? icon : [icon.fill || "", icon.d || "", icon.solid || ""].join("|");
}
export function DDBoardIcon({ React: R, name, size = 18 }) {
  const icon = DDboardIconOf(name), layers = typeof icon === "string" ? { d: icon } : icon;
  return R.createElement("svg", {
    width: size, height: size, viewBox: "0 0 20 20", "data-icon": name,
    fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
  },
  layers.fill && R.createElement("path", { className: "dd-icon-fill", d: layers.fill, fill: "currentColor", stroke: "none", opacity: 0.22 }),
  layers.d && R.createElement("path", { d: layers.d }),
  layers.solid && R.createElement("path", { className: "dd-icon-solid", d: layers.solid, fill: "currentColor" }));
}
