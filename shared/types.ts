export type Service = {
  id: string;
  name: string;
  summary: string;
};

export type Island = {
  id: string;
  name: string;
  places: string[];
  access: "ferry" | "barge";
};

export type QuoteInput = {
  name: string;
  email: string;
  phone: string;
  island: string;
  address: string;
  service: string;
  details: string;
};

export type Quote = QuoteInput & {
  id: number;
  createdAt: string;
};

export type TableCell = string | number | null;

export type DataTable = {
  title: string;
  columns: { key: string; label: string; numeric?: boolean; moeKey?: string }[];
  rows: { cells: Record<string, TableCell>; total?: boolean }[];
};

export type PostSummary = {
  id: string;
  title: string;
  date: string;
  summary: string;
};

export type Post = PostSummary & {
  projectId: string;
  projectTitle: string;
  body: string[];
  tables: DataTable[];
  notes: string[];
  source: { label: string; url: string };
};

export type Project = {
  id: string;
  title: string;
  summary: string;
  posts: PostSummary[];
};

export type CostLine = { label: string; amount: number };

export type PlanStep = {
  day?: string; // e.g. "Night before"; omitted for single-day plans
  start: string; // "6:45 AM"
  end: string;
  title: string;
  detail: string;
  paidHours: number; // crew time on the clock, costed in the phase's labor lines
  estimateHours: number; // time spent on the estimate itself
  costs: CostLine[];
};

export type PlanPhase = {
  number: number;
  part?: number; // a phase can be split into parts, each with its own steps
  option?: { letter: string; name: string }; // alternative plans for the same phase (and part)
  title: string;
  summary: string;
  steps: PlanStep[]; // direct costs only
  labor: CostLine[]; // added at the end
  materials?: CostLine[]; // placeholder until a supplier quotes
  assumptions: string[];
  sources: { label: string; url: string }[];
};

export type ChallengeSummary = {
  id: string;
  number: number;
  title: string;
  location: string;
};

export type Challenge = ChallengeSummary & { phases: PlanPhase[] };
