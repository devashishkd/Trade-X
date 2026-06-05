import { v4 as uuidv4 } from 'uuid';
import { User }          from '../models/User.model';
import { Wallet }        from '../models/Wallet.model';
import { hashPassword, comparePassword } from '../utils/password.utils';
import { signToken }     from '../utils/jwt.utils';
import { toDecimal128, fromDecimal128, AppError } from '@trade-x/shared';

const INITIAL_BALANCE = parseFloat(process.env.INITIAL_WALLET_BALANCE ?? '100000');

// ─── Register ──────────────────────────────────────────────────────────────
export const register = async (dto: {
  email:    string;
  username: string;
  password: string;
}) => {
  // Check uniqueness before hashing (cheap DB check first)
  const existing = await User.findOne({
    $or: [{ email: dto.email }, { username: dto.username }],
  });

  if (existing) {
    const field = existing.email === dto.email ? 'email' : 'username';
    throw new AppError('CONFLICT', 409, `${field} is already taken`, field);
  }

  const userId      = uuidv4();
  const passwordHash = await hashPassword(dto.password);

  const user = await User.create({ userId, email: dto.email, username: dto.username, passwordHash });

  // Wallet created atomically alongside user
  const wallet = await Wallet.create({
    userId,
    availableBalance: toDecimal128(INITIAL_BALANCE),
    lockedBalance:    toDecimal128(0),
  });

  const token = signToken({
    userId,
    email:    user.email,
    username: user.username,
    role:     user.role,
  });

  return {
    userId,
    email:    user.email,
    username: user.username,
    token,
    wallet: {
      availableBalance: fromDecimal128(wallet.availableBalance).toFixed(2),
      lockedBalance:    fromDecimal128(wallet.lockedBalance).toFixed(2),
      currency:         wallet.currency,
    },
  };
};

// ─── Login ─────────────────────────────────────────────────────────────────
export const login = async (dto: { email: string; password: string }) => {
  // .select('+passwordHash') is required because passwordHash has select:false
  const user = await User.findOne({ email: dto.email }).select('+passwordHash');
  if (!user) throw new AppError('UNAUTHORIZED', 401, 'Invalid email or password');
  if (!user.isActive) throw new AppError('FORBIDDEN', 403, 'Account has been deactivated');

  const valid = await comparePassword(dto.password, user.passwordHash);
  // Same error message for wrong email or wrong password (security: no user enumeration)
  if (!valid) throw new AppError('UNAUTHORIZED', 401, 'Invalid email or password');

  const token = signToken({
    userId:   user.userId,
    email:    user.email,
    username: user.username,
    role:     user.role,
  });

  return {
    userId:    user.userId,
    username:  user.username,
    email:     user.email,
    token,
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN ?? '86400'),
  };
};

// ─── Profile ───────────────────────────────────────────────────────────────
export const getProfile = async (userId: string) => {
  const user = await User.findOne({ userId });
  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');

  return {
    userId:    user.userId,
    email:     user.email,
    username:  user.username,
    role:      user.role,
    kycStatus: user.kycStatus,
    isActive:  user.isActive,
    createdAt: user.createdAt,
  };
};
