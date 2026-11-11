import { cp, mkdir, readdir } from "node:fs/promises";

const target = ".cloudflare-static";
await mkdir(target, { recursive: true });
for (const entry of await readdir(".", { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".html")) {
        await cp(entry.name, target + "/" + entry.name);
    }
}
for (const folder of ["css", "js", "vendor"]) {
    await cp(folder, target + "/" + folder, { recursive: true });
}
