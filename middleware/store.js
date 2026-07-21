const fs = require('fs');
const path = require('path');

/**
 * Pure-JS call/earnings store backed by a JSON file — no native compilation step,
 * so it runs identically on Windows/Mac/Linux with zero build tools required.
 * (Swapping to a real database later is a drop-in change behind this same class.)
 */
class Store {
  constructor(dbPath = path.join(__dirname, '..', 'meterai-data.json')) {
    this.dbPath = dbPath;
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, JSON.stringify({ calls: [] }, null, 2));
    }
  }

  _read() {
    return JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
  }

  _write(data) {
    fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
  }

  logCall(call) {
    const data = this._read();
    data.calls.push(call);
    this._write(data);
  }

  earningsByService() {
    const { calls } = this._read();
    const map = new Map();
    for (const c of calls) {
      const entry = map.get(c.serviceId) || { serviceId: c.serviceId, calls: 0, earningsUsdc: 0 };
      entry.calls += 1;
      entry.earningsUsdc += c.amountUsdc;
      map.set(c.serviceId, entry);
    }
    return [...map.values()].sort((a, b) => b.earningsUsdc - a.earningsUsdc);
  }

  earningsByConsumer() {
    const { calls } = this._read();
    const map = new Map();
    for (const c of calls) {
      const entry = map.get(c.payer) || { payer: c.payer, calls: 0, spentUsdc: 0 };
      entry.calls += 1;
      entry.spentUsdc += c.amountUsdc;
      map.set(c.payer, entry);
    }
    return [...map.values()].sort((a, b) => b.spentUsdc - a.spentUsdc);
  }

  recentCalls(limit = 50) {
    const { calls } = this._read();
    return [...calls].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }
}

module.exports = Store;
