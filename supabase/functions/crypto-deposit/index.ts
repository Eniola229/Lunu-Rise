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

    if (req.method === "POST") {
      const { planId, currency, amountCrypto, txHash, proofFile, note } = await req.json();

      // Validate required fields
      if (!txHash || !proofFile) {
        throw new Error("Transaction hash and proof image are required");
      }

      // Upload proof image to storage
      const fileExt = proofFile.name?.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Convert base64 to file for upload
      const fileData = Uint8Array.from(atob(proofFile.data), c => c.charCodeAt(0));
      
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('crypto-proofs')
        .upload(fileName, fileData, {
          contentType: proofFile.type || 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Failed to upload proof image');
      }

      // Create crypto deposit record
      const { data: depositData, error: depositError } = await supabaseAdmin
        .from('crypto_deposits')
        .insert({
          user_id: user.id,
          plan_id: planId,
          currency: currency || 'USDT',
          amount_crypto: amountCrypto,
          tx_hash: txHash,
          proof_path: uploadData.path,
          status: 'pending',
          admin_note: note
        })
        .select()
        .single();

      if (depositError) {
        console.error('Deposit creation error:', depositError);
        throw new Error('Failed to create crypto deposit record');
      }

      return new Response(
        JSON.stringify({
          success: true,
          depositId: depositData.id,
          status: 'pending',
          message: 'Crypto deposit submitted for admin approval'
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // GET method - retrieve user's crypto deposits
    if (req.method === "GET") {
      const { data: deposits, error } = await supabaseAdmin
        .from('crypto_deposits')
        .select(`
          *,
          plans:plan_id (name, deposit_usd)
        `)
        .eq('user_id', user.id)
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

    throw new Error("Method not allowed");

  } catch (error) {
    console.error("Crypto deposit error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});