import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function createSign(params: Record<string, any>, secretKey: string): Promise<string> {
  const entries = Object.entries(params)
    .filter(([k, v]) => v !== null && v !== undefined && k !== 'sign' && k !== 'sign_type')
    .sort((a, b) => a[0].localeCompare(b[0], 'en'));
  const query = entries.map(([k, v]) => `${k}=${v}`).join('&') + `&key=${secretKey}`;
  const data = new TextEncoder().encode(query);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
}

function getSourceIp(req: Request) {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return (req as any).conn?.remoteAddr?.hostname || 'unknown';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const text = await req.text();
    const params = new URLSearchParams(text);
    const payload: Record<string, string> = {};
    params.forEach((v, k) => (payload[k] = v));

    const sourceIp = getSourceIp(req);

    // Verify signature
    const collection_key = Deno.env.get('BASEPAY_COLLECTION_KEY') ?? '';
    const expectedSign = await createSign(payload, collection_key);
    const signatureOk = (payload['sign'] || '').toLowerCase() === expectedSign.toLowerCase();

    await supabase.from('webhook_events').insert({
      event_id: payload['orderNo'] || payload['mch_order_no'] || payload['mchOrderNo'] || crypto.randomUUID(),
      payload,
      signature_ok: signatureOk,
      processed: false,
      gateway_name: 'basepay',
      source_ip: sourceIp
    });

    if (!signatureOk) {
      return new Response('invalid signature', { status: 400, headers: corsHeaders });
    }

    const tradeResult = payload['tradeResult'];
    const mchOrderNo = payload['mchOrderNo'] || payload['mch_order_no'];

    if (!mchOrderNo) {
      return new Response('missing order', { status: 400, headers: corsHeaders });
    }

    // Find deposit by mch_order_no
    const { data: deposit, error: depErr } = await supabase
      .from('deposits')
      .select('*')
      .eq('mch_order_no', mchOrderNo)
      .single();

    if (depErr || !deposit) {
      await supabase.from('gateway_logs').insert({ type: 'webhook_error', payload: { payload, error: depErr }, deposit_id: null });
      return new Response('not found', { status: 404, headers: corsHeaders });
    }

    if (deposit.status === 'confirmed') {
      return new Response('success', { status: 200, headers: corsHeaders });
    }

    if (String(tradeResult) === '1') {
      // Confirm deposit, credit wallet + 5% bonus, record transactions
      const amountCents: number = deposit.amount_usd_cents;
      const bonusCents: number = Math.round(amountCents * 0.05);

      // Update deposit status
      const { error: updErr } = await supabase
        .from('deposits')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), gateway_ref: payload['orderNo'] })
        .eq('id', deposit.id);
      if (updErr) throw updErr;

      // Load wallet
      const { data: wallet, error: wErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', deposit.user_id)
        .single();
      if (wErr) throw wErr;

      const newAvailable = Number(wallet.available_cents) + amountCents + bonusCents;
      const newTotal = Number(wallet.total_earned_cents) + amountCents + bonusCents;

      // Update wallet
      const { error: wuErr } = await supabase
        .from('wallets')
        .update({ available_cents: newAvailable, total_earned_cents: newTotal })
        .eq('user_id', deposit.user_id);
      if (wuErr) throw wuErr;

      // Idempotency: check if we already inserted deposit tx
      const { data: existingTx } = await supabase
        .from('wallet_transactions')
        .select('id')
        .eq('user_id', deposit.user_id)
        .eq('type', 'deposit')
        .eq('reference_id', deposit.id)
        .maybeSingle();

      if (!existingTx) {
        // Insert transactions: deposit and bonus
        await supabase.from('wallet_transactions').insert([
          {
            user_id: deposit.user_id,
            type: 'deposit',
            amount_cents: amountCents,
            balance_after_cents: newAvailable - bonusCents,
            reference_id: deposit.id,
            meta: { description: 'Deposit confirmed', deposit_id: deposit.id }
          },
          {
            user_id: deposit.user_id,
            type: 'income',
            amount_cents: bonusCents,
            balance_after_cents: newAvailable,
            reference_id: deposit.id,
            meta: { description: '5% deposit bonus', deposit_id: deposit.id }
          }
        ]);
      }

      // Multi-level referral bonuses (Level1:20%, Level2:3%, Level3:2%)
      const { data: profile } = await supabase
        .from('profiles')
        .select('referrer_id')
        .eq('user_id', deposit.user_id)
        .maybeSingle();

      const levels = [0.20, 0.03, 0.02];
      let currentRef = profile?.referrer_id as string | null;
      for (let i = 0; i < levels.length && currentRef; i++) {
        const pct = levels[i];
        const refBonus = Math.round(amountCents * pct);

        // Update referrer wallet
        const { data: refWallet } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', currentRef)
          .maybeSingle();

        if (refWallet) {
          const { error: rwErr } = await supabase
            .from('wallets')
            .update({
              available_cents: Number(refWallet.available_cents) + refBonus,
              total_earned_cents: Number(refWallet.total_earned_cents) + refBonus
            })
            .eq('user_id', currentRef);
          if (!rwErr) {
            await supabase.from('wallet_transactions').insert({
              user_id: currentRef,
              type: 'referral',
              amount_cents: refBonus,
              reference_id: deposit.id,
              meta: { level: i + 1, description: `Referral bonus L${i + 1}` }
            });
            await supabase.from('referrals').insert({
              referrer_id: currentRef,
              referred_id: deposit.user_id,
              level: i + 1,
              bonus_cents: refBonus,
              deposit_id: deposit.id
            });
          }
        }

        // Traverse up
        const { data: nextProfile } = await supabase
          .from('profiles')
          .select('referrer_id')
          .eq('user_id', currentRef)
          .maybeSingle();
        currentRef = nextProfile?.referrer_id || null;
      }

      await supabase.from('gateway_logs').insert({ type: 'webhook_success', payload, deposit_id: deposit.id });
      return new Response('success', { status: 200, headers: corsHeaders });
    }

    // Non-successful trade
    await supabase
      .from('deposits')
      .update({ status: 'failed' })
      .eq('id', deposit.id);

    await supabase.from('gateway_logs').insert({ type: 'webhook_failed', payload, deposit_id: deposit.id });
    return new Response('success', { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error('webhookDeposit error:', e);
    return new Response(e.message || 'error', { status: 400, headers: corsHeaders });
  }
});