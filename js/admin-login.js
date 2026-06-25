document
.getElementById("loginButton")
.addEventListener(
    "click",
    login
);

async function login(){

    const username =
    document
    .getElementById("username")
    .value
    .trim();

    const password =
    document
    .getElementById("password")
    .value
    .trim();

    if(!username || !password){

        alert(
            "ユーザー名とパスワードを入力してください。"
        );

        return;

    }

    const { data, error } =
    await supabaseClient
        .from("admins")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .eq("role", "admin")
        .single();

    if(error || !data){

        console.error(error);

        alert(
            "ユーザー名またはパスワードが正しくありません。"
        );

        return;

    }

    sessionStorage.setItem(
        "admin",
        "true"
    );

    sessionStorage.setItem(
        "admin_id",
        data.id
    );

    sessionStorage.setItem("admin","true");

    console.log(
        sessionStorage.getItem("admin")
    );

    window.location.href =
    `${BASE_PATH}/index.html`;

    window.location.href =
    `${BASE_PATH}/index.html`;

}