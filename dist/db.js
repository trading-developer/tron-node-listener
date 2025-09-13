import mysql from 'mysql2/promise';
import { cfg } from './config.js';
export const pool = mysql.createPool({
    host: cfg.DB_HOST,
    port: cfg.DB_PORT,
    user: cfg.DB_USER,
    password: cfg.DB_PASS,
    database: cfg.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true
});
export async function getScannerLast() {
    const [rows] = await pool.query('SELECT last_processed_block FROM scanner_state WHERE id=1 AND state_key="usdt"');
    const r = rows[0];
    return r ? Number(r.last_processed_block) : cfg.START_BLOCK;
}
export async function setScannerLast(h) {
    await pool.query('INSERT INTO scanner_state (id, state_key, last_processed_block) VALUES (1,"usdt",:h) ON DUPLICATE KEY UPDATE last_processed_block=:h', { h });
}
export async function listActive() {
    const [rows] = await pool.query('SELECT address_base58,address_hex40,active FROM watched_addresses WHERE active=1');
    return rows;
}
export async function touchActivity(addr, when) {
    await pool.query('UPDATE watched_addresses SET last_activity_at=:ts WHERE address_base58=:a', { ts: when, a: addr });
}
export async function autoUnsubscribe(maxIdleHours) {
    await pool.query('UPDATE watched_addresses SET active=0 WHERE active=1 AND expires_at IS NOT NULL AND expires_at <= NOW()');
    if (maxIdleHours && maxIdleHours > 0) {
        await pool.query('UPDATE watched_addresses SET active=0 WHERE active=1 AND last_activity_at IS NOT NULL AND last_activity_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)', [maxIdleHours]);
    }
}
export async function insertEvent(e) {
    try {
        await pool.query(`INSERT INTO usdt_events
       (txid,log_index,block_num,ts,from_addr_base58,to_addr_base58,from_hex40,to_hex40,amount_raw,amount,direction,watched_hit)
       VALUES (:txid,:log_index,:block_num,:ts,:fB,:tB,:fH,:tH,:raw,:amt,:dir,:hit)`, {
            txid: e.txid, log_index: e.log_index, block_num: e.block_num, ts: e.ts,
            fB: e.from_addr_base58, tB: e.to_addr_base58,
            fH: e.from_hex40, tH: e.to_hex40,
            raw: e.amount_raw, amt: e.amount, dir: e.direction, hit: e.watched_hit
        });
    }
    catch (err) {
        if (err?.code !== 'ER_DUP_ENTRY')
            throw err;
    }
}
