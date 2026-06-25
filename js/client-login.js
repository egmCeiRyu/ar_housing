document
.getElementById("loginButton")
.addEventListener(
    "click",
    loginClient
);

async function loginClient() {

    const email =
        document
        .getElementById("email")
        .value
        .trim();

    const password =
        document
        .getElementById("password")
        .value
        .trim();

    if (!email || !password) {

        alert(
            "メールアドレスとパスワードを入力してください"
        );

        return;

    }

    const { data, error } =
        await supabaseClient
            .from("clients")
            .select("*")
            .eq("email", email)
            .eq("client_password", password)
            .single();

    if (error || !data) {

        alert(
            "ログイン情報が正しくありません"
        );

        console.error(error);

        return;

    }

    localStorage.setItem(
        "client_id",
        data.id
    );

    localStorage.setItem(
        "client_name",
        data.company_name
    );

    window.location.href =
    "client-portal.html?id=" + data.id;

}