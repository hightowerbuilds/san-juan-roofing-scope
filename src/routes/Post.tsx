import { Link, getRouteApi } from "@tanstack/solid-router";
import { useQuery } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import { postQuery } from "../lib/api";
import { formatDate } from "../lib/format";
import { DataTableView } from "../components/DataTable";

const route = getRouteApi("/research/$projectId/$postId");

export function PostPage() {
  const params = route.useParams();
  const post = useQuery(() => postQuery(params().projectId, params().postId));

  return (
    <Show when={post.data}>
      {(p) => (
        <article class="page post">
          <p class="crumb">
            <Link to="/">{p().projectTitle}</Link>
          </p>
          <h1>{p().title}</h1>
          <time class="muted" datetime={p().date}>{formatDate(p().date)}</time>

          <div class="prose">
            <For each={p().body}>{(paragraph) => <p>{paragraph}</p>}</For>
          </div>

          <For each={p().tables}>{(table) => <DataTableView table={table} />}</For>

          <section class="notes">
            <h2>Notes</h2>
            <ul>
              <For each={p().notes}>{(note) => <li>{note}</li>}</For>
            </ul>
            <p>
              Source: <a href={p().source.url} target="_blank" rel="noopener">{p().source.label}</a>
            </p>
          </section>
        </article>
      )}
    </Show>
  );
}
