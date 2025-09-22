CREATE TABLE IF NOT EXISTS watched_addresses
(
    id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    address_base58   VARCHAR(48)  NOT NULL,
    address_hex40    CHAR(40)     NOT NULL,
    label            VARCHAR(255) NULL,
    active           TINYINT(1)   NOT NULL DEFAULT 1,
    expires_at       DATETIME     NULL,
    last_activity_at DATETIME     NULL,
    added_by         VARCHAR(255) NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_watch_addr (address_base58),
    KEY              idx_active_hex(active, address_hex40),
    KEY              idx_expires(active, expires_at),
    KEY              idx_last_activity(active, last_activity_at)
);

CREATE TABLE IF NOT EXISTS scanner_state
(
    id                   TINYINT UNSIGNED PRIMARY KEY,
    state_key            VARCHAR(64) NOT NULL UNIQUE,
    last_processed_block BIGINT UNSIGNED NOT NULL,
    updated_at           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO scanner_state (id, state_key, last_processed_block)
VALUES (1, 'usdt', 0);

CREATE TABLE IF NOT EXISTS usdt_events
(
    id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    txid             CHAR(64)                    NOT NULL,
    log_index        INT                         NOT NULL,
    block_num        BIGINT UNSIGNED NOT NULL,
    ts               DATETIME                    NOT NULL,
    from_addr_base58 VARCHAR(48)                 NOT NULL,
    to_addr_base58   VARCHAR(48)                 NOT NULL,
    from_hex40       CHAR(40)                    NOT NULL,
    to_hex40         CHAR(40)                    NOT NULL,
    amount_raw       DECIMAL(40, 0)              NOT NULL,
    amount           DECIMAL(30, 6)              NOT NULL,
    direction        ENUM('IN', 'OUT', 'IN/OUT') NOT NULL,
    watched_hit      ENUM('FROM', 'TO', 'BOTH')  NOT NULL,
    watched_address_id BIGINT UNSIGNED NULL,
    created_at       DATETIME                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tx_log (txid, log_index),
    KEY              idx_block(block_num),
    KEY              idx_to(to_hex40),
    KEY              idx_from(from_hex40),
    KEY              idx_watched_id(watched_address_id),
    FOREIGN KEY fk_watched_address (watched_address_id) REFERENCES watched_addresses(id) ON DELETE SET NULL
);
