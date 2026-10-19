import type { Challenge, ChallengeSummary, CostLine, PlanPhase, PlanStep } from "../shared/types";

// Typical island roofing jobs. Each gets a set of instructions for completing the job, with the
// cost of every step worked out from the assumptions listed alongside it.

// ---- Shared rates ----

const rates = {
  people: 2, // a paid crew member and the company owner
  laborRate: 40, // $/hr, the paid crew member; the owner isn't paid hourly
  mpg: 16, // F-150 with a loaded ladder rack (assumed)
  fuelPrice: 5.49, // $/gal, Washington average, AAA, Oct 2 2026
  breakfast: 15, // per person
  lunch: 20,
  dinner: 25,
  motelRoom: 150, // one room, two beds, per night (assumed; Orcas listings run about $140–180)
  lodgingTax: 0.11, // sales and lodging tax (assumed)
  vehicleFare: 54.15, // Anacortes → Orcas, vehicle under 22 ft & driver, WSF Oct 2026
  passengerFare: 18.0, // adult passenger
  cardFee: 0.03, // WSF card surcharge since Mar 1 2026
  // Pickup and delivery: F-550 (diesel) with a rented 30' trailer
  dieselPrice: 7.37, // $/gal, Washington average, AAA, Oct 2 2026
  f550Mpg: 12, // F-550 diesel, no trailer (assumed)
  towMpgEmpty: 10, // ...pulling the empty 30' trailer (assumed)
  towMpgLoaded: 8, // ...loaded with the metal (assumed)
  trailerPerDay: 150, // 30' flatbed rental near Nu-Ray, per day (placeholder until a yard quotes)
  trailerDays: 4,
  rigFareUnder60: 319.8, // Anacortes → Orcas, vehicle under 60 ft (F-550 + 30' trailer), driver included
  loadSupplies: 150, // straps, edge protectors, 4x4 dunnage, tarp, if not already on hand (assumed)
};

// The metal order, until Nu-Ray quotes it.
const order = {
  roofSquares: 40,
  waste: 0.1,
  panelPricePerSqFt: 5.0, // placeholder: published 24-ga material ranges run about $2.50–9.00/sq ft
  accessoriesShare: 0.2, // trim, clips, screws, closures, sealant, as a share of panels (assumed)
  lbPerSqFt: 1.3, // 24-ga steel panel, per sq ft of roof covered (approximate)
  accessoriesLb: 500, // trim and fasteners (approximate)
};
const orderSqFt = Math.round(order.roofSquares * (1 + order.waste) * 100);

// High-temperature ice and water shield over the whole deck: the dry-in underlayment.
const iceWater = {
  squares: 40,
  laps: 0.1, // side and end laps
  product: "CertainTeed WinterGuard HT",
  rollSqFt: 195, // 36 in. × 65 ft roll
  rollPrice: 175, // placeholder: WinterGuard Sand lists at about $105–155 a roll, PRO HT at $205
  rollLb: 60, // approximate
};
const iceWaterRolls = Math.ceil((iceWater.squares * 100 * (1 + iceWater.laps)) / iceWater.rollSqFt);
const loadLb = Math.round((orderSqFt * order.lbPerSqFt + order.accessoriesLb + iceWaterRolls * iceWater.rollLb) / 100) * 100;

const round2 = (n: number) => Math.round(n * 100) / 100;

// "6:45 AM" → minutes after midnight.
function minutes(clock: string): number {
  const [, h, m, ampm] = clock.match(/^(\d+):(\d+) (AM|PM)$/)!;
  return ((Number(h) % 12) + (ampm === "PM" ? 12 : 0)) * 60 + Number(m);
}

const hrs = (n: number) => `${Number(n.toFixed(2))} h`;

type StepInput = {
  day?: string;
  start: string;
  end: string;
  title: string;
  detail: string;
  paid?: boolean; // crew time on the clock (default true)
  crew?: number; // paid people on this step (default 1)
  work?: boolean; // time spent on the estimate itself
  miles?: number;
  mpg?: number; // default: the F-150 alone
  diesel?: boolean; // the F-550 burns diesel
  extra?: CostLine[];
};

// Steps carry direct costs only; their paid time is costed once, in the labor lines at the end.
function step(input: StepInput): PlanStep {
  const { day, start, end, title, detail, paid = true, crew = 1, work = false, miles = 0, mpg = rates.mpg, diesel = false, extra = [] } = input;
  const hours = (minutes(end) - minutes(start)) / 60;
  const costs: CostLine[] = [];
  if (miles) {
    const price = diesel ? rates.dieselPrice : rates.fuelPrice;
    costs.push({ label: `${diesel ? "Diesel" : "Fuel"}: ${miles} mi at ${mpg} mpg`, amount: round2((miles / mpg) * price) });
  }
  costs.push(...extra);
  return { day, start, end, title, detail, paidHours: paid ? hours * crew : 0, estimateHours: work ? hours : 0, costs };
}

// One paid crew member with the owner along, unless told otherwise.
function crewLabor(steps: PlanStep[], when: string, who = "Crew member", ownerAlong = true): CostLine[] {
  const hours = steps.reduce((total, s) => total + s.paidHours, 0);
  const lines = [{ label: `${who}: ${hrs(hours)} at $${rates.laborRate}/h (${when})`, amount: round2(hours * rates.laborRate) }];
  if (ownerAlong) lines.push({ label: "Owner: rides along, not paid hourly", amount: 0 });
  return lines;
}

const meals = (meal: "breakfast" | "lunch" | "dinner"): CostLine => ({
  label: `${meal[0]!.toUpperCase()}${meal.slice(1)}: ${rates.people} × $${rates[meal]}`,
  amount: rates.people * rates[meal],
});

const ferryOut: CostLine = {
  label: `Ferry: vehicle & driver plus ${rates.people - 1} passenger, with the 3% card fee`,
  amount: round2((rates.vehicleFare + (rates.people - 1) * rates.passengerFare) * (1 + rates.cardFee)),
};

const ferryDetail =
  "The F-150 is under 22 feet even with the rack, so it rides at the standard vehicle fare (WSF dropped the height surcharge for vehicles under 22 feet in 2015). If the ladders hang past 22 feet, it jumps to the under-30-foot rate. The second person in the truck pays the passenger fare. Fares are only collected leaving Anacortes.";

const siteVisitDetail =
  "Measure the sheathed roof, plane by plane: eave-to-ridge length for every panel run, the width of each plane for the panel count, pitch, overhangs, and every valley, hip, wall and penetration. Mark where the roof differs from the plans and photograph every elevation.";

const orderDetail =
  "Update the cut list and trim list from the field measurements (add about 2 in. per panel for the eave hem), mark every change from the plans, and send it to Nu-Ray so the order matches the roof as built.";

const sharedAssumptions = [
  `Two people in the truck: one crew member at $${rates.laborRate}/hour and the company owner, who isn't paid hourly. The owner books the trip beforehand.`,
  `Fuel at $${rates.fuelPrice}/gal (Washington average) and ${rates.mpg} mpg for an F-150 carrying a ladder rack.`,
  `The $${rates.laborRate} rate is the wage only; payroll taxes and workers' comp would add to it.`,
  "Truck wear and insurance aren't included. The metal order is costed in part 3, and its delivery in phase 2.",
];

const ferrySources = [
  { label: "WSF fares: Anacortes to Orcas", url: "https://www.wsdot.wa.gov/ferries/fares/faresdetail.aspx?departingterm=1&arrivingterm=15" },
  { label: "WSF fall 2026 schedule: Anacortes / San Juan Islands", url: "https://wsdot.com/ferries/schedule/scheduledetailbyroute.aspx?route=ana-sj-sid" },
  { label: "WSF vehicle reservations", url: "https://www.wsdot.wa.gov/ferries/reservations" },
];

// ---- Challenge 1, phase 1, part 1: bid from the plans ----
// Desk work by the owner, ending with a signed contract and a deposit. Nothing is ordered yet.

const office = "Owner, from the office";

const bidSteps: PlanStep[] = [
  step({
    day: office,
    start: "8:00 AM",
    end: "8:30 AM",
    title: "Get the plan set from the general contractor",
    detail:
      "Ask for the roof plan, elevations, building sections and roof details, plus the specs: panel profile, gauge, color, underlayment, snow guards and gutters. Ask when the roof will be framed and sheathed, and when they need it dried in.",
    paid: false,
  }),
  step({
    day: office,
    start: "8:30 AM",
    end: "9:30 AM",
    title: "Call Nu-Ray",
    detail:
      "Call Nu-Ray's Washington sales line (800-700-7228) and ask for the territory rep for WA North. Ask: do they sell direct to contractors or through a dealer; what it takes to open an account; whether they do takeoffs from plans; which standing-seam profile fits this roof (for example NRM-1750, a 1.75 in. snap-lock seam in 14 or 18 in. widths, or NRM-1000, a 1.5 in. seam on floating clips in 12 or 16 in.); 24 gauge; finish (their D2 Kynar with Ocean Guard is aimed at salt air); lead time; and how their contractors get metal to the islands.",
    paid: false,
  }),
  step({
    day: office,
    start: "9:30 AM",
    end: "10:30 AM",
    title: "Send the plans to Nu-Ray for a takeoff and material quote",
    detail:
      "Send the roof plan with the pitch and the panel profile. If Nu-Ray doesn't do takeoffs, do it yourself: for each roof plane, the panel length (eave to ridge along the slope, plus about 2 in. for the eave hem) and the panel count (plane width ÷ panel coverage); then the length of every eave, rake, ridge, valley and wall for the trim, plus clips, screws, closures, sealant and underlayment. Ask for samples of the specified color.",
    paid: false,
  }),
  step({
    day: office,
    start: "1:00 PM",
    end: "2:00 PM",
    title: "Check the takeoff against the plans",
    detail:
      "A few days later, when the takeoff comes back: check every plane, pitch, panel length and count, and every trim run against the plans. Make sure the longest panel fits on a 30 ft trailer, and note the shipping weight.",
    paid: false,
  }),
  step({
    day: office,
    start: "2:00 PM",
    end: "4:00 PM",
    title: "Price the job and send the bid",
    detail:
      "Add up Nu-Ray's material quote, the travel and logistics (the trip costs on this page), the install labor and the markup. Send the bid to the general contractor with the color sample and the lead time.",
    paid: false,
  }),
  step({
    day: office,
    start: "4:00 PM",
    end: "4:30 PM",
    title: "Sign the contract and collect a deposit",
    detail:
      "Don't order anything until the contract is signed and a deposit is in. The panels are cut to length for this roof and can't be returned, so the deposit should at least cover the metal.",
    paid: false,
  }),
];

const bid: PlanPhase = {
  number: 1,
  part: 1,
  title: "Bid from the plans",
  summary:
    "With the architect's plans in hand, the bid is desk work: get a takeoff and material quote from Nu-Ray, check it, price the job, and send the bid. No trip to Orcas is needed until the contract is signed.",
  steps: bidSteps,
  labor: [{ label: "Owner: desk work, not paid hourly", amount: 0 }],
  assumptions: [
    "The general contractor has a full plan set, including a roof plan with pitches.",
    "Supplier takeoffs from plans are common in metal roofing, but they don't replace checking the roof as built (part 2).",
    "The owner does all of this, so the time isn't costed.",
  ],
  sources: [
    { label: "Nu-Ray Metals", url: "https://www.nuraymetals.com/" },
    { label: "Nu-Ray roofing profiles", url: "https://www.nuraymetals.com/roofing" },
    { label: "Example supplier takeoff service (Sheffield Metals)", url: "https://sheffieldmetals.com/take-off-service/" },
    { label: "Measuring standing seam panels", url: "https://www.roofingcalc.com/standing-seam-metal-roofing-installation/" },
  ],
};

// ---- Challenge 1, phase 1, part 2, option A: the roof was built to the plans ----

const fromPlansSteps: PlanStep[] = [
  step({
    day: office,
    start: "8:00 AM",
    end: "8:30 AM",
    title: "Confirm the roof was built to the plans",
    detail:
      "Once the roof is framed and sheathed, ask the general contractor whether anything changed: pitch, overhangs, dormers, skylights, vents or chimneys. Ask the framer for photos of each roof plane and a few tape measurements (eave length and one eave-to-ridge run per plane) to check against the plans.",
    paid: false,
  }),
  step({
    day: office,
    start: "8:30 AM",
    end: "9:00 AM",
    title: "Finalize the cut list",
    detail:
      "If the measurements match, confirm the takeoff's cut list with Nu-Ray as final. Order panels about an inch long and a spare panel or two, since a short panel can't be fixed. If anything doesn't match, switch to option B or C.",
    paid: false,
  }),
];

const fromPlans: PlanPhase = {
  number: 1,
  part: 2,
  option: { letter: "A", name: "Built to plans: order from the plans" },
  title: "Confirm the measurements",
  summary:
    "If the framer built the roof to the plans, the takeoff stands. Confirm it with the general contractor from the office, with photos and a few tape measurements from the framer, and finalize the order without a trip.",
  steps: fromPlansSteps,
  labor: [{ label: "Owner: desk work, not paid hourly", amount: 0 }],
  assumptions: [
    "This relies on the framer's measurements. If they're off, the panels are wrong and can't be returned, so check more than one run per plane.",
  ],
  sources: [{ label: "Measuring standing seam panels", url: "https://www.roofingcalc.com/standing-seam-metal-roofing-installation/" }],
};

// ---- Challenge 1, phase 1, part 2, option B: plans changed, field measure on a day trip ----

const dayTripSteps: PlanStep[] = [
  step({
    start: "3:00 PM",
    end: "3:30 PM",
    title: "Book the ferry and set the appointment (the day before)",
    detail:
      "The owner books vehicle reservations both ways: the 8:40 AM from Anacortes to Orcas and the 4:35 PM back. Each direction is a separate one-way reservation. Confirm with the general contractor that the roof is sheathed and the site is open.",
    paid: false,
  }),
  step({
    start: "6:45 AM",
    end: "8:40 AM",
    title: "Drive Coupeville to the Anacortes ferry terminal and wait in line",
    detail:
      "About 35 miles up SR-20 over Deception Pass, roughly an hour. WSF asks reservation holders on the San Juan routes to be in line 45–60 minutes before sailing.",
    miles: 35,
  }),
  step({ start: "8:40 AM", end: "9:45 AM", title: "Ferry Anacortes to Orcas", detail: ferryDetail, extra: [ferryOut] }),
  step({
    start: "9:45 AM",
    end: "10:05 AM",
    title: "Drive from the Orcas ferry landing to the site",
    detail: "About 9 miles to the Eastsound area.",
    miles: 9,
  }),
  step({ start: "10:05 AM", end: "12:15 PM", title: "Field-measure the roof", detail: siteVisitDetail, work: true }),
  step({
    start: "12:15 PM",
    end: "1:00 PM",
    title: "Lunch in Eastsound",
    detail: "Unpaid meal break.",
    paid: false,
    miles: 2,
    extra: [meals("lunch")],
  }),
  step({ start: "1:00 PM", end: "3:15 PM", title: "Update the cut list and send it to Nu-Ray", detail: orderDetail, work: true }),
  step({
    start: "3:15 PM",
    end: "4:35 PM",
    title: "Drive to the Orcas ferry landing and wait in line",
    detail: "About 9 miles back to the landing, in line by about 3:40 PM.",
    miles: 9,
  }),
  step({ start: "4:35 PM", end: "5:45 PM", title: "Ferry Orcas to Anacortes", detail: "No fare is collected eastbound." }),
  step({
    start: "5:45 PM",
    end: "6:45 PM",
    title: "Drive back to HQ in Coupeville",
    detail: "About 35 miles back down SR-20.",
    miles: 35,
  }),
];

const dayTrip: PlanPhase = {
  number: 1,
  part: 2,
  option: { letter: "B", name: "Plans changed: field measure, day trip" },
  title: "Confirm the measurements",
  summary:
    "The framing doesn't match the plans, so the roof has to be measured before ordering. Leave HQ in Coupeville in the morning, take the ferry from Anacortes to Orcas, measure the sheathed roof, send the updated cut list to Nu-Ray, and drive back the same day. Cheaper, and enough for a simple roof, but the ferry schedule leaves only the middle of the day on site.",
  steps: dayTripSteps,
  labor: crewLabor(dayTripSteps, "6:45 AM to 6:45 PM, less the unpaid lunch"),
  assumptions: [
    ...sharedAssumptions,
    "The 45-minute lunch is unpaid. Every other hour from 6:45 AM to 6:45 PM is paid.",
    "The only earlier sailing back with vehicle space is 11:50 AM, which leaves too little time on site. That is why the day ends on the 4:35 PM boat.",
  ],
  sources: ferrySources,
};

// ---- Challenge 1, phase 1, part 2, option C: plans changed, field measure with an overnight ----

const night = "Night before";
const estimateDay = "Measure day";
const lodging = round2(rates.motelRoom * (1 + rates.lodgingTax));

const overnightSteps: PlanStep[] = [
  step({
    day: "Beforehand",
    start: "3:00 PM",
    end: "3:30 PM",
    title: "Book the ferry, the motel and the appointment",
    detail:
      "The owner books vehicle reservations both ways: the 6:05 PM from Anacortes to Orcas the night before and the 4:35 PM back on the measure day. Book a cheap room in Eastsound. Confirm with the general contractor that the roof is sheathed and the site is open.",
    paid: false,
  }),
  step({
    day: night,
    start: "4:10 PM",
    end: "6:05 PM",
    title: "Drive Coupeville to the Anacortes ferry terminal and wait in line",
    detail: "About 35 miles up SR-20, in line 45–60 minutes before sailing. Travel the night before is unpaid.",
    paid: false,
    miles: 35,
  }),
  step({ day: night, start: "6:05 PM", end: "7:15 PM", title: "Ferry Anacortes to Orcas", detail: ferryDetail, paid: false, extra: [ferryOut] }),
  step({
    day: night,
    start: "7:15 PM",
    end: "7:35 PM",
    title: "Drive to the motel in Eastsound",
    detail: "About 9 miles from the ferry landing.",
    paid: false,
    miles: 9,
  }),
  step({
    day: night,
    start: "7:35 PM",
    end: "8:30 PM",
    title: "Check in and dinner",
    detail: "One room with two beds for the night.",
    paid: false,
    extra: [
      { label: `Motel: 1 room at $${rates.motelRoom} plus ${Math.round(rates.lodgingTax * 100)}% tax`, amount: lodging },
      meals("dinner"),
    ],
  }),
  step({
    day: estimateDay,
    start: "7:00 AM",
    end: "7:30 AM",
    title: "Breakfast and check out",
    detail: "Before the crew member goes on the clock.",
    paid: false,
    extra: [meals("breakfast")],
  }),
  step({
    day: estimateDay,
    start: "7:30 AM",
    end: "7:45 AM",
    title: "Drive to the site",
    detail: "A couple of miles from Eastsound.",
    miles: 2,
  }),
  step({
    day: estimateDay,
    start: "7:45 AM",
    end: "12:00 PM",
    title: "Field-measure the roof",
    detail: `${siteVisitDetail} With the whole morning, there's time to measure everything twice.`,
    work: true,
  }),
  step({
    day: estimateDay,
    start: "12:00 PM",
    end: "12:30 PM",
    title: "Lunch",
    detail: "Unpaid meal break.",
    paid: false,
    extra: [meals("lunch")],
  }),
  step({
    day: estimateDay,
    start: "12:30 PM",
    end: "3:15 PM",
    title: "Update the cut list and send it to Nu-Ray",
    detail: `${orderDetail} Still near the site, so anything missed can be re-measured before leaving.`,
    work: true,
  }),
  step({
    day: estimateDay,
    start: "3:15 PM",
    end: "4:35 PM",
    title: "Drive to the Orcas ferry landing and wait in line",
    detail: "About 9 miles back to the landing, in line by about 3:40 PM.",
    miles: 9,
  }),
  step({ day: estimateDay, start: "4:35 PM", end: "5:45 PM", title: "Ferry Orcas to Anacortes", detail: "No fare is collected eastbound." }),
  step({
    day: estimateDay,
    start: "5:45 PM",
    end: "6:45 PM",
    title: "Drive back to HQ in Coupeville",
    detail: "About 35 miles back down SR-20.",
    miles: 35,
  }),
];

const overnight: PlanPhase = {
  number: 1,
  part: 2,
  option: { letter: "C", name: "Plans changed: field measure, overnight" },
  title: "Confirm the measurements",
  summary:
    "The framing doesn't match the plans, so the roof has to be measured before ordering. Take the evening ferry to Orcas the night before, stay in a cheap motel in Eastsound, and start measuring first thing. Costs more, but leaves most of the day on the roof, for a complicated roof or big changes.",
  steps: overnightSteps,
  labor: crewLabor(overnightSteps, "7:30 AM to 6:45 PM on the measure day, less the unpaid lunch"),
  assumptions: [
    ...sharedAssumptions,
    "Travel the night before is unpaid. Washington's rules on paying for travel time are worth checking with L&I.",
    `One motel room with two beds at about $${rates.motelRoom} a night plus ${Math.round(rates.lodgingTax * 100)}% tax. Orcas has few true budget motels; listings in Eastsound run about $140–180. Replace this with a real quote.`,
    "On the measure day the crew member is on the clock from 7:30 AM until back at HQ, less a 30-minute unpaid lunch.",
  ],
  sources: [
    ...ferrySources,
    { label: "Eastsound lodging listings (rough guide)", url: "https://www.expedia.com/Eastsound-Hotels-Cheap-Hotels.0-0-d1164-tCheapHotels.Travel-Guide-Filter-Hotels" },
  ],
};

// ---- Challenge 1, phase 1, part 3: order the metal ----

const panelCost = round2(orderSqFt * order.panelPricePerSqFt);

const orderSteps: PlanStep[] = [
  step({
    day: office,
    start: "10:30 AM",
    end: "11:00 AM",
    title: "Approve the order and pay",
    detail:
      `Once the measurements are confirmed (part 2) and the homeowner's deposit is in, sign Nu-Ray's final quote, pay, and get a written order confirmation with the lead time and the yard address. Order ${iceWaterRolls} rolls of ${iceWater.product} ice and water shield for the dry-in from the Northwest roofing supplier Nu-Ray recommends: ask the rep for one near their yard, so it's picked up on the same trip. Ask Nu-Ray to hold the order for pickup until the roof is sheathed (phase 2).`,
    paid: false,
  }),
];

const orderMetal: PlanPhase = {
  number: 1,
  part: 3,
  title: "Order the metal",
  summary:
    "Place the order with Nu-Ray once the measurements are confirmed and the deposit is in: the panels, trim and accessories. Order the ice and water shield that covers the whole deck for the dry-in, CertainTeed WinterGuard HT, from the supplier Nu-Ray recommends.",
  steps: orderSteps,
  labor: [{ label: "Owner: desk work, not paid hourly", amount: 0 }],
  materials: [
    {
      label: `Panels: ${orderSqFt.toLocaleString("en-US")} sq ft (${order.roofSquares} squares plus ${order.waste * 100}% waste) at $${order.panelPricePerSqFt.toFixed(2)}/sq ft`,
      amount: panelCost,
    },
    {
      label: `Trim, clips, screws, closures, sealant: about ${order.accessoriesShare * 100}% of the panels`,
      amount: round2(panelCost * order.accessoriesShare),
    },
    {
      label: `Ice and water shield, ${iceWater.product}, from Nu-Ray's recommended supplier: ${iceWaterRolls} rolls of ${iceWater.rollSqFt} sq ft (${iceWater.squares} squares plus ${iceWater.laps * 100}% for laps) at $${iceWater.rollPrice} (placeholder)`,
      amount: round2(iceWaterRolls * iceWater.rollPrice),
    },
  ],
  assumptions: [
    `Ice and water shield is ${iceWater.product}, CertainTeed's high-temperature membrane for metal roofs, from a Northwest roofing supplier Nu-Ray recommends; ask their rep for the name (SRS Distribution lists Nu-Ray as a key supplier). The $${iceWater.rollPrice} a roll is a placeholder until that supplier quotes: no HT price is published, and other WinterGuard rolls list at about $105–205.`,
    "The panel and trim prices are placeholders until Nu-Ray quotes. Published material-only prices for 24-gauge standing seam run about $2.50–9.00 per sq ft. Sales tax isn't included.",
    "Panels are cut to length for this roof and can't be returned, so nothing is ordered before the contract, the deposit and the measurements.",
  ],
  sources: [
    { label: "Nu-Ray Metals", url: "https://www.nuraymetals.com/" },
    { label: "Standing seam material prices (national guide)", url: "https://roofvista.com/resources/guides/metal-roofing-cost" },
    { label: "SRS Distribution: Nu-Ray Metals key supplier listing", url: "https://www.srsdistribution.com/en/products/key-suppliers/nu-ray-metals/" },
    { label: "CertainTeed WinterGuard HT listing (Hancock Lumber)", url: "https://shop.hancocklumber.com/product/certainteed-winter-guard-ht-ice-water-36-x65-619693" },
    { label: "CertainTeed WinterGuard underlayments brochure", url: "https://www.buildsite.com/pdf/certainteed/Winterguard-Underlayments-Summary-Brochure-2954589.pdf" },
  ],
};

// ---- Challenge 1, phase 2: dry-in and metal delivery ----

const day1 = "Day 1: pickup and ferry";
const day2 = "Day 2: unload and start the dry-in";
const day3 = "Day 3: finish the dry-in";
const day4 = "Day 4: return the trailer";
const diesel = (mpg: number) => ({ mpg, diesel: true });
const motelNight: CostLine = {
  label: `Motel: 1 room at $${rates.motelRoom} plus ${Math.round(rates.lodgingTax * 100)}% tax`,
  amount: round2(rates.motelRoom * (1 + rates.lodgingTax)),
};

// Phase 2 is the crew's job: two paid crew members on the road, and the crew lead handles the calls.
const lead = "Crew lead, from the office";
const crewStep = (input: StepInput) => step({ crew: input.day === lead ? 1 : 2, ...input });

const deliverySteps: PlanStep[] = [
  crewStep({
    day: lead,
    start: "8:00 AM",
    end: "8:30 AM",
    title: "The general contractor says the roof is sheathed",
    detail:
      "Agree on the dry-in date. Ask where to stage the metal, whether the site has power, and whether a telehandler will be on site (it would save unloading by hand). Confirm with Nu-Ray, and with the supplier holding the ice and water shield, that both orders are ready for pickup.",
  }),
  crewStep({
    day: lead,
    start: "8:30 AM",
    end: "9:30 AM",
    title: "Book the trailer, the ferry and the motel",
    detail: `Rent a 30 ft flatbed for ${rates.trailerDays} days from a yard near Nu-Ray. Check that its hitch (gooseneck or bumper-pull) and brake plug fit the F-550, and that its rated capacity covers the load. Book the 3:20 PM Anacortes–Orcas sailing for the F-550 and trailer (call WSF if the online system won't take a vehicle that long) and the 6:50 AM back on day 4. Book three nights in Eastsound.`,
  }),
  crewStep({
    day: "Day before",
    start: "3:00 PM",
    end: "3:30 PM",
    title: "Get the F-550 ready",
    detail:
      "Fuel up and load the straps, edge protectors, 4x4 dunnage to keep the bundles off the deck, a tarp, work gloves, and the tools for the dry-in (hammer tackers, knives, chalk line, harnesses and roof anchors).",
    extra: [{ label: "Straps, edge protectors, dunnage, tarp (if not on hand)", amount: rates.loadSupplies }],
  }),
  crewStep({
    day: day1,
    start: "5:15 AM",
    end: "8:00 AM",
    title: "Drive Coupeville to the rental yard near Nu-Ray",
    detail: "About 130 miles: over Deception Pass to I-5 at Burlington, then south through Seattle in morning traffic.",
    miles: 130,
    ...diesel(rates.f550Mpg),
  }),
  crewStep({
    day: day1,
    start: "8:00 AM",
    end: "8:45 AM",
    title: "Pick up the rental trailer",
    detail: "Walk around it with the yard (tires, lights, brakes, deck), photograph any damage, hitch it and test the brakes.",
    extra: [{ label: `Trailer rental: ${rates.trailerDays} days at $${rates.trailerPerDay}`, amount: rates.trailerDays * rates.trailerPerDay }],
  }),
  crewStep({ day: day1, start: "8:45 AM", end: "9:00 AM", title: "Drive to Nu-Ray's yard", detail: "A few miles, towing empty.", miles: 3, ...diesel(rates.towMpgEmpty) }),
  crewStep({
    day: day1,
    start: "9:00 AM",
    end: "10:30 AM",
    title: "Load, check and secure the order",
    detail:
      "Nu-Ray loads the bundles by forklift. Before signing, count every bundle, trim piece and roll of ice and water shield against the order and check color, gauge and damage. Set the bundles on dunnage, strap them down with edge protectors, and tarp the load.",
  }),
  crewStep({
    day: day1,
    start: "10:30 AM",
    end: "11:00 AM",
    title: "Pick up the ice and water shield",
    detail: `Stop at the supplier Nu-Ray recommended, near their yard. Count the ${iceWaterRolls} rolls, load them on the trailer and strap them down.`,
    miles: 5,
    ...diesel(rates.towMpgLoaded),
  }),
  crewStep({
    day: day1,
    start: "11:00 AM",
    end: "1:30 PM",
    title: "Drive up I-5 to the Anacortes ferry terminal",
    detail: "About 110 miles north on I-5, then west on SR-20 at Burlington. Loaded, so take it steady.",
    miles: 110,
    ...diesel(rates.towMpgLoaded),
  }),
  crewStep({ day: day1, start: "1:30 PM", end: "2:00 PM", title: "Lunch", detail: "Unpaid meal break in Anacortes.", paid: false, extra: [meals("lunch")] }),
  crewStep({
    day: day1,
    start: "2:00 PM",
    end: "3:20 PM",
    title: "Wait in the ferry line",
    detail: "In line 45–60 minutes before the 3:20 PM sailing. The earlier 11:55 AM boat leaves before the load can get there.",
  }),
  crewStep({
    day: day1,
    start: "3:20 PM",
    end: "4:50 PM",
    title: "Ferry Anacortes to Orcas",
    detail:
      "The F-550 and trailer should measure under 60 ft, which pays the under-60-ft fare with the driver included (under 70 ft is $372.90). The second crew member pays the passenger fare. The return trip is free.",
    extra: [
      {
        label: `Ferry: F-550 and trailer under 60 ft plus ${rates.people - 1} passenger, with the 3% card fee`,
        amount: round2((rates.rigFareUnder60 + (rates.people - 1) * rates.passengerFare) * (1 + rates.cardFee)),
      },
    ],
  }),
  crewStep({ day: day1, start: "4:50 PM", end: "5:15 PM", title: "Drive to the site", detail: "About 9 miles to the Eastsound area, loaded.", miles: 9, ...diesel(rates.towMpgLoaded) }),
  crewStep({
    day: day1,
    start: "5:15 PM",
    end: "5:45 PM",
    title: "Park and secure the load for the night",
    detail: "It's close to dark, so leave the metal on the trailer: park where the general contractor says, chock the wheels, check the straps and tarp, and unhitch.",
  }),
  crewStep({ day: day1, start: "5:45 PM", end: "6:00 PM", title: "Drive to the motel in Eastsound", detail: "A couple of miles, without the trailer.", miles: 2, ...diesel(rates.f550Mpg) }),
  crewStep({
    day: day1,
    start: "6:00 PM",
    end: "7:00 PM",
    title: "Check in and dinner",
    detail: "One room with two beds.",
    paid: false,
    extra: [motelNight, meals("dinner")],
  }),
  crewStep({ day: day2, start: "6:45 AM", end: "7:15 AM", title: "Breakfast", detail: "Before the crew goes on the clock.", paid: false, extra: [meals("breakfast")] }),
  crewStep({ day: day2, start: "7:15 AM", end: "7:30 AM", title: "Drive to the site", detail: "A couple of miles from Eastsound.", miles: 2, ...diesel(rates.f550Mpg) }),
  crewStep({
    day: day2,
    start: "7:30 AM",
    end: "10:30 AM",
    title: "Unload by hand",
    detail:
      "Two people carry the panels off one at a time, flat and supported, and stack them on dunnage where the general contractor wants them. Keep the bundles in order of length, count everything again, and cover the stack. Set the ice and water rolls and eave trim aside for the dry-in.",
  }),
  crewStep({
    day: day2,
    start: "10:30 AM",
    end: "12:30 PM",
    title: "Start the dry-in",
    detail:
      "Set roof anchors and harnesses. Walk the deck with the general contractor for loose or damaged sheathing; it has to be clean and dry for the membrane to stick. Install the eave flashing, line the valley first, then roll the ice and water shield from the eaves up, one person peeling the release film and one pressing it down, lapped as the manufacturer specifies.",
  }),
  crewStep({ day: day2, start: "12:30 PM", end: "1:00 PM", title: "Lunch", detail: "Unpaid meal break on site.", paid: false, extra: [meals("lunch")] }),
  crewStep({
    day: day2,
    start: "1:00 PM",
    end: "4:30 PM",
    title: "Keep going on the dry-in",
    detail: "Work up the roof plane by plane. At the end of the day, make sure every edge of the membrane laid so far is lapped and sealed in case of rain overnight.",
  }),
  crewStep({ day: day2, start: "4:30 PM", end: "4:45 PM", title: "Drive to the motel", detail: "Leave the empty trailer at the site.", miles: 2, ...diesel(rates.f550Mpg) }),
  crewStep({ day: day2, start: "4:45 PM", end: "6:00 PM", title: "Second night and dinner", detail: "Same room.", paid: false, extra: [motelNight, meals("dinner")] }),
  crewStep({ day: day3, start: "6:45 AM", end: "7:15 AM", title: "Breakfast", detail: "Before the crew goes on the clock.", paid: false, extra: [meals("breakfast")] }),
  crewStep({ day: day3, start: "7:15 AM", end: "7:30 AM", title: "Drive to the site", detail: "A couple of miles from Eastsound.", miles: 2, ...diesel(rates.f550Mpg) }),
  crewStep({
    day: day3,
    start: "7:30 AM",
    end: "12:00 PM",
    title: "Finish the dry-in",
    detail: "Ice and water shield over the rest of the roof and over the ridge, flashed tight around every penetration.",
  }),
  crewStep({ day: day3, start: "12:00 PM", end: "12:30 PM", title: "Lunch", detail: "Unpaid meal break on site.", paid: false, extra: [meals("lunch")] }),
  crewStep({
    day: day3,
    start: "12:30 PM",
    end: "3:00 PM",
    title: "Check the dry-in with the general contractor",
    detail:
      "Roll every lap, check that the deck is fully covered and the laps shed water, and fix anything loose. Walk the roof with the general contractor to show the house is dried in. Clean up the release film and offcuts, and leave the panel stack covered for the install.",
  }),
  crewStep({ day: day3, start: "3:00 PM", end: "3:15 PM", title: "Hitch the trailer and drive to the motel", detail: "A couple of miles, towing empty.", miles: 2, ...diesel(rates.towMpgEmpty) }),
  crewStep({ day: day3, start: "3:15 PM", end: "6:00 PM", title: "Third night and dinner", detail: "Same room.", paid: false, extra: [motelNight, meals("dinner")] }),
  crewStep({
    day: day4,
    start: "5:45 AM",
    end: "6:50 AM",
    title: "Drive to the Orcas ferry landing and wait in line",
    detail: "About 9 miles with the empty trailer, in line by about 6:05 AM for the 6:50 AM sailing.",
    miles: 9,
    ...diesel(rates.towMpgEmpty),
  }),
  crewStep({
    day: day4,
    start: "6:50 AM",
    end: "8:20 AM",
    title: "Ferry Orcas to Anacortes",
    detail: "No fare is collected eastbound. Breakfast on the boat.",
    extra: [meals("breakfast")],
  }),
  crewStep({
    day: day4,
    start: "8:20 AM",
    end: "10:50 AM",
    title: "Drive the empty trailer back to the rental yard",
    detail: "About 115 miles south on I-5.",
    miles: 115,
    ...diesel(rates.towMpgEmpty),
  }),
  crewStep({ day: day4, start: "10:50 AM", end: "11:20 AM", title: "Return the trailer", detail: "Walk around it with the yard and get the return signed off." }),
  crewStep({ day: day4, start: "11:20 AM", end: "11:50 AM", title: "Lunch", detail: "Unpaid meal break.", paid: false, extra: [meals("lunch")] }),
  crewStep({
    day: day4,
    start: "11:50 AM",
    end: "2:50 PM",
    title: "Drive back to HQ in Coupeville",
    detail: "About 130 miles north on I-5 and over Deception Pass.",
    miles: 130,
    ...diesel(rates.f550Mpg),
  }),
];

const dryInDelivery: PlanPhase = {
  number: 2,
  title: "Dry-in and metal delivery",
  summary:
    "The crew's job, without the owner. Starts when the general contractor says the roof is sheathed. Pick up the metal at Nu-Ray and the ice and water shield at the supplier they recommend, with the F-550 and a rented 30 ft trailer, drive up I-5 to the Anacortes ferry, and park the load on site overnight. Next morning, unload by hand and start the dry-in: high-temperature ice and water shield over the whole deck, which takes about a day and a half. On day 4, take the early boat back and return the trailer.",
  steps: deliverySteps,
  labor: crewLabor(
    deliverySteps,
    "the crew lead's 1½ hours of calls and bookings, then both crew members for half an hour of prep, 5:15 AM to 6:00 PM on day 1, 7:15 AM to 4:45 PM on day 2, 7:15 AM to 3:15 PM on day 3 and 5:45 AM to 2:50 PM on day 4, less the unpaid lunches",
    "Two crew members, one of them the crew lead (hours are person-hours)",
    false,
  ),
  assumptions: [
    "The owner isn't part of phase 2. Two paid crew members make the trip, and the crew lead (one of them) handles the calls and bookings on the clock. Two people are needed to unload long panels and to lay the membrane.",
    "The dry-in is 40 squares of CertainTeed WinterGuard HT, a self-adhered ice and water shield, laid by the two crew members over about a day and a half (roughly 13 hours on the roof, or about 3 squares an hour). A commercial labor study puts self-adhered membrane at about 54 labor-minutes per square, so this could run longer on a cut-up roof. The deck has to be dry for the membrane to stick, so rain can push it back a day.",
    "If the roof was field-measured (phase 1, part 2, option B or C), the metal can't arrive until its lead time after the sheathing. The general contractor may need the dry-in sooner, which would mean a separate dry-in trip with the ice and water shield bought on its own.",
    "Four days on the road: about 12, 9, 7½ and 8½ paid hours per crew member. Washington overtime is weekly (over 40 hours), so this can push the crew member into overtime if the week is already full.",
    `The trailer rental is a placeholder of $${rates.trailerPerDay} a day for ${rates.trailerDays} days, until a yard near Nu-Ray quotes. Ask about mileage charges, deposit and damage waiver.`,
    `The load is roughly ${loadLb.toLocaleString("en-US")} lb (24-gauge panels at about ${order.lbPerSqFt} lb per sq ft of roof, plus trim, accessories and ${iceWaterRolls} rolls of ice and water shield), well within what an F-550 can tow.`,
    "Check the driver's license class: a combination rated at 26,001 lb or more with a trailer rated over 10,000 lb needs a Class A CDL. Commercial vehicles over 10,000 lb may also need a USDOT number and a medical card for the driver.",
    `Diesel at $${rates.dieselPrice}/gal (Washington average); the F-550 at ${rates.f550Mpg} mpg alone, ${rates.towMpgEmpty} mpg with the empty trailer and ${rates.towMpgLoaded} mpg loaded (assumed).`,
  ],
  sources: [
    { label: "Nu-Ray contact and pickup", url: "https://www.nuraymetals.com/contact" },
    { label: "Self-adhered vs. TPO labor study (CertainTeed)", url: "https://certainteed.com/inspiration/how-tos/need-speed-self-adhered-versus-tpo-single-ply-roofing" },
    { label: "WSF fares: Anacortes to Orcas", url: "https://www.wsdot.wa.gov/ferries/fares/faresdetail.aspx?departingterm=1&arrivingterm=15" },
    { label: "WSF fall 2026 schedule: Anacortes / San Juan Islands", url: "https://wsdot.com/ferries/schedule/scheduledetailbyroute.aspx?route=ana-sj-sid" },
  ],
};

const all: Challenge[] = [
  {
    id: "metal-new-construction",
    number: 1,
    title: "40-square metal roof on new construction",
    location: "Orcas Island",
    phases: [bid, fromPlans, dayTrip, overnight, orderMetal, dryInDelivery],
  },
  {
    id: "composite-tear-off",
    number: 2,
    title: "40-square composite roof with tear-off",
    location: "Friday Harbor, San Juan Island",
    phases: [],
  },
  {
    id: "tpo-flat-tear-off",
    number: 3,
    title: "60-square TPO flat roof with tear-off",
    location: "Orcas Island",
    phases: [],
  },
];

export const challenges: ChallengeSummary[] = all.map(({ id, number, title, location }) => ({ id, number, title, location }));

export const findChallenge = (id: string) => all.find((c) => c.id === id);
