import { Link, getRouteApi } from "@tanstack/solid-router";
import { useQuery } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import { challengeQuery } from "../lib/api";
import { DataTableView } from "../components/DataTable";

const route = getRouteApi("/challenges/$challengeId");

export function ChallengePage() {
  const params = route.useParams();
  const challenge = useQuery(() => challengeQuery(params().challengeId));

  return (
    <Show when={challenge.data}>
      {(c) => (
        <article class="page challenge">
          <p class="crumb">
            <Link to="/">Challenges</Link> · Challenge {c().number}
          </p>
          <h1>{c().title}</h1>
          <p class="lede">{c().summary}</p>

          <dl class="spec">
            <For each={c().spec}>
              {(row) => (
                <>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </>
              )}
            </For>
          </dl>

          <DataTableView table={c().takeoff} />

          <h2>Instructions</h2>
          <ol class="phases">
            <For each={c().phases}>
              {(phase, i) => (
                <li class="phase">
                  <h3>
                    <span class="muted">{i() + 1}.</span> {phase.title}
                  </h3>
                  <ul>
                    <For each={phase.steps}>{(step) => <li>{step}</li>}</For>
                  </ul>
                  <p class="price">
                    <span>To price:</span> {phase.price.join(" · ")}
                  </p>
                </li>
              )}
            </For>
          </ol>

          <section class="notes">
            <h2>Open questions</h2>
            <ul>
              <For each={c().openQuestions}>{(q) => <li>{q}</li>}</For>
            </ul>
          </section>
        </article>
      )}
    </Show>
  );
}
