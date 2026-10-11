import type { Island, Service } from "../shared/types";

export const services: Service[] = [
  {
    id: "replacement",
    name: "Roof replacement",
    summary: "Full tear-off and new roof in asphalt shingle or standing-seam metal, built for marine weather.",
  },
  {
    id: "repair",
    name: "Repairs & leaks",
    summary: "Leak tracing, flashing, vents, skylights and storm damage. Fixed right the first time.",
  },
  {
    id: "inspection",
    name: "Inspections",
    summary: "Written condition reports for buyers, sellers, insurers and seasonal homeowners.",
  },
  {
    id: "maintenance",
    name: "Moss & maintenance",
    summary: "Moss removal, zinc treatment and gutter cleaning to keep island roofs lasting.",
  },
];

export const islands: Island[] = [
  {
    id: "san-juan",
    name: "San Juan Island",
    places: ["Friday Harbor", "Roche Harbor", "False Bay"],
    access: "ferry",
  },
  {
    id: "orcas",
    name: "Orcas Island",
    places: ["Eastsound", "Deer Harbor", "Orcas", "Olga", "Doe Bay"],
    access: "ferry",
  },
  {
    id: "lopez",
    name: "Lopez Island",
    places: ["Lopez Village", "Richardson", "Port Stanley"],
    access: "ferry",
  },
  {
    id: "shaw",
    name: "Shaw Island",
    places: ["Shaw"],
    access: "ferry",
  },
  {
    id: "outer",
    name: "Outer islands",
    places: ["Decatur", "Blakely", "Stuart", "Waldron"],
    access: "barge",
  },
];
