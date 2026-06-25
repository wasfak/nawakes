import type { CustomItem } from "@/models/CustomRequest";

export type RequestStatus =
  | "completed"
  | "approved"
  | "reduced"
  | "rejected"
  | "unavailable"
  | "pending";

export interface RequestStatusInfo {
  status: RequestStatus;
  label: string;
  /** The quantity the user will actually get (approved if set, else requested). */
  effectiveQty: number;
}

export function getRequestStatus(item: CustomItem): RequestStatusInfo {
  const { quantity, approvedQty, completed, unavailable } = item;

  if (unavailable) {
    return { status: "unavailable", label: "تعذر", effectiveQty: 0 };
  }
  if (completed) {
    return { status: "completed", label: "Completed", effectiveQty: approvedQty ?? quantity };
  }
  if (approvedQty === null || approvedQty === undefined) {
    return { status: "pending", label: "Pending review", effectiveQty: quantity };
  }
  if (approvedQty <= 0) {
    return { status: "rejected", label: "Rejected", effectiveQty: 0 };
  }
  if (approvedQty < quantity) {
    return { status: "reduced", label: "Partially approved", effectiveQty: approvedQty };
  }
  return { status: "approved", label: "Approved", effectiveQty: approvedQty };
}
