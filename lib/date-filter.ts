/** Build a MongoDB `createdAt` filter from `from` / `to` search params.
 *  Defaults to today when params are missing. */
export function dateRange(from?: string | null, to?: string | null) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const f = from || todayStr;
  const t = to || todayStr;

  const start = new Date(f + "T00:00:00.000Z");
  const end = new Date(t + "T23:59:59.999Z");

  return { $gte: start, $lte: end };
}
