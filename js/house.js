const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

let currentProject = null;
let selectedColor = null;

loadHouse();

async function loadHouse(){

    const { data: project, error } = await supabaseClient
        .from("properties")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .single();

    if(error){
        console.error(error);
        alert("Project not found");
        return;
    }

    currentProject = project;

    document.getElementById("projectName").innerText = project.name;
    document.getElementById("thumbnail").src = project.thumbnail_url;

    loadColors(project.id);
}

async function loadColors(projectId){

    const { data, error } = await supabaseClient
        .from("project_colors")
        .select("*")
        .eq("property_id", projectId)
        .order("created_at");

    if(error){
        console.error(error);
        return;
    }

    renderColors(data || []);
}

function renderColors(colors){

    const container = document.getElementById("colorList");
    container.innerHTML = "";

    colors.forEach(color => {
        container.innerHTML += `
            <button class="color-btn" onclick="selectColor('${color.color_code}')">
                <span class="color-dot" style="background:${color.color_code}"></span>
                ${color.color_name}
            </button>
        `;
    });
}

function selectColor(colorCode){
    selectedColor = colorCode;
}

document.getElementById("openArBtn").addEventListener("click", () => {

    if(!currentProject){
        return;
    }

    const url =
    `ar.html?slug=${currentProject.slug}&color=${encodeURIComponent(selectedColor || "")}`;

    location.href = url;
});

