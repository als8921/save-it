create policy "Users can update own subscriptions" on push_subscriptions
  for update using (auth.uid() = user_id);
