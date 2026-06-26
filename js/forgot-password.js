const emailInput =
document.getElementById("email");

const sendButton =
document.getElementById("sendButton");

const message =
document.getElementById("message");

sendButton.addEventListener(
    "click",
    sendResetEmail
);

async function sendResetEmail() {

    const email =
    emailInput.value.trim();

    if (!email) {
        showMessage(
            "メールアドレスを入力してください。",
            true
        );
        return;
    }

    sendButton.disabled = true;
    sendButton.innerText = "送信中...";

    const redirectTo =
    `${window.location.origin}${BASE_PATH}/reset-password.html`;

    const { error } =
    await supabaseClient.auth.resetPasswordForEmail(
        email,
        {
            redirectTo
        }
    );

    sendButton.disabled = false;
    sendButton.innerText = "再設定メールを送信";

    if (error) {
        console.error(error);

        showMessage(
            "メール送信に失敗しました。時間をおいて再度お試しください。",
            true
        );

        return;
    }

    showMessage(
        "パスワード再設定メールを送信しました。",
        false
    );
}

function showMessage(text, isError) {

    message.innerText =
    text;

    message.style.color =
    isError ? "#dc2626" : "#15803d";
}