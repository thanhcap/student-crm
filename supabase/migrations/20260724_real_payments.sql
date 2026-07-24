-- REAL PAYMENTS — Stripe (cards) + MoMo Wallet.
-- Applied to wuralwhctnbtkirofuph on 2026-07-24 via Supabase MCP.
--
-- The core security property of this schema: subscriptions and
-- payment_transactions have a SELECT policy and NOTHING ELSE. There is
-- deliberately no client INSERT/UPDATE/DELETE policy, so a user cannot grant
-- themselves a paid plan by calling supabase.from('subscriptions').insert(...).
-- Every write happens through the service-role key inside a webhook handler
-- that has already verified the payment provider's signature.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',              -- 'free' | 'pro' | 'max'
  billing_cycle text,                             -- 'monthly' | 'annual' | null (free)
  provider text,                                  -- 'stripe' | 'momo' | null
  status text NOT NULL DEFAULT 'active',          -- 'active' | 'past_due' | 'canceled' | 'expired'
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own subscriptions read" ON public.subscriptions;
CREATE POLICY "own subscriptions read" ON public.subscriptions
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS subscriptions_stripe_sub_idx
  ON public.subscriptions (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS subscriptions_momo_expiry_idx
  ON public.subscriptions (provider, status, current_period_end);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,                         -- 'stripe' | 'momo'
  provider_transaction_id text UNIQUE,
  plan text NOT NULL,
  billing_cycle text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL,                         -- 'USD' | 'VND'
  status text NOT NULL DEFAULT 'pending',         -- 'pending' | 'succeeded' | 'failed'
  raw_payload jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own payment_transactions read" ON public.payment_transactions;
CREATE POLICY "own payment_transactions read" ON public.payment_transactions
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS payment_transactions_user_idx
  ON public.payment_transactions (user_id, created_at DESC);

-- Fixed VND pricing per tier for MoMo. Deliberately NOT live-FX-converted:
-- an admin-set stable price means the amount signed into the MoMo request
-- always matches what the pricing page showed a moment earlier.
CREATE TABLE IF NOT EXISTS public.momo_pricing (
  plan text NOT NULL,
  billing_cycle text NOT NULL,
  amount_vnd bigint NOT NULL,
  PRIMARY KEY (plan, billing_cycle)
);
ALTER TABLE public.momo_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone reads momo_pricing" ON public.momo_pricing;
CREATE POLICY "anyone reads momo_pricing" ON public.momo_pricing FOR SELECT USING (true);

INSERT INTO public.momo_pricing (plan, billing_cycle, amount_vnd) VALUES
  ('pro', 'monthly', 480000), ('pro', 'annual', 4900000),
  ('max', 'monthly', 1250000), ('max', 'annual', 12750000)
ON CONFLICT (plan, billing_cycle) DO NOTHING;
