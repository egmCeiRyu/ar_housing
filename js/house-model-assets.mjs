// Apply only to this exact uploaded model; a new Blender upload uses its own source.
const source = "https://ar-housing-platform-418384447723-ap-northeast-1-an.s3.ap-northeast-1.amazonaws.com/clients/client_001/project_001/house.glb?v=bdc95f441f1f";
export function houseModelAssets(slug, sourceUrl) {
    if (slug !== "house01" || sourceUrl !== source) return null;
    return {
        web: "/models/house01/atlas-alpha-webp.glb?v=20261113-wallfaces1",
        native: "/models/house01/atlas-alpha-native.glb?v=20261113-wallfaces1"
    };
}
