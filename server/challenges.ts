import type { Challenge, ChallengeSummary, DataTable } from "../shared/types";

// Three typical island jobs, written as step-by-step instructions so each step can be priced.
// Quantities are computed from roof area with stated waste factors; anything that depends on
// the actual roof (edge lengths, deck condition, layers) is listed as "measure" or an open question.

const SQ_FT = 100; // one roofing square
const fmt = (n: number) => n.toLocaleString("en-US");
// Rounded to hundredths so 40 × 1.1 is 44, not 44.000000000000007 (which would ceil to 45).
const withWaste = (squares: number, waste: number) => Math.round(squares * (1 + waste) * 100) / 100;

const takeoffColumns: DataTable["columns"] = [
  { key: "item", label: "Item" },
  { key: "quantity", label: "Quantity", numeric: true },
  { key: "basis", label: "Basis" },
];
const takeoff = (rows: [item: string, quantity: string, basis: string][]): DataTable => ({
  title: "Material takeoff",
  columns: takeoffColumns,
  rows: rows.map(([item, quantity, basis]) => ({ cells: { item, quantity, basis } })),
});

// Steps shared by every island job.
const islandLogistics = [
  "Book Washington State Ferries vehicle reservations from Anacortes for the crew and material trucks. Oversize vehicles pay by length, so note each truck and trailer length when booking.",
  "Book crew lodging on the island for the full job, plus a spare day for weather.",
];

// ---- Challenge 1: metal, new construction ----

const metalSquares = 40;
const metalPanelWidthFt = 16 / 12;
const metalPanelLf = (metalSquares * SQ_FT) / metalPanelWidthFt;
const metalClips = Math.ceil(metalPanelLf / 2);

const metal: Challenge = {
  id: "metal-new-construction",
  number: 1,
  title: "40-square metal roof on new construction",
  island: "Orcas Island",
  place: "Eastsound",
  summary:
    "A new house near Eastsound is framed and sheathed. We supply and install a standing-seam metal roof over the new deck, on the general contractor's schedule.",
  tags: ["40 squares", "Standing-seam metal", "New construction"],
  spec: [
    { label: "Location", value: "Near Eastsound, Orcas Island" },
    { label: "Roof area", value: `${metalSquares} squares (${fmt(metalSquares * SQ_FT)} sq ft)` },
    { label: "Roof shape", value: "Gable with one valley, 6/12 pitch, two stories (assumed)" },
    { label: "Deck", value: "New plywood sheathing, installed by the general contractor" },
    { label: "System", value: "24-gauge standing-seam panels, 16 in. wide, concealed clips" },
    { label: "Underlayment", value: "High-temperature synthetic" },
  ],
  takeoff: takeoff([
    ["Panel coverage", `${fmt(Math.round(withWaste(metalSquares, 0.1)))} squares`, "Roof area plus 10% waste"],
    [
      "Panels (16 in.)",
      `${fmt(Math.round(metalPanelLf * 1.1))} lin ft`,
      `${fmt(metalSquares * SQ_FT)} sq ft ÷ 1.33 ft coverage, plus 10%`,
    ],
    ["Clips", fmt(metalClips), "One per 24 in. along each panel (confirm the manufacturer's spacing for wind exposure)"],
    ["Clip fasteners", fmt(metalClips * 2), "Two per clip"],
    ["Underlayment", `${Math.ceil(withWaste(metalSquares, 0.1) / 10)} rolls`, "10-square rolls, plus 10% for laps"],
    ["Eave, rake, ridge and valley trim", "Measure", "Linear feet from the plans"],
    ["Closures, sealant, pipe flashings", "Measure", "From ridge length and penetration count"],
  ]),
  phases: [
    {
      title: "Before the job",
      steps: [
        "Get the plans from the general contractor. Take off eave, rake, ridge and valley lengths, panel lengths and every penetration.",
        "Confirm that the contractor's building permit covers the roof, and when the roof will be inspected.",
        "Decide how panels arrive: cut to length by a mainland supplier, or rolled on site from coil with a portable roll former. Check that the longest panel fits on the truck and the ferry.",
        ...islandLogistics,
      ],
      price: ["Panels, trim and accessories (supplier quote)", "Roll former rental, if used", "Ferry fares", "Lodging", "Site visit"],
    },
    {
      title: "Mobilize",
      steps: [
        "Ferry the crew, tools and materials to Orcas. Stage the panels flat and supported off the ground.",
        "Set up fall protection and a way to lift panels to the roof.",
      ],
      price: ["Lift or hoist rental", "Fall protection", "Crew time on travel days"],
    },
    {
      title: "Dry-in",
      steps: [
        "Walk the deck with the general contractor and agree that it is ready.",
        "Install eave trim, then high-temperature underlayment from the eave up. Line the valley.",
        "Dry in the whole roof before setting panels.",
      ],
      price: ["Crew-days"],
    },
    {
      title: "Panels and trim",
      steps: [
        "Set the first panel square to the eave and clip each panel as it goes.",
        "Cut and flash every penetration.",
        "Install the valley, ridge with closures, and rake trim.",
      ],
      price: ["Crew-days", "Flashing and closures"],
    },
    {
      title: "Closeout",
      steps: [
        "Sweep metal shavings off the panels so they don't rust, and touch up scratches.",
        "Walk the punch list with the general contractor and pass the final inspection.",
        "Take scrap metal off the island to recycle.",
      ],
      price: ["Crew-day", "Ferry fares out"],
    },
  ],
  openQuestions: [
    "The wind exposure at the site sets the clip spacing and the edge details.",
    "Who supplies the gutters and snow guards, if any.",
    "The panel color and finish (lead time).",
  ],
};

// ---- Challenge 2: composition shingles, tear-off ----

const compSquares = 40;
const compOrderSquares = Math.ceil(withWaste(compSquares, 0.1));
const sheathingAllowanceSqFt = compSquares * SQ_FT * 0.1;

const composite: Challenge = {
  id: "composite-tear-off",
  number: 2,
  title: "40-square composite roof with tear-off",
  island: "San Juan Island",
  place: "Friday Harbor",
  summary:
    "Re-roof an older house in Friday Harbor: strip the existing asphalt shingles to the deck, repair the sheathing, and install a new architectural shingle roof.",
  tags: ["40 squares", "Architectural shingles", "Tear-off"],
  spec: [
    { label: "Location", value: "Friday Harbor, San Juan Island" },
    { label: "Roof area", value: `${compSquares} squares (${fmt(compSquares * SQ_FT)} sq ft)` },
    { label: "Roof shape", value: "Hip and gable, 6/12 pitch, one story (assumed)" },
    { label: "Existing roof", value: "One layer of asphalt shingles (assumed; confirm)" },
    { label: "System", value: "Architectural shingles, synthetic underlayment, ridge vent" },
    { label: "Occupancy", value: "Lived in during the work" },
  ],
  takeoff: takeoff([
    ["Shingles", `${compOrderSquares * 3} bundles`, `${compOrderSquares} squares (roof plus 10% waste) × 3 bundles`],
    ["Underlayment", `${Math.ceil(withWaste(compSquares, 0.1) / 10)} rolls`, "10-square rolls, plus 10% for laps"],
    ["Ice and water membrane", "Measure", "Valleys, eaves and around penetrations"],
    ["Starter and ridge cap", "Measure", "Eave and rake length; ridge and hip length"],
    ["Drip edge, step flashing, pipe boots", "Measure", "Edge lengths, wall lengths, penetration count"],
    [
      "Sheathing allowance",
      `${Math.ceil(sheathingAllowanceSqFt / 32)} sheets`,
      `10% of the deck (${fmt(sheathingAllowanceSqFt)} sq ft) in 4 × 8 sheets; true-up after tear-off`,
    ],
    [
      "Tear-off debris",
      `${fmt((compSquares * 250) / 2000)}–${fmt((compSquares * 350) / 2000)} tons`,
      "One layer at 250–350 lb per square",
    ],
  ]),
  phases: [
    {
      title: "Before the job",
      steps: [
        "Measure the roof. Count the layers at an edge and look at the deck from the attic.",
        "Have a good-faith asbestos survey done before tear-off. Washington requires one before renovation work.",
        "Get the permit from the Town of Friday Harbor (inside town limits) or San Juan County Community Development (outside them).",
        "Plan where the tear-off goes: the island transfer station, or back to the mainland on the ferry. Choose an on-island dumpster or our own dump trailer.",
        ...islandLogistics,
      ],
      price: ["Asbestos survey", "Permit", "Materials (supplier quote)", "Ferry fares", "Lodging"],
    },
    {
      title: "Protect and mobilize",
      steps: [
        "Tarp the landscaping, lean plywood against windows and walls, and place the dumpster or trailer.",
        "Set up fall protection.",
      ],
      price: ["Dumpster or trailer", "Tarps and protection", "Fall protection"],
    },
    {
      title: "Tear-off",
      steps: [
        "Strip one section at a time, no more than can be dried in the same day.",
        "Remove shingles, underlayment, nails and old flashing down to the deck.",
        "Replace rotted or soft sheathing and log every sheet for the change order.",
        "Dry in each section before leaving for the day.",
      ],
      price: ["Crew-days", "Disposal by the ton", "Debris trips on the ferry, if hauled off-island", "Sheathing beyond the allowance"],
    },
    {
      title: "Install",
      steps: [
        "Install drip edge at the eaves, ice and water membrane at eaves, valleys and penetrations, then underlayment and drip edge at the rakes.",
        "Lay starter, then shingles to the manufacturer's nailing pattern.",
        "Step- and counter-flash walls and chimneys, and fit new pipe boots.",
        "Install ridge vent and ridge cap.",
      ],
      price: ["Crew-days", "Flashing"],
    },
    {
      title: "Closeout",
      steps: [
        "Run a magnet over the yard and driveway twice.",
        "Haul the last of the debris, pass the final inspection, and register the shingle warranty.",
      ],
      price: ["Crew-day", "Ferry fares out"],
    },
  ],
  openQuestions: [
    "How many layers are really there, and what condition the deck is in.",
    "Whether the attic has enough intake vents to balance a ridge vent.",
    "Whether the gutters stay or are replaced.",
  ],
};

// ---- Challenge 3: TPO flat roof, tear-off ----

const tpoSquares = 60;
const tpoBoards = Math.ceil(withWaste(tpoSquares, 0.05) * SQ_FT / 32);

const tpo: Challenge = {
  id: "tpo-flat-tear-off",
  number: 3,
  title: "60-square TPO flat roof with tear-off",
  island: "Lopez Island",
  place: "Lopez Village",
  summary:
    "Replace the flat roof on a commercial building in Lopez Village: remove the old roof and any wet insulation, then install a new TPO membrane over new insulation while the business stays open.",
  tags: ["60 squares", "TPO membrane", "Tear-off", "Commercial"],
  spec: [
    { label: "Location", value: "Lopez Village, Lopez Island" },
    { label: "Roof area", value: `${tpoSquares} squares (${fmt(tpoSquares * SQ_FT)} sq ft)` },
    { label: "Roof", value: "Low slope with parapet walls, interior drains and scuppers (assumed)" },
    { label: "Existing roof", value: "Built-up or modified bitumen (identify with core cuts)" },
    { label: "System", value: "60-mil TPO over tapered polyiso and cover board" },
    { label: "Occupancy", value: "Business open during the work" },
  ],
  takeoff: takeoff([
    [
      "TPO membrane",
      `${Math.ceil(withWaste(tpoSquares, 0.15) / 10)} rolls`,
      "10 × 100 ft rolls (10 squares), plus 15% for seams, laps and flashings",
    ],
    ["Polyiso insulation", `${tpoBoards} boards per layer`, "4 × 8 boards, plus 5%"],
    ["Cover board", `${tpoBoards} boards`, "4 × 8 boards, plus 5%"],
    ["Tapered insulation", "Design", "Supplier layout from the drain locations"],
    ["Fasteners and plates", "Design", "Manufacturer's pattern for the deck type and wind zone"],
    ["Edge metal, coping, drain rings", "Measure", "Perimeter, parapet length, drain count"],
    ["Wet insulation replacement", "Measure", "From the moisture survey"],
  ]),
  phases: [
    {
      title: "Before the job",
      steps: [
        "Cut cores to find each layer and the deck type. Run a moisture survey to map wet insulation.",
        "Have a good-faith asbestos survey done. Old built-up roofs and mastics can contain asbestos.",
        "Confirm the insulation level the Washington State Energy Code requires when a commercial roof is replaced; it usually means adding insulation.",
        "Get the permit from San Juan County Community Development.",
        "Count drains, scuppers and rooftop units. Arrange with the HVAC contractor to lift or disconnect units.",
        "Book a crane or boom truck to hoist materials, on the island or brought over on the ferry.",
        "Confirm site power for the robotic welder, or bring a generator.",
        "Agree on work hours with the business, and keep adhesive fumes away from the air intakes.",
        ...islandLogistics,
      ],
      price: [
        "Core cuts and moisture survey",
        "Asbestos survey",
        "Permit",
        "Materials (supplier quote)",
        "Crane",
        "HVAC contractor",
        "Generator",
        "Ferry fares",
        "Lodging",
      ],
    },
    {
      title: "Mobilize",
      steps: [
        "Hoist materials to the roof and spread the load. Never stack it in one place on the deck.",
        "Set warning lines or guardrails at the roof edge, and run a debris chute to the dumpster.",
      ],
      price: ["Crane time", "Dumpster", "Guardrails or warning lines", "Debris chute"],
    },
    {
      title: "Tear-off",
      steps: [
        "Remove the roof in sections that can be closed the same day.",
        "Take off the membrane and wet insulation, and check the deck.",
        "Make the section watertight at the end of each day.",
      ],
      price: ["Crew-days", "Disposal by the ton", "Deck repairs"],
    },
    {
      title: "Install",
      steps: [
        "Lay the tapered polyiso and cover board, fastened to the pattern.",
        "Roll out the TPO and weld every seam with the robotic welder.",
        "Flash curbs, parapets, drains (new clamping rings) and scuppers.",
        "Install edge metal and coping.",
      ],
      price: ["Crew-days", "Welder rental", "Flashing and metal"],
    },
    {
      title: "Closeout",
      steps: [
        "Probe every seam and water-test the drains.",
        "Pass the manufacturer's warranty inspection and the county's final inspection.",
        "Clean up and haul the last of the debris.",
      ],
      price: ["Warranty inspection fee", "Crew-day", "Ferry fares out"],
    },
  ],
  openQuestions: [
    "The deck type (wood, steel or concrete) sets the fasteners and the attachment system.",
    "Which drainage improvements the tapered layout needs.",
    "Which rooftop units must be lifted, and by whom.",
    "The warranty length the owner wants (it changes the membrane and the inspection).",
  ],
};

const all: Challenge[] = [metal, composite, tpo];

export const challenges: ChallengeSummary[] = all.map(({ id, number, title, island, place, summary, tags }) => ({
  id,
  number,
  title,
  island,
  place,
  summary,
  tags,
}));

export const findChallenge = (id: string) => all.find((c) => c.id === id);
