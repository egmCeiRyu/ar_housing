import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: object, status = 200) {
    return new Response(JSON.stringify(body), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

function generateTemporaryPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$";
    let password = "";
    for (const byte of crypto.getRandomValues(new Uint8Array(12))) {
        password += chars[byte % chars.length];
    }
    return password;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }
    try {
        const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
        if (!token) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
        const { data: caller, error: callerError } = await authClient.auth.getUser(token);
        if (callerError || !caller.user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        if (caller.user.app_metadata?.role !== "admin") return new Response("Forbidden", { status: 403, headers: corsHeaders });

        const body = await req.json();
        const clientId = body?.clientId;
        const email = typeof body?.email === "string" ? body.email.trim() : "";
        const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : "";
        const contactName = typeof body?.contactName === "string" ? body.contactName.trim() : "";
        if (!email || (!clientId && !companyName)) {
            return jsonResponse({ error: "Email and company name are required for registration" }, 400);
        }
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) {
            return jsonResponse({ error: "Missing Supabase env variables" }, 500);
        }
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const temporaryPassword = generateTemporaryPassword();
        if (!clientId) {
            const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
                email, password: temporaryPassword, email_confirm: true,
                user_metadata: { role: "client", company_name: companyName }
            });
            if (userError || !userData.user) {
                return jsonResponse({ error: userError?.message || "Create user failed" }, 400);
            }

            const userId = userData.user.id;
            const { error: insertError } = await adminClient.from("clients").insert({
                company_name: companyName,
                contact_name: contactName,
                email,
                client_folder: "client_" + userId,
                auth_user_id: userId,
                client_password: temporaryPassword
            });
            if (insertError) {
                // A transport error can hide a successful insert. Confirm before undoing Auth.
                const { data: saved, error: checkError } = await adminClient
                    .from("clients").select("id").eq("auth_user_id", userId).maybeSingle();
                if (!saved) {
                    if (checkError) {
                        console.error("CLIENT INSERT STATUS UNKNOWN:", checkError);
                        return jsonResponse({ error: "Registration status could not be verified. Refresh the client list before retrying." }, 503);
                    }
                    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(userId);
                    if (rollbackError) console.error("CREATE CLIENT ROLLBACK ERROR:", rollbackError);
                    return jsonResponse({
                        error: rollbackError ? "Client was not saved. Contact support before retrying." : insertError.message
                    }, 500);
                }
            }

            return jsonResponse({ success: true, auth_user_id: userId, temporary_password: temporaryPassword });
        }

        const { data: client, error: clientError } = await adminClient
            .from("clients").select("id, auth_user_id").eq("id", clientId).single();
        if (clientError || !client) {
            console.error("CLIENT ERROR:", clientError);
            return jsonResponse({ error: "Client not found" }, 404);
        }
        if (client.auth_user_id) {
            return jsonResponse({ success: true, message: "Client already has login", auth_user_id: client.auth_user_id });
        }
        const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
            email: email, password: temporaryPassword, email_confirm: true,
            user_metadata: { role: "client", client_id: clientId, company_name: companyName || "" }
        });
        if (userError || !userData.user) {
            console.error("CREATE USER ERROR:", userError);
            return jsonResponse({ error: userError?.message || "Create user failed" }, 400);
        }
        const { error: updateError } = await adminClient.from("clients")
            .update({ auth_user_id: userData.user.id, client_password: temporaryPassword }).eq("id", clientId);
        if (updateError) {
            console.error("UPDATE CLIENT ERROR:", updateError);
            return jsonResponse({ error: updateError.message }, 400);
        }
        return jsonResponse({ success: true, auth_user_id: userData.user.id, temporary_password: temporaryPassword });
    } catch (error) {
        console.error("UNEXPECTED ERROR:", error);
        return jsonResponse({ error: String(error) }, 500);
    }
});
