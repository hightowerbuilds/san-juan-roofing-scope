import { useQuery } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import { islandsQuery, quotesQuery, servicesQuery } from "../lib/api";

export function Leads() {
  const quotes = useQuery(() => quotesQuery);
  const islands = useQuery(() => islandsQuery);
  const services = useQuery(() => servicesQuery);

  const islandName = (id: string) => islands.data?.find((i) => i.id === id)?.name ?? id;
  const serviceName = (id: string) => services.data?.find((s) => s.id === id)?.name ?? id;

  return (
    <section class="page">
      <h1>Quote requests</h1>
      <p class="lede">Internal view. Not linked publicly — add auth before launch.</p>
      <Show when={quotes.data?.length} fallback={<p>No requests yet.</p>}>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Received</th><th>Name</th><th>Contact</th><th>Island</th><th>Service</th><th>Details</th></tr>
            </thead>
            <tbody>
              <For each={quotes.data}>
                {(q) => (
                  <tr>
                    <td>{q.id}</td>
                    <td>{new Date(q.createdAt + "Z").toLocaleString()}</td>
                    <td>{q.name}</td>
                    <td>{[q.email, q.phone].filter(Boolean).join(" · ")}</td>
                    <td>{islandName(q.island)}</td>
                    <td>{serviceName(q.service)}</td>
                    <td>{[q.address, q.details].filter(Boolean).join(" — ")}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </section>
  );
}
