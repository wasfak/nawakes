"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Filter,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isNumericColumn,
  stringify,
  type Cell,
  type DataRow,
} from "@/lib/dataset";

type SortDir = "asc" | "desc";

export type { Cell, DataRow };

export interface DataTableSelection {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleMany: (ids: string[], checked: boolean) => void;
}

export interface DataTableEditable {
  column: string;
  getValue: (row: DataRow) => number | string;
  onChange: (id: string, value: number) => void;
}

interface DataTableProps {
  columns: string[];
  rows: DataRow[];
  numericColumns?: Set<string>;
  /** Adds a leading checkbox column for marking rows. */
  selection?: DataTableSelection;
  /** Renders one column as an editable number input. */
  editable?: DataTableEditable;
  /** Extra controls on the right of the toolbar (e.g. a Save button). */
  rightToolbar?: React.ReactNode;
}

export function DataTable({
  columns,
  rows,
  numericColumns,
  selection,
  editable,
  rightToolbar,
}: DataTableProps) {
  const [search, setSearch] = React.useState("");
  // For each column: a Set of allowed (stringified) values. Absent key = no filter.
  const [filters, setFilters] = React.useState<Record<string, Set<string>>>({});
  const [sort, setSort] = React.useState<{ col: string; dir: SortDir } | null>(
    null,
  );
  const [menu, setMenu] = React.useState<{
    col: string;
    x: number;
    y: number;
  } | null>(null);
  const [valSearch, setValSearch] = React.useState("");

  const numericCols = React.useMemo(() => {
    if (numericColumns) return numericColumns;
    const set = new Set<string>();
    for (const c of columns) if (isNumericColumn(rows, c)) set.add(c);
    return set;
  }, [rows, columns, numericColumns]);

  const domains = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of columns) {
      const set = new Set<string>();
      for (const row of rows) set.add(stringify(row[col]));
      const numeric = numericCols.has(col);
      map[col] = [...set].sort((a, b) => {
        if (a === "" || b === "") return a === "" ? 1 : -1; // blanks last
        return numeric
          ? Number(a) - Number(b)
          : a.localeCompare(b, undefined, { numeric: true });
      });
    }
    return map;
  }, [rows, columns, numericCols]);

  const setColumnFilter = (
    col: string,
    mutate: (allowed: Set<string>) => void,
  ) => {
    setFilters((prev) => {
      const allowed = prev[col] ? new Set(prev[col]) : new Set(domains[col]);
      mutate(allowed);
      const next = { ...prev };
      if (allowed.size === domains[col].length) delete next[col];
      else next[col] = allowed;
      return next;
    });
  };

  const toggleValue = (col: string, value: string) =>
    setColumnFilter(col, (allowed) => {
      if (allowed.has(value)) allowed.delete(value);
      else allowed.add(value);
    });

  const setAllValues = (col: string, values: string[], checked: boolean) =>
    setColumnFilter(col, (allowed) => {
      for (const v of values) checked ? allowed.add(v) : allowed.delete(v);
    });

  const clearColumn = (col: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[col];
      return next;
    });
    setMenu(null);
  };

  const clearAll = () => {
    setSearch("");
    setFilters({});
  };

  const toggleSort = (col: string) =>
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return null;
    });

  React.useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-col-filter]"))
        setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    const onScroll = () => setMenu(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [menu]);

  const visibleRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const active = Object.entries(filters);

    let out = rows.filter((row) => {
      if (
        q &&
        !columns.some((c) => stringify(row[c]).toLowerCase().includes(q))
      )
        return false;
      for (const [col, allowed] of active) {
        if (!allowed.has(stringify(row[col]))) return false;
      }
      return true;
    });

    if (sort) {
      const { col, dir } = sort;
      const numeric = numericCols.has(col);
      out = [...out].sort((a, b) => {
        const as = stringify(a[col]);
        const bs = stringify(b[col]);
        if (as === "" || bs === "") return as === bs ? 0 : as === "" ? 1 : -1;
        const cmp = numeric
          ? Number(as) - Number(bs)
          : as.localeCompare(bs, undefined, {
              numeric: true,
              sensitivity: "base",
            });
        return dir === "asc" ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, columns, search, filters, sort, numericCols]);

  const visibleIds = React.useMemo(
    () => visibleRows.map((r) => r.__id),
    [visibleRows],
  );

  const activeFilterCount =
    Object.keys(filters).length + (search.trim() ? 1 : 0);

  // FIXED: Added 'en-US' locale
  const fmt = (col: string, v: string) =>
    v === ""
      ? "(Blanks)"
      : numericCols.has(col)
        ? Number(v).toLocaleString("en-US")
        : v;

  const menuValues = React.useMemo(() => {
    if (!menu) return [];
    const q = valSearch.trim().toLowerCase();
    if (!q) return domains[menu.col];
    return domains[menu.col].filter((v) =>
      fmt(menu.col, v).toLowerCase().includes(q),
    );
  }, [menu, valSearch, domains]); // eslint-disable-line react-hooks/exhaustive-deps

  const menuAllChecked =
    menu &&
    menuValues.every((v) => !filters[menu.col] || filters[menu.col].has(v));

  const allVisibleSelected =
    !!selection &&
    visibleIds.length > 0 &&
    visibleIds.every((id) => selection.selectedIds.has(id));
  const someVisibleSelected =
    !!selection && visibleIds.some((id) => selection.selectedIds.has(id));

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all columns…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        {/* FIXED: Added 'en-US' locale */}
        <p className="text-sm text-muted-foreground">
          {visibleRows.length.toLocaleString("en-US")} of{" "}
          {rows.length.toLocaleString("en-US")} rows
        </p>
        {activeFilterCount > 0 && (
          <Button variant="outline" size="sm" onClick={clearAll}>
            <X /> Clear all ({activeFilterCount})
          </Button>
        )}
        {rightToolbar}
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              {selection && (
                <th className="border-b border-border px-2 py-1.5">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    className="size-4 accent-primary align-middle"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el)
                        el.indeterminate =
                          !allVisibleSelected && someVisibleSelected;
                    }}
                    onChange={(e) =>
                      selection.onToggleMany(visibleIds, e.target.checked)
                    }
                  />
                </th>
              )}
              {columns.map((col) => {
                const sorted = sort?.col === col;
                const filtered = !!filters[col];
                return (
                  <th
                    key={col}
                    className="border-b border-border text-center font-semibold"
                  >
                    <div
                      data-col-filter
                      className="flex items-center justify-between gap-1 px-2 py-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded px-1 py-1 hover:bg-muted/60"
                        title={`Sort by ${col}`}
                      >
                        <span className="truncate" title={col}>
                          {col}
                        </span>
                        {sorted ? (
                          sort!.dir === "asc" ? (
                            <ArrowUp className="size-3.5 shrink-0" />
                          ) : (
                            <ArrowDown className="size-3.5 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground/40" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={`Filter ${col}`}
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setValSearch("");
                          setMenu((m) =>
                            m?.col === col
                              ? null
                              : {
                                  col,
                                  x: Math.min(r.left, window.innerWidth - 272),
                                  y: r.bottom,
                                },
                          );
                        }}
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded hover:bg-muted",
                          filtered && "text-primary",
                        )}
                      >
                        <Filter
                          className={cn(
                            "size-3.5",
                            filtered && "fill-primary/20",
                          )}
                        />
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const selected = selection?.selectedIds.has(row.__id);
              return (
                <tr
                  key={row.__id}
                  className={cn(
                    "border-b border-border last:border-0 hover:bg-muted/40",
                    selected && "bg-primary/5",
                  )}
                >
                  {selection && (
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        className="size-4 accent-primary align-middle"
                        checked={!!selected}
                        onChange={() => selection.onToggle(row.__id)}
                      />
                    </td>
                  )}
                  {columns.map((col) => {
                    const numeric = numericCols.has(col);
                    const empty = stringify(row[col]) === "";
                    const isEditable = editable?.column === col;
                    return (
                      <td
                        key={col}
                        className={cn(
                          "px-3 py-2 text-center align-top",
                          numeric && "tabular-nums",
                        )}
                      >
                        {isEditable ? (
                          <input
                            type="number"
                            value={editable!.getValue(row)}
                            onChange={(e) =>
                              editable!.onChange(
                                row.__id,
                                Number(e.target.value),
                              )
                            }
                            className="h-8 w-24 rounded-md border border-border bg-background px-2 text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                          />
                        ) : empty ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : numeric ? (
                          // FIXED: Added 'en-US' locale
                          Number(row[col]).toLocaleString("en-US")
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (selection ? 1 : 0)}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  No rows match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Excel-style filter dropdown */}
      {menu && (
        <div
          data-col-filter
          style={{ position: "fixed", top: menu.y + 4, left: menu.x }}
          className="z-50 flex w-68 flex-col rounded-lg border border-border bg-card p-2 text-sm shadow-xl"
        >
          <div className="flex gap-1 pb-2">
            <button
              type="button"
              onClick={() => {
                setSort({ col: menu.col, dir: "asc" });
                setMenu(null);
              }}
              className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <ArrowUp className="size-3.5" /> Sort ascending
            </button>
            <button
              type="button"
              onClick={() => {
                setSort({ col: menu.col, dir: "desc" });
                setMenu(null);
              }}
              className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <ArrowDown className="size-3.5" /> Sort descending
            </button>
          </div>

          <div className="-mx-2 border-t border-border" />

          <div className="relative pt-2">
            <Search className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={valSearch}
              onChange={(e) => setValSearch(e.target.value)}
              placeholder="Search values…"
              className="h-8 w-full rounded-md border border-border bg-background ps-7 pe-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 font-medium hover:bg-muted">
            <input
              type="checkbox"
              className="size-3.5 accent-primary"
              checked={!!menuAllChecked}
              ref={(el) => {
                if (el)
                  el.indeterminate =
                    !menuAllChecked &&
                    menuValues.some(
                      (v) => !filters[menu.col] || filters[menu.col].has(v),
                    );
              }}
              onChange={(e) =>
                setAllValues(menu.col, menuValues, e.target.checked)
              }
            />
            <span>(Select all{valSearch ? " in search" : ""})</span>
          </label>

          <div className="max-h-56 overflow-auto py-1">
            {menuValues.length === 0 && (
              <p className="px-2 py-3 text-center text-muted-foreground">
                No matching values.
              </p>
            )}
            {menuValues.map((v) => {
              const checked = !filters[menu.col] || filters[menu.col].has(v);
              return (
                <label
                  key={v}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    checked={checked}
                    onChange={() => toggleValue(menu.col, v)}
                  />
                  <span
                    className={cn(
                      "truncate",
                      v === "" && "text-muted-foreground italic",
                    )}
                    title={fmt(menu.col, v)}
                  >
                    {fmt(menu.col, v)}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="-mx-2 border-t border-border" />

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearColumn(menu.col)}
              disabled={!filters[menu.col]}
            >
              Clear filter
            </Button>
            <Button size="sm" onClick={() => setMenu(null)}>
              <Check /> Done
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
