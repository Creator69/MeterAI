/**
 * Demo consumer agent — zero human interaction.
 *
 * For each target endpoint it:
 *   1. Sends an unpaid request -> reads the 402 quote.
 *   2. Evaluates the quote against its own decision logic (max price/call + budget caps).
 *   3. If acceptable, authorizes a USDC nanopayment via its wallet and retries with proof.
 *   4. Consumes and logs the response.
 * Run alongside `npm run dev:services` (see docs/PROGRESS.md).
 */

const AgentWallet = require('./wallet');

const BASE_URL = process.env.SERVICES_URL || 'http://localhost:4021';

// --- Agent's own spend policy, unrelated to what the provider charges ---
const MAX_PRICE_PER_CALL_USDC = 0.003; // "only pay if the quote is under $0.003/call"
const wallet = new AgentWallet({
  address: 'arc:0xDemoBuyerAgentWalletAddr',
  dailyCapUsdc: 1.0,
  perServiceCapUsdc: 0.5,
});

async function callMeteredEndpoint(path, { serviceIdHint } = {}) {
  const url = `${BASE_URL}${path}`;

  // Step 1: discover price
  const quoteRes = await fetch(url);
  if (quoteRes.status !== 402) {
    console.log(`[agent] ${path} -> unexpected status ${quoteRes.status}, skipping`);
    return;
  }
  const quote = await quoteRes.json();
  const accept = quote.accepts[0];
  const price = parseFloat(accept.maxAmountRequired);
  const serviceId = serviceIdHint || accept.description;

  console.log(`[agent] quote for ${path}: ${price} USDC`);

  // Step 2: decision logic tied to real signals — price ceiling + wallet budget caps
  if (price > MAX_PRICE_PER_CALL_USDC) {
    console.log(`[agent] DECLINE ${path}: ${price} exceeds max price/call ${MAX_PRICE_PER_CALL_USDC}`);
    return;
  }
  const afford = wallet.canAfford(serviceId, price);
  if (!afford.ok) {
    console.log(`[agent] DECLINE ${path}: ${afford.reason}`);
    return;
  }

  // Step 3: authorize nanopayment and retry with proof
  const proof = await wallet.authorizePayment({ serviceId, amountUsdc: price, payTo: accept.payTo });
  const paymentHeader = Buffer.from(JSON.stringify(proof)).toString('base64');

  const paidRes = await fetch(url, { headers: { 'X-PAYMENT': paymentHeader } });
  if (!paidRes.ok) {
    console.log(`[agent] payment retry failed for ${path}: ${paidRes.status}`);
    return;
  }

  // Step 4: consume
  const data = await paidRes.json();
  console.log(`[agent] PAID ${price} USDC -> ${path} settled as ${proof.txRef}`);
  console.log(`[agent] response:`, data);
}

async function main() {
  console.log(`[agent] starting run — max price/call ${MAX_PRICE_PER_CALL_USDC} USDC, daily cap ${wallet.dailyCapUsdc} USDC\n`);

  await callMeteredEndpoint('/v1/inference/sentiment?text=arc%20is%20fast', {
    serviceIdHint: 'sentiment-inference',
  });
  console.log('');
  await callMeteredEndpoint('/v1/data/traffic-density?zone=zone-7', {
    serviceIdHint: 'traffic-density-feed',
  });

  console.log(`\n[agent] run complete. Total spent: ${wallet.spentTodayUsdc.toFixed(4)} USDC`);
}

main().catch((err) => {
  console.error('[agent] fatal error:', err);
  process.exit(1);
});
