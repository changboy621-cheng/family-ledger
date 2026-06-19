insert into public.categories (name, icon, type, is_shared, sort_order)
values
  ('餐飲', '🍽️', 'expense', true, 10),
  ('交通', '🚗', 'expense', true, 20),
  ('購物', '🛒', 'expense', true, 30),
  ('居家', '🏠', 'expense', true, 40),
  ('醫療', '💊', 'expense', true, 50),
  ('娛樂', '🎬', 'expense', true, 60),
  ('教育', '📚', 'expense', true, 70),
  ('旅遊', '✈️', 'expense', true, 80),
  ('薪資', '💰', 'income', true, 90),
  ('其他收入', '💵', 'income', true, 100)
on conflict do nothing;
