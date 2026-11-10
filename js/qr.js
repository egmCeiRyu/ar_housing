
const params =
new URLSearchParams(window.location.search);

const projectId =
params.get("id");

initializePage();

async function initializePage() {

    const { data, error } = await supabaseClient.auth.getUser();
    const user = data?.user;
    if (error || !user) {
        const loginPage = params.get("from") === "client" ? "client-login.html" : "admin-login.html";
        window.location.replace(loginPage);
        return;
    }

    const isAdmin = user.app_metadata?.role === "admin";
    const returnPage = isAdmin ? "index.html" : "client-portal.html";
    if (!projectId) {
        window.location.replace(returnPage);
        return;
    }

    const query = supabaseClient.from("properties").select("name, slug").eq("id", projectId);
    if (!isAdmin) {
        const { data: client, error: clientError } = await supabaseClient
            .from("clients")
            .select("id")
            .eq("auth_user_id", user.id)
            .maybeSingle();

        if (clientError || !client) {
            if (clientError) console.error(clientError);
            window.location.replace(returnPage);
            return;
        }
        query.eq("client_id", client.id);
    }

    const { data: project, error: projectError } = await query.maybeSingle();
    if (projectError || !project) {
        if (projectError) console.error(projectError);
        alert("プロジェクトが見つかりません。");
        window.location.replace(returnPage);
        return;
    }

    document
        .getElementById("projectName")
        .innerText =
        project.name;

    const arUrl =
    `${VIEWER_URL}?slug=${project.slug}`;

    document
        .getElementById("projectUrl")
        .value =
        arUrl;

    const qrSmallUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(arUrl)}`;

    document
        .getElementById("qrImage")
        .src =
        qrSmallUrl;
}

document
    .getElementById("copyBtn")
    .addEventListener("click", () => {

        navigator.clipboard.writeText(
            document
                .getElementById("projectUrl")
                .value
        );

        alert("URLをコピーしました。");

    });

document
    .getElementById("openBtn")
    .addEventListener("click", () => {

        window.open(
            document
                .getElementById("projectUrl")
                .value,
            "_blank"
        );

    });

document
    .getElementById("downloadQrBtn")
    .addEventListener("click", async () => {

        const arUrl =
        document
            .getElementById("projectUrl")
            .value;

        if (!arUrl) {
            alert("QRコードの準備ができていません。");
            return;
        }

        const qrLargeUrl =
        `https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&data=${encodeURIComponent(arUrl)}`;

        const response =
        await fetch(qrLargeUrl);

        const blob =
        await response.blob();

        const downloadUrl =
        URL.createObjectURL(blob);

        const a =
        document.createElement("a");

        a.href =
        downloadUrl;

        a.download =
        "project-qr.png";

        document.body.appendChild(a);

        a.click();

        a.remove();

        URL.revokeObjectURL(downloadUrl);

    });