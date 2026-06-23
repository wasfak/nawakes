"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar, RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "date-filter";

function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const todayStr = () => toLocalDate(new Date());

function loadSaved(): { from: string; to: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.from && parsed?.to) return parsed;
  } catch {}
  return null;
}

function saveDates(from: string, to: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ from, to }));
  } catch {}
}

function DateFilterInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const hasUrlParams = params.has("from") || params.has("to");
  const [restored, setRestored] = React.useState(false);

  React.useEffect(() => {
    if (restored || hasUrlParams) return;
    const saved = loadSaved();
    if (saved) {
      const today = todayStr();
      if (saved.from !== today || saved.to !== today) {
        const sp = new URLSearchParams(params.toString());
        sp.set("from", saved.from);
        sp.set("to", saved.to);
        router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
      }
    }
    setRestored(true);
  }, [restored, hasUrlParams, pathname, router, params]);

  const appliedFrom = params.get("from") ?? todayStr();
  const appliedTo = params.get("to") ?? todayStr();

  const [from, setFrom] = React.useState(appliedFrom);
  const [to, setTo] = React.useState(appliedTo);

  React.useEffect(() => {
    setFrom(appliedFrom);
    setTo(appliedTo);
  }, [appliedFrom, appliedTo]);

  const isToday = appliedFrom === todayStr() && appliedTo === todayStr();

  const push = (f: string, t: string) => {
    saveDates(f, t);
    const today = todayStr();
    const sp = new URLSearchParams(params.toString());
    sp.delete("ds");
    if (f !== today || t !== today) {
      sp.set("from", f);
      sp.set("to", t);
    } else {
      sp.delete("from");
      sp.delete("to");
    }
    const q = sp.toString();
    router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar className="size-4 text-muted-foreground hidden sm:block" />

      <Button
        variant={isToday ? "default" : "outline"}
        size="sm"
        onClick={() => push(todayStr(), todayStr())}
      >
        Today
      </Button>

      <div className="flex items-center gap-1.5">
        <label className="text-xs text-muted-foreground">From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={cn(
            "h-8 rounded-md border border-border bg-background px-2 text-sm outline-none",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-xs text-muted-foreground">To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={cn(
            "h-8 rounded-md border border-border bg-background px-2 text-sm outline-none",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
        />
      </div>

      <Button size="sm" onClick={() => push(from, to)}>
        <Search className="size-3.5" /> Search
      </Button>

      {!isToday && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => push(todayStr(), todayStr())}
          title="Reset to today"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

export function DateFilter() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="size-4" /> Loading...
        </div>
      }
    >
      <DateFilterInner />
    </React.Suspense>
  );
}
