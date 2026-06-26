const backButton =
document.getElementById("backButton");

const params =
new URLSearchParams(window.location.search);

const adminClientId =
params.get("id");

let clientId = null;

initializePage();

async function initializePage() {

    await initializeBackButton();

    if (adminClientId) {

        clientId = adminClientId;

    } else {

        const { data: authData } =
        await supabaseClient.auth.getUser();

        if (!authData.user) {

            window.location.href =
            "client-login.html";

            return;
        }

        const { data: client, error } =
        await supabaseClient
            .from("clients")
            .select("id")
            .eq("auth_user_id", authData.user.id)
            .single();

        if (error || !client) {

            alert("お客様情報が見つかりません。");

            console.error(error);

            await supabaseClient.auth.signOut();

            window.location.href =
            "client-login.html";

            return;
        }

        clientId = client.id;
    }

    await loadClient();
    await loadProjects();
}

async function initializeBackButton() {

    if (!backButton) return;

    const { data } =
    await supabaseClient.auth.getSession();

    const isAdmin =
    !!data.session && !!adminClientId;

    backButton.style.display =
    isAdmin ? "flex" : "none";

    backButton.addEventListener("click", () => {

        window.location.href =
        "index.html";

    });
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
        .order("created_at", {
            ascending: true
        });

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
                    プロジェクトがありません。
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