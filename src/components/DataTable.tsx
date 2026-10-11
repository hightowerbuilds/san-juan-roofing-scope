import { For, Show } from "solid-js";
import type { DataTable } from "../../shared/types";

export function DataTableView(props: { table: DataTable }) {
  return (
    <figure class="data-table">
      <figcaption>{props.table.title}</figcaption>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <For each={props.table.columns}>{(col) => <th classList={{ num: col.numeric }}>{col.label}</th>}</For>
            </tr>
          </thead>
          <tbody>
            <For each={props.table.rows}>
              {(row) => (
                <tr classList={{ total: row.total }}>
                  <For each={props.table.columns}>
                    {(col) => (
                      <td classList={{ num: col.numeric }}>
                        {row.cells[col.key] ?? "—"}
                        <Show when={col.moeKey && row.cells[col.moeKey]}>
                          <span class="moe">{row.cells[col.moeKey!]}</span>
                        </Show>
                      </td>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </figure>
  );
}
