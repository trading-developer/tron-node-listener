import { cfg } from './config.js';
import { createHmac } from 'node:crypto';
import { fetch } from 'undici';
const webhookQueue = [];
let isProcessingWebhooks = false;
async function processWebhookQueue() {
    if (isProcessingWebhooks || webhookQueue.length === 0)
        return;
    isProcessingWebhooks = true;
    while (webhookQueue.length > 0) {
        const event = webhookQueue.shift();
        try {
            await sendWebhookSync(event);
        }
        catch (error) {
            console.warn('[webhook] failed:', error);
        }
    }
    isProcessingWebhooks = false;
}
export function queueWebhook(payload) {
    webhookQueue.push(payload);
    setImmediate(processWebhookQueue);
}
async function sendWebhookSync(payload) {
    const body = JSON.stringify(payload);
    const headers = { 'content-type': 'application/json' };
    if (cfg.WEBHOOK_SIGNING_SECRET) {
        const sig = createHmac('sha256', cfg.WEBHOOK_SIGNING_SECRET).update(body).digest('hex');
        headers['x-signature'] = `sha256=${sig}`;
    }
    const res = await fetch(cfg.WEBHOOK_URL, { method: 'POST', headers, body });
    if (!res.ok) {
        const t = await res.text().catch(() => '');
        console.warn('Webhook failed', res.status, t);
    }
}
// Для обратной совместимости
export async function sendWebhook(payload) {
    return sendWebhookSync(payload);
}
