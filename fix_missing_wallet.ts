import mongoose from 'mongoose';

const authUri = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/auth-db';

const userSchema = new mongoose.Schema({ email: String, userId: String }, { collection: 'users' });
const walletSchema = new mongoose.Schema({
  userId: String,
  availableBalance: mongoose.Schema.Types.Decimal128,
  lockedBalance: mongoose.Schema.Types.Decimal128,
  currency: String,
  version: Number
}, { collection: 'wallets', timestamps: true });

async function run() {
  try {
    const authConn = await mongoose.createConnection(authUri).asPromise();
    const User = authConn.model('User', userSchema);
    const Wallet = authConn.model('Wallet', walletSchema);
    
    const email = 'newuser@gmail.com';
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User ${email} not found.`);
      process.exit(1);
    }

    const wallet = await Wallet.findOneAndUpdate(
      { userId: user.userId },
      { 
        $setOnInsert: { 
          availableBalance: mongoose.Types.Decimal128.fromString('10000.00'), // Give them $10k to start
          lockedBalance: mongoose.Types.Decimal128.fromString('0.00'),
          currency: 'USD',
          version: 0
        }
      },
      { upsert: true, new: true }
    );

    console.log(`Wallet successfully ensured for user ${email}. Balance: $${wallet?.availableBalance?.toString() ?? '10000.00'}`);

    await authConn.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
