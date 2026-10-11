import { createStore } from "@tanstack/solid-store";
import type { QuoteInput } from "../../shared/types";

const STORAGE_KEY = "quote-draft";

const empty: QuoteInput = {
  name: "",
  email: "",
  phone: "",
  island: "",
  address: "",
  service: "",
  details: "",
};

function load(): QuoteInput {
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return empty;
  }
}

// The quote draft survives navigation and reloads, so visitors can browse
// services or islands mid-form without losing what they typed.
export const quoteStore = createStore(load(), ({ setState }) => ({
  set: <K extends keyof QuoteInput>(key: K, value: QuoteInput[K]) =>
    setState((s) => ({ ...s, [key]: value })),
  reset: () => setState(() => empty),
}));

quoteStore.subscribe((draft) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {}
});
