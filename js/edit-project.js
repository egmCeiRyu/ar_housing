let currentProject = null;
let currentClient = null;


setupDropZone("glbDropZone", "glbFileInput", "glb");
setupDropZone("thumbDropZone", "thumbFileInput", "thumbnail");

function setupDropZone(zoneId, inputId, type) {

    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);

    zone.addEventListener("click", () => {
        input.click();
    });

    zone.addEventListener("dragover", (event) => {
        event.preventDefault();
        zone.classList.add("drag-over");
    });

    zone.addEventListener("dragleave", () => {
        zone.classList.remove("drag-over");
    });

    zone.addEventListener("drop", async (event) => {
        event.preventDefault();
        zone.classList.remove("drag-over");

        const file = event.dataTransfer.files[0];

        if (!file) return;

        await handleProjectFile(file, type);
    });

    input.addEventListener("change", async () => {
        const file = input.files[0];

        if (!file) return;

        await handleProjectFile(file, type);
    });
}

window.addEventListener("dragover", (event) => {
    event.preventDefault();
});

window.addEventListener("drop", (event) => {
    event.preventDefault();
});

initializePage();

async function initializePage() {

    const ok = await requireAdmin();

    if (!ok) return;

    initializeProject();
}

function initializeProject() {

    if (!isNewProject) {
        loadProject();
        loadColors();
    }
}

const params = new URLSearchParams(window.location.search);

const projectId = params.get("id");
const clientId = params.get("client");

const isNewProject = !projectId;

if (!projectId && !clientId) {
    alert("Project ID or Client ID not found");
    throw new Error("Project ID or Client ID not found");
}

const saveBtn =
document.getElementById("saveBtn");

const openViewerBtn =
document.getElementById("openViewerBtn");

const openQrBtn =
document.getElementById("openQrBtn");

const addColorBtn =
document.getElementById("addColorBtn");

const picker =
document.getElementById("colorPicker");

const colorHex =
document.getElementById("colorHex");

saveBtn.addEventListener(
    "click",
    saveProject
);

addColorBtn.addEventListener(
    "click",
    addColor
);

picker.addEventListener(
    "input",
    updateSelectedColor
);

colorHex.addEventListener(
    "input",
    () => {

        let value =
        colorHex.value.trim();

        if (!value.startsWith("#")) {
            value = "#" + value;
        }

        if (
            /^#[0-9A-Fa-f]{6}$/
            .test(value)
        ) {
            picker.value = value;
            colorHex.value =
            value.toUpperCase();
        }
    }
);

// openViewerBtn?.addEventListener(
//     "click",
//     openViewer
// );

// openQrBtn?.addEventListener(
//     "click",
//     openQrPage
// );

if (!isNewProject) {
    loadProject();
    loadColors();
}


function updateSelectedColor() {
    colorHex.value =
    picker.value.toUpperCase();
}

async function loadProject() {
    const { data, error } = await supabaseClient
        .from("properties")
        .select(`
            *,
            clients (
                client_folder
            )
        `)
        .eq("id", projectId)
        .single();

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    currentProject = data;
    currentClient = data.clients;

    document.getElementById("name").value = data.name || "";
    document.getElementById("glbUrl").value = data.glb_url || "";
    document.getElementById("thumbnailUrl").value = data.thumbnail_url || "";
    document.getElementById("editableMaterial").value = data.editable_material || "";
    document.getElementById("status").value = data.status || "active";
}

function createSlug(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

async function saveProject() {
    const name = document.getElementById("name").value.trim();

    if (!name) {
        alert("Please enter project name");
        return;
    }

    const projectData = {
        name: name,
        slug: createSlug(name),
        glb_url: document.getElementById("glbUrl").value.trim(),
        thumbnail_url: document.getElementById("thumbnailUrl").value.trim(),
        editable_material: "wallpaint",
        status: document.getElementById("status").value
    };

    let result;

    if (isNewProject) {

    const { data: existingProjects, error: countError } =
        await supabaseClient
            .from("properties")
            .select("project_folder")
            .eq("client_id", clientId);

    if (countError) {
        console.error(countError);
        alert(countError.message);
        return;
    }

    const nextNumber =
        (existingProjects || []).length + 1;

    const projectFolder =
        `project_${String(nextNumber).padStart(3, "0")}`;

    result = await supabaseClient
        .from("properties")
        .insert({
            ...projectData,
            client_id: clientId,
            project_folder: projectFolder
        })
        .select()
        .single();

    } else {
        
    result = await supabaseClient
        .from("properties")
        .update(projectData)
        .eq("id", projectId);
    }

    if (result.error) {
        console.error(result.error);
        alert(result.error.message);
        return;
    }

    alert(
        isNewProject
            ? "Project Created"
            : "Project Updated"
    );

    if (isNewProject) {
        location.href =
            `edit-project.html?id=${result.data.id}`;
    }
}
function updateSelectedColor() {
    colorHex.value = picker.value.toUpperCase();
}

async function loadColors() {
    const { data, error } = await supabaseClient
        .from("project_colors")
        .select("*")
        .eq("property_id", projectId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    renderColors(data || []);
}

function renderColors(colors) {
    const container = document.getElementById("colorList");
    container.innerHTML = "";

    if (colors.length === 0) {
        container.innerHTML = `
            <p style="margin-top:16px;color:#666;">
                No colors registered yet.
            </p>
        `;
        return;
    }

    colors.forEach(color => {
        container.innerHTML += `
            <div class="color-item">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div
                        class="color-preview"
                        style="background:${color.color_code}">
                    </div>

                    <div>
                        <strong>${color.color_name}</strong><br>
                        ${color.color_code}
                    </div>
                </div>

                <button onclick="deleteColor('${color.id}')">
                    Delete
                </button>
            </div>
        `;
    });
}

async function addColor() {
    const colorName = document
        .getElementById("colorName")
        .value
        .trim();

    const colorCode = picker.value.toUpperCase();

    if (!colorName) {
        alert("色名を入力してください");
        return;
    }

    const { data, error } = await supabaseClient
        .from("project_colors")
        .insert({
            property_id: projectId,
            color_name: colorName,
            color_code: colorCode
        })
        .select();

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    console.log("Saved color:", data);

    document.getElementById("colorName").value = "";
    picker.value = "#ffffff";

    updateSelectedColor();
    await loadColors();

    alert("Color saved");
}

async function deleteColor(id) {
    const ok = confirm("Delete this color?");

    if (!ok) return;

    const { error } = await supabaseClient
        .from("project_colors")
        .delete()
        .eq("id", id);

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    await loadColors();
}

function openViewer() {

    const name =
        document
        .getElementById("name")
        .value
        .trim();

    if (!name) {
        alert("Save project first");
        return;
    }

    const slug =
        createSlug(name);

    window.open(
        `ar.html?slug=${slug}`,
        "_blank"
    );
}

function openQrPage() {

    window.open(
        `qr.html?id=${projectId}`,
        "_blank"
    );
}



async function handleProjectFile(file, type) {

    if (!currentProject || !currentClient) {
    alert("プロジェクト情報を読み込み中です。");
    return;
    }

    if (!currentClient.client_folder) {
        alert("クライアントフォルダが設定されていません。");
        return;
    }

    if (!currentProject.project_folder) {
        alert("プロジェクトフォルダが設定されていません。");
        return;
    }

    const clientFolder = currentClient.client_folder;
    const projectFolder = currentProject.project_folder;

    let fileType = "";
    let inputId = "";

    if (type === "glb") {
        fileType = "glb";
        inputId = "glbUrl";
    }

    if (type === "thumbnail") {
        fileType = "thumbnail";
        inputId = "thumbnailUrl";
    }

    console.log("UPLOAD START:", {
        fileName: file.name,
        fileType,
        clientFolder,
        projectFolder
    });

    const { data, error } =
        await supabaseClient.functions.invoke(
            "create-s3-upload-url",
            {
                body: {
                    clientFolder,
                    projectFolder,
                    fileType
                }
            }
        );

    console.log("FUNCTION DATA:", data);
    console.log("FUNCTION ERROR:", error);

    if (error || !data?.uploadUrl) {
        alert("Presigned URL error");
        return;
    }

    const uploadResponse = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": data.contentType
        },
        body: file
    });

    console.log("S3 STATUS:", uploadResponse.status);
    console.log("S3 OK:", uploadResponse.ok);

    if (!uploadResponse.ok) {
        const text = await uploadResponse.text();
        console.error("S3 ERROR TEXT:", text);
        alert("S3 upload failed: " + uploadResponse.status);
        return;
    }

    document.getElementById(inputId).value = data.publicUrl;

    alert("アップロードが完了しました。");
}

