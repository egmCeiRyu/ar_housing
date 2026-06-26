const emailInput =
document.getElementById("email");

const passwordInput =
document.getElementById("password");

const loginButton =
document.getElementById("loginButton");

initializePage();

async function initializePage() {

    const { data } =
    await supabaseClient.auth.getSession();

    if (data.session) {

        window.location.href =
        "client-portal.html";

        return;

    }

}

loginButton.addEventListener(
    "click",
    loginClient
);

passwordInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {
            loginClient();
        }

    }
);

async function loginClient() {

    const email =
    emailInput.value.trim();

    const password =
    passwordInput.value.trim();

    if (!email || !password) {

        alert(
            "メールアドレスとパスワードを入力してください。"
        );

        return;
    }

    loginButton.disabled = true;
    loginButton.innerText = "ログイン中...";

    const { data, error } =
    await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    loginButton.disabled = false;
    loginButton.innerText = "ログイン";

    if (error) {

        alert(
            "メールアドレスまたはパスワードが正しくありません。"
        );

        console.error(error);

        return;
    }

    if (!data.user) {

        alert(
            "ログインできませんでした。"
        );

        return;
    }

    window.location.href =
    "client-portal.html";
}