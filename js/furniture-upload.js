const modelIds = {
    "squarySofa.glb": "sofa",
    "dinningTable.glb": "table",
    "dinningChair.glb": "chair",
    "tvBench.glb": "tvbench",
    "tv50inch.glb": "tv",
    "house_firstFloor.glb": "first-floor",
    "house_secondFloor.glb": "second-floor",
    "01_white_cross.jpg": "white-cross",
    "02_washi_beige.jpg": "washi-beige",
    "03_concrete_gray.jpg": "concrete-gray",
    "04_woven_beige.jpg": "woven-beige"
};
const input = document.getElementById("models");
const button = document.getElementById("upload");
const status = document.getElementById("status");
const results = document.getElementById("results");
const completed = new Map();
requireAdmin().then(ok => {
    if (!ok) return;
    input.disabled = false;
    button.disabled = false;
    status.textContent = "Selecione os modelos para enviar.";
});
button.addEventListener("click", async () => {
    const files = [...input.files];
    if (!files.length) return;
    if (files.some(file => !modelIds[file.name])) {
        status.textContent = "Selecione os arquivos cadastrados de móveis, andares ou papéis de parede.";
        return;
    }
    button.disabled = true;
    input.disabled = true;
    try {
        for (const file of files) {
            const id = modelIds[file.name];
            if (completed.has(id)) continue;
            const header = new DataView(await file.slice(0, 12).arrayBuffer());
            const isWallpaper = file.name.endsWith(".jpg");
            const valid = isWallpaper
                ? header.byteLength >= 2 && header.getUint16(0) === 0xffd8
                : header.byteLength === 12 && header.getUint32(0, true) === 0x46546c67 &&
                    header.getUint32(4, true) === 2 && header.getUint32(8, true) === file.size;
            if (!valid) throw new Error("Arquivo inválido: " + file.name);
            status.textContent = "Enviando " + file.name + "…";
            const { data, error } = await supabaseClient.functions.invoke("create-s3-upload-url", {
                body: {
                    clientFolder: isWallpaper ? "wallpaper-catalog" :
                        file.name.startsWith("house_") ? "floor-catalog" : "furniture-catalog",
                    projectFolder: id,
                    fileType: isWallpaper ? "thumbnail" : "glb"
                }
            });
            if (error || !data?.uploadUrl) throw error || new Error("Falha ao autorizar upload");
            const response = await fetch(data.uploadUrl, {
                method: "PUT", headers: { "Content-Type": data.contentType }, body: file
            });
            if (!response.ok) throw new Error("S3 retornou " + response.status);
            completed.set(id, data.publicUrl);
            const item = document.createElement("li");
            const link = document.createElement("a");
            link.href = data.publicUrl;
            link.textContent = id + " — " + data.publicUrl;
            item.append(link);
            results.append(item);
        }
        status.textContent = completed.size + " modelos enviados ao S3.";
    } catch (error) {
        console.error(error);
        status.textContent = "Envio interrompido: " + error.message + ". Tente novamente para continuar.";
    } finally {
        button.disabled = false;
        input.disabled = false;
    }
});
