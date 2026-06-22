import { Schema, model, models } from "mongoose";

export type DatasetRow = Record<string, string | number | boolean | null>;

const DatasetSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    columns: { type: [String], required: true },
    // Rows have dynamic shape (columns vary per uploaded sheet), so store as Mixed.
    rows: { type: Schema.Types.Mixed, default: [] },
  },
  // `minimize: false` keeps empty objects; only createdAt is needed ("with its date").
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false }
);

export const Dataset = models.Dataset || model("Dataset", DatasetSchema);
