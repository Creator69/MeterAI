/**
 * MeterAI middleware — turns any Express route into a pay-per-call endpoint.
 *
 * Flow:
 *   1. Request arrives with no payment header -> respond 402 with price + payment instructions.
 *   2. Agent authorizes a USDC nanopayment on Arc via its wallet (Circle Wallets / Agent Stack),
 *      then retries the same request with an `X-PAYMENT` header containing the payment proof.
 *   3. Middleware verifies the proof against Arc (settlement check) and, if valid, lets the
 *      request through and records the call for the provider dashboard.
 *
 * NOTE ON THIS CHECKPOINT: `verifyPaymentOnArc()` below is a stub. It defines the exact
 * interface we'll swap for a real Arc RPC + Circle Contracts settlement check in Checkpoint 3
 * (see docs/PROGRESS.md "Next steps"). Everything else — pricing, 402 semantics, budget
 * enforcement on the agent side, call logging — is fully functional today.
 */

const { randomUUID } = require('crypto');

/**
 * @param {object} opts
 * @param {number} opts.priceUsdc   - price per call in USDC (e.g. 0.001)
 * @param {string} opts.payToAddress - provider's Arc/Circle wallet address
 * @param {string} opts.serviceId   - identifier shown in the dashboard
 * @param {import('./store')} opts.store - call/earnings store
 */
function meterAI({ priceUsdc, payToAddress, serviceId, store }) {
  return async function meterAIMiddleware(req, res, next) {
    const paymentHeader = req.get('X-PAYMENT');

    if (!paymentHeader) {
      // Step 1: no payment attached — quote the price, x402-style.
      res.status(402).json({
        error: 'Payment Required',
        x402Version: 1,
        accepts: [
          {
            scheme: 'exact',
            network: 'arc',
            asset: 'USDC',
            maxAmountRequired: priceUsdc.toString(),
            payTo: payToAddress,
            resource: req.originalUrl,
            description: `Pay-per-call access to ${serviceId}`,
          },
        ],
      });
      return;
    }

    // Step 2: verify the payment proof the agent retried the request with.
    let proof;
    try {
      proof = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf8'));
    } catch (err) {
      res.status(400).json({ error: 'Malformed X-PAYMENT header' });
      return;
    }

    const verification = await verifyPaymentOnArc(proof, { priceUsdc, payToAddress });
    if (!verification.ok) {
      res.status(402).json({ error: 'Payment verification failed', reason: verification.reason });
      return;
    }

    // Step 3: payment settled — log the call and let it through.
    store.logCall({
      id: randomUUID(),
      serviceId,
      payer: proof.from,
      amountUsdc: priceUsdc,
      txRef: proof.txRef,
      timestamp: Date.now(),
    });

    res.setHeader('X-PAYMENT-SETTLED', proof.txRef);
    next();
  };
}

/**
 * Stub settlement check. Real implementation (Checkpoint 3) will:
 *   - confirm `proof.txRef` on Arc (sub-second finality)
 *   - confirm the transfer amount >= priceUsdc and asset == USDC
 *   - confirm `payTo` matches the provider's registered Circle Wallet address
 *   - reject replays via a seen-txRef cache
 * For this checkpoint, we accept any structurally valid proof so the full
 * 402 -> pay -> retry -> serve loop can be demoed end-to-end today.
 */
async function verifyPaymentOnArc(proof, { priceUsdc, payToAddress }) {
  if (!proof || !proof.txRef || !proof.from || typeof proof.amountUsdc !== 'number') {
    return { ok: false, reason: 'incomplete proof' };
  }
  if (proof.amountUsdc < priceUsdc) {
    return { ok: false, reason: 'underpaid' };
  }
  return { ok: true };
}

module.exports = { meterAI, verifyPaymentOnArc };
