import type { DataTable, Post, Project } from "../shared/types";
import towns from "./data/san-juan-towns.json";

type TownRow = (typeof towns.rows)[number];

const fmt = (n: number | null) => (n === null ? null : n.toLocaleString("en-US"));

const townColumns: DataTable["columns"] = [
  { key: "name", label: "Town" },
  { key: "zip", label: "ZIP" },
  { key: "island", label: "Island" },
  { key: "homes", label: "Homes", numeric: true, moeKey: "homesMoe" },
  { key: "median", label: "Median year built", numeric: true, moeKey: "medianMoe" },
  { key: "average", label: "Avg. year built (est.)", numeric: true },
  { key: "pre1980", label: "Built before 1980", numeric: true },
];

function townRow(r: TownRow) {
  return {
    name: r.name,
    zip: r.zip ?? "—",
    island: r.island ?? "—",
    homes: fmt(r.homes),
    homesMoe: r.homesMoe === null ? null : `±${fmt(r.homesMoe)}`,
    median: r.medianYearBuilt,
    medianMoe: r.medianYearBuiltMoe === null ? null : `±${r.medianYearBuiltMoe}`,
    average: r.estAverageYearBuilt,
    pre1980: r.builtBefore1980Share === null ? null : `${r.builtBefore1980Share}%`,
  };
}

const zipRows = towns.rows.filter((r) => r.kind === "zip").sort((a, b) => (b.homes ?? 0) - (a.homes ?? 0));
const county = towns.rows.find((r) => r.kind === "county")!;
const places = towns.rows.filter((r) => r.kind === "place");
const totalZipHomes = zipRows.reduce((sum, r) => sum + (r.homes ?? 0), 0);
const fridayHarbor = zipRows.find((r) => r.zip === "98250")!;
const olderTowns = new Intl.ListFormat("en-US").format(
  zipRows.filter((r) => (r.builtBefore1980Share ?? 0) > 50).map((r) => r.name),
);

const townsPost: Post = {
  id: "towns-homes-and-age",
  projectId: "san-juan-statistics",
  projectTitle: "San Juan Statistics",
  title: "The towns of the San Juans: how many homes, and how old",
  date: "2026-10-10",
  summary: `A list of every town in San Juan County, with the number of homes in each and when they were built.`,
  body: [
    `Friday Harbor is the only incorporated town in San Juan County. The Census Bureau also recognizes one ` +
      `unincorporated community, Roche Harbor, as a census-designated place. Every other town in the islands ` +
      `is unincorporated, so there is no official boundary to count within. We use each town's ZIP code ` +
      `instead: nine ZIP code areas lie entirely inside the county, one per town.`,
    `The county has about ${fmt(county.homes)} homes. ${fridayHarbor.name} alone accounts for ` +
      `${Math.round(((fridayHarbor.homes ?? 0) / (county.homes ?? 1)) * 100)}% of them. ` +
      `The typical (median) home in the county was built in ${county.medianYearBuilt}. ` +
      `Housing is oldest in ${olderTowns}, where more than half of all homes were built before 1980.`,
    `"Homes" means all housing units, occupied or not. That matters here: ` +
      `${fmt(county.seasonalHomes)} homes, about ` +
      `${Math.round(((county.seasonalHomes ?? 0) / (county.homes ?? 1)) * 100)}% of the county, are held for ` +
      `seasonal or occasional use.`,
    `The nine towns add up to ${fmt(totalZipHomes)} homes, ${fmt((county.homes ?? 0) - totalZipHomes)} fewer ` +
      `than the county total. Part of the county falls in Anacortes's mainland ZIP code (98221) and isn't ` +
      `broken out here, and estimates for separate areas don't add up exactly.`,
  ],
  tables: [
    {
      title: "Towns (ZIP code areas)",
      columns: townColumns,
      rows: [
        ...zipRows.map((r) => ({ cells: townRow(r) })),
        { cells: { ...townRow(county), zip: "—", island: "All islands" }, total: true },
      ],
    },
    {
      title: "Census places (inside the Friday Harbor ZIP code)",
      columns: townColumns.filter((c) => c.key !== "zip"),
      rows: places.map((r) => ({ cells: townRow(r) })),
    },
  ],
  notes: [
    `All figures are ${towns.source}, so they are survey estimates. "±" is the Census Bureau's 90% margin ` +
      `of error; small towns like Waldron and Blakely Island have wide margins.`,
    `The Census publishes the median year built, not the average. The average shown here is estimated from ` +
      `the number of homes built in each decade, using the middle of each decade and assuming 1925 for homes ` +
      `built in 1939 or earlier.`,
    `ZIP code areas are the Census Bureau's ZIP Code Tabulation Areas (ZCTAs). Data was extracted with ` +
      `scripts/census-san-juan.ts on ${towns.generatedAt}.`,
  ],
  source: { label: "U.S. Census Bureau, American Community Survey summary file", url: towns.sourceUrl },
};

const posts: Post[] = [townsPost];

export const projects: Project[] = [
  {
    id: "san-juan-statistics",
    title: "San Juan Statistics",
    summary: "Facts and figures on the towns, homes and buildings of the San Juan Islands, from public data.",
    posts: posts
      .filter((p) => p.projectId === "san-juan-statistics")
      .map(({ id, title, date, summary }) => ({ id, title, date, summary })),
  },
];

export function findPost(projectId: string, postId: string): Post | undefined {
  return posts.find((p) => p.projectId === projectId && p.id === postId);
}
