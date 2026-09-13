async function isCurrentUserAdmin() {
    try {
        const { data, error } = await supabaseClient.auth.getUser();
        return !error && data?.user?.app_metadata?.role === "admin";
    } catch {
        return false;
    }
}

async function requireAdmin() {
    if (await isCurrentUserAdmin()) return true;
    window.location.replace("admin-login.html");
    return false;
}

async function getCurrentUser() {

    const { data } =
    await supabaseClient.auth.getUser();

    return data.user;
}

async function logout() {

    await supabaseClient.auth.signOut();

    window.location.href =
    "admin-login.html";
}