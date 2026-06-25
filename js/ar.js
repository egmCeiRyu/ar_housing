const params = new URLSearchParams(window.location.search);

const slug = params.get("slug");
const selectedColor = params.get("color");

const viewer = document.getElementById("viewer");
const loading = document.getElementById("loading");

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

    await loadColorButtons(project.id);

    await savePageView(project.id);
    await startARSession(project.id);

    viewer.src = project.glb_url;

    viewer.addEventListener("load", () => {

        loading.style.display = "none";

        validateMaterials();

        if (selectedColor && project.editable_material) {
            applyMaterialColor(
                project.editable_material,
                selectedColor
            );
        }

    });
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

    const { error } = await supabaseClient
        .from("ar_sessions")
        .insert({
            property_id: propertyId,
            device: info.device,
            browser: info.browser,
            os: info.os,
            started_at: sessionStartedAt.toISOString()
        });

    if (error) {
        console.error("AR session start error:", error);
    }
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
            duration: duration
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
    }
    else if (/CriOS/i.test(ua)) {
        browser = "Chrome iOS";
    }
    else if (/Chrome/i.test(ua)) {
        browser = "Chrome";
    }
    else if (/Safari/i.test(ua)) {
        browser = "Safari";
    }
    else if (/Firefox/i.test(ua)) {
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
        console.warn(
            "Materiais faltando:",
            missingMaterials
        );
    } else {
        console.log(
            "Todos os materiais encontrados."
        );
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
        console.warn(
            "Material not found:",
            materialName
        );
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

window.addEventListener("pagehide", endARSession);

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        endARSession();
    }
});

document.getElementById("customArButton").addEventListener("click", () => {
    viewer.activateAR();
});


async function loadColorButtons(projectId){

    const { data, error } =
    await supabaseClient
        .from("project_colors")
        .select("*")
        .eq("property_id", projectId)
        .order("created_at");

    if(error){
        console.error(error);
        return;
    }

    renderColorButtons(data || []);
}

function renderColorButtons(colors){

    const bar =
        document.getElementById("colorBar");

    bar.innerHTML = "";

    colors.forEach(color => {
        bar.innerHTML += `
            <button
                class="color-dot"
                style="background:${color.color_code}"
                title="${color.color_name}"
                onclick="selectViewerColor('${color.color_code}', this)"
            </button>
        `;
    });
}

function selectViewerColor(colorCode, button){

    if(!currentProject){
        return;
    }

    if(!currentProject.editable_material){
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

