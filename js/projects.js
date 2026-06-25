const isAdmin =
sessionStorage.getItem("admin");

if (isAdmin !== "true") {

    window.location.href =
    "admin-login.html";

}

const params =
new URLSearchParams(window.location.search);

const clientId =
params.get("client");

async function loadProjects() {

    const { data, error } =
    await supabaseClient
        .from("properties")
        .select(`
            *,
            clients (
                company_name
            )
        `)
        .eq("client_id", clientId);

    if(error){
        console.error(error);
        return;
    }

    renderProjects(data);
}

function renderProjects(projects){

    const container =
    document.getElementById("projectList");

    container.innerHTML = "";

    projects.forEach(project => {

        container.innerHTML += `
        <div class="project-card">

            <img src="${project.thumbnail_url}">

            <div class="project-content">

                <div class="project-name">
                    ${project.name}
                </div>

                <div class="project-client">
                    ${project.clients?.company_name || ""}
                </div>

                <div class="project-status">
                    ${project.status}
                </div>

                <div class="project-actions">

                    <button onclick="editProject('${project.id}')">
                        Edit
                    </button>

                    <button onclick="showQr('${project.slug}')">
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

function showQr(slug) {

    alert(
        `ar.html?slug=${slug}`
    );

}

function openAnalytics(id) {

    alert(
        `Analytics: ${id}`
    );

}

loadProjects();