import { cfg } from './config.js';
import { tickOnce } from './scanner.js';
import { startApi } from './api.js';
const api = startApi(3000);
let stopping = false;
const loop = async () => {
    if (stopping)
        return;
    try {
        await tickOnce();
    }
    catch (e) {
        console.error(e);
    }
    setTimeout(loop, cfg.TICK_MS);
};
loop();
const stop = async () => {
    if (stopping)
        return;
    stopping = true;
    api.close(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
