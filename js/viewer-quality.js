// A light variant is valid only for the exact full model version it came from.
const QRIEViewerQuality = {
    resolve(project, variants, { baseUrl, requested, saved, mobile } = {}) {
        const entry = variants?.[project.slug];
        if (!entry || entry.sourceUrl !== project.glb_url || typeof entry.light !== "string") {
            return { mode: "full", url: project.glb_url, available: false };
        }
        const light = new URL(entry.light, baseUrl);
        const base = new URL(baseUrl);
        if (light.origin !== base.origin || !light.pathname.startsWith("/models/") || !light.pathname.endsWith(".glb")) {
            return { mode: "full", url: project.glb_url, available: false };
        }
        const valid = value => value === "light" || value === "full";
        const mode = valid(requested) ? requested : valid(saved) ? saved : mobile ? "light" : "full";
        return { mode, url: mode === "light" ? light.href : project.glb_url, available: true };
    }
};
