import { queryOptions } from "@tanstack/solid-query";
import type { Island, Post, Project, Quote, QuoteInput, Service } from "../../shared/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const servicesQuery = queryOptions({
  queryKey: ["services"],
  queryFn: () => request<Service[]>("/api/services"),
  staleTime: Infinity,
});

export const islandsQuery = queryOptions({
  queryKey: ["islands"],
  queryFn: () => request<Island[]>("/api/islands"),
  staleTime: Infinity,
});

export const quotesQuery = queryOptions({
  queryKey: ["quotes"],
  queryFn: () => request<Quote[]>("/api/quotes"),
});

export const projectsQuery = queryOptions({
  queryKey: ["projects"],
  queryFn: () => request<Project[]>("/api/projects"),
});

export const postQuery = (projectId: string, postId: string) =>
  queryOptions({
    queryKey: ["post", projectId, postId],
    queryFn: () => request<Post>(`/api/projects/${projectId}/posts/${postId}`),
  });

export function submitQuote(input: QuoteInput) {
  return request<{ id: number }>("/api/quotes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
