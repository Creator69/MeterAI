const express = require('express');
const path = require('path');
const { meterAI } = require('./meterai');
const Store = require('./store');

const app = express();
app.use(express.json());

const store = new Store();
const PROVIDER_WALLET = process.env.PROVIDER_WALLET || 'arc:0xProviderCircleWalletDemoAddr';

// --- Service 1: mock inference endpoint --------------------------------
app.get(
  '/v1/inference/sentiment',
  meterAI({ priceUsdc: 0.002, payToAddress: PROVIDER_WALLET, serviceId: 'sentiment-inference', store }),
  (req, res) => {
    const text = req.query.text || '';
    const score = text.length % 2 === 0 ? 'positive' : 'negative';
    res.json({ text, sentiment: score, confidence: 0.87 });
  }
);

// --- Service 2: mock live data feed -------------------------------------
app.get(
  '/v1/data/traffic-density',
  meterAI({ priceUsdc: 0.0015, payToAddress: PROVIDER_WALLET, serviceId: 'traffic-density-feed', store }),
  (req, res) => {
    const zone = req.query.zone || 'zone-1';
    res.json({ zone, densityScore: (Math.random() * 100).toFixed(1), unit: 'vehicles/km', ts: Date.now() });
  }
);

// --- Provider dashboard API (read-only JSON, polled by dashboard/) ------
app.get('/dashboard/api/summary', (req, res) => {
  res.json({
    byService: store.earningsByService(),
    byConsumer: store.earningsByConsumer(),
    recentCalls: store.recentCalls(50),
  });
});

app.use('/dashboard', express.static(path.join(__dirname, '..', 'dashboard')));

const PORT = process.env.PORT || 4021;
app.listen(PORT, () => {
  console.log(`MeterAI demo services + dashboard running on http://localhost:${PORT}`);
  console.log(`  GET /v1/inference/sentiment?text=...   (0.002 USDC/call)`);
  console.log(`  GET /v1/data/traffic-density?zone=...  (0.0015 USDC/call)`);
  console.log(`  Dashboard: http://localhost:${PORT}/dashboard`);
});
