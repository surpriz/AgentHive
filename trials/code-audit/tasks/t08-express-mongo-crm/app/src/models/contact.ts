import { model, Schema, Types } from 'mongoose';

const contactSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    company: { type: String, default: '' },
    phone: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

contactSchema.index({ name: 'text', company: 'text' });

export const Contact = model('Contact', contactSchema);
