import 'dotenv/config';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

const BOT_CREDENTIALS = {
  username: 'market_maker_bot',
  email: 'bot@trade-x.com',
  password: 'BotPassword123!'
};

const SYMBOLS = ['AAPL', 'TSLA', 'MSFT', 'AMZN', 'GOOG', 'META', 'NFLX', 'NVDA'];
let token = '';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function initBot() {
  console.log('🤖 Initializing Multi-Stock Market Maker Bot...');
  let botUserId = '';
  try {
    // Try to login
    try {
      const res = await axios.post(`${API_URL}/auth/login`, {
        email: BOT_CREDENTIALS.email,
        password: BOT_CREDENTIALS.password
      });
      token = res.data.data.token;
      botUserId = res.data.data.userId;
      console.log('✅ Logged in successfully');
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 404) {
        console.log('Bot account not found, registering...');
        const res = await axios.post(`${API_URL}/auth/register`, BOT_CREDENTIALS);
        token = res.data.data.token;
        botUserId = res.data.data.userId;
        console.log('✅ Registered successfully');
      } else {
        throw err;
      }
    }

    // Give bot money (Max deposit per transaction is 1M)
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    await axios.post(`${API_URL}/wallet/deposit`, { amount: 1000000 });
    console.log('💰 Bot wallet funded');

    // Give bot unlimited shares for all symbols via internal API
    const SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || 'trade_x_internal_key_change_in_production';
    
    for (const symbol of SYMBOLS) {
      await axios.post('http://localhost:3004/internal/portfolio/trade-executed', {
        tradeId: `seed-${symbol}-${Date.now()}`,
        buyOrderId: `seed-buy-${symbol}`,
        sellOrderId: `seed-sell-${symbol}`,
        buyerId: botUserId,
        sellerId: 'system',
        symbol: symbol,
        quantity: 100000,
        price: 150.00,
        makerSide: 'SELL',
        executedAt: new Date().toISOString()
      }, {
        headers: { 'x-service-key': SERVICE_KEY }
      });
      console.log(`📦 Bot portfolio funded with ${symbol} shares`);
    }

    startTrading();
  } catch (error: any) {
    console.error('❌ Bot initialization failed:', error.response?.data || error.message);
  }
}

let baselinePrices: Record<string, number> = {
  'AAPL': 150.0,
  'TSLA': 200.0,
  'MSFT': 350.0,
  'AMZN': 130.0,
  'GOOG': 140.0,
  'META': 300.0,
  'NFLX': 400.0,
  'NVDA': 500.0
};

async function startTrading() {
  console.log(`📈 Starting Market Making for: ${SYMBOLS.join(', ')}`);
  
  while (true) {
    for (const symbol of SYMBOLS) {
      try {
        // Random walk the baseline price
        baselinePrices[symbol] += (Math.random() - 0.5) * 2;
        if (baselinePrices[symbol] < 50) baselinePrices[symbol] = 50;

        const currentPrice = baselinePrices[symbol];

        // 1. Post a few liquidity limit orders (Bids & Asks)
        const bidPrice = currentPrice - (Math.random() * 0.5);
        const askPrice = currentPrice + (Math.random() * 0.5);
        
        const bidQty = Math.floor(Math.random() * 50) + 1;
        const askQty = Math.floor(Math.random() * 50) + 1;

        // Post Bid
        await axios.post(`${API_URL}/orders`, {
          symbol,
          side: 'BUY',
          type: 'LIMIT',
          quantity: bidQty,
          price: Number(bidPrice.toFixed(2))
        });

        // Post Ask
        await axios.post(`${API_URL}/orders`, {
          symbol,
          side: 'SELL',
          type: 'LIMIT',
          quantity: askQty,
          price: Number(askPrice.toFixed(2))
        });

        // 2. Randomly execute a market order to generate a trade and move the chart
        if (Math.random() > 0.6) {
          const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
          const qty = Math.floor(Math.random() * 10) + 1;
          await axios.post(`${API_URL}/orders`, {
            symbol,
            side,
            type: 'MARKET',
            quantity: qty
          });
          console.log(`💥 Executed ${side} ${qty} ${symbol} @ Market`);
        }

      } catch (err: any) {
        console.error(`Bot Error (${symbol}):`, err.response?.data?.error?.message || err.message);
      }
    }
    
    // Wait between 1 and 3 seconds
    await sleep(1000 + Math.random() * 2000);
  }
}

initBot();
