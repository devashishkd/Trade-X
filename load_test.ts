import mongoose from 'mongoose';
import crypto from 'crypto';

const API_GATEWAY = 'http://localhost:3000';
const portfolioUri = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/portfolio-db';
const NUM_USERS = 150;
const SYMBOLS = ['AAPL', 'GOOG', 'TSLA', 'AMZN', 'MSFT', 'NFLX', 'NVDA', 'META'];

const holdingSchema = new mongoose.Schema({
  userId: String,
  symbol: String,
  availableQty: Number,
  lockedQty: Number,
  avgCostBasis: mongoose.Schema.Types.Decimal128,
  version: Number
}, { collection: 'holdings', timestamps: true });

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface User {
  userId: string;
  email: string;
  token: string;
}

async function run() {
  console.log(`Starting Load Test Simulation for ${NUM_USERS} users...`);

  // 1. Create Users
  const users: User[] = [];
  console.log(`[1/3] Registering ${NUM_USERS} users...`);

  for (let i = 0; i < NUM_USERS; i++) {
    const randomId = crypto.randomUUID().substring(0, 8);
    const email = `testuser_${randomId}@gmail.com`;
    const username = `user_${randomId}`;
    const password = 'Password@123';

    try {
      const response = await fetch(`${API_GATEWAY}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        users.push({
          userId: data.data.userId,
          email: data.data.email,
          token: data.data.token
        });
        if ((i + 1) % 10 === 0) console.log(`  Registered ${i + 1} users...`);
      } else {
        console.error(`  Failed to register user ${email}:`, data);
      }
    } catch (err) {
      console.error(`  Error registering user ${email}:`, err);
    }
  }

  console.log(`Successfully registered ${users.length} users.\n`);

  if (users.length === 0) {
    console.error("No users registered. Exiting.");
    process.exit(1);
  }

  // 2. Allocate Shares
  console.log(`[2/3] Allocating shares to users...`);
  try {
    const portfolioConn = await mongoose.createConnection(portfolioUri).asPromise();
    const Holding = portfolioConn.model('Holding', holdingSchema);

    let holdingsCreated = 0;
    for (const user of users) {
      for (const symbol of SYMBOLS) {
        await Holding.findOneAndUpdate(
          { userId: user.userId, symbol: symbol },
          {
            $inc: { availableQty: 1000 },
            $setOnInsert: { lockedQty: 0, avgCostBasis: mongoose.Types.Decimal128.fromString('100.00'), version: 0 }
          },
          { upsert: true, new: true }
        );
        holdingsCreated++;
      }
    }
    await portfolioConn.close();
    console.log(`Successfully allocated shares (${holdingsCreated} holdings created).\n`);
  } catch (err) {
    console.error('Error allocating shares:', err);
    process.exit(1);
  }

  // 3. Start Trading Simulation
  console.log(`[3/3] Starting trading simulation... Press Ctrl+C to stop.\n`);

  let ordersPlaced = 0;
  let ordersFailed = 0;

  // Status reporter
  setInterval(() => {
    console.log(`[STATUS] Total orders placed: ${ordersPlaced} | Failed: ${ordersFailed}`);
  }, 50);

  while (true) {
    // Pick a random user
    const user = users[Math.floor(Math.random() * users.length)];
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const quantity = Math.floor(Math.random() * 50) + 1; // 1 to 50 shares

    // We will place mostly MARKET orders to guarantee execution
    const type = 'MARKET';

    try {
      const response = await fetch(`${API_GATEWAY}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ symbol, side, type, quantity })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        ordersPlaced++;
      } else {
        ordersFailed++;
      }
    } catch (err) {
      ordersFailed++;
    }

    // Small delay to simulate load but not overwhelm single-threaded Node completely
    // 50ms delay -> ~20 req/sec globally
    await sleep(50);
  }
}

run().catch(console.error);
