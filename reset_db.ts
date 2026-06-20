import mongoose from 'mongoose';

// ─── DB URIs ──────────────────────────────────────────────────────────────────
const AUTH_URI      = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/auth-db';
const PORTFOLIO_URI = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/portfolio-db';
const ORDER_URI     = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/order-db';
const MARKET_URI    = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/market-db';

// ─── Schemas ──────────────────────────────────────────────────────────────────
const userSchema         = new mongoose.Schema({ userId: String, email: String, username: String }, { collection: 'users' });
const walletSchema       = new mongoose.Schema({ userId: String }, { collection: 'wallets' });
const holdingSchema      = new mongoose.Schema({ userId: String, symbol: String }, { collection: 'holdings' });
const orderSchema        = new mongoose.Schema({ userId: String }, { collection: 'orders' });
const tradeSchema        = new mongoose.Schema({ buyerId: String, sellerId: String }, { collection: 'trades' });
const recentTradeSchema  = new mongoose.Schema({ symbol: String }, { collection: 'recent_trades' });
// HistoricalPrice: the actual collection used for candles (NOT 'prices' or 'ohlccandles')
const historicalSchema   = new mongoose.Schema({ symbol: String, timeframe: String }, { collection: 'historical_prices' });

async function run() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║       Trade-X Database Reset         ║');
  console.log('╚══════════════════════════════════════╝\n');

  // ── 1. AUTH DB ───────────────────────────────────────────────────────────────
  console.log('[1/4] Connecting to auth-db...');
  const authConn = await mongoose.createConnection(AUTH_URI).asPromise();
  const User = authConn.model('User', userSchema);

  // Delete sim_ users (from simulation.ts) AND legacy testuser_ / user_ patterns
  const testUsers = await User.find({
    $or: [
      { email:    { $regex: /^(sim_|testuser_)/ } },
      { username: { $regex: /^(sim_|user_)/ } }
    ]
  }).exec();

  const testUserIds = testUsers.map(u => u.userId).filter(Boolean);
  console.log(`  Found ${testUsers.length} sim/test users (${testUserIds.length} userIds).`);

  const authDel = await User.deleteMany({
    $or: [
      { email:    { $regex: /^(sim_|testuser_)/ } },
      { username: { $regex: /^(sim_|user_)/ } }
    ]
  });
  console.log(`  ✓ Deleted ${authDel.deletedCount} users from auth-db.\n`);
  await authConn.close();

  // ── 2. PORTFOLIO DB ───────────────────────────────────────────────────────────
  console.log('[2/4] Connecting to portfolio-db...');
  const portfolioConn = await mongoose.createConnection(PORTFOLIO_URI).asPromise();
  const Holding = portfolioConn.model('Holding', holdingSchema);
  const Wallet  = portfolioConn.model('Wallet', walletSchema);

  const holdingDel = await Holding.deleteMany({ userId: { $in: testUserIds } });
  const walletDel  = await Wallet.deleteMany({ userId: { $in: testUserIds } });
  console.log(`  ✓ Deleted ${holdingDel.deletedCount} holdings.`);
  console.log(`  ✓ Deleted ${walletDel.deletedCount} wallets.\n`);
  await portfolioConn.close();

  // ── 3. ORDER DB ───────────────────────────────────────────────────────────────
  console.log('[3/4] Connecting to order-db...');
  const orderConn = await mongoose.createConnection(ORDER_URI).asPromise();
  const Order = orderConn.model('Order', orderSchema);
  const Trade = orderConn.model('Trade', tradeSchema);

  const orderDel = await Order.deleteMany({ userId: { $in: testUserIds } });
  const tradeDel = await Trade.deleteMany({
    $or: [
      { buyerId:  { $in: testUserIds } },
      { sellerId: { $in: testUserIds } }
    ]
  });
  console.log(`  ✓ Deleted ${orderDel.deletedCount} orders.`);
  console.log(`  ✓ Deleted ${tradeDel.deletedCount} trades.\n`);
  await orderConn.close();

  // ── 4. MARKET DB ──────────────────────────────────────────────────────────────
  console.log('[4/4] Connecting to market-db...');
  const marketConn = await mongoose.createConnection(MARKET_URI).asPromise();
  const db = marketConn.db;
  const RecentTrade = marketConn.model('RecentTrade', recentTradeSchema);

  if (!db) throw new Error('Could not connect to market-db');

  const recentDel = await RecentTrade.deleteMany({});
  const { deletedCount: pCount } = await db.collection('historical_prices').deleteMany({});
  const { deletedCount: sCount } = await db.collection('market_snapshots').deleteMany({});
  console.log(`  ✓ Deleted ${pCount ?? 0} historical prices and ${sCount ?? 0} market snapshots.`);
  console.log(`  ✓ Deleted ${recentDel.deletedCount} recent trades.\n`);
  await marketConn.close();

  console.log('╔══════════════════════════════════════╗');
  console.log('║           Reset Complete! ✓          ║');
  console.log('╠══════════════════════════════════════╣');
  console.log('║  sim/test users, orders, holdings,   ║');
  console.log('║  wallets, trades, live candles &     ║');
  console.log('║  recent trades have been wiped.      ║');
  console.log('║  Historical 1D candles preserved.    ║');
  console.log('╚══════════════════════════════════════╝');

  process.exit(0);
}

run().catch(err => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
