/**
 * Stand-in for Circle Wallets + Agent Stack + Paymaster.
 *
 * Real integration (Checkpoint 3):
 *   - `createWallet()`   -> Circle Wallets API (Agent Stack starter kit) provisions an
 *                           MPC/developer-controlled wallet scoped to this agent.
 *   - `authorizePayment()` -> builds a USDC transfer, sponsors gas via Paymaster
 *                             (agent never holds native gas token, only thinks in USDC),
 *                             submits on Arc, and returns the settled tx hash.
 * For this checkpoint both are mocked so the full agent decision loop — discover price,
 * check budget, decide, pay, retry, consume — runs end-to-end without live keys.
 */

class AgentWallet {
  constructor({ address, dailyCapUsdc, perServiceCapUsdc }) {
    this.address = address;
    this.dailyCapUsdc = dailyCapUsdc;
    this.perServiceCapUsdc = perServiceCapUsdc;
    this.spentTodayUsdc = 0;
    this.spentByService = {};
  }

  // Would call Circle Wallets balance API in the real integration.
  getSpendState(serviceId) {
    return {
      spentTodayUsdc: this.spentTodayUsdc,
      spentOnServiceUsdc: this.spentByService[serviceId] || 0,
    };
  }

  canAfford(serviceId, priceUsdc) {
    const { spentTodayUsdc, spentOnServiceUsdc } = this.getSpendState(serviceId);
    if (spentTodayUsdc + priceUsdc > this.dailyCapUsdc) return { ok: false, reason: 'daily cap exceeded' };
    if (spentOnServiceUsdc + priceUsdc > this.perServiceCapUsdc)
      return { ok: false, reason: 'per-service cap exceeded' };
    return { ok: true };
  }

  /**
   * Mocked nanopayment authorization. Returns a payment proof shaped exactly like what
   * the real Arc settlement (via Paymaster-sponsored USDC transfer) would return, so
   * swapping in the live call later is a one-function change.
   */
  async authorizePayment({ serviceId, amountUsdc, payTo }) {
    this.spentTodayUsdc += amountUsdc;
    this.spentByService[serviceId] = (this.spentByService[serviceId] || 0) + amountUsdc;

    const proof = {
      from: this.address,
      to: payTo,
      amountUsdc,
      txRef: `arc:mock:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      settledAt: Date.now(),
    };
    return proof;
  }
}

module.exports = AgentWallet;
