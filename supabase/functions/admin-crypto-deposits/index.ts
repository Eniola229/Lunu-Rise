import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Create user client for authentication
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('phone, country')
      .eq('user_id', user.id)
      .single();

    const isAdmin = profile?.phone === 'admin@example.com' || profile?.country === 'ADMIN';
    if (!isAdmin) {
      throw new Error("Admin access required");
    }

    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // GET /admin-crypto-deposits - list all pending deposits
    if (req.method === "GET" && pathSegments.length === 1) {
      const status = url.searchParams.get('status') || 'pending';
      
      const { data: deposits, error } = await supabaseAdmin
        .from('crypto_deposits')
        .select(`
          *,
          profiles:user_id (full_name, phone, country),
          plans:plan_id (name, deposit_usd)
        `)
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error('Failed to fetch crypto deposits');
      }

      return new Response(
        JSON.stringify({ deposits }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // GET /admin-crypto-deposits/{id} - get single deposit with signed URL for image
    if (req.method === "GET" && pathSegments.length === 2) {
      const depositId = pathSegments[1];
      
      const { data: deposit, error } = await supabaseAdmin
        .from('crypto_deposits')
        .select(`
          *,
          profiles:user_id (full_name, phone, country),
          plans:plan_id (name, deposit_usd)
        `)
        .eq('id', depositId)
        .single();

      if (error) {
        throw new Error('Deposit not found');
      }

      // Generate signed URL for proof image
      let proofImageUrl = null;
      if (deposit.proof_path) {
        const { data: signedUrlData } = await supabaseAdmin.storage
          .from('crypto-proofs')
          .createSignedUrl(deposit.proof_path, 300); // 5 minutes expiry
        
        proofImageUrl = signedUrlData?.signedUrl;
      }

      return new Response(
        JSON.stringify({ 
          deposit: {
            ...deposit,
            proof_image_url: proofImageUrl
          }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // POST /admin-crypto-deposits/{id}/approve - approve deposit
    if (req.method === "POST" && pathSegments.length === 3 && pathSegments[2] === "approve") {
      const depositId = pathSegments[1];
      const { amountUsdCents, adminNote } = await req.json();

      if (!amountUsdCents || amountUsdCents <= 0) {
        throw new Error("Valid USD amount is required");
      }

      // Get deposit details
      const { data: deposit, error: depositError } = await supabaseAdmin
        .from('crypto_deposits')
        .select('*, plans:plan_id (deposit_usd)')
        .eq('id', depositId)
        .single();

      if (depositError || !deposit) {
        throw new Error('Deposit not found');
      }

      if (deposit.status !== 'pending') {
        throw new Error('Deposit has already been processed');
      }

      // Begin transaction-like operations
      try {
        // Update crypto deposit status
        const { error: updateError } = await supabaseAdmin
          .from('crypto_deposits')
          .update({
            status: 'approved',
            amount_usd_cents: amountUsdCents,
            admin_id: user.id,
            admin_note: adminNote,
            updated_at: new Date().toISOString()
          })
          .eq('id', depositId);

        if (updateError) throw updateError;

        // Create corresponding deposit record
        const { data: newDeposit, error: newDepositError } = await supabaseAdmin
          .from('deposits')
          .insert({
            user_id: deposit.user_id,
            plan_id: deposit.plan_id,
            amount_usd_cents: amountUsdCents,
            method: 'crypto_manual',
            status: 'confirmed',
            gateway_ref: deposit.tx_hash,
            confirmed_at: new Date().toISOString()
          })
          .select()
          .single();

        if (newDepositError) throw newDepositError;

        // Update user wallet
        const { data: wallet, error: walletFetchError } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('user_id', deposit.user_id)
          .single();

        if (walletFetchError) throw walletFetchError;

        const newAvailable = wallet.available_cents + amountUsdCents;
        const newTotalEarned = wallet.total_earned_cents + amountUsdCents;

        const { error: walletUpdateError } = await supabaseAdmin
          .from('wallets')
          .update({
            available_cents: newAvailable,
            total_earned_cents: newTotalEarned
          })
          .eq('user_id', deposit.user_id);

        if (walletUpdateError) throw walletUpdateError;

        // Create wallet transaction
        const { error: transactionError } = await supabaseAdmin
          .from('wallet_transactions')
          .insert({
            user_id: deposit.user_id,
            type: 'deposit',
            amount_cents: amountUsdCents,
            balance_after_cents: newAvailable,
            reference_id: newDeposit.id,
            meta: {
              description: 'Crypto deposit approved',
              crypto_deposit_id: depositId,
              tx_hash: deposit.tx_hash,
              currency: deposit.currency,
              admin_approved: true
            }
          });

        if (transactionError) throw transactionError;

        // Log admin action
        await supabaseAdmin
          .from('audit_logs')
          .insert({
            admin_id: user.id,
            action: 'approve_crypto_deposit',
            target_table: 'crypto_deposits',
            target_id: depositId,
            details: {
              amount_usd_cents: amountUsdCents,
              admin_note: adminNote,
              user_id: deposit.user_id
            }
          });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Crypto deposit approved and wallet credited',
            depositId: newDeposit.id
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );

      } catch (error) {
        console.error('Approval transaction failed:', error);
        throw new Error('Failed to approve deposit: ' + error.message);
      }
    }

    // POST /admin-crypto-deposits/{id}/reject - reject deposit
    if (req.method === "POST" && pathSegments.length === 3 && pathSegments[2] === "reject") {
      const depositId = pathSegments[1];
      const { adminNote } = await req.json();

      const { error: updateError } = await supabaseAdmin
        .from('crypto_deposits')
        .update({
          status: 'rejected',
          admin_id: user.id,
          admin_note: adminNote,
          updated_at: new Date().toISOString()
        })
        .eq('id', depositId)
        .eq('status', 'pending'); // Only reject pending deposits

      if (updateError) {
        throw new Error('Failed to reject deposit');
      }

      // Log admin action
      await supabaseAdmin
        .from('audit_logs')
        .insert({
          admin_id: user.id,
          action: 'reject_crypto_deposit',
          target_table: 'crypto_deposits',
          target_id: depositId,
          details: {
            admin_note: adminNote
          }
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Crypto deposit rejected'
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    throw new Error("Invalid endpoint");

  } catch (error) {
    console.error("Admin crypto deposits error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});