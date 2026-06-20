import mongoose from 'mongoose';
import crypto from 'crypto';

// ─── Config ───────────────────────────────────────────────────────────────────
const API_GATEWAY   = 'http://localhost:3000';
const PORTFOLIO_URI = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/portfolio-db';

const NUM_USERS = 50; // number of simulated traders
const SYMBOLS   = ['AAPL', 'GOOG', 'TSLA', 'AMZN', 'MSFT', 'NFLX', 'NVDA', 'META'];
const SHARES_PER_SYMBOL = 2000; // shares given to each simulated user
const INITIAL_CASH      = 500000; // not directly set here — comes from auth-service .env

// Baseline prices for LIMIT order offset calculations
const BASELINE: Record<string, number> = {
  AAPL: 600, GOOG: 2800, TSLA: 420,
  AMZN: 900, MSFT: 312, NFLX: 450,
  NVDA: 875, META: 520
};

// ─── Schemas ──────────────────────────────────────────────────────────────────
const holdingSchema = new mongoose.Schema({
  userId:       String,
  symbol:       String,
  availableQty: Number,
  lockedQty:    Number,
  avgCostBasis: mongoose.Schema.Types.Decimal128,
  version:      Number
}, { collection: 'holdings', timestamps: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface SimUser {
  userId: string;
  email: string;
  token: string;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║        Trade-X Fresh Simulation            ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // ── STEP 1: Register fresh simulated users ──────────────────────────────────
  const users: SimUser[] = [];
  console.log(`[1/3] Registering ${NUM_USERS} simulation users...`);

  for (let i = 0; i < NUM_USERS; i++) {
    const id       = crypto.randomUUID().substring(0, 8);
    const email    = `sim_${id}@tradex.test`;
    const username = `sim_${id}`;
    const password = 'Simulate@123';

    try {
      const res  = await fetch(`${API_GATEWAY}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        users.push({ userId: data.data.userId, email: data.data.email, token: data.data.token });
        if ((i + 1) % 10 === 0) console.log(`  ✓ Registered ${i + 1}/${NUM_USERS} users`);
      } else {
        console.error(`  ✗ Failed [${email}]:`, data.message ?? data);
      }
    } catch (err: any) {
      console.error(`  ✗ Network error [${email}]:`, err.message);
    }
  }

  console.log(`\n  Registered ${users.length} users successfully.\n`);
  if (users.length === 0) { console.error('No users created. Is the API gateway running?'); process.exit(1); }

  // ── STEP 2: Seed holdings for every user ────────────────────────────────────
  console.log(`[2/3] Seeding ${SHARES_PER_SYMBOL} shares × ${SYMBOLS.length} symbols for each user...`);
  try {
    const conn    = await mongoose.createConnection(PORTFOLIO_URI).asPromise();
    const Holding = conn.model('Holding', holdingSchema);

    let count = 0;
    for (const user of users) {
      for (const symbol of SYMBOLS) {
        await Holding.findOneAndUpdate(
          { userId: user.userId, symbol },
          {
            $inc: { availableQty: SHARES_PER_SYMBOL },
            $setOnInsert: {
              lockedQty:    0,
              avgCostBasis: mongoose.Types.Decimal128.fromString(String(BASELINE[symbol])),
              version:      0
            }
          },
          { upsert: true, new: true }
        );
        count++;
      }
    }

    await conn.close();
    console.log(`  ✓ ${count} holding records seeded.\n`);
  } catch (err: any) {
    console.error('  ✗ Holdings seeding failed:', err.message);
    process.exit(1);
  }

  // ── STEP 3: Run continuous trading simulation ───────────────────────────────
  console.log('[3/3] Starting trading simulation — press Ctrl+C to stop.\n');

  let placed = 0;
  let failed = 0;

  // Status reporter every 10 seconds
  const reporter = setInterval(() => {
    console.log(`[STATUS] placed=${placed}  failed=${failed}  rate=${(placed / ((Date.now() - startTime) / 1000)).toFixed(1)} req/s`);
  }, 10_000);

  const startTime = Date.now();

  // 5 concurrent async workers — each fires one order, waits 20ms, repeats
  const CONCURRENCY = 5;
  let running       = true;

  const worker = async () => {
    while (running) {
      const user    = users[Math.floor(Math.random() * users.length)];
      const symbol  = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const side    = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const qty     = Math.floor(Math.random() * 100) + 1;
      const isLimit = Math.random() > 0.3; // 70% LIMIT, 30% MARKET
      const type    = isLimit ? 'LIMIT' : 'MARKET';

      let price: number | undefined;
      if (isLimit) {
        const offset = (Math.random() - 0.5) * BASELINE[symbol] * 0.04; // ±2%
        price = parseFloat((BASELINE[symbol] + offset).toFixed(2));
      }

      try {
        const res  = await fetch(`${API_GATEWAY}/api/orders`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${user.token}`
          },
          body: JSON.stringify({ symbol, side, type, quantity: qty, price })
        });
        const data = await res.json();
        if (res.ok && data.success) { placed++; } else { failed++; }
      } catch {
        failed++;
      }

      await sleep(20);
    }
  };

  // Graceful Ctrl+C shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nStopping simulation...');
    running = false;
    clearInterval(reporter);
    await sleep(500);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n╔════════════════════════════════════════════╗');
    console.log( '║           Simulation Summary               ║');
    console.log( '╠════════════════════════════════════════════╣');
    console.log(`║  Duration  : ${elapsed}s`.padEnd(46) + '║');
    console.log(`║  Placed    : ${placed}`.padEnd(46) + '║');
    console.log(`║  Failed    : ${failed}`.padEnd(46) + '║');
    console.log(`║  Avg rate  : ${(placed / parseFloat(elapsed)).toFixed(2)} req/s`.padEnd(46) + '║');
    console.log( '╚════════════════════════════════════════════╝');
    process.exit(0);
  });

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}

run().catch(err => {
  console.error('Simulation crashed:', err.message);
  process.exit(1);
});
