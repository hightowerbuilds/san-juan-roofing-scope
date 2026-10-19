import { QueryClient } from "@tanstack/solid-query";
import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/solid-router";
import { islandsQuery, postQuery, projectsQuery, quotesQuery, servicesQuery } from "./lib/api";
import { pixelMapQuery } from "./lib/pixelMap";
import { Layout, NotFound } from "./routes/Layout";
import { Home } from "./routes/Home";
import { PostPage } from "./routes/Post";
import { Areas } from "./routes/Areas";
import { MapPage } from "./routes/MapPage";
import { QuotePage } from "./routes/Quote";
import { Leads } from "./routes/Leads";

export const queryClient = new QueryClient();

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Layout,
  notFoundComponent: NotFound,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery),
  component: Home,
});

const postRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/research/$projectId/$postId",
  loader: ({ context, params }) => context.queryClient.ensureQueryData(postQuery(params.projectId, params.postId)),
  component: PostPage,
});

const areasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/areas",
  component: Areas,
});

const mapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/map",
  staticData: { fullBleed: true },
  // Start the ~1.5 MB download (on link hover, via preload) without blocking; the page shows its own loading state.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(pixelMapQuery);
  },
  component: MapPage,
});

const quoteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/quote",
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(servicesQuery),
      context.queryClient.ensureQueryData(islandsQuery),
    ]),
  component: QuotePage,
});

const leadsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leads",
  loader: ({ context }) => context.queryClient.ensureQueryData(quotesQuery),
  component: Leads,
});

const routeTree = rootRoute.addChildren([homeRoute, postRoute, areasRoute, mapRoute, quoteRoute, leadsRoute]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  // Let TanStack Query own caching; the router just triggers loads.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
  interface StaticDataRouteOption {
    fullBleed?: boolean; // page renders edge to edge instead of inside .wrap
  }
}
