-- Seed the MVP set of crypto-arena battle templates.
-- These are the ones the BattleFactory rolls out automatically.

insert into public.battle_templates (id, name, question_template, battle_type, asset_a, asset_b, duration_minutes, entry_cutoff_seconds)
values
  ('btc-updown-15m', 'BTC Up or Down 15m', 'Will BTC close higher than its opening price in this 15-minute window?', 'updown', 'BTC', null, 15, 30),
  ('btc-updown-1h',  'BTC Up or Down Hourly', 'Will BTC close higher than its opening price this hour?',                'updown', 'BTC', null, 60, 30),
  ('eth-updown-1h',  'ETH Up or Down Hourly', 'Will ETH close higher than its opening price this hour?',                'updown', 'ETH', null, 60, 30),
  ('sol-updown-1h',  'SOL Up or Down Hourly', 'Will SOL close higher than its opening price this hour?',                'updown', 'SOL', null, 60, 30),
  ('doge-updown-1h', 'DOGE Up or Down Hourly','Will DOGE close higher than its opening price this hour?',               'updown', 'DOGE', null, 60, 30),
  ('eth-vs-sol-2h',  'ETH Coven vs SOL Sprinters', 'Will ETH outperform SOL over the next 2 hours?',                    'outperform', 'ETH', 'SOL', 120, 60),
  ('btc-vs-eth-2h',  'BTC Kings vs ETH Coven',     'Will BTC outperform ETH over the next 2 hours?',                    'outperform', 'BTC', 'ETH', 120, 60),
  ('doge-vs-sol-15m','DOGE Goblins vs SOL Sprinters','Will DOGE outperform SOL in this 15-minute window?',              'outperform', 'DOGE', 'SOL', 15, 30)
on conflict (id) do nothing;
