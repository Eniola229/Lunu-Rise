import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExchangeRate {
  base_currency: string;
  quote_currency: string;
  rate: number;
}

// Free API endpoint for currency conversion
const EXCHANGE_API_URL = "https://api.exchangerate-api.com/v4/latest/USD";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    console.log('Fetching exchange rates...');

    // Fetch exchange rates from API
    const response = await fetch(EXCHANGE_API_URL);
    if (!response.ok) {
      throw new Error(`Exchange API error: ${response.statusText}`);
    }

    const data = await response.json();
    const rates = data.rates;

    console.log('Received rates:', rates);

    // Define the currencies we support
    const supportedCurrencies = ['NGN', 'KES', 'UGX', 'ZAR', 'GHS'];
    const ratesToUpdate: ExchangeRate[] = [];

    // Prepare rates for database update
    for (const currency of supportedCurrencies) {
      if (rates[currency]) {
        ratesToUpdate.push({
          base_currency: 'USD',
          quote_currency: currency,
          rate: rates[currency]
        });
      }
    }

    console.log('Rates to update:', ratesToUpdate);

    // Update conversion_rates table
    for (const rateData of ratesToUpdate) {
      const { error } = await supabaseAdmin
        .from('conversion_rates')
        .upsert({
          base_currency: rateData.base_currency,
          quote_currency: rateData.quote_currency,
          rate: rateData.rate,
          fetched_at: new Date().toISOString()
        }, {
          onConflict: 'base_currency,quote_currency'
        });

      if (error) {
        console.error(`Failed to update ${rateData.quote_currency}:`, error);
      } else {
        console.log(`Updated ${rateData.base_currency}/${rateData.quote_currency}: ${rateData.rate}`);
      }
    }

    // Also update USDT rates (using CoinGecko free API)
    try {
      const usdtResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd');
      const usdtData = await usdtResponse.json();
      const usdtToUsd = usdtData.tether?.usd || 1.0;

      await supabaseAdmin
        .from('usdt_rates')
        .upsert({
          currency: 'USD',
          rate: usdtToUsd,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'currency'
        });

      console.log('Updated USDT/USD rate:', usdtToUsd);
    } catch (usdtError) {
      console.error('Failed to update USDT rates:', usdtError);
    }

    // Log job completion
    await supabaseAdmin
      .from('jobs_log')
      .insert({
        job: 'update_conversion_rates',
        status: 'completed',
        payload: { rates_updated: ratesToUpdate.length },
        execution_time_ms: Date.now(),
        processed_count: ratesToUpdate.length
      });

    return new Response(
      JSON.stringify({
        success: true,
        updated_rates: ratesToUpdate.length,
        rates: ratesToUpdate
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Update conversion rates error:", error);
    
    // Log failed job
    try {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      await supabaseAdmin
        .from('jobs_log')
        .insert({
          job: 'update_conversion_rates',
          status: 'failed',
          payload: { error: error.message },
          error_count: 1
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});