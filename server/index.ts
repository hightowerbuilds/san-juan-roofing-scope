import { islands, services } from "./data";
import { createQuote, listQuotes } from "./db";
import { findPost, projects } from "./research";
import type { QuoteInput } from "../shared/types";

const isProd = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? (isProd ? 3000 : 3001));

const fields = ["name", "email", "phone", "island", "address", "service", "details"] as const;

function validate(body: unknown): QuoteInput | string {
  if (typeof body !== "object" || body === null) return "Invalid request body";
  const raw = body as Record<string, unknown>;
  const input = {} as QuoteInput;
  for (const f of fields) {
    const v = raw[f];
    if (typeof v !== "string") return `Missing field: ${f}`;
    input[f] = v.trim().slice(0, 2000);
  }
  if (!input.name) return "Name is required";
  if (!input.email.includes("@") && !input.phone) return "Provide an email or phone number";
  if (!islands.some((i) => i.id === input.island)) return "Choose an island";
  if (!services.some((s) => s.id === input.service)) return "Choose a service";
  return input;
}

// In production, serve the built SPA from dist/ with index.html as the fallback.
async function serveStatic(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);
  const file = Bun.file(`dist${pathname}`);
  if (pathname !== "/" && (await file.exists())) return new Response(file);
  return new Response(Bun.file("dist/index.html"));
}

const server = Bun.serve({
  port,
  routes: {
    "/api/services": () => Response.json(services),
    "/api/islands": () => Response.json(islands),
    "/api/projects": () => Response.json(projects),
    "/api/projects/:projectId/posts/:postId": (req) => {
      const post = findPost(req.params.projectId, req.params.postId);
      return post ? Response.json(post) : Response.json({ error: "Post not found" }, { status: 404 });
    },
    "/api/quotes": {
      // NOTE: unauthenticated for the prototype. Add auth before going live.
      GET: () => Response.json(listQuotes()),
      POST: async (req) => {
        const result = validate(await req.json().catch(() => null));
        if (typeof result === "string") return Response.json({ error: result }, { status: 400 });
        return Response.json({ id: createQuote(result) }, { status: 201 });
      },
    },
    "/api/*": () => Response.json({ error: "Not found" }, { status: 404 }),
  },
  fetch: isProd ? serveStatic : () => new Response("Not found", { status: 404 }),
});

console.log(`API listening on ${server.url}`);
