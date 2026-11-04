import { model, Schema } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: '' },
    role: { type: String, enum: ['agent', 'manager', 'admin'], default: 'agent' },
  },
  { timestamps: true },
);

export const User = model('User', userSchema);
