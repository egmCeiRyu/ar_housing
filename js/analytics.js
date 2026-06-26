initializePage();

async function initializePage() {

    const ok =
    await requireAdmin();

    if (!ok) return;

    loadAnalytics();
}

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


async function loadAnalytics() {

    const { data: project, error: projectError } =
    await supabaseClient
        .from("properties")
        .select("*")
        .eq("id", projectId)
        .single();

    if (projectError || !project) {
        console.error(projectError);
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

    document.getElementById("projectName").innerText =
        project.name;

    const { data: views, error: viewsError } =
    await supabaseClient
        .from("page_views")
        .select("*")
        .eq("property_id", projectId);

    if (viewsError) {
        console.error(viewsError);
        return;
    }

    const { data: sessions, error: sessionsError } =
    await supabaseClient
        .from("ar_sessions")
        .select("*")
        .eq("property_id", projectId);

    if (sessionsError) {
        console.error(sessionsError);
        return;
    }

    renderAnalytics(views || [], sessions || []);
}

function renderAnalytics(views, sessions) {

    document.getElementById("totalViews").innerText =
        views.length;

    document.getElementById("totalSessions").innerText =
        sessions.length;

    const finishedSessions =
        sessions.filter(session => session.duration);

    const totalDuration =
        finishedSessions.reduce((sum, session) => {
            return sum + Number(session.duration || 0);
        }, 0);

    const average =
        finishedSessions.length > 0
            ? Math.round(totalDuration / finishedSessions.length)
            : 0;

    document.getElementById("averageTime").innerText =
        formatDuration(average);

    renderDeviceStats(views);
    renderBrowserStats(views);
    renderLatestSessions(sessions);
}

function renderLatestSessions(sessions) {

    const container =
        document.getElementById("latestSessions");

    container.innerHTML = "";

    sessions
        .slice()
        .reverse()
        .slice(0, 10)
        .forEach(session => {
            container.innerHTML += `
                <div class="analytics-row">
                    <span>${formatDate(session.started_at)}</span>
                    <strong>${formatDuration(session.duration || 0)}</strong>
                </div>
            `;
        });

    if (sessions.length === 0) {
        container.innerHTML = "データがありません。";
    }
}

function formatDuration(seconds) {

    seconds = Number(seconds || 0);

    if (seconds < 60) {
        return `${seconds}秒`;
    }

    const min =
        Math.floor(seconds / 60);

    const sec =
        seconds % 60;

    return `${min}分 ${sec}秒`;
}

function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    return date.toLocaleString("ja-JP");
}

function renderDeviceStats(views) {

    const container =
        document.getElementById("deviceStats");

    const counts = {};

    views.forEach(item => {
        const name =
        getDeviceName(item.device || item.os);

        counts[name] =
        (counts[name] || 0) + 1;
    });

    renderSimpleCount(container, counts);
}

function renderBrowserStats(views) {

    const container =
        document.getElementById("browserStats");

    const counts = {};

    views.forEach(item => {
        const name =
        getBrowserName(item.browser);

        counts[name] =
        (counts[name] || 0) + 1;
    });

    renderSimpleCount(container, counts);
}

function getDeviceName(value) {

    const text =
        (value || "").toLowerCase();

    if (text.includes("iphone")) {
        return "iPhone";
    }

    if (text.includes("ipad")) {
        return "iPad";
    }

    if (text.includes("android")) {
        return "Android";
    }

    if (
        text.includes("windows") ||
        text.includes("win32")
    ) {
        return "Windows PC";
    }

    if (
        text.includes("macintosh") ||
        text.includes("mac os")
    ) {
        return "Mac";
    }

    return "その他";
}

function getBrowserName(value) {

    const text =
        (value || "").toLowerCase();

    if (text.includes("edg")) {
        return "Edge";
    }

    if (
        text.includes("crios") ||
        text.includes("chrome")
    ) {
        return "Chrome";
    }

    if (text.includes("safari")) {
        return "Safari";
    }

    if (text.includes("firefox")) {
        return "Firefox";
    }

    return "その他";
}

function renderSimpleCount(container, counts) {

    container.innerHTML = "";

    const entries =
        Object.entries(counts)
            .sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
        container.innerHTML = "データがありません。";
        return;
    }

    entries.forEach(([name, count]) => {
        container.innerHTML += `
            <div class="analytics-row">
                <span>${name}</span>
                <strong>${count}</strong>
            </div>
        `;
    });
}