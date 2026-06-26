const passwordInput =
document.getElementById("password");

const confirmPasswordInput =
document.getElementById("confirmPassword");

const updateButton =
document.getElementById("updateButton");

const message =
document.getElementById("message");

updateButton.addEventListener(
    "click",
    updatePassword
);

async function updatePassword() {

    const password =
    passwordInput.value.trim();

    const confirmPassword =
    confirmPasswordInput.value.trim();

    if (!password || !confirmPassword) {
        showMessage(
            "新しいパスワードを入力してください。",
            true
        );
        return;
    }

    if (password.length < 6) {
        showMessage(
            "パスワードは6文字以上で入力してください。",
            true
        );
        return;
    }

    if (password !== confirmPassword) {
        showMessage(
            "パスワードが一致しません。",
            true
        );
        return;
    }

    updateButton.disabled = true;
    updateButton.innerText = "更新中...";

    const { error } =
    await supabaseClient.auth.updateUser({
        password
    });

    updateButton.disabled = false;
    updateButton.innerText = "パスワードを更新";

    if (error) {
        console.error(error);

        showMessage(
            "パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。",
            true
        );

        return;
    }

    showMessage(
        "パスワードを更新しました。ログイン画面へ移動します。",
        false
    );

    setTimeout(() => {
        window.location.href =
        "client-login.html";
    }, 1500);
}

function showMessage(text, isError) {

    message.innerText =
    text;

    message.style.color =
    isError ? "#dc2626" : "#15803d";
}