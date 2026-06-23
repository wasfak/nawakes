import { Schema, model, models, Types } from "mongoose";

export interface OrderItem {
  index: number; // row index within the dataset's `rows`
  quantity: number; // the quantity this user wants (may differ from original)
}

export interface OrderDoc {
  _id: Types.ObjectId;
  userId: string;
  userName: string;
  datasetId: Types.ObjectId;
  items: OrderItem[];
  ignored: number[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<OrderItem>(
  {
    index: { type: Number, required: true },
    quantity: { type: Number, required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String, default: "" },
    datasetId: { type: Schema.Types.ObjectId, ref: "Dataset", required: true },
    items: { type: [OrderItemSchema], default: [] },
    ignored: { type: [Number], default: [] },
  },
  { timestamps: true }
);

// One order per user per dataset (re-saving updates the same document).
OrderSchema.index({ userId: 1, datasetId: 1 }, { unique: true });

export const Order = models.Order || model("Order", OrderSchema);
