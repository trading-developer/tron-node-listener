import { tron, TRANSFER_TOPIC, usdtHexAddr, base58FromHex40 } from './tron.js';
import { autoUnsubscribe, getScannerLast, insertEvent, listActive, setScannerLast, touchActivity } from './db.js';
import pLimit from 'p-limit';
import { cfg } from './config.js';
import { sendWebhook } from "./webhook";
const limit = pLimit(10);
function normHex(s) {
    return (s || '').replace(/^0x/, '').toLowerCase();
}
export async function tickOnce() {
    await autoUnsubscribe(cfg.WATCH_MAX_IDLE_HOURS);
    const last = await getScannerLast();
    const latestBlock = await tron.trx.getCurrentBlock();
    const latestHeight = latestBlock.block_header.raw_data.number;
    const toBlock = Math.max(last, latestHeight - cfg.CONFIRMATIONS);
    if (toBlock <= last)
        return;
    const watched = await listActive();
    if (watched.length === 0) {
        await setScannerLast(toBlock);
        return;
    }
    const watchSet = new Set(watched.map(w => w.address_hex40));
    const start = last + 1;
    const end = Math.min(toBlock, start + cfg.SCAN_STEP - 1);
    for (let h = start; h <= end; h++) {
        const block = await tron.trx.getBlock(h);
        const txs = block?.transactions ?? [];
        if (!txs.length) {
            await setScannerLast(h);
            continue;
        }
        const candidateTxIds = [];
        for (const tx of txs) {
            const c = tx.raw_data?.contract?.[0];
            if (c?.type !== 'TriggerSmartContract')
                continue;
            const toContract = normHex(c.parameter?.value?.contract_address);
            if (toContract === usdtHexAddr)
                candidateTxIds.push(tx.txID);
        }
        const tasks = candidateTxIds.map((txid) => limit(async () => {
            const info = await tron.trx.getTransactionInfo(txid);
            const logs = info?.log ?? [];
            for (let i = 0; i < logs.length; i++) {
                const log = logs[i];
                if (normHex(log.address) !== usdtHexAddr)
                    continue;
                const topics = (log.topics || []).map(normHex);
                if (topics[0] !== TRANSFER_TOPIC)
                    continue;
                const fromHex40 = topics[1].slice(-40);
                const toHex40 = topics[2].slice(-40);
                const hitOUT = watchSet.has(fromHex40);
                const hitIN = watchSet.has(toHex40);
                if (!hitIN && !hitOUT)
                    continue;
                const fromB58 = base58FromHex40(fromHex40);
                const toB58 = base58FromHex40(toHex40);
                const value = BigInt('0x' + (normHex(log.data) || '0'));
                const amount = (Number(value) / 1_000_000).toFixed(6);
                const event = {
                    network: 'TRON',
                    token: 'USDT',
                    txid,
                    block: h,
                    ts: new Date(info.blockTimeStamp ?? block.block_header.raw_data.timestamp),
                    from: fromB58,
                    to: toB58,
                    amount_raw: value.toString(),
                    amount,
                    direction: hitIN && hitOUT ? 'IN/OUT' : (hitIN ? 'IN' : 'OUT')
                };
                await insertEvent({
                    txid,
                    log_index: i,
                    block_num: h,
                    ts: event.ts,
                    from_addr_base58: fromB58,
                    to_addr_base58: toB58,
                    from_hex40: fromHex40,
                    to_hex40: toHex40,
                    amount_raw: event.amount_raw,
                    amount: event.amount,
                    direction: event.direction,
                    watched_hit: hitIN && hitOUT ? 'BOTH' : (hitIN ? 'TO' : 'FROM')
                });
                // можно вынести в очередь, если вебхук медленный
                await sendWebhook(event);
                if (hitOUT)
                    await touchActivity(fromB58, event.ts);
                if (hitIN)
                    await touchActivity(toB58, event.ts);
            }
        }));
        await Promise.all(tasks);
        await setScannerLast(h);
    }
}
