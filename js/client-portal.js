const isAdmin =
sessionStorage.getItem("admin") === "true";

const backButton =
document.getElementById("backButton");

console.log("admin =", isAdmin);

if (backButton) {

    if (isAdmin) {

        backButton.style.display = "flex";

    } else {

        backButton.style.display = "none";

    }

}
const params =
new URLSearchParams(window.location.search);

const clientId =
params.get("id");

if (!clientId) {
    alert("Client ID not found");
    throw new Error("Client ID not found");
}

loadClient();
loadProjects();

async function loadClient() {

    const { data, error } =
    await supabaseClient
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    document
        .getElementById("clientName")
        .innerText =
        data.company_name;

    document
        .getElementById("clientInfo")
        .innerHTML = `
            <div class="project-card">
                <div class="project-content">

                    <div>
                        担当者：
                        ${data.contact_name || ""}
                    </div>

                    <div>
                        メールアドレス：
                        ${data.email || ""}
                    </div>

                </div>
            </div>
        `;
}

async function loadProjects() {

    const { data, error } =
    await supabaseClient
        .from("properties")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error(error);
        alert(error.message);
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
            <div class="project-card">
                <div class="project-content">
                    No projects found.
                </div>
            </div>
        `;
        return;
    }

    projects.forEach(project => {

        container.innerHTML += `
            <div class="project-card">

                ${project.thumbnail_url ? `
                <img src="${project.thumbnail_url}">
                ` : ""}

                <div class="project-content">

                    <div class="project-name">
                        ${project.name}
                    </div>

                    <div>
                        Status:
                        ${project.status}
                    </div>

                    <div class="project-actions">

                        <button onclick="projectQr('${project.id}')">
                            QR
                        </button>

                        <button onclick="projectAnalytics('${project.id}')">
                            分析
                        </button>

                    </div>

                </div>

            </div>
        `;
    });
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