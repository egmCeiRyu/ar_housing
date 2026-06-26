initializePage();

const params =
new URLSearchParams(window.location.search);

const clientId =
params.get("client");

async function initializePage() {

    const ok =
    await requireAdmin();

    if (!ok) return;

    await loadProjects();
}

async function loadProjects() {

    let query =
    supabaseClient
        .from("properties")
        .select(`
            *,
            clients (
                company_name
            )
        `)
        .order("created_at", { ascending: false });

    if (clientId) {
        query =
        query.eq("client_id", clientId);
    }

    const { data, error } =
    await query;

    if (error) {
        console.error(error);
        return;
    }

    renderProjects(data || []);
}

function renderProjects(projects) {

    const container =
    document.getElementById("projectList");

    container.innerHTML = "";

    if (projects.length === 0) {
        container.innerHTML = `
            <p style="margin-top:20px;color:#666;">
                プロジェクトがありません。
            </p>
        `;
        return;
    }

    projects.forEach((project) => {

        container.innerHTML += `
            <div class="project-card">

                <img src="${project.thumbnail_url || ""}">

                <div class="project-content">

                    <div class="project-name">
                        ${project.name || ""}
                    </div>

                    <div class="project-client">
                        ${project.clients?.company_name || ""}
                    </div>

                    <div class="project-status">
                        ${project.status || ""}
                    </div>

                    <div class="project-actions">

                        <button onclick="editProject('${project.id}')">
                            Edit
                        </button>

                        <button onclick="showQr('${project.id}')">
                            QR
                        </button>

                        <button onclick="openAnalytics('${project.id}')">
                            Analytics
                        </button>

                    </div>

                </div>

            </div>
        `;
    });
}

function editProject(id) {

    location.href =
    `edit-project.html?id=${id}`;
}

function showQr(id) {

    location.href =
    `qr.html?id=${id}`;
}

function openAnalytics(id) {

    location.href =
    `analytics.html?id=${id}`;
}

window.addEventListener("pageshow", async () => {

    if (
        sessionStorage.getItem("projectsNeedReload") === "true"
    ) {

        sessionStorage.removeItem(
            "projectsNeedReload"
        );

        await loadProjects();
    }
});