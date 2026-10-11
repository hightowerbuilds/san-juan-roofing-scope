// Builds server/data/san-juan-towns.json from the Census Bureau's keyless ACS 5-year
// summary files (2020–2024). Run: bun scripts/census-san-juan.ts
//
// Tables: B25001 (housing units), B25035 (median year built), B25034 (units by year built),
// B25004 (vacancy status, for seasonal homes).

const BASE = "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData";
const VINTAGE = "ACS 2020–2024 5-year estimates";

type Area = { geoId: string; name: string; kind: "zip" | "place" | "county"; zip?: string; island?: string };

// ZIP areas (ZCTAs) lying entirely within San Juan County, per the Census 2020
// ZCTA-to-county relationship file. 98221 (Anacortes) only clips the county and is excluded.
const areas: Area[] = [
  { geoId: "860Z200US98250", name: "Friday Harbor", kind: "zip", zip: "98250", island: "San Juan" },
  { geoId: "860Z200US98245", name: "Eastsound", kind: "zip", zip: "98245", island: "Orcas" },
  { geoId: "860Z200US98243", name: "Deer Harbor", kind: "zip", zip: "98243", island: "Orcas" },
  { geoId: "860Z200US98279", name: "Olga", kind: "zip", zip: "98279", island: "Orcas" },
  { geoId: "860Z200US98280", name: "Orcas", kind: "zip", zip: "98280", island: "Orcas" },
  { geoId: "860Z200US98261", name: "Lopez Island", kind: "zip", zip: "98261", island: "Lopez" },
  { geoId: "860Z200US98286", name: "Shaw Island", kind: "zip", zip: "98286", island: "Shaw" },
  { geoId: "860Z200US98297", name: "Waldron", kind: "zip", zip: "98297", island: "Waldron" },
  { geoId: "860Z200US98222", name: "Blakely Island", kind: "zip", zip: "98222", island: "Blakely" },
  // The county's only Census places; both sit inside ZIP 98250.
  { geoId: "1600000US5325615", name: "Friday Harbor (town limits)", kind: "place", island: "San Juan" },
  { geoId: "1600000US5359075", name: "Roche Harbor (CDP)", kind: "place", island: "San Juan" },
  { geoId: "0500000US53055", name: "San Juan County", kind: "county" },
];

// Midpoints for B25034 bins (_002.._011). "2020 or later" spans 2020–2024; the open-ended
// "1939 or earlier" bin is assumed to center on 1925.
const BIN_MIDPOINTS = [2022, 2014.5, 2004.5, 1994.5, 1984.5, 1974.5, 1964.5, 1954.5, 1944.5, 1925];

async function loadTable(table: string): Promise<Map<string, Record<string, string>>> {
  const res = await fetch(`${BASE}/acsdt5y2024-${table}.dat`);
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
  const [header, ...lines] = (await res.text()).split("\n");
  const cols = header!.trim().split("|");
  const wanted = new Set(areas.map((a) => a.geoId));
  const rows = new Map<string, Record<string, string>>();
  for (const line of lines) {
    const geoId = line.slice(0, line.indexOf("|"));
    if (!wanted.has(geoId)) continue;
    const values = line.trim().split("|");
    rows.set(geoId, Object.fromEntries(cols.map((c, i) => [c, values[i]!])));
  }
  return rows;
}

const num = (v: string | undefined) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

const [units, median, byYear, vacancy] = await Promise.all(["b25001", "b25035", "b25034", "b25004"].map(loadTable));

const rows = areas.map((area) => {
  const u = units!.get(area.geoId);
  const m = median!.get(area.geoId);
  const y = byYear!.get(area.geoId);
  const v = vacancy!.get(area.geoId);
  if (!u || !m || !y || !v) throw new Error(`Missing data for ${area.geoId}`);

  const bins = BIN_MIDPOINTS.map((_, i) => num(y[`B25034_E${String(i + 2).padStart(3, "0")}`]) ?? 0);
  const total = bins.reduce((a, b) => a + b, 0);
  const estAverage = total ? bins.reduce((sum, n, i) => sum + n * BIN_MIDPOINTS[i]!, 0) / total : null;

  return {
    ...area,
    homes: num(u.B25001_E001),
    homesMoe: num(u.B25001_M001),
    medianYearBuilt: num(m.B25035_E001),
    medianYearBuiltMoe: num(m.B25035_M001),
    estAverageYearBuilt: estAverage === null ? null : Math.round(estAverage),
    seasonalHomes: num(v.B25004_E006),
    seasonalHomesMoe: num(v.B25004_M006),
    builtBefore1980Share: total ? Math.round((bins.slice(5).reduce((a, b) => a + b, 0) / total) * 100) : null,
  };
});

const out = {
  source: VINTAGE,
  sourceUrl: "https://www.census.gov/programs-surveys/acs/data/summary-file.html",
  generatedAt: new Date().toLocaleDateString("en-CA"), // local YYYY-MM-DD
  rows,
};
await Bun.write("server/data/san-juan-towns.json", JSON.stringify(out, null, 2) + "\n");
console.table(rows.map(({ name, homes, homesMoe, medianYearBuilt, medianYearBuiltMoe, estAverageYearBuilt, builtBefore1980Share }) =>
  ({ name, homes, homesMoe, medianYearBuilt, medianYearBuiltMoe, estAverageYearBuilt, builtBefore1980Share })));
