import http from 'node:http';
import { pool } from './db.js';
import { tron } from './tron.js';
export function startApi(port = 3000) {
    const server = http.createServer(async (req, res) => {
        try {
            if (req.method === 'GET' && req.url === '/health') {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
                return;
            }
            if (req.method === 'POST' && req.url === '/watch') {
                const body = await new Promise(r => {
                    let d = '';
                    req.on('data', c => d += c);
                    req.on('end', () => r(d));
                });
                const dto = JSON.parse(body || '{}');
                const hex = tron.address.toHex(dto.address).replace(/^0x/, '').toLowerCase();
                const hex40 = hex.slice(-40);
                await pool.query(`INSERT INTO watched_addresses (address_base58,address_hex40,active,expires_at,label,added_by)
           VALUES (:b,:h,1,${dto.expiresInHours ? 'DATE_ADD(NOW(), INTERVAL :hrs HOUR)' : 'NULL'},:label,:by)
           ON DUPLICATE KEY UPDATE active=1, address_hex40=VALUES(address_hex40),
             expires_at=${dto.expiresInHours ? 'DATE_ADD(NOW(), INTERVAL VALUES(expires_at) HOUR)' : 'expires_at'},
             label=IFNULL(:label,label), added_by=IFNULL(:by,added_by)`, { b: dto.address, h: hex40, hrs: dto.expiresInHours, label: dto.label ?? null, by: dto.addedBy ?? null });
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
                return;
            }
            res.writeHead(404);
            res.end();
        }
        catch (e) {
            res.writeHead(500, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: e?.message }));
        }
    });
    server.listen(port, () => console.log('API on', port));
    return server;
}
