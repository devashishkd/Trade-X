import mongoose from 'mongoose';
import crypto from 'crypto';

const authUri = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/auth-db';
const portfolioUri = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/portfolio-db';

const userSchema = new mongoose.Schema({ 
  userId: String, 
  email: String,
  username: String,
  passwordHash: String,
  role: String,
  isActive: Boolean,
  kycStatus: String
}, { collection: 'users', timestamps: true });

const holdingSchema = new mongoose.Schema({
  userId: String,
  symbol: String,
  availableQty: Number,
  lockedQty: Number,
  avgCostBasis: mongoose.Schema.Types.Decimal128,
  version: Number
}, { collection: 'holdings', timestamps: true });

async function run() {
  try {
    const authConn = await mongoose.createConnection(authUri).asPromise();
    const User = authConn.model('User', userSchema);
    
    const email = 'newuser@gmail.com';
    const username = 'newuser';
    const userId = crypto.randomUUID();

    // Create the user if it doesn't exist
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        userId,
        email,
        username,
        passwordHash: 'dummy_hash', // In production, this should be a bcrypt hashed password
        role: 'USER',
        isActive: true,
        kycStatus: 'VERIFIED'
      });
      console.log(`Created new user: ${email} with ID: ${user.userId}`);
    } else {
      console.log(`User ${email} already exists with ID: ${user.userId}`);
    }

    const portfolioConn = await mongoose.createConnection(portfolioUri).asPromise();
    const Holding = portfolioConn.model('Holding', holdingSchema);

    // Give 5 AAPL shares
    const holding = await Holding.findOneAndUpdate(
      { userId: user.userId, symbol: 'AAPL' },
      { 
        $inc: { availableQty: 5 },
        $setOnInsert: { lockedQty: 0, avgCostBasis: mongoose.Types.Decimal128.fromString('150.00'), version: 0 }
      },
      { upsert: true, new: true }
    );

    console.log('Added 5 AAPL shares:', holding);

    await authConn.close();
    await portfolioConn.close();
    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
