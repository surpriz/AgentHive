import { model, Schema, Types } from 'mongoose';

const dealSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    contact: { type: Types.ObjectId, ref: 'Contact', required: true },
    title: { type: String, required: true },
    amountCents: { type: Number, required: true, min: 0 },
    stage: { type: String, enum: ['lead', 'qualified', 'proposal', 'won', 'lost'], default: 'lead' },
  },
  { timestamps: true },
);

export const Deal = model('Deal', dealSchema);
