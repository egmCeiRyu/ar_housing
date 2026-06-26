async function requireAdmin() {

    const { data } =
    await supabaseClient.auth.getSession();

    if (!data.session) {

        window.location.href =
        "admin-login.html";

        return false;
    }

    return true;
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