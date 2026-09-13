import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
    S3Client,
    PutObjectCommand
} from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {

    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: corsHeaders
        });
    }

    try {
        const authorization = req.headers.get("Authorization");
        const token = authorization?.match(/^Bearer (.+)$/i)?.[1];
        if (!token) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
        const { data, error } = await auth.auth.getUser(token);
        if (error || !data.user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        if (data.user.app_metadata?.role !== "admin") {
            return new Response("Forbidden", { status: 403, headers: corsHeaders });
        }

        const {
            clientFolder,
            projectFolder,
            fileType
        } = await req.json();

        let fileName = "";
        let contentType = "";

        if (fileType === "glb") {
            fileName = "house.glb";
            contentType = "model/gltf-binary";
        } else if (fileType === "thumbnail") {
            fileName = "thumbnail.jpg";
            contentType = "image/jpeg";
        } else {
            return new Response(
                JSON.stringify({
                    error: "Invalid fileType"
                }),
                {
                    status: 400,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const bucketName = Deno.env.get("AWS_BUCKET_NAME");
        const region = Deno.env.get("AWS_REGION");

        const key =
            `clients/${clientFolder}/${projectFolder}/${fileName}`;

        const s3 = new S3Client({
            region,
            credentials: {
                accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
                secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!
            }
        });

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: contentType
        });

        const uploadUrl = await getSignedUrl(
            s3,
            command,
            { expiresIn: 300 }
        );

        const publicUrl =
            `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

        return new Response(
            JSON.stringify({
                uploadUrl,
                publicUrl,
                key,
                contentType
            }),
            {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json"
                }
            }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({
                error: String(error)
            }),
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json"
                }
            }
        );
    }
});