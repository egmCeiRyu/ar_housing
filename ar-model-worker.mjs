import { houseModelAssets } from "./js/house-model-assets.mjs";
const JSON_CHUNK = 0x4e4f534a;
const MAX_JSON_BYTES = 8 * 1024 * 1024;

export function scaleSceneRoots(model, scale) {
    const nodes = model.nodes ??= [];
    for (const scene of model.scenes ?? []) {
        if (!scene.nodes?.length) continue;
        const root = nodes.length;
        nodes.push({ scale: [scale, scale, scale], children: scene.nodes });
        scene.nodes = [root];
    }
}

// Rewrite the JSON chunk and stream the binary chunks without buffering the model.
export async function scaleGlb(body, scale) {
    const reader = body.getReader();
    let remainder = new Uint8Array();
    async function readExactly(length) {
        const result = new Uint8Array(length);
        let offset = 0;
        while (offset < length) {
            if (!remainder.length) {
                const { value, done } = await reader.read();
                if (done) throw new Error("Truncated GLB");
                remainder = value;
            }
            const count = Math.min(length - offset, remainder.length);
            result.set(remainder.subarray(0, count), offset);
            offset += count;
            remainder = remainder.subarray(count);
        }
        return result;
    }

    try {
        const prefix = await readExactly(20);
        const header = new DataView(prefix.buffer);
        const total = header.getUint32(8, true);
        const jsonLength = header.getUint32(12, true);
        if (header.getUint32(0, true) !== 0x46546c67 ||
            header.getUint32(4, true) !== 2 ||
            header.getUint32(16, true) !== JSON_CHUNK ||
            jsonLength > MAX_JSON_BYTES || jsonLength + 20 > total) {
            throw new Error("Unsupported GLB");
        }

        const original = await readExactly(jsonLength);
        const model = JSON.parse(new TextDecoder().decode(original));
        scaleSceneRoots(model, scale);
        const json = new TextEncoder().encode(JSON.stringify(model));
        const paddedLength = Math.ceil(json.length / 4) * 4;
        const firstChunk = new Uint8Array(20 + paddedLength);
        firstChunk.set(prefix);
        firstChunk.fill(0x20, 20);
        firstChunk.set(json, 20);
        const updatedHeader = new DataView(firstChunk.buffer);
        updatedHeader.setUint32(8, total - jsonLength + paddedLength, true);
        updatedHeader.setUint32(12, paddedLength, true);

        return new ReadableStream({
            start(controller) {
                controller.enqueue(firstChunk);
                if (remainder.length) controller.enqueue(remainder);
            },
            async pull(controller) {
                const { value, done } = await reader.read();
                if (done) controller.close();
                else controller.enqueue(value);
            },
            cancel(reason) { return reader.cancel(reason); }
        });
    } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname !== "/ar-model.glb") return env.ASSETS.fetch(request);
        if (!["GET", "HEAD"].includes(request.method)) {
            return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
        }
        const slug = url.searchParams.get("slug");
        const percent = url.searchParams.get("percent");
        if (!slug || slug.length > 200 || !/^(?:5|[1-9][05]|100)$/.test(percent ?? "")) {
            return new Response("Invalid model or scale", { status: 400 });
        }

        try {
            const lookup = new URL("/rest/v1/properties", env.SUPABASE_URL);
            lookup.search = new URLSearchParams({
                select: "glb_url", slug: "eq." + slug, status: "eq.active", limit: "1"
            });
            const result = await fetch(lookup, { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY } });
            if (!result.ok) throw new Error("Model lookup failed");
            const [property] = await result.json();
            if (!property?.glb_url) return new Response("Model not found", { status: 404 });

            const source = new URL(property.glb_url);
            if (source.protocol !== "https:" || source.port || source.username || source.password ||
                !/^[a-z0-9][a-z0-9.-]*\.s3\.[a-z0-9-]+\.amazonaws\.com$/.test(source.hostname) ||
                !source.pathname.toLowerCase().endsWith(".glb")) {
                return new Response("Unsupported model source", { status: 422 });
            }

            const headers = { "Content-Type": "model/gltf-binary", "Cache-Control": "private, no-store" };
            if (request.method === "HEAD") return new Response(null, { headers });
            const optimized = houseModelAssets(slug, property.glb_url);
            const asset = optimized
                ? await env.ASSETS.fetch(new Request(new URL(optimized.native, url), { method: "GET" }))
                : await fetch(source, { redirect: "manual" });
            if (!asset.ok || !asset.body) throw new Error("Model download failed");
            return new Response(await scaleGlb(asset.body, Number(percent) / 100), { headers });
        } catch (error) {
            console.error(error.message);
            return new Response("Could not prepare AR model", { status: 502 });
        }
    }
};
