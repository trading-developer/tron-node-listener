# TRON USDT Listener

Сервис, который:
- Сканирует TRON-блоки через RPC
- Фильтрует только транзакции USDT (TRC-20)
- Отправляет вебхук при IN/OUT движениях по вашим кошелькам.
- Пишет события в MySQL и хранит watch-лист
- Держит scanner_state для продолжения с последнего блока.

## Требования

- Node.js 20+
- MySQL 8+
- TRON-нода с RPC: FullNode (8090), желательно SolidityNode (8091)

## Установка

```bash
npm i
```
## Запуск

```bash
npm run dev
```
