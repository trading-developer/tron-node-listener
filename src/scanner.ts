import { tron, TRANSFER_TOPIC, usdtHexAddr, base58FromHex40 } from './tron.js';
import { autoUnsubscribe, getScannerLast, insertEvent, listActive, setScannerLast, touchActivity } from './db.js';
import pLimit from 'p-limit';
import { cfg } from './config.js';
import { queueWebhook } from "./webhook.js";

const limit = pLimit(10);

function normHex(s: string) {
    return (s || '').replace(/^0x/, '').toLowerCase();
}

export async function tickOnce() {
    await autoUnsubscribe(cfg.WATCH_MAX_IDLE_HOURS);

    const last = await getScannerLast();
    let latestHeight = last;
    try {
        const latestBlock = await tron.trx.getCurrentBlock();
        latestHeight = latestBlock.block_header.raw_data.number;
    } catch (e) {
        console.warn('[scanner] getCurrentBlock failed:', e);
        return;
    }
    const toBlock = Math.max(last, latestHeight - cfg.CONFIRMATIONS);
    if (toBlock <= last) {
        console.log(`[scanner] up-to-date: last=${last}, latest=${latestHeight}, conf=${cfg.CONFIRMATIONS}`);
        return;
    }

    const watched = await listActive();
    if (watched.length === 0) {
        console.log(`[scanner] no watched addresses. fast-forward to ${toBlock}`);
        await setScannerLast(toBlock);
        return;
    }

    // Нормализуем до нижнего регистра и последних 40 символов (без 0x)
    const watchSet = new Set(watched.map(w => normHex(w.address_hex40).slice(-40)));
    const watchMap = new Map(watched.map(w => [normHex(w.address_hex40).slice(-40), w.id]));
    const usdtHex40 = normHex(usdtHexAddr).slice(-40);

    const start = last + 1;
    const end = Math.min(toBlock, start + cfg.SCAN_STEP - 1);


    for (let h = start; h <= end; h++) {
        let block: any;
        try {
            block = await tron.trx.getBlock(h);
        } catch (e) {
            console.warn(`[scanner] getBlock(${h}) failed:`, e);
            continue;
        }
        const txs: any[] = block?.transactions ?? [];
        if (!txs.length) { await setScannerLast(h); continue; }

        // Берём все txid — события Transfer USDT могут возникать и при вызовах других контрактов
        const candidateTxIds: string[] = txs.map(tx => tx.txID);
        let insertedInBlock = 0;
        const tasks = candidateTxIds.map((txid) => limit(async () => {
            let info: any;
            try {
                info = await tron.trx.getTransactionInfo(txid);
            } catch (e) {
                console.warn(`[scanner] getTransactionInfo(${txid}) failed:`, e);
                return;
            }
            const logs: any[] = info?.log ?? [];

            for (let i = 0; i < logs.length; i++) {
                const log = logs[i];
                const logAddr = normHex(log.address);
                const logAddr40 = logAddr.slice(-40);
                if (logAddr40 !== usdtHex40) continue;
                const topics: string[] = (log.topics || []).map(normHex);
                if (topics[0] !== TRANSFER_TOPIC) continue;

                const fromHex40 = topics[1].slice(-40);
                const toHex40   = topics[2].slice(-40);

                const hitOUT = watchSet.has(fromHex40);
                const hitIN  = watchSet.has(toHex40);
                if (!hitIN && !hitOUT) continue;

                // Определяем watched_address_id для события
                let watchedAddressId: number | undefined;
                if (hitIN && hitOUT) {
                    // Если оба адреса в watchlist, берём первый попавшийся
                    watchedAddressId = watchMap.get(fromHex40) || watchMap.get(toHex40);
                } else if (hitIN) {
                    watchedAddressId = watchMap.get(toHex40);
                } else if (hitOUT) {
                    watchedAddressId = watchMap.get(fromHex40);
                }

                const fromB58 = base58FromHex40(fromHex40);
                const toB58   = base58FromHex40(toHex40);
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
                    direction: event.direction as any,
                    watched_hit: hitIN && hitOUT ? 'BOTH' : (hitIN ? 'TO' : 'FROM'),
                    watched_address_id: watchedAddressId
                });
                insertedInBlock += 1;

                queueWebhook(event);

                if (hitOUT) await touchActivity(fromB58, event.ts);
                if (hitIN)  await touchActivity(toB58,   event.ts);
            }
        }));

        await Promise.all(tasks);
        await setScannerLast(h);
    }
}
