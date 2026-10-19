import { Link, getRouteApi } from "@tanstack/solid-router";
import { useQuery } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import type { CostLine, PlanPhase } from "../../shared/types";
import { challengeQuery } from "../lib/api";
import { formatMoney } from "../lib/format";

const route = getRouteApi("/challenges/$challengeId");

const sum = (lines: CostLine[]) => lines.reduce((total, line) => total + line.amount, 0);
const tripCosts = (p: PlanPhase) => sum(p.steps.flatMap((s) => s.costs));
const laborCost = (p: PlanPhase) => sum(p.labor);
const materialsCost = (p: PlanPhase) => sum(p.materials ?? []);
const total = (p: PlanPhase) => tripCosts(p) + laborCost(p) + materialsCost(p);
const estimateHours = (p: PlanPhase) => p.steps.reduce((total, s) => total + s.estimateHours, 0);
const hours = (h: number) => (h ? `${Number(h.toFixed(2))} h` : "—");

// Plans sharing a phase and part number are alternatives (options) for it.
function groupPlans(phases: PlanPhase[]): PlanPhase[][] {
  const groups = new Map<string, PlanPhase[]>();
  for (const p of phases) {
    const key = `${p.number}.${p.part ?? 0}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()];
}

const planHeading = (p: PlanPhase) => `Phase ${p.number}${p.part ? `, part ${p.part}` : ""}: ${p.title}`;

function CostList(props: { lines: CostLine[]; class?: string }) {
  return (
    <ul class={`cost-lines ${props.class ?? ""}`}>
      <For each={props.lines}>
        {(line) => (
          <li>
            <span>{line.label}</span>
            <span>{formatMoney(line.amount)}</span>
          </li>
        )}
      </For>
    </ul>
  );
}

function PhasePlan(props: { phase: PlanPhase }) {
  const p = () => props.phase;
  return (
    <section class="plan-option">
      <Show when={p().option}>{(o) => <h3>Option {o().letter}: {o().name}</h3>}</Show>
      <p>{p().summary}</p>

      <ol class="plan-steps">
        <For each={p().steps}>
          {(step, i) => (
            <>
              <Show when={step.day && step.day !== p().steps[i() - 1]?.day}>
                <li class="step-day">{step.day}</li>
              </Show>
              <li>
                <p class="step-time">
                  {step.start} – {step.end}
                </p>
                <div>
                  <h4>{step.title}</h4>
                  <p>{step.detail}</p>
                  <Show when={step.costs.length}>
                    <CostList lines={step.costs} />
                  </Show>
                </div>
                <p class="step-cost">{step.costs.length ? formatMoney(sum(step.costs)) : "—"}</p>
              </li>
            </>
          )}
        </For>
      </ol>

      <h4 class="labor-heading">Labor</h4>
      <CostList lines={p().labor} class="labor-lines" />

      <Show when={p().materials}>
        {(materials) => (
          <>
            <h4 class="labor-heading">Materials (placeholder until the supplier quotes)</h4>
            <CostList lines={materials()} class="labor-lines" />
          </>
        )}
      </Show>

      <dl class="phase-totals">
        <Show when={estimateHours(p())}>
          <dt>Time on site</dt>
          <dd>{hours(estimateHours(p()))}</dd>
        </Show>
        <dt>Trip costs</dt>
        <dd>{formatMoney(tripCosts(p()))}</dd>
        <dt>Labor</dt>
        <dd>{formatMoney(laborCost(p()))}</dd>
        <Show when={p().materials}>
          <dt>Materials (placeholder)</dt>
          <dd>{formatMoney(materialsCost(p()))}</dd>
        </Show>
        <dt class="grand">Total{p().option ? `, option ${p().option!.letter}` : ""}</dt>
        <dd class="grand">{formatMoney(total(p()))}</dd>
      </dl>

      <section class="notes">
        <h4>Assumptions</h4>
        <ul>
          <For each={p().assumptions}>{(a) => <li>{a}</li>}</For>
        </ul>
        <p>
          Sources:{" "}
          <For each={p().sources}>
            {(source, i) => (
              <>
                {i() > 0 && " · "}
                <a href={source.url} target="_blank" rel="noopener">
                  {source.label}
                </a>
              </>
            )}
          </For>
        </p>
      </section>
    </section>
  );
}

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
          <p class="lede">{c().location}</p>

          <For
            each={groupPlans(c().phases)}
            fallback={<p class="muted">Instructions for this job haven’t been written yet.</p>}
          >
            {(options) => (
              <details class="plan-phase">
                <summary>
                  <h2>{planHeading(options[0]!)}</h2>
                  <span class="plan-phase-total">
                    {options.length > 1
                      ? `${options.length} options`
                      : formatMoney(total(options[0]!))}
                  </span>
                </summary>
                <Show when={options.length > 1}>
                  <div class="table-wrap option-compare">
                    <table>
                      <thead>
                        <tr>
                          <th>Option</th>
                          <th class="num">Time on site</th>
                          <th class="num">Trip costs</th>
                          <th class="num">Labor</th>
                          <th class="num">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={options}>
                          {(o) => (
                            <tr>
                              <td>
                                {o.option!.letter}: {o.option!.name}
                              </td>
                              <td class="num">{hours(estimateHours(o))}</td>
                              <td class="num">{formatMoney(tripCosts(o))}</td>
                              <td class="num">{formatMoney(laborCost(o))}</td>
                              <td class="num">{formatMoney(total(o))}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Show>
                <For each={options}>{(phase) => <PhasePlan phase={phase} />}</For>
              </details>
            )}
          </For>
        </article>
      )}
    </Show>
  );
}
