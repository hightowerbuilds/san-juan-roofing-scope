import { createMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { useSelector } from "@tanstack/solid-store";
import { For, Show, createSignal } from "solid-js";
import type { QuoteInput } from "../../shared/types";
import { islandsQuery, servicesQuery, submitQuote } from "../lib/api";
import { quoteStore } from "../lib/quoteStore";

export function QuotePage() {
  const queryClient = useQueryClient();
  const services = useQuery(() => servicesQuery);
  const islands = useQuery(() => islandsQuery);
  const draft = useSelector(quoteStore);
  const [submittedId, setSubmittedId] = createSignal<number | null>(null);

  const mutation = createMutation(() => ({
    mutationFn: submitQuote,
    onSuccess: ({ id }) => {
      setSubmittedId(id);
      quoteStore.actions.reset();
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  }));

  // Selects pick their value via <option selected>, since Solid sets a select's
  // value before its <For> options are inserted.
  const bind = (key: keyof QuoteInput) => ({
    name: key,
    get value() {
      return draft()[key];
    },
    onInput: (e: { currentTarget: { value: string } }) => quoteStore.actions.set(key, e.currentTarget.value),
  });

  return (
    <section class="page narrow">
      <Show
        when={submittedId() === null}
        fallback={
          <div class="notice">
            <h1>Thanks — we'll be in touch.</h1>
            <p>Your request #{submittedId()} is in. We usually reply within one business day.</p>
            <button class="btn btn-ghost" onClick={() => setSubmittedId(null)}>Submit another</button>
          </div>
        }
      >
        <h1>Request a quote</h1>
        <p class="lede">Tell us a little about the job. Free estimates, island-wide.</p>

        <form
          class="form"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(draft());
          }}
        >
          <label>
            Name
            <input required autocomplete="name" {...bind("name")} />
          </label>
          <div class="row">
            <label>
              Email
              <input type="email" autocomplete="email" {...bind("email")} />
            </label>
            <label>
              Phone
              <input type="tel" autocomplete="tel" {...bind("phone")} />
            </label>
          </div>
          <div class="row">
            <label>
              Island
              <select required {...bind("island")}>
                <option value="">Choose…</option>
                <For each={islands.data}>
                  {(i) => <option value={i.id} selected={draft().island === i.id}>{i.name}</option>}
                </For>
              </select>
            </label>
            <label>
              Service
              <select required {...bind("service")}>
                <option value="">Choose…</option>
                <For each={services.data}>
                  {(s) => <option value={s.id} selected={draft().service === s.id}>{s.name}</option>}
                </For>
              </select>
            </label>
          </div>
          <label>
            Property address
            <input autocomplete="street-address" {...bind("address")} />
          </label>
          <label>
            Details
            <textarea rows={5} placeholder="Roof age, material, leaks, timing…" {...bind("details")} />
          </label>

          <Show when={mutation.error}>
            <p class="error">{mutation.error?.message}</p>
          </Show>

          <button class="btn" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Sending…" : "Send request"}
          </button>
        </form>
      </Show>
    </section>
  );
}
