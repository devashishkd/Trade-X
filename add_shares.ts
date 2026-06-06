import mongoose from 'mongoose';

const authUri = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/auth-db';
const portfolioUri = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/portfolio-db';

const userSchema = new mongoose.Schema({ userId: String, email: String }, { collection: 'users' });
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
    const user = await User.findOne({ email: 'trade1@gmail.com' });

    if (!user) {
      console.log('User trade1@gmail.com not found');
      process.exit(1);
    }
    
    console.log(`Found user: ${user.userId}`);

    const portfolioConn = await mongoose.createConnection(portfolioUri).asPromise();
    const Holding = portfolioConn.model('Holding', holdingSchema);

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
    console.error(err);
    process.exit(1);
  }
}

run();
