import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  userId:       string;
  email:        string;
  username:     string;
  passwordHash: string;
  role:         'USER' | 'ADMIN';
  isActive:     boolean;
  kycStatus:    'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt:    Date;
  updatedAt:    Date;
}

const UserSchema = new Schema<IUser>(
  {
    userId:       { type: String, required: true },
    email:        { type: String, required: true, lowercase: true, trim: true },
    username:     { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role:         { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    isActive:     { type: Boolean, default: true },
    kycStatus:    { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
  },
  {
    timestamps: true,
    collection: 'users',
  },
);

UserSchema.index({ userId: 1 },    { unique: true });
UserSchema.index({ email: 1 },     { unique: true });
UserSchema.index({ username: 1 },  { unique: true });
UserSchema.index({ email: 1, isActive: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
