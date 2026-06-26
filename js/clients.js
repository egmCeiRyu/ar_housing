initializePage();

let editingClientId = null;
let editingAuthUserId = null;

const clientForm =
document.getElementById("clientForm");

const formTitle =
document.getElementById("formTitle");

const companyNameInput =
document.getElementById("companyName");

const contactNameInput =
document.getElementById("contactName");

const emailInput =
document.getElementById("email");

const clientPasswordInput =
document.getElementById("clientPassword");

const newClientBtn =
document.getElementById("newClientBtn");

const saveClientBtn =
document.getElementById("saveClientBtn");

const cancelClientBtnBottom =
document.getElementById("cancelClientBtnBottom");

newClientBtn.addEventListener("click", openNewClientForm);
saveClientBtn.addEventListener("click", saveClient);
cancelClientBtnBottom.addEventListener("click", closeClientForm);

async function initializePage() {

    const ok =
    await requireAdmin();

    if (!ok) return;

    await loadClients();
}

async function loadClients() {

    const { data, error } =
    await supabaseClient
        .from("clients")
        .select("*")
        .order("company_name");

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    renderClients(data || []);
}

function renderClients(clients) {

    const container =
    document.getElementById("clientList");

    container.innerHTML = "";

    clients.forEach(client => {

        container.innerHTML += `
            <div class="project-card">
                <div class="project-content">

                    <div class="project-name">
                        ${client.company_name}
                    </div>

                    <div class="project-client">
                        ${client.contact_name || ""}
                    </div>

                    <div class="project-client">
                        ${client.email || ""}
                    </div>

                    <div class="login-info">

                        <div class="login-title">
                            ログイン情報
                        </div>

                        <div class="login-row">
                            <span>${client.email || ""}</span>

                            <button
                                class="copy-btn"
                                onclick="copyToClipboard('${client.email || ""}')">
                                📋
                            </button>
                        </div>

                        <div class="login-row">
                            <span>${client.client_password || "-"}</span>

                            <button
                                class="copy-btn"
                                onclick="copyToClipboard('${client.client_password || ""}')">
                                📋
                            </button>
                        </div>

                    </div>

                    <div class="project-actions">

                        <button onclick="editClient('${client.id}')">
                            編集
                        </button>

                        <button onclick="openProjects('${client.id}')">
                            プロジェクト
                        </button>

                        <button onclick="openClientPortal('${client.id}')">
                            ポータル
                        </button>

                        <button onclick="deleteClient('${client.id}')">
                            削除
                        </button>

                    </div>

                </div>
            </div>
        `;
    });
}

function openNewClientForm() {

    editingClientId = null;
    editingAuthUserId = null;

    formTitle.innerText =
    "新規顧客登録";

    companyNameInput.value = "";
    contactNameInput.value = "";
    emailInput.value = "";
    clientPasswordInput.value = "";

    clientForm.classList.remove("hidden");
    clientForm.style.display = "block";
}

async function editClient(id) {

    const { data, error } =
    await supabaseClient
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    editingClientId =
    id;

    editingAuthUserId =
    data.auth_user_id;

    formTitle.innerText =
    "顧客情報編集";

    companyNameInput.value =
    data.company_name || "";

    contactNameInput.value =
    data.contact_name || "";

    emailInput.value =
    data.email || "";

    clientPasswordInput.value =
    "";

    clientForm.classList.remove("hidden");
    clientForm.style.display = "block";
}

async function saveClient() {

    const companyName =
    companyNameInput.value.trim();

    const contactName =
    contactNameInput.value.trim();

    const email =
    emailInput.value.trim();

    const password =
    clientPasswordInput.value.trim();

    if (!companyName) {
        alert("会社名を入力してください");
        return;
    }

    if (!email) {
        alert("メールアドレスを入力してください");
        return;
    }

    saveClientBtn.disabled = true;
    saveClientBtn.innerText = "保存中...";

    if (editingClientId) {

        if (!editingAuthUserId) {
            alert("Auth User ID が見つかりません。");
            saveClientBtn.disabled = false;
            saveClientBtn.innerText = "保存";
            return;
        }

        const response =
        await supabaseClient.functions.invoke(
            "update-client-login",
            {
                body: {
                    clientId: editingClientId,
                    authUserId: editingAuthUserId,
                    email: email,
                    password: password
                }
            }
        );

        const { data, error } =
        response;

        if (error || data?.error) {
            console.error(error || data.error);

            alert(
                "ログイン情報を更新できませんでした。\n\n" +
                (data?.error || error?.message || "")
            );

            saveClientBtn.disabled = false;
            saveClientBtn.innerText = "保存";
            return;
        }

        const { error: profileError } =
        await supabaseClient
            .from("clients")
            .update({
                company_name: companyName,
                contact_name: contactName
            })
            .eq("id", editingClientId);

        if (profileError) {
            console.error(profileError);
            alert(profileError.message);

            saveClientBtn.disabled = false;
            saveClientBtn.innerText = "保存";
            return;
        }

        alert("顧客情報を更新しました。");

    } else {

        const { data: existingClients, error: countError } =
        await supabaseClient
            .from("clients")
            .select("client_folder");

        if (countError) {
            console.error(countError);
            alert(countError.message);

            saveClientBtn.disabled = false;
            saveClientBtn.innerText = "保存";
            return;
        }

        const nextNumber =
        (existingClients || []).length + 1;

        const clientFolder =
        `client_${String(nextNumber).padStart(3, "0")}`;

        const { data: newClient, error: insertError } =
        await supabaseClient
            .from("clients")
            .insert({
                company_name: companyName,
                contact_name: contactName,
                email: email,
                client_folder: clientFolder
            })
            .select()
            .single();

        if (insertError) {
            console.error(insertError);
            alert(insertError.message);

            saveClientBtn.disabled = false;
            saveClientBtn.innerText = "保存";
            return;
        }

        const response =
        await supabaseClient.functions.invoke(
            "create-client-user",
            {
                body: {
                    clientId: newClient.id,
                    email: email,
                    companyName: companyName
                }
            }
        );

        const { data, error } =
        response;

        if (error || data?.error) {
            console.error(error || data.error);

            alert(
                "ログインユーザーを作成できませんでした。\n\n" +
                (data?.error || error?.message || "")
            );

            saveClientBtn.disabled = false;
            saveClientBtn.innerText = "保存";
            return;
        }

        alert(
`顧客を登録しました。

メール:
${email}

仮パスワード:
${data.temporary_password}

この情報をお客様へ送ってください。`
        );
    }

    saveClientBtn.disabled = false;
    saveClientBtn.innerText = "保存";

    closeClientForm();

    await loadClients();
}

function closeClientForm() {

    editingClientId = null;
    editingAuthUserId = null;

    clientForm.classList.add("hidden");
    clientForm.style.display = "none";
}

function openProjects(id) {

    location.href =
    `client.html?id=${id}`;
}

function openClientPortal(id) {

    location.href =
    `client-portal.html?id=${id}`;
}

async function deleteClient(id) {

    const { data: projects, error: projectError } =
    await supabaseClient
        .from("properties")
        .select("id")
        .eq("client_id", id);

    if (projectError) {
        console.error(projectError);
        alert(projectError.message);
        return;
    }

    if (projects && projects.length > 0) {
        alert(
            "この顧客にはプロジェクトがあります。先にプロジェクトを削除してください。"
        );
        return;
    }

    const ok =
    confirm("この顧客を削除しますか？");

    if (!ok) return;

    const { error } =
    await supabaseClient
        .from("clients")
        .delete()
        .eq("id", id);

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    alert("顧客を削除しました");

    await loadClients();
}

async function copyToClipboard(text) {

    if (!text) return;

    await navigator.clipboard.writeText(text);

    alert("コピーしました");
}