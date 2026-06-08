import mongoose from 'mongoose';

const API_GATEWAY = 'http://localhost:3000';
const authUri = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/auth-db';
const SYMBOLS = ['AAPL', 'GOOG', 'TSLA', 'AMZN', 'MSFT', 'NFLX', 'NVDA', 'META'];

const userSchema = new mongoose.Schema({
  userId: String,
  email: String,
}, { collection: 'users' });

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface User {
  userId: string;
  email: string;
  token: string;
}

async function run() {
  console.log(`Starting 1-Minute Constant Buy/Sell Simulation...`);

  const users: User[] = [];
  console.log(`[1/2] Fetching existing users and logging in...`);
  
  try {
    const authConn = await mongoose.createConnection(authUri).asPromise();
    const User = authConn.model('User', userSchema);
    
    const dbUsers = await User.find({ email: /testuser_/ }).limit(100).exec();
    await authConn.close();

    for (const dbUser of dbUsers) {
      if (!dbUser.email) continue;
      try {
        const response = await fetch(`${API_GATEWAY}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: dbUser.email, password: 'Password@123' })
        });
        const data = await response.json();
        if (response.ok && data.success) {
          users.push({ userId: data.data.userId, email: data.data.email, token: data.data.token });
        }
      } catch (err) {}
    }
  } catch (err) {
    console.error('Error fetching users:', err);
    process.exit(1);
  }

  console.log(`Successfully logged in ${users.length} users.\n`);

  if (users.length === 0) {
    console.error("No users logged in.");
    process.exit(1);
  }

  console.log(`[2/2] Blasting orders continuously for exactly 1 minute...\n`);

  let ordersPlaced = 0;
  let ordersFailed = 0;
  const startTime = Date.now();
  const DURATION_MS = 60 * 1000;

  // Status reporter runs every 5 seconds
  const statusInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    console.log(`[${elapsedSec}s / 60s] Total orders placed: ${ordersPlaced} | Failed: ${ordersFailed}`);
  }, 5000);

  // We use 10 concurrent async loops to "blast" orders and simulate heavy constant load
  const CONCURRENCY = 10;
  let isRunning = true;

  const worker = async () => {
    while (isRunning) {
      const user = users[Math.floor(Math.random() * users.length)];
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const quantity = Math.floor(Math.random() * 50) + 1;
      
      const isLimit = Math.random() > 0.4; // 60% limit orders to provide liquidity
      const type = isLimit ? 'LIMIT' : 'MARKET';
      
      const baselinePrices: Record<string, number> = { AAPL: 600, GOOG: 2800, TSLA: 420, AMZN: 900, MSFT: 312, NFLX: 450, NVDA: 875, META: 520 };
      let price: number | undefined = undefined;
      if (isLimit) {
        const offset = (Math.random() - 0.5) * (baselinePrices[symbol] * 0.05); // +/- 2.5%
        price = parseFloat((baselinePrices[symbol] + offset).toFixed(2));
      }
      
      try {
        const response = await fetch(`${API_GATEWAY}/api/orders`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
          },
          body: JSON.stringify({ symbol, side, type, quantity, price })
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
      
      // Small 10ms delay to throttle slightly but still be very fast
      await sleep(10);
    }
  };

  // Start concurrent workers
  const workers = Array.from({ length: CONCURRENCY }).map(() => worker());

  // Wait for 1 minute
  await sleep(DURATION_MS);
  
  // Stop simulation
  isRunning = false; 
  clearInterval(statusInterval);
  
  // Wait for any pending network requests to finish gracefully
  await Promise.all(workers);

  console.log(`\n=========================================`);
  console.log(`Simulation Complete!`);
  console.log(`Total duration : 60 seconds`);
  console.log(`Orders placed  : ${ordersPlaced}`);
  console.log(`Orders failed  : ${ordersFailed}`);
  console.log(`Throughput     : ${(ordersPlaced / 60).toFixed(2)} orders/sec`);
  console.log(`=========================================\n`);
}

run().catch(console.error);
