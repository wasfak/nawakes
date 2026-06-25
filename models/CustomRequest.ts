import { Schema, model, models } from "mongoose";

export interface CustomItem {
  name: string;
  quantity: number;
  approvedQty: number | null;
  completed: boolean;
  /** تعذر — admin couldn't find this item. */
  unavailable: boolean;
}

const CustomItemSchema = new Schema<CustomItem>(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    approvedQty: { type: Number, default: null },
    completed: { type: Boolean, default: false },
    unavailable: { type: Boolean, default: false },
  },
  { _id: false },
);

const CustomRequestSchema = new Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String, default: "" },
    items: { type: [CustomItemSchema], default: [] },
  },
  { timestamps: true },
);

CustomRequestSchema.index({ userId: 1 }, { unique: true });

export const CustomRequest =
  models.CustomRequest || model("CustomRequest", CustomRequestSchema);
