import mongoose from 'mongoose';

const API_GATEWAY = 'http://localhost:3000';
const authUri = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/auth-db';

const userSchema = new mongoose.Schema({
  userId: String,
  email: String,
}, { collection: 'users' });

async function run() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log("Usage: npx tsx simulate_order.ts <BUY|SELL> <SYMBOL> <QUANTITY>");
    console.log("Example: npx tsx simulate_order.ts BUY AAPL 10");
    process.exit(1);
  }

  const side = args[0].toUpperCase();
  const symbol = args[1].toUpperCase();
  const quantity = parseInt(args[2], 10);
  const type = 'MARKET';

  console.log(`[1/2] Fetching a test user and logging in...`);
  let token = '';

  try {
    const authConn = await mongoose.createConnection(authUri).asPromise();
    const User = authConn.model('User', userSchema);
    const dbUser = await User.findOne({ email: /testuser_/ }).exec();
    await authConn.close();

    if (!dbUser || !dbUser.email) {
      console.error("No test user found in database.");
      process.exit(1);
    }

    const loginRes = await fetch(`${API_GATEWAY}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: dbUser.email, password: 'Password@123' })
    });
    const loginData = await loginRes.json();

    if (loginRes.ok && loginData.success) {
      token = loginData.data.token;
      console.log(`Successfully logged in as ${dbUser.email}`);
    } else {
      console.error("Failed to login:", loginData);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error fetching/logging in user:', err);
    process.exit(1);
  }

  console.log(`\n[2/2] Placing ${type} ${side} order for ${quantity} ${symbol}...`);

  try {
    const response = await fetch(`${API_GATEWAY}/api/orders`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ symbol, side, type, quantity })
    });
    
    const data = await response.json();
    if (response.ok && data.success) {
      console.log(`✅ Order placed successfully!`);
      console.log(`Order ID: ${data.data.orderId}`);
      console.log(`Status: ${data.data.status}`);
    } else {
      console.error(`❌ Failed to place order:`, data);
    }
  } catch (err) {
    console.error(`❌ Error placing order:`, err);
  }
}

run().catch(console.error);
