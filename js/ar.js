const params = new URLSearchParams(window.location.search);

const slug = params.get("slug");
const selectedColor = params.get("color");

const viewer = document.getElementById("viewer");
const loading = document.getElementById("loading");
const arScale = document.getElementById("arScale");
const openAR = document.getElementById("openAR");
let arMode = "scene-viewer";

let currentProject = null;
let currentSessionId = null;
let sessionStartedAt = null;
let sessionEnded = false;

const requiredMaterials = [
    "wallpaint",
    "wood",
    "metal",
    "glass",
    "roof",
    "window",
    "door"
];

if (params.has("arUnavailable")) {
    alert("この端末ではARを起動できませんでした。");
    params.delete("arUnavailable");
    history.replaceState(null, "", location.pathname + (params.size ? "?" + params : "") + location.hash);
}

loadAR();

async function loadAR() {

    if (!slug) {
        loading.innerText = "URLにプロジェクトIDがありません";
        return;
    }

    const { data: project, error } = await supabaseClient
        .from("properties")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .single();

    if (error) {
        console.error(error);
        loading.innerText = "プロジェクトが見つかりません";
        return;
    }

    currentProject = project;

    void loadClientEmail(project);

    await loadColorButtons(project.id);
    await savePageView(project.id);
    await startARSession(project.id);

    viewer.src = project.glb_url;

    viewer.addEventListener("load", () => {

        loading.style.display = "none";

        validateMaterials();
        void configureAR();

        if (selectedColor && project.editable_material) {
            applyMaterialColor(
                project.editable_material,
                selectedColor
            );
        }
    });
}

async function loadClientEmail(project) {
    try {
        const { data, error } = await supabaseClient.rpc("get_ar_contact_email", {
            project_slug: project.slug
        });
        if (error) throw error;
        configureEmailButton(project, data);
    } catch (error) {
        console.error("Contact email unavailable:", error);
        configureEmailButton(project, null);
    }
}

function configureEmailButton(project, clientEmail) {
    const button = document.getElementById("emailClientButton");
    const email = typeof clientEmail === "string" ? clientEmail.trim() : "";
    button.hidden = true;
    button.removeAttribute("href");
    if (!/^[^\s@<>?,;:]+@[^\s@<>?,;:]+\.[^\s@<>?,;:]+$/.test(email)) return;

    const projectUrl = new URL("ar.html", window.location.href);
    projectUrl.searchParams.set("slug", project.slug);
    const subject = `お問い合わせ：${project.name || "物件"}`;
    const body = `こちらの物件について詳しく知りたいです。\r\n\r\n${project.name || ""}\r\n${projectUrl.href}\r\n\r\nお名前：\r\nお問い合わせ内容：\r\n`;
    button.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    button.hidden = false;
}

async function savePageView(propertyId) {

    const info = getDeviceInfo();

    const { error } = await supabaseClient
        .from("page_views")
        .insert({
            property_id: propertyId,
            device: info.device,
            browser: info.browser,
            os: info.os
        });

    if (error) {
        console.error("Page view error:", error);
    }
}

async function startARSession(propertyId) {

    const info = getDeviceInfo();

    sessionStartedAt = new Date();

    const { data, error } = await supabaseClient
        .from("ar_sessions")
        .insert({
            property_id: propertyId,
            device: info.device,
            browser: info.browser,
            os: info.os,
            started_at: sessionStartedAt.toISOString()
        })
        .select("id")
        .single();

    if (error) {
        console.error("AR session start error:", error);
        return;
    }

    currentSessionId = data.id;
}

async function endARSession() {

    if (sessionEnded) return;
    if (!currentSessionId) return;
    if (!sessionStartedAt) return;

    sessionEnded = true;

    const endedAt = new Date();

    const duration =
        Math.round(
            (endedAt.getTime() - sessionStartedAt.getTime()) / 1000
        );

    const { error } = await supabaseClient
        .from("ar_sessions")
        .update({
            ended_at: endedAt.toISOString(),
            duration_seconds: duration
        })
        .eq("id", currentSessionId);

    if (error) {
        console.error("AR session end error:", error);
    }
}

function getDeviceInfo() {

    const ua = navigator.userAgent;

    let os = "Unknown";
    let device = ua;
    let browser = "Other";

    if (/iPhone/i.test(ua) || /iPad/i.test(ua)) {
        os = "iOS";
    } else if (/Android/i.test(ua)) {
        os = "Android";
    } else if (/Windows/i.test(ua)) {
        os = "Windows";
    } else if (/Mac/i.test(ua)) {
        os = "Mac";
    }

    if (/Edg/i.test(ua)) {
        browser = "Edge";
    } else if (/CriOS/i.test(ua)) {
        browser = "Chrome iOS";
    } else if (/Chrome/i.test(ua)) {
        browser = "Chrome";
    } else if (/Safari/i.test(ua)) {
        browser = "Safari";
    } else if (/Firefox/i.test(ua)) {
        browser = "Firefox";
    }

    return {
        device,
        browser,
        os
    };
}

function validateMaterials() {

    const model = viewer.model;

    if (!model) {
        console.warn("Model not loaded yet");
        return;
    }

    const foundMaterials =
        model.materials.map(material => material.name);

    const missingMaterials =
        requiredMaterials.filter(materialName =>
            !foundMaterials.includes(materialName)
        );

    console.log("Found materials:", foundMaterials);

    if (missingMaterials.length > 0) {
        console.warn("Materiais faltando:", missingMaterials);
    } else {
        console.log("Todos os materiais encontrados.");
    }
}

function applyMaterialColor(materialName, colorCode) {

    const model = viewer.model;

    if (!model) {
        return;
    }

    const material =
        model.getMaterialByName(materialName);

    if (!material) {
        console.warn("Material not found:", materialName);
        return;
    }

    const rgb = hexToRgb(colorCode);

    material.pbrMetallicRoughness.setBaseColorFactor([
        rgb.r / 255,
        rgb.g / 255,
        rgb.b / 255,
        1
    ]);
}

function hexToRgb(hex) {

    const clean =
        hex.replace("#", "");

    return {
        r: parseInt(clean.substring(0, 2), 16),
        g: parseInt(clean.substring(2, 4), 16),
        b: parseInt(clean.substring(4, 6), 16)
    };
}

async function loadColorButtons(projectId) {

    const { data, error } =
        await supabaseClient
            .from("project_colors")
            .select("*")
            .eq("property_id", projectId)
            .order("created_at");

    if (error) {
        console.error(error);
        return;
    }

    renderColorButtons(data || []);
}

function renderColorButtons(colors) {

    const bar =
        document.getElementById("colorBar");

    bar.innerHTML = "";

    colors.forEach(color => {
        bar.innerHTML += `
            <button
                class="color-dot"
                style="background:${color.color_code}"
                title="${color.color_name}"
                onclick="selectViewerColor('${color.color_code}', this)">
            </button>
        `;
    });
}

function selectViewerColor(colorCode, button) {

    if (!currentProject) {
        return;
    }

    if (!currentProject.editable_material) {
        return;
    }

    applyMaterialColor(
        currentProject.editable_material,
        colorCode
    );

    document
        .querySelectorAll(".color-dot")
        .forEach(btn =>
            btn.classList.remove("active")
        );

    button.classList.add("active");
}

async function configureAR() {
    if (document.createElement("a").relList.supports("ar")) {
        arMode = "quick-look";
    } else if (await navigator.xr?.isSessionSupported("immersive-ar").catch(() => false)) {
        arMode = "webxr";
    }

    viewer.setAttribute("ar-modes", arMode);
    arScale.disabled = false;
    openAR.disabled = false;
}

openAR.addEventListener("click", async () => {
    const scale = arScale.value;
    if (arMode === "scene-viewer" && scale !== "1" && /Android/i.test(navigator.userAgent)) {
        const modelUrl = new URL("/ar-model.glb", location.origin);
        modelUrl.searchParams.set("slug", slug);
        modelUrl.searchParams.set("percent", String(Math.round(Number(scale) * 100)));

        const parameters = new URLSearchParams({
            file: modelUrl.href,
            mode: "ar_preferred",
            resizable: "false"
        });
        const fallback = new URL(location.href);
        fallback.searchParams.set("arUnavailable", "1");
        location.href = "intent://arvr.google.com/scene-viewer/1.2?" + parameters +
            "#Intent;scheme=https;package=com.google.android.googlequicksearchbox;" +
            "action=android.intent.action.VIEW;S.browser_fallback_url=" +
            encodeURIComponent(fallback.href) + ";end;";
        return;
    }
    viewer.scale = [scale, scale, scale].join(" ");
    try {
        await viewer.activateAR();
    } catch (error) {
        viewer.scale = "1 1 1";
        console.error("AR activation failed:", error);
        alert("ARを起動できませんでした。");
    }
});
viewer.addEventListener("ar-status", ({ detail: { status } }) => {
    const active = status === "session-started" || status === "object-placed";
    document.body.classList.toggle("webxr-active", active);
    if (status === "not-presenting" || status === "failed") {
        viewer.scale = "1 1 1";
    }
});

window.addEventListener("pagehide", endARSession);

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        endARSession();
    }
});
