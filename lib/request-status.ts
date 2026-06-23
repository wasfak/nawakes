import type { CustomItem } from "@/models/CustomRequest";

export type RequestStatus =
  | "completed"
  | "approved"
  | "reduced"
  | "rejected"
  | "pending";

export interface RequestStatusInfo {
  status: RequestStatus;
  label: string;
  /** The quantity the user will actually get (approved if set, else requested). */
  effectiveQty: number;
}

export function getRequestStatus(item: CustomItem): RequestStatusInfo {
  const { quantity, approvedQty, completed } = item;

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
