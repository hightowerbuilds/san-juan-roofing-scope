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

export type ChallengeSummary = {
  id: string;
  number: number;
  title: string;
  island: string;
  place: string;
  summary: string;
  tags: string[];
};

export type ChallengePhase = {
  title: string;
  steps: string[];
  price: string[]; // what to put a cost on in this phase
};

export type Challenge = ChallengeSummary & {
  spec: { label: string; value: string }[];
  takeoff: DataTable;
  phases: ChallengePhase[];
  openQuestions: string[];
};
