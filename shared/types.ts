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
