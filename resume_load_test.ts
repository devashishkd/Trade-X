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
  console.log(`Starting Resumed Load Test Simulation...`);

  const users: User[] = [];
  console.log(`[1/2] Fetching existing users and logging in...`);
  
  try {
    const authConn = await mongoose.createConnection(authUri).asPromise();
    const User = authConn.model('User', userSchema);
    
    // Fetch registered test users
    const dbUsers = await User.find({ email: /testuser_/ }).limit(150).exec();
    console.log(`Found ${dbUsers.length} test users in database.`);
    
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
          users.push({
            userId: data.data.userId,
            email: data.data.email,
            token: data.data.token
          });
          if (users.length % 10 === 0) console.log(`  Logged in ${users.length} users...`);
        } else {
          console.error(`  Failed to login user ${dbUser.email}:`, data);
        }
      } catch (err) {
        console.error(`  Error logging in user ${dbUser.email}:`, err);
      }
    }
  } catch (err) {
    console.error('Error fetching users:', err);
    process.exit(1);
  }

  console.log(`Successfully logged in ${users.length} users.\n`);

  if (users.length === 0) {
    console.error("No users logged in. Exiting.");
    process.exit(1);
  }

  // 2. Start Trading Simulation
  console.log(`[2/2] Starting trading simulation... Press Ctrl+C to stop.\n`);

  let ordersPlaced = 0;
  let ordersFailed = 0;

  // Status reporter
  setInterval(() => {
    console.log(`[STATUS] Total orders placed: ${ordersPlaced} | Failed: ${ordersFailed}`);
  }, 5000);
  
  while (true) {
    const user = users[Math.floor(Math.random() * users.length)];
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const quantity = Math.floor(Math.random() * 50) + 1;
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

    await sleep(50);
  }
}

run().catch(console.error);
