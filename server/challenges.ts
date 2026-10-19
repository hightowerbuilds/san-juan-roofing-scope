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
  trailerDays: 2,
  rigFareUnder60: 319.8, // Anacortes → Orcas, vehicle under 60 ft (F-550 + 30' trailer), driver included
  loadSupplies: 150, // straps, edge protectors, 4x4 dunnage, tarp, if not already on hand (assumed)
};

// The metal order, until Nu-Ray quotes it.
const order = {
  roofSquares: 40,
  waste: 0.1,
  panelPricePerSqFt: 5.0, // placeholder: published 24-ga material ranges run about $2.50–9.00/sq ft
  accessoriesShare: 0.2, // trim, clips, screws, closures, sealant, underlayment, as a share of panels (assumed)
  lbPerSqFt: 1.3, // 24-ga steel panel, per sq ft of roof covered (approximate)
  accessoriesLb: 600, // trim, fasteners, underlayment (approximate)
};
const orderSqFt = Math.round(order.roofSquares * (1 + order.waste) * 100);
const loadLb = Math.round((orderSqFt * order.lbPerSqFt + order.accessoriesLb) / 100) * 100;

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
  paid?: boolean; // the crew member is on the clock (default true)
  work?: boolean; // time spent on the estimate itself
  miles?: number;
  mpg?: number; // default: the F-150 alone
  diesel?: boolean; // the F-550 burns diesel
  extra?: CostLine[];
};

// Steps carry direct costs only; their paid time is costed once, in the labor lines at the end.
function step(input: StepInput): PlanStep {
  const { day, start, end, title, detail, paid = true, work = false, miles = 0, mpg = rates.mpg, diesel = false, extra = [] } = input;
  const hours = (minutes(end) - minutes(start)) / 60;
  const costs: CostLine[] = [];
  if (miles) {
    const price = diesel ? rates.dieselPrice : rates.fuelPrice;
    costs.push({ label: `${diesel ? "Diesel" : "Fuel"}: ${miles} mi at ${mpg} mpg`, amount: round2((miles / mpg) * price) });
  }
  costs.push(...extra);
  return { day, start, end, title, detail, paidHours: paid ? hours : 0, estimateHours: work ? hours : 0, costs };
}

function crewLabor(steps: PlanStep[], when: string): CostLine[] {
  const hours = steps.reduce((total, s) => total + s.paidHours, 0);
  return [
    { label: `Crew member: ${hrs(hours)} at $${rates.laborRate}/h (${when})`, amount: round2(hours * rates.laborRate) },
    { label: "Owner: rides along, not paid hourly", amount: 0 },
  ];
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
  "Truck wear and insurance aren't included. The metal order is costed in part 3.",
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

// ---- Challenge 1, phase 1, part 3: order from Nu-Ray, pick up, deliver to Orcas ----

const day1 = "Day 1: pickup and ferry";
const day2 = "Day 2: unload and return the trailer";
const panelCost = round2(orderSqFt * order.panelPricePerSqFt);
const diesel = (mpg: number) => ({ mpg, diesel: true });

const orderSteps: PlanStep[] = [
  step({
    day: office,
    start: "10:30 AM",
    end: "11:00 AM",
    title: "Approve the order and pay",
    detail:
      "Once the measurements are confirmed (part 2) and the homeowner's deposit is in, sign Nu-Ray's final quote, pay, and get a written order confirmation with the pickup date and yard address. Time the pickup to the start of phase 2, so the metal doesn't sit on site.",
    paid: false,
  }),
  step({
    day: office,
    start: "11:00 AM",
    end: "12:00 PM",
    title: "Book the trailer, the ferry and the motel",
    detail:
      "Rent a 30 ft flatbed for two days from a yard near Nu-Ray. Check that its hitch (gooseneck or bumper-pull) and brake plug fit the F-550, and that its rated capacity covers the load. Book the 3:20 PM Anacortes–Orcas sailing for the F-550 and trailer (call WSF if the online system won't take a vehicle that long) and the 11:50 AM back the next day. Book a room in Eastsound and tell the general contractor when the metal arrives.",
    paid: false,
  }),
  step({
    day: "Day before",
    start: "3:00 PM",
    end: "3:30 PM",
    title: "Get the F-550 ready",
    detail: "Fuel up and load the straps, edge protectors, 4x4 dunnage to keep the bundles off the deck, a tarp, and work gloves for unloading.",
    extra: [{ label: "Straps, edge protectors, dunnage, tarp (if not on hand)", amount: rates.loadSupplies }],
  }),
  step({
    day: day1,
    start: "5:15 AM",
    end: "8:00 AM",
    title: "Drive Coupeville to the rental yard near Nu-Ray",
    detail: "About 130 miles: over Deception Pass to I-5 at Burlington, then south through Seattle in morning traffic.",
    miles: 130,
    ...diesel(rates.f550Mpg),
  }),
  step({
    day: day1,
    start: "8:00 AM",
    end: "8:45 AM",
    title: "Pick up the rental trailer",
    detail: "Walk around it with the yard (tires, lights, brakes, deck), photograph any damage, hitch it and test the brakes.",
    extra: [{ label: `Trailer rental: ${rates.trailerDays} days at $${rates.trailerPerDay}`, amount: rates.trailerDays * rates.trailerPerDay }],
  }),
  step({
    day: day1,
    start: "8:45 AM",
    end: "9:00 AM",
    title: "Drive to Nu-Ray's yard",
    detail: "A few miles, towing empty.",
    miles: 3,
    ...diesel(rates.towMpgEmpty),
  }),
  step({
    day: day1,
    start: "9:00 AM",
    end: "10:30 AM",
    title: "Load, check and secure the order",
    detail:
      "Nu-Ray loads the bundles by forklift. Before signing, count every bundle and trim piece against the order and check color, gauge and damage. Set the bundles on dunnage, strap them down with edge protectors, and tarp the load.",
  }),
  step({
    day: day1,
    start: "10:30 AM",
    end: "1:15 PM",
    title: "Drive up I-5 to the Anacortes ferry terminal",
    detail: "About 110 miles north on I-5, then west on SR-20 at Burlington. Loaded, so take it steady.",
    miles: 110,
    ...diesel(rates.towMpgLoaded),
  }),
  step({
    day: day1,
    start: "1:15 PM",
    end: "1:45 PM",
    title: "Lunch",
    detail: "Unpaid meal break in Anacortes.",
    paid: false,
    extra: [meals("lunch")],
  }),
  step({
    day: day1,
    start: "1:45 PM",
    end: "3:20 PM",
    title: "Wait in the ferry line",
    detail: "In line 45–60 minutes before the 3:20 PM sailing, with time to spare. The earlier 11:55 AM boat leaves before the load can get there.",
  }),
  step({
    day: day1,
    start: "3:20 PM",
    end: "4:50 PM",
    title: "Ferry Anacortes to Orcas",
    detail:
      "The F-550 and trailer should measure under 60 ft, which pays the under-60-ft fare with the driver included (under 70 ft is $372.90). The second person pays the passenger fare. The return trip is free.",
    extra: [
      {
        label: `Ferry: F-550 and trailer under 60 ft plus ${rates.people - 1} passenger, with the 3% card fee`,
        amount: round2((rates.rigFareUnder60 + (rates.people - 1) * rates.passengerFare) * (1 + rates.cardFee)),
      },
    ],
  }),
  step({
    day: day1,
    start: "4:50 PM",
    end: "5:15 PM",
    title: "Drive to the site",
    detail: "About 9 miles to the Eastsound area, loaded.",
    miles: 9,
    ...diesel(rates.towMpgLoaded),
  }),
  step({
    day: day1,
    start: "5:15 PM",
    end: "5:45 PM",
    title: "Park and secure the load for the night",
    detail: "It's close to dark, so leave the metal on the trailer: park where the general contractor says, chock the wheels, check the straps and tarp, and unhitch.",
  }),
  step({
    day: day1,
    start: "5:45 PM",
    end: "6:00 PM",
    title: "Drive to the motel in Eastsound",
    detail: "A couple of miles, without the trailer.",
    miles: 2,
    ...diesel(rates.f550Mpg),
  }),
  step({
    day: day1,
    start: "6:00 PM",
    end: "7:00 PM",
    title: "Check in and dinner",
    detail: "One room with two beds.",
    paid: false,
    extra: [
      { label: `Motel: 1 room at $${rates.motelRoom} plus ${Math.round(rates.lodgingTax * 100)}% tax`, amount: round2(rates.motelRoom * (1 + rates.lodgingTax)) },
      meals("dinner"),
    ],
  }),
  step({
    day: day2,
    start: "6:45 AM",
    end: "7:15 AM",
    title: "Breakfast and check out",
    detail: "Before the crew member goes on the clock.",
    paid: false,
    extra: [meals("breakfast")],
  }),
  step({
    day: day2,
    start: "7:15 AM",
    end: "7:30 AM",
    title: "Drive to the site",
    detail: "A couple of miles from Eastsound.",
    miles: 2,
    ...diesel(rates.f550Mpg),
  }),
  step({
    day: day2,
    start: "7:30 AM",
    end: "10:30 AM",
    title: "Unload by hand",
    detail:
      "Two people carry the panels off one at a time, flat and supported, and stack them on dunnage where the general contractor wants them. Keep the bundles in order of length, count everything again, and cover the stack.",
  }),
  step({
    day: day2,
    start: "10:30 AM",
    end: "11:50 AM",
    title: "Drive to the Orcas ferry landing and wait in line",
    detail: "About 9 miles with the empty trailer, in line by about 10:50 AM for the 11:50 AM sailing.",
    miles: 9,
    ...diesel(rates.towMpgEmpty),
  }),
  step({ day: day2, start: "11:50 AM", end: "1:05 PM", title: "Ferry Orcas to Anacortes", detail: "No fare is collected eastbound." }),
  step({
    day: day2,
    start: "1:05 PM",
    end: "1:35 PM",
    title: "Lunch",
    detail: "Unpaid meal break in Anacortes.",
    paid: false,
    extra: [meals("lunch")],
  }),
  step({
    day: day2,
    start: "1:35 PM",
    end: "4:15 PM",
    title: "Drive the empty trailer back to the rental yard",
    detail: "About 115 miles south on I-5.",
    miles: 115,
    ...diesel(rates.towMpgEmpty),
  }),
  step({
    day: day2,
    start: "4:15 PM",
    end: "4:45 PM",
    title: "Return the trailer",
    detail: "Walk around it with the yard and get the return signed off.",
  }),
  step({
    day: day2,
    start: "4:45 PM",
    end: "7:45 PM",
    title: "Drive back to HQ in Coupeville",
    detail: "About 130 miles north on I-5 and over Deception Pass, in evening traffic.",
    miles: 130,
    ...diesel(rates.f550Mpg),
  }),
];

const orderPickup: PlanPhase = {
  number: 1,
  part: 3,
  title: "Order the metal and deliver it to Orcas",
  summary:
    "Order the panels, trim and accessories from Nu-Ray. Rent a 30 ft trailer near Nu-Ray, load the order there with the F-550, and drive up I-5 to the Anacortes ferry. On Orcas, park the load overnight, unload it by hand the next morning, and bring the empty trailer back to the rental yard.",
  steps: orderSteps,
  labor: crewLabor(orderSteps, "half an hour of prep the day before, then 5:15 AM to 6:00 PM on day 1 and 7:15 AM to 7:45 PM on day 2, less the unpaid lunches"),
  materials: [
    {
      label: `Panels: ${orderSqFt.toLocaleString("en-US")} sq ft (${order.roofSquares} squares plus ${order.waste * 100}% waste) at $${order.panelPricePerSqFt.toFixed(2)}/sq ft`,
      amount: panelCost,
    },
    {
      label: `Trim, clips, screws, closures, sealant, underlayment: about ${order.accessoriesShare * 100}% of the panels`,
      amount: round2(panelCost * order.accessoriesShare),
    },
  ],
  assumptions: [
    "The owner handles the order and the bookings, so that time isn't costed. The crew member is paid for the prep and both days on the road.",
    "Two very long days: about 12 paid hours each. Washington overtime is weekly (over 40 hours), so these days can push the crew member into overtime if the week is already full.",
    `The material prices are placeholders until Nu-Ray quotes. Published material-only prices for 24-gauge standing seam run about $2.50–9.00 per sq ft. Sales tax isn't included.`,
    `The trailer rental is a placeholder of $${rates.trailerPerDay} a day for ${rates.trailerDays} days, until a yard near Nu-Ray quotes. Ask about mileage charges, deposit and damage waiver.`,
    "Renting the trailer near Burlington or Mount Vernon instead would cut the trailer's return trip on day 2 (about 115 miles south and 130 back) to about 20 miles, saving roughly 5 hours of driving.",
    `The load is roughly ${loadLb.toLocaleString("en-US")} lb (24-gauge panels at about ${order.lbPerSqFt} lb per sq ft of roof, plus trim and accessories), well within what an F-550 can tow.`,
    "Check the driver's license class: a combination rated at 26,001 lb or more with a trailer rated over 10,000 lb needs a Class A CDL. Commercial vehicles over 10,000 lb may also need a USDOT number and a medical card for the driver.",
    `Diesel at $${rates.dieselPrice}/gal (Washington average); the F-550 at ${rates.f550Mpg} mpg alone, ${rates.towMpgEmpty} mpg with the empty trailer and ${rates.towMpgLoaded} mpg loaded (assumed).`,
    "Unloading by hand assumes the owner and the crew member, about 3 hours for roughly 150 panels plus trim.",
  ],
  sources: [
    { label: "Nu-Ray Metals", url: "https://www.nuraymetals.com/" },
    { label: "Nu-Ray roofing profiles", url: "https://www.nuraymetals.com/roofing" },
    { label: "Nu-Ray contact and pickup", url: "https://www.nuraymetals.com/contact" },
    { label: "WSF fares: Anacortes to Orcas", url: "https://www.wsdot.wa.gov/ferries/fares/faresdetail.aspx?departingterm=1&arrivingterm=15" },
    { label: "WSF fall 2026 schedule: Anacortes / San Juan Islands", url: "https://wsdot.com/ferries/schedule/scheduledetailbyroute.aspx?route=ana-sj-sid" },
    { label: "Standing seam material prices (national guide)", url: "https://roofvista.com/resources/guides/metal-roofing-cost" },
  ],
};

const all: Challenge[] = [
  {
    id: "metal-new-construction",
    number: 1,
    title: "40-square metal roof on new construction",
    location: "Orcas Island",
    phases: [bid, fromPlans, dayTrip, overnight, orderPickup],
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
