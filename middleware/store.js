const Database = require('better-sqlite3');
const path = require('path');

class Store {
  constructor(dbPath = path.join(__dirname, '..', 'meterai.db')) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        serviceId TEXT NOT NULL,
        payer TEXT NOT NULL,
        amountUsdc REAL NOT NULL,
        txRef TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  logCall(call) {
    this.db
      .prepare(
        `INSERT INTO calls (id, serviceId, payer, amountUsdc, txRef, timestamp)
         VALUES (@id, @serviceId, @payer, @amountUsdc, @txRef, @timestamp)`
      )
      .run(call);
  }

  earningsByService() {
    return this.db
      .prepare(
        `SELECT serviceId, COUNT(*) as calls, SUM(amountUsdc) as earningsUsdc
         FROM calls GROUP BY serviceId ORDER BY earningsUsdc DESC`
      )
      .all();
  }

  earningsByConsumer() {
    return this.db
      .prepare(
        `SELECT payer, COUNT(*) as calls, SUM(amountUsdc) as spentUsdc
         FROM calls GROUP BY payer ORDER BY spentUsdc DESC`
      )
      .all();
  }

  recentCalls(limit = 50) {
    return this.db
      .prepare(`SELECT * FROM calls ORDER BY timestamp DESC LIMIT ?`)
      .all(limit);
  }
}

module.exports = Store;
