const params = new URLSearchParams(window.location.search);
const projectId = params.get("id");
const fromClientPortal = params.get("from") === "client";

initializePage();

async function initializePage() {
    const { data, error } = await supabaseClient.auth.getUser();
    if (error || !data?.user) {
        window.location.replace(fromClientPortal ? "client-login.html" : "home.html");
        return;
    }

    const returnPage = data.user.app_metadata?.role === "admin"
        ? "index.html"
        : "client-portal.html";
    document.getElementById("analyticsBack").href = returnPage;

    if (!projectId) {
        window.location.replace(returnPage);
        return;
    }

    const { data: report, error: reportError } = await supabaseClient.rpc(
        "get_property_analytics",
        { requested_property_id: projectId }
    );
    if (reportError || !report) {
        if (reportError) console.error(reportError);
        document.getElementById("projectName").innerText =
            reportError ? "分析データを読み込めませんでした。" : "この物件の分析データを表示できません。";
        document.getElementById("analyticsReport").hidden = true;
        return;
    }

    document.getElementById("projectName").innerText = report.project_name;
    renderAnalytics(report.views, report.sessions);
}


function renderAnalytics(views, sessions) {

    document.getElementById("totalViews").innerText =
    views.length;

    document.getElementById("totalSessions").innerText =
    sessions.length;

    const finishedSessions =
    sessions.filter(session =>
        session.duration_seconds || session.duration
    );

    const totalDuration =
    finishedSessions.reduce((sum, session) => {
        return sum + Number(
            session.duration_seconds ||
            session.duration ||
            0
        );
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

    if (sessions.length === 0) {
        container.innerHTML = "データがありません。";
        return;
    }

    sessions
        .slice()
        .reverse()
        .slice(0, 10)
        .forEach(session => {

            const duration =
            session.duration_seconds ||
            session.duration ||
            0;

            container.innerHTML += `
                <div class="analytics-row">
                    <span>${formatDate(session.started_at)}</span>
                    <strong>${formatDuration(duration)}</strong>
                </div>
            `;
        });
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
        getBrowserName(item.browser || item.device);

        counts[name] =
        (counts[name] || 0) + 1;
    });

    renderSimpleCount(container, counts);
}

function renderSimpleCount(container, counts) {

    container.innerHTML = "";

    const entries =
    Object.entries(counts);

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

function getDeviceName(value) {

    const text =
    (value || "").toLowerCase();

    if (text.includes("iphone")) return "iPhone";
    if (text.includes("ipad")) return "iPad";
    if (text.includes("android")) return "Android";
    if (text.includes("windows") || text.includes("win32")) return "Windows PC";
    if (text.includes("macintosh") || text.includes("mac os")) return "Mac";

    return "その他";
}

function getBrowserName(value) {

    const text =
    (value || "").toLowerCase();

    if (text.includes("edg")) return "Edge";
    if (text.includes("chrome")) return "Chrome";
    if (text.includes("safari")) return "Safari";
    if (text.includes("firefox")) return "Firefox";

    return "その他";
}

function formatDuration(seconds) {

    seconds =
    Number(seconds || 0);

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