-- More templates → more open battles → bots play more often.
-- Was: 8 templates, only BTC/ETH/SOL/DOGE, only 15m/1h/2h durations.
-- Now: 24 templates including 5-min for fast turnover, all 10 supported
-- assets, and 15-min outperform pairs so bots with asset filters always
-- have something to bet on.

insert into public.battle_templates
  (id, name, question_template, battle_type, asset_a, asset_b, duration_minutes,
   primary_price_source, backup_price_sources, stale_threshold_seconds,
   max_deviation_bps, entry_cutoff_seconds, active)
values
  -- 5-minute Up/Down — high-frequency battles for constant action
  ('btc-updown-5m',  'BTC Up or Down 5m',  'Will BTC close higher than open in this 5-minute window?',  'updown', 'BTC', null,  5,  'coingecko_v3', '{coinbase_spot,binance_spot}', 30, 50, 15, true),
  ('eth-updown-5m',  'ETH Up or Down 5m',  'Will ETH close higher than open in this 5-minute window?',  'updown', 'ETH', null,  5,  'coingecko_v3', '{coinbase_spot,binance_spot}', 30, 50, 15, true),
  ('sol-updown-5m',  'SOL Up or Down 5m',  'Will SOL close higher than open in this 5-minute window?',  'updown', 'SOL', null,  5,  'coingecko_v3', '{coinbase_spot,binance_spot}', 30, 50, 15, true),

  -- 15-minute Up/Down for the missing assets so bots with asset filters always have a candidate
  ('eth-updown-15m', 'ETH Up or Down 15m', 'Will ETH close higher than open in this 15-minute window?', 'updown', 'ETH', null,  15, 'coingecko_v3', '{coinbase_spot,binance_spot}', 30, 50, 30, true),
  ('sol-updown-15m', 'SOL Up or Down 15m', 'Will SOL close higher than open in this 15-minute window?', 'updown', 'SOL', null,  15, 'coingecko_v3', '{coinbase_spot,binance_spot}', 30, 50, 30, true),
  ('link-updown-15m','LINK Up or Down 15m','Will LINK close higher than open in this 15-minute window?','updown', 'LINK',null,  15, 'coingecko_v3', '{coinbase_spot,binance_spot}', 30, 50, 30, true),
  ('avax-updown-15m','AVAX Up or Down 15m','Will AVAX close higher than open in this 15-minute window?','updown', 'AVAX',null,  15, 'coingecko_v3', '{coinbase_spot,binance_spot}', 30, 50, 30, true),
  ('uni-updown-15m', 'UNI Up or Down 15m', 'Will UNI close higher than open in this 15-minute window?', 'updown', 'UNI', null,  15, 'coingecko_v3', '{coinbase_spot,binance_spot}', 30, 50, 30, true),
  ('bnb-updown-15m', 'BNB Up or Down 15m', 'Will BNB close higher than open in this 15-minute window?', 'updown', 'BNB', null,  15, 'coingecko_v3', '{coinbase_spot,binance_spot}', 30, 50, 30, true),
  ('doge-updown-15m','DOGE Up or Down 15m','Will DOGE close higher than open in this 15-minute window?','updown', 'DOGE',null,  15, 'coingecko_v3', '{coinbase_spot,binance_spot}', 30, 50, 30, true),

  -- 1-hour Up/Down for the remaining assets
  ('link-updown-1h', 'LINK Up or Down 1h', 'Will LINK close higher than open this hour?',                'updown', 'LINK',null,  60, 'coingecko_v3', '{coinbase_spot,binance_spot}', 30, 50, 60, true),
  ('avax-updown-1h', 'AVAX Up or Down 1h', 'Will AVAX close higher than open this hour?',                'updown', 'AVAX',null,  60, 'coingecko_v3', '{coinbase_spot,binance_spot}', 30, 50, 60, true),
  ('uni-updown-1h',  'UNI Up or Down 1h',  'Will UNI close higher than open this hour?',                 'updown', 'UNI', null,  60, 'coingecko_v3', '{coinbase_spot,binance_spot}', 30, 50, 60, true),

  -- 15-min outperform pairs (fast, opinion-driven)
  ('btc-vs-eth-15m', 'BTC vs ETH 15m',  'Will BTC outperform ETH in the next 15 minutes?',   'outperform','BTC', 'ETH', 15, 'coingecko_v3','{coinbase_spot,binance_spot}', 30, 50, 30, true),
  ('btc-vs-sol-15m', 'BTC vs SOL 15m',  'Will BTC outperform SOL in the next 15 minutes?',   'outperform','BTC', 'SOL', 15, 'coingecko_v3','{coinbase_spot,binance_spot}', 30, 50, 30, true),
  ('eth-vs-sol-15m', 'ETH vs SOL 15m',  'Will ETH outperform SOL in the next 15 minutes?',   'outperform','ETH', 'SOL', 15, 'coingecko_v3','{coinbase_spot,binance_spot}', 30, 50, 30, true)

on conflict (id) do nothing;
