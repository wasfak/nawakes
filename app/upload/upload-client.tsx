"use client";

import * as React from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, Send, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import {
  isNumericColumn,
  stringify,
  type Cell,
  type DataRow,
} from "@/lib/dataset";

type Row = Record<string, Cell>;

function detectColumns(rows: Row[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) for (const k of Object.keys(row)) keys.add(k);
  return [...keys].filter((key) => {
    if (/^__EMPTY/.test(key)) return false;
    return rows.some((row) => stringify(row[key]) !== "");
  });
}

export function UploadClient() {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [columns, setColumns] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);

  const dataRows = React.useMemo<DataRow[]>(
    () => rows.map((r, i) => ({ ...r, __id: String(i) })),
    [rows]
  );

  const numericCols = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of columns) if (isNumericColumn(dataRows, c)) set.add(c);
    return set;
  }, [dataRows, columns]);

  const parseFile = React.useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: null });

      if (data.length === 0) {
        setError("The sheet appears to be empty.");
        setRows([]);
        setColumns([]);
      } else {
        setRows(data);
        setColumns(detectColumns(data));
      }
      setFileName(file.name);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not read this file as a spreadsheet."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const send = async () => {
    setSending(true);
    try {
      const cleaned = rows.map((r) =>
        Object.fromEntries(
          columns.map((c) => {
            const v = r[c] ?? null;
            if (numericCols.has(c) && v !== null && v !== "") return [c, Number(v)];
            return [c, v];
          })
        )
      );
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, columns, rows: cleaned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save the data.");
      toast.success(
        `Saved ${cleaned.length.toLocaleString()} rows. View them on the Home page.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the data.");
    } finally {
      setSending(false);
    }
  };

  const hasData = columns.length > 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upload spreadsheet</h1>
          <p className="text-sm text-muted-foreground">
            Drop an Excel/CSV file to read its columns and explore the data with
            Excel-style filters and sorting.
          </p>
        </div>
        <Button onClick={send} disabled={!hasData || sending}>
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
          {sending ? "Sending..." : "Send"}
        </Button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/40"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={onFileChange}
        />
        <div className="rounded-full bg-muted p-3">
          {fileName ? (
            <FileSpreadsheet className="size-6 text-primary" />
          ) : (
            <Upload className="size-6 text-muted-foreground" />
          )}
        </div>
        {fileName ? (
          <div>
            <p className="font-medium">{fileName}</p>
            <p className="text-sm text-muted-foreground">
              {rows.length.toLocaleString()} rows · {columns.length} columns ·
              click to replace
            </p>
          </div>
        ) : (
          <div>
            <p className="font-medium">
              {loading ? "Reading file..." : "Click to choose or drag a file here"}
            </p>
            <p className="text-sm text-muted-foreground">
              Supports .xlsx, .xls and .csv
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {hasData && (
        <DataTable columns={columns} rows={dataRows} numericColumns={numericCols} storageKey="upload-preview" />
      )}
    </div>
  );
}
