import * as THREE from 'three';

// model-viewer is pinned to 4.4.0. Reuse its loaded scene and renderer;
// this module never loads a model or creates another WebGL context.
export async function createHousePreview(viewer) {
    await viewer.updateComplete;
    function internal(name) {
        for (let object = viewer; object; object = Object.getPrototypeOf(object)) {
            const key = Object.getOwnPropertySymbols(object).find(key => key.description === name);
            if (key) return viewer[key];
        }
    }
    const scene = internal('scene');
    const renderer = internal('renderer')?.threeRenderer;
    if (!scene?.model || !renderer || typeof scene.queueRender !== 'function') {
        throw new Error('Shared model-viewer scene unavailable');
    }
    const bounds = new THREE.Box3().setFromObject(scene.model);
    const size = bounds.getSize(new THREE.Vector3());
    const target = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.z, 1);
    const sun = new THREE.DirectionalLight(0xfff9f0, 3);
    sun.name = 'qrie-sun';
    sun.position.copy(target).add(new THREE.Vector3(-0.7, 1.5, 1).normalize().multiplyScalar(radius * 2));
    sun.target.position.copy(target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.015;
    Object.assign(sun.shadow.camera, {left:-radius, right:radius, top:radius, bottom:-radius, near:0.1, far:radius*5});
    sun.shadow.camera.updateProjectionMatrix();
    scene.model.traverse(mesh => {
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mesh.castShadow = !materials.every(m => m.transmission > 0.5 || ['glass', 'window'].includes(m.name));
        mesh.receiveShadow = true;
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    scene.add(sun, sun.target);
    scene.queueRender();
    return {
        refresh() { scene.queueRender(); },
        dispose() { scene.remove(sun, sun.target); sun.shadow.dispose(); scene.queueRender(); }
    };
}
