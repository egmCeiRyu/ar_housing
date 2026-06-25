

const isAdmin =
sessionStorage.getItem("admin") === "true";

const loggedClientId =
localStorage.getItem("client_id");

const params =
new URLSearchParams(window.location.search);

const projectId =
params.get("id");

if (!isAdmin && !loggedClientId) {
    window.location.href = "home.html";
}

if (!projectId) {
    alert("プロジェクトIDがありません。");
    window.location.href = "home.html";
}

loadProject();

async function loadProject() {

    const { data: project, error } =
    await supabaseClient
        .from("properties")
        .select("*")
        .eq("id", projectId)
        .single();

    if (error || !project) {
        console.error(error);
        alert("プロジェクトが見つかりません。");
        window.location.href = "home.html";
        return;
    }

    if (!isAdmin && project.client_id !== loggedClientId) {

        alert("このプロジェクトを表示する権限がありません。");

        window.location.href =
        "client-portal.html";

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