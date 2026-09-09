CREATE TABLE IF NOT EXISTS stock_tokens (
  ticker             TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  contract           BYTEA NOT NULL UNIQUE,
  contract_hex       TEXT NOT NULL UNIQUE,
  decimals           INT NOT NULL DEFAULT 18,
  asset_type         TEXT NOT NULL,
  oracle_feed        TEXT,
  sectors            TEXT[] NOT NULL DEFAULT '{}',
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  registry_synced_at TIMESTAMPTZ NOT NULL,
  CHECK (asset_type IN ('equity', 'etf', 'commodity'))
);

CREATE TABLE IF NOT EXISTS tokens (
  address         TEXT PRIMARY KEY,
  symbol          TEXT,
  name            TEXT,
  decimals        INT,
  created_at      TIMESTAMPTZ,
  creator         TEXT,
  launchpad       TEXT,
  is_stock_token  BOOLEAN NOT NULL DEFAULT FALSE
);
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS total_supply_raw NUMERIC;

CREATE TABLE IF NOT EXISTS pools (
  id             BIGSERIAL PRIMARY KEY,
  address        TEXT NOT NULL UNIQUE,
  dex            TEXT NOT NULL,
  token0         TEXT NOT NULL,
  token1         TEXT NOT NULL,
  fee_bps        INT,
  created_at     TIMESTAMPTZ,
  created_block  BIGINT,
  stock_ticker   TEXT REFERENCES stock_tokens(ticker),
  meme_address   TEXT,
  pair_quality   TEXT NOT NULL
    CHECK (pair_quality IN (
      'pair_canonical',
      'pair_fake_underlying',
      'pair_spot_stock',
      'pair_stock_stock',
      'unknown'
    )),
  creator        TEXT,
  pool_id        TEXT,
  hooks          TEXT,
  tick_spacing   INT
);
CREATE INDEX IF NOT EXISTS pools_stock ON pools (stock_ticker) WHERE stock_ticker IS NOT NULL;
CREATE INDEX IF NOT EXISTS pools_created ON pools (created_at DESC);
CREATE INDEX IF NOT EXISTS pools_pool_id ON pools (pool_id) WHERE pool_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pools_canonical_meme ON pools (id)
  WHERE meme_address IS NOT NULL AND pair_quality IN ('pair_canonical', 'canonical');
CREATE INDEX IF NOT EXISTS pools_live_created ON pools (created_at DESC)
  WHERE meme_address IS NOT NULL
    AND pair_quality IN ('pair_canonical', 'canonical', 'pair_fake_underlying');

ALTER TABLE pools ADD COLUMN IF NOT EXISTS tick_spacing INT;
ALTER TABLE pools ADD COLUMN IF NOT EXISTS graduated BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS pools_graduated ON pools (graduated) WHERE graduated;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'pools'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%pair_quality%'
  LOOP
    EXECUTE format('ALTER TABLE pools DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

UPDATE pools SET pair_quality = 'pair_spot_stock'
WHERE pair_quality IN ('canonical', 'none', 'mixed')
  AND meme_address IS NULL
  AND (
    lower(token0) IN (
      '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
      '0x0bd7d308f8e1639fab988df18a8011f41eacad73',
      '0x0000000000000000000000000000000000000000',
      '0xcec185eb182c47d1ba1efc84e6959e18cd620be4'
    )
    OR lower(token1) IN (
      '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
      '0x0bd7d308f8e1639fab988df18a8011f41eacad73',
      '0x0000000000000000000000000000000000000000',
      '0xcec185eb182c47d1ba1efc84e6959e18cd620be4'
    )
  );

UPDATE pools SET pair_quality = 'pair_canonical' WHERE pair_quality = 'canonical';
UPDATE pools SET pair_quality = 'pair_fake_underlying' WHERE pair_quality = 'fake_underlying';
UPDATE pools SET pair_quality = 'unknown' WHERE pair_quality IN ('none', 'mixed');

ALTER TABLE pools ADD CONSTRAINT pools_pair_quality_check
  CHECK (pair_quality IN (
    'pair_canonical',
    'pair_fake_underlying',
    'pair_spot_stock',
    'pair_stock_stock',
    'unknown'
  ));

CREATE TABLE IF NOT EXISTS pool_snapshots (
  pool_id               BIGINT REFERENCES pools(id),
  block_number          BIGINT NOT NULL,
  taken_at              TIMESTAMPTZ NOT NULL,
  stock_bal_raw         NUMERIC NOT NULL,
  meme_bal_raw          NUMERIC,
  reserve_usd           NUMERIC,
  price_meme_in_stock   NUMERIC,
  volume_usd_1h         NUMERIC,
  volume_usd_24h        NUMERIC,
  price_meme_usdg       NUMERIC,
  PRIMARY KEY (pool_id, block_number)
);
CREATE INDEX IF NOT EXISTS pool_snapshots_block ON pool_snapshots (block_number DESC);

CREATE TABLE IF NOT EXISTS stock_snapshots (
  ticker            TEXT REFERENCES stock_tokens(ticker),
  block_number      BIGINT NOT NULL,
  taken_at          TIMESTAMPTZ NOT NULL,
  total_supply_raw  NUMERIC NOT NULL,
  dex_price_usd     NUMERIC,
  oracle_price_usd  NUMERIC,
  premium_bps       INT,
  float_locked_raw  NUMERIC NOT NULL,
  float_locked_pct  NUMERIC NOT NULL,
  meme_pair_count   INT NOT NULL,
  meme_vol_24h_usd  NUMERIC,
  spot_vol_24h_usd  NUMERIC,
  PRIMARY KEY (ticker, block_number)
);
CREATE INDEX IF NOT EXISTS stock_snapshots_taken ON stock_snapshots (ticker, taken_at DESC);

CREATE TABLE IF NOT EXISTS token_risk (
  address               TEXT PRIMARY KEY REFERENCES tokens(address),
  checked_at            TIMESTAMPTZ NOT NULL,
  owner                 TEXT,
  owner_renounced       BOOLEAN,
  can_mint              BOOLEAN,
  can_pause             BOOLEAN,
  can_blacklist         BOOLEAN,
  buy_tax_bps           INT,
  sell_tax_bps          INT,
  lp_locked             BOOLEAN,
  honeypot_signal       BOOLEAN,
  top10_pct             NUMERIC,
  creator_launch_count  INT,
  grade                 TEXT NOT NULL
    CHECK (grade IN ('clear', 'caution', 'danger')),
  reasons               JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS swaps (
  tx_hash      TEXT NOT NULL,
  log_index    INT NOT NULL,
  pool_id      BIGINT NOT NULL REFERENCES pools(id),
  block_number BIGINT NOT NULL,
  taken_at     TIMESTAMPTZ NOT NULL,
  usd_notional NUMERIC NOT NULL,
  PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS swaps_pool_time ON swaps (pool_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS swaps_taken ON swaps (taken_at DESC);

CREATE TABLE IF NOT EXISTS indexer_state (
  key           TEXT PRIMARY KEY,
  last_block    BIGINT NOT NULL,
  last_ok_at    TIMESTAMPTZ NOT NULL,
  lag_seconds   INT
);
