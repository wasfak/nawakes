"use client";

import * as React from "react";
import * as XLSX from "xlsx-js-style";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Download, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DashboardSectionProps {
  datasetId: string;
  fileName: string;
  columns: string[];
  exportData: Record<string, unknown>[];
  children: React.ReactNode;
}

const EXPORT_COLUMNS = ["المورد", "إسم الصنف", "الكميه", "السعر", "خصم"];

function matchExportColumns(datasetColumns: string[]) {
  return EXPORT_COLUMNS.flatMap((pattern) => {
    const match = datasetColumns.find((c) => c.includes(pattern));
    return match ? [match] : [];
  });
}

export function DashboardSection({
  datasetId,
  fileName,
  columns: datasetColumns,
  exportData,
  children,
}: DashboardSectionProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const exportToExcel = () => {
    if (exportData.length === 0) return;

    const cols = matchExportColumns(datasetColumns);
    if (cols.length === 0) return;

    const changedFlags = exportData.map((row) => !!row.__changed);

    const rows = exportData.map((row) =>
      Object.fromEntries(cols.map((c) => [c, row[c] ?? ""]))
    );

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, { header: cols });

    const changedFill = { fgColor: { rgb: "FFF3CD" } };
    for (let r = 0; r < rows.length; r++) {
      if (!changedFlags[r]) continue;
      for (let c = 0; c < cols.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: r + 1, c });
        const cell = ws[addr];
        if (cell) {
          cell.s = { fill: changedFill };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Orders");

    const name = fileName.replace(/\.[^.]+$/, "");
    XLSX.writeFile(wb, `${name}_orders.xlsx`);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/datasets?id=${datasetId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not delete.");
      toast.success(`"${fileName}" deleted.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 font-semibold hover:text-primary transition-colors"
        >
          {open ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
          {fileName}
        </button>
        <div className="flex items-center gap-2">
          {exportData.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <Download className="size-3.5" /> Export Excel
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Collapse" : "Expand"}
          </Button>

          {!confirmDelete ? (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1">
              <span className="text-sm font-medium text-destructive">
                Delete this sheet?
              </span>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 px-3"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : "Yes"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                No
              </Button>
            </div>
          )}
        </div>
      </div>
      {open && children}
    </section>
  );
}
