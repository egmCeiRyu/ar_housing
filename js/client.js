const params =
new URLSearchParams(
    window.location.search
);

const clientId =
params.get("id");

initializePage();

async function initializePage() {

    const ok =
    await requireAdmin();

    if (!ok) return;

    loadClient();
    loadProjects();
}

async function loadClient() {

    const { data, error } =
    await supabaseClient
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

    if (error) {
        console.error(error);
        return;
    }

    document
        .getElementById("clientName")
        .innerText =
        data.company_name;

    document
        .getElementById("clientInfo")
        .innerHTML = `
            担当者： ${data.contact_name || ""}<br>
            メールアドレス： ${data.email || ""}
        `;
}

async function loadProjects() {

    const { data, error } =
    await supabaseClient
        .from("properties")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", {
            ascending: true
        });

    if (error) {
        console.error(error);
        return;
    }

    renderProjects(data || []);
}

function renderProjects(projects) {

    const container =
        document.getElementById(
            "projectList"
        );

    container.innerHTML = "";

    projects.forEach(project => {

        container.innerHTML += `
        <div class="project-card">

            ${project.thumbnail_url ? `
                <img
                    src="${project.thumbnail_url}"
                    alt="${project.name}">
            ` : ""}

            <div class="project-content">

                <div class="project-name">
                    ${project.name}
                </div>

                <div>
                    Status: ${project.status}
                </div>

                <div class="project-actions">

                    <button onclick="editProject('${project.id}')">
                        編集
                    </button>

                    <button onclick="projectQr('${project.id}')">
                        QR
                    </button>

                    <button onclick="projectAnalytics('${project.id}')">
                        分析
                    </button>

                    <button onclick="deleteProject('${project.id}')">
                        削除
                </button>

</div>

            </div>

        </div>
        `;
    });
}

document
    .getElementById("newProjectBtn")
    .addEventListener("click", () => {

        location.href =
            `edit-project.html?client=${clientId}`;

    });

function editProject(id) {

    location.href =
        `edit-project.html?id=${id}`;

}

function projectQr(id) {
    window.open(
        `qr.html?id=${id}`,
        "_blank"
    );
}

function projectAnalytics(id) {

    location.href =
        `analytics.html?id=${id}`;

}

async function deleteProject(id) {

    const ok =
        confirm(
            "このプロジェクトを削除しますか？この操作は取り消すことができません。"
        );

    if (!ok) return;

    const { error } =
        await supabaseClient
            .from("properties")
            .delete()
            .eq("id", id);

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    alert("プロジェクトを削除しました。");

    await loadProjects();
}

window.addEventListener("pageshow", async () => {

    if (
        sessionStorage.getItem("projectsNeedReload") === "true"
    ) {

        sessionStorage.removeItem(
            "projectsNeedReload"
        );

        await loadClient();
        await loadProjects();
    }

});