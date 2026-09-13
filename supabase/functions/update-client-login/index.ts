import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    try {
        const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
        if (!token) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
        const { data: caller, error: callerError } = await authClient.auth.getUser(token);
        if (callerError || !caller.user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        if (caller.user.app_metadata?.role !== "admin") return new Response("Forbidden", { status: 403, headers: corsHeaders });

        const { clientId, authUserId, email, password } = await req.json();
        if (!clientId || !authUserId || !email) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
        }
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const authUpdate: { email: string; password?: string } = { email };
        if (password && password.trim() !== "") authUpdate.password = password;
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, authUpdate);
        if (authError) {
            return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers: corsHeaders });
        }
        const clientUpdate: { email: string; client_password?: string } = { email };
        if (password && password.trim() !== "") clientUpdate.client_password = password;
        const { error: clientError } = await supabaseAdmin.from("clients").update(clientUpdate).eq("id", clientId);
        if (clientError) {
            return new Response(JSON.stringify({ error: clientError.message }), { status: 400, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});
