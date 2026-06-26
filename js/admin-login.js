const emailInput =
document.getElementById("email");

const passwordInput =
document.getElementById("password");

const loginButton =
document.getElementById("loginButton");

const togglePasswordButton =
document.getElementById("togglePassword");

const loginMessage =
document.getElementById("loginMessage");

loginButton.addEventListener("click", login);
togglePasswordButton.addEventListener("click", togglePassword);

async function login() {

    const email =
    emailInput.value.trim();

    const password =
    passwordInput.value.trim();

    if(!email || !password) {
        showMessage(
            "メールアドレスとパスワードを入力してください。",
            true
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

    if(error) {
        showMessage(
            "メールアドレスまたはパスワードが正しくありません。",
            true
        );
        return;
    }

    if(!data.user) {
        showMessage(
            "ログインできませんでした。",
            true
        );
        return;
    }

    window.location.href = "index.html";
}

function togglePassword() {

    const isPassword =
    passwordInput.type === "password";

    passwordInput.type =
    isPassword ? "text" : "password";

    togglePasswordButton.innerText =
    isPassword ? "非表示" : "表示";
}

function showMessage(text, isError) {

    loginMessage.innerText =
    text;

    loginMessage.style.color =
    isError ? "#dc2626" : "#15803d";
}