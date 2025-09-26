import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const startTime = Date.now();
    console.log('Processing income events...');

    // Get due income events that haven't been processed
    const { data: dueEvents, error: eventsError } = await supabaseAdmin
      .from('income_events')
      .select(`
        *,
        deposits!inner(*, plans!inner(*))
      `)
      .eq('status', 'pending')
      .lte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(100);

    if (eventsError) {
      throw new Error(`Failed to fetch income events: ${eventsError.message}`);
    }

    console.log(`Found ${dueEvents?.length || 0} due income events`);

    let processedCount = 0;
    let errorCount = 0;

    for (const event of dueEvents || []) {
      try {
        // Use the atomic function to process each income event
        const { data: result, error: processError } = await supabaseAdmin
          .rpc('process_income_event_atomic', {
            event_id: event.id,
            user_id: event.user_id,
            amount_cents: event.amount_cents,
            deposit_id: event.deposit_id,
            drop_number: event.drop_number
          });

        if (processError) {
          console.error(`Failed to process income event ${event.id}:`, processError);
          errorCount++;
          continue;
        }

        const processResult = result as any;
        if (!processResult?.success) {
          console.error(`Income event processing failed for ${event.id}:`, processResult?.error);
          errorCount++;
          continue;
        }

        console.log(`Processed income event ${event.id} for user ${event.user_id}: ${event.amount_cents} cents`);
        processedCount++;

        // Schedule next income event if there are more drops
        const deposit = event.deposits;
        const plan = deposit.plans;
        
        if (event.drop_number < plan.drops_count) {
          const nextDueDate = new Date();
          nextDueDate.setHours(nextDueDate.getHours() + 22); // 22 hours from now

          const { error: nextEventError } = await supabaseAdmin
            .from('income_events')
            .insert({
              deposit_id: event.deposit_id,
              user_id: event.user_id,
              amount_cents: plan.payout_per_drop_usd,
              drop_number: event.drop_number + 1,
              due_at: nextDueDate.toISOString(),
              status: 'pending'
            });

          if (nextEventError) {
            console.error(`Failed to schedule next income event:`, nextEventError);
          } else {
            console.log(`Scheduled next income event (drop ${event.drop_number + 1}) for user ${event.user_id}`);
          }
        } else {
          console.log(`All drops completed for deposit ${event.deposit_id}`);
        }

      } catch (eventError) {
        console.error(`Error processing income event ${event.id}:`, eventError);
        errorCount++;
      }
    }

    const executionTime = Date.now() - startTime;

    // Log job completion
    await supabaseAdmin
      .from('jobs_log')
      .insert({
        job: 'process_income_events',
        status: errorCount > 0 ? 'completed_with_errors' : 'completed',
        payload: { 
          total_events: dueEvents?.length || 0,
          processed_count: processedCount,
          error_count: errorCount
        },
        execution_time_ms: executionTime,
        processed_count: processedCount,
        error_count: errorCount
      });

    console.log(`Income events processing completed: ${processedCount} processed, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: processedCount,
        error_count: errorCount,
        execution_time_ms: executionTime
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Process income events error:", error);

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
          job: 'process_income_events',
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