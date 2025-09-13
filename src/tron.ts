import { TronWeb } from 'tronweb';
import { cfg } from './config.js';

export const tron = new TronWeb({
    fullHost: cfg.TRON_FULLNODE,
    fullNode: cfg.TRON_FULLNODE,
    solidityNode: cfg.TRON_SOLIDITYNODE ?? cfg.TRON_FULLNODE,
});

// keccak256("Transfer(address,address,uint256)")
export const TRANSFER_TOPIC =
    'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export const usdtHexAddr = tron.address.toHex(cfg.USDT_CONTRACT).replace(/^0x/, '').toLowerCase();

export const hex40FromBase58 = (addr: string) =>
    tron.address.toHex(addr).replace(/^0x/, '').toLowerCase().slice(-40);

export const base58FromHex40 = (hex40: string) =>
    tron.address.fromHex('0x' + (hex40.startsWith('0x') ? hex40.slice(2) : hex40));
