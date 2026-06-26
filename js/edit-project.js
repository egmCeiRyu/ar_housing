let currentProject = null;
let currentClient = null;

const params =
new URLSearchParams(window.location.search);

const projectId =
params.get("id");

const clientId =
params.get("client");

const isNewProject =
!projectId;

if (!projectId && !clientId) {
    alert("プロジェクトIDまたはクライアントIDが見つかりません。");
    throw new Error("Project ID or Client ID not found");
}

const saveBtn =
document.getElementById("saveBtn");

const addColorBtn =
document.getElementById("addColorBtn");

const picker =
document.getElementById("colorPicker");

const colorHex =
document.getElementById("colorHex");

saveBtn.addEventListener("click", saveProject);
addColorBtn.addEventListener("click", addColor);

picker.addEventListener("input", updateSelectedColor);

colorHex.addEventListener("input", () => {
    let value =
    colorHex.value.trim();

    if (!value.startsWith("#")) {
        value = "#" + value;
    }

    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        picker.value = value;
        colorHex.value = value.toUpperCase();
    }
});

setupDropZone("glbDropZone", "glbFileInput", "glb");
setupDropZone("thumbDropZone", "thumbFileInput", "thumbnail");

window.addEventListener("dragover", (event) => {
    event.preventDefault();
});

window.addEventListener("drop", (event) => {
    event.preventDefault();
});

initializePage();

async function initializePage() {

    const ok =
    await requireAdmin();

    if (!ok) return;

    updateSelectedColor();

    if (!isNewProject) {
        await loadProject();
        await loadColors();
    }
}

function setupDropZone(zoneId, inputId, type) {

    const zone =
    document.getElementById(zoneId);

    const input =
    document.getElementById(inputId);

    if (!zone || !input) return;

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

        const file =
        event.dataTransfer.files[0];

        if (!file) return;

        await handleProjectFile(file, type);
    });

    input.addEventListener("change", async () => {
        const file =
        input.files[0];

        if (!file) return;

        await handleProjectFile(file, type);
    });
}

function updateSelectedColor() {

    if (!picker || !colorHex) return;

    colorHex.value =
    picker.value.toUpperCase();
}

async function loadProject() {

    const { data, error } =
    await supabaseClient
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

    currentProject =
    data;

    currentClient =
    data.clients;

    document.getElementById("name").value =
    data.name || "";

    document.getElementById("glbUrl").value =
    data.glb_url || "";

    document.getElementById("thumbnailUrl").value =
    data.thumbnail_url || "";

    const editableMaterialInput =
    document.getElementById("editableMaterial");

    if (editableMaterialInput) {
        editableMaterialInput.value =
        data.editable_material || "wallpaint";
    }

    document.getElementById("status").value =
    data.status || "active";
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

    const name =
    document
        .getElementById("name")
        .value
        .trim();

    if (!name) {
        alert("プロジェクト名を入力してください。");
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

        result =
        await supabaseClient
            .from("properties")
            .insert({
                ...projectData,
                client_id: clientId,
                project_folder: projectFolder
            })
            .select()
            .single();

    } else {

        result =
        await supabaseClient
            .from("properties")
            .update(projectData)
            .eq("id", projectId)
            .select()
            .single();
    }

    if (result.error) {
        console.error(result.error);
        alert(result.error.message);
        return;
    }

    sessionStorage.setItem(
        "projectsNeedReload",
        "true"
    );

    alert(
        isNewProject
            ? "プロジェクトを作成しました。"
            : "プロジェクトを更新しました。"
    );

    if (isNewProject) {
        location.href =
        `edit-project.html?id=${result.data.id}`;
    } else {
        history.back();
    }
}

async function loadColors() {

    const { data, error } =
    await supabaseClient
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

    const container =
    document.getElementById("colorList");

    container.innerHTML = "";

    if (colors.length === 0) {
        container.innerHTML = `
            <p style="margin-top:16px;color:#666;">
                まだカラーが登録されていません。
            </p>
        `;
        return;
    }

    colors.forEach((color) => {
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
                    削除
                </button>
            </div>
        `;
    });
}

async function addColor() {

    if (isNewProject) {
        alert("先にプロジェクトを保存してください。");
        return;
    }

    const colorName =
    document
        .getElementById("colorName")
        .value
        .trim();

    const colorCode =
    picker.value.toUpperCase();

    if (!colorName) {
        alert("色名を入力してください。");
        return;
    }

    const { error } =
    await supabaseClient
        .from("project_colors")
        .insert({
            property_id: projectId,
            color_name: colorName,
            color_code: colorCode
        });

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    document.getElementById("colorName").value =
    "";

    picker.value =
    "#ffffff";

    updateSelectedColor();

    await loadColors();

    sessionStorage.setItem(
        "projectsNeedReload",
        "true"
    );

    alert("カラーを保存しました。");
}

async function deleteColor(id) {

    const ok =
    confirm("このカラーを削除しますか？");

    if (!ok) return;

    const { error } =
    await supabaseClient
        .from("project_colors")
        .delete()
        .eq("id", id);

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    await loadColors();

    sessionStorage.setItem(
        "projectsNeedReload",
        "true"
    );
}

function openViewer() {

    const name =
    document
        .getElementById("name")
        .value
        .trim();

    if (!name) {
        alert("先にプロジェクトを保存してください。");
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

    if (isNewProject) {
        alert("先にプロジェクトを保存してください。");
        return;
    }

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

    const clientFolder =
    currentClient.client_folder;

    const projectFolder =
    currentProject.project_folder;

    let fileType =
    "";

    let inputId =
    "";

    if (type === "glb") {
        fileType = "glb";
        inputId = "glbUrl";
    }

    if (type === "thumbnail") {
        fileType = "thumbnail";
        inputId = "thumbnailUrl";
    }

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

    if (error || !data?.uploadUrl) {
        console.error(error);
        alert("アップロードURLの作成に失敗しました。");
        return;
    }

    const uploadResponse =
    await fetch(data.uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": data.contentType
        },
        body: file
    });

    if (!uploadResponse.ok) {
        const text =
        await uploadResponse.text();

        console.error("S3 ERROR TEXT:", text);

        alert(
            "S3アップロードに失敗しました: " +
            uploadResponse.status
        );

        return;
    }

    document.getElementById(inputId).value =
    data.publicUrl;

    sessionStorage.setItem(
        "projectsNeedReload",
        "true"
    );

    alert("アップロードが完了しました。保存ボタンを押してください。");
}