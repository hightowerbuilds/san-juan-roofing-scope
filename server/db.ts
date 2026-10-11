import { Database } from "bun:sqlite";
import type { Quote, QuoteInput } from "../shared/types";

const db = new Database(process.env.DB_PATH ?? "roofing.sqlite", { create: true, strict: true });

db.run(`
  CREATE TABLE IF NOT EXISTS quotes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    email     TEXT NOT NULL,
    phone     TEXT NOT NULL,
    island    TEXT NOT NULL,
    address   TEXT NOT NULL,
    service   TEXT NOT NULL,
    details   TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const insert = db.query<{ id: number }, QuoteInput>(`
  INSERT INTO quotes (name, email, phone, island, address, service, details)
  VALUES ($name, $email, $phone, $island, $address, $service, $details)
  RETURNING id
`);

const list = db.query<Quote, []>("SELECT * FROM quotes ORDER BY id DESC");

export function createQuote(input: QuoteInput): number {
  return insert.get(input)!.id;
}

export function listQuotes(): Quote[] {
  return list.all();
}
