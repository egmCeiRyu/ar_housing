import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Keep the original scene unchanged. Offsetting this wrapper gives a bottom-center pivot.
export function normalizePivot(scene) {
    scene.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(scene, true);
    if (box.isEmpty()) throw new Error('モデルに表示できる形状がありません。');
    const size = box.getSize(new THREE.Vector3());
    if (![size.x, size.y, size.z].every(Number.isFinite) || size.length() === 0) throw new Error('モデルの寸法が無効です。');
    const center = box.getCenter(new THREE.Vector3());
    const offset = new THREE.Vector3(-center.x, -box.min.y, -center.z);
    const root = new THREE.Group();
    root.position.copy(offset);
    root.add(scene);
    const pivot = new THREE.Group();
    pivot.add(root);
    return { pivot, size, offset };
}
function release(root) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse(object => {
        if (!object.isMesh) return;
        geometries.add(object.geometry);
        for (const material of [object.material].flat()) {
            materials.add(material);
            for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        }
    });
    geometries.forEach(item => item.dispose());
    materials.forEach(item => item.dispose());
    textures.forEach(item => { item.dispose(); item.source?.data?.close?.(); });
}
const blobFromCanvas = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('サムネイルを生成できませんでした。')), 'image/webp', 0.9));
export async function createAssetPreview(file, container) {
    const magic = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isGlb = file.name.toLowerCase().endsWith('.glb');
    if (!isGlb) {
        const bitmap = await createImageBitmap(file);
        try {
            if (bitmap.width * bitmap.height > 67108864) throw new Error('画像は 64 メガピクセル以下にしてください。');
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 512;
            const context = canvas.getContext('2d');
            context.fillStyle = '#edf1f5'; context.fillRect(0, 0, 512, 512);
            const scale = Math.min(512 / bitmap.width, 512 / bitmap.height);
            context.drawImage(bitmap, (512 - bitmap.width * scale) / 2, (512 - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
            const thumbnail = await blobFromCanvas(canvas);
            container.replaceChildren(canvas);
            return { type: 'texture', width: 0, depth: 0, height: 0, pivotOffset: null, thumbnail,
                details: `${bitmap.width} × ${bitmap.height} px`, dispose() { canvas.remove(); } };
        } finally { bitmap.close(); }
    }
    const header = new DataView(magic.buffer);
    if (magic.length !== 12 || header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== file.size) throw new Error('有効な GLB 2.0 を選択してください。');
    const buffer = await file.arrayBuffer();
    const jsonLength = new DataView(buffer).getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
    if ([...(json.buffers || []), ...(json.images || [])].some(item => item.uri && !item.uri.startsWith('data:'))) throw new Error('画像を埋め込んだ GLB を選択してください。');
    const loader = new GLTFLoader();
    const gltf = await loader.parseAsync(buffer, '');
    let renderer, controls, observer;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#edf1f5');
    let normalized;
    try { normalized = normalizePivot(gltf.scene); } catch (error) { release(gltf.scene); throw error; }
    const { pivot, size, offset } = normalized;
    scene.add(pivot);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8b98a5, 2));
    const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(4, 6, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xd4e4ff, 1.2); fill.position.set(-4, 3, -2); scene.add(fill);
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(1); renderer.setSize(512, 512, false);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
        const target = new THREE.Vector3(0, size.y / 2, 0);
        const radius = size.length() / 2;
        const distance = radius / Math.sin(THREE.MathUtils.degToRad(20)) * 1.12;
        camera.position.copy(target).add(new THREE.Vector3(1, 0.7, 1).normalize().multiplyScalar(distance));
        camera.near = Math.max(distance / 1000, 0.001); camera.far = distance * 20; camera.updateProjectionMatrix();
        camera.lookAt(target);
        renderer.render(scene, camera);
        const thumbnail = await blobFromCanvas(renderer.domElement);
        container.replaceChildren(renderer.domElement);
        controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(target); controls.enablePan = false; controls.minDistance = radius * 1.2; controls.maxDistance = distance * 3;
        const draw = () => renderer.render(scene, camera);
        controls.update();
        controls.addEventListener('change', draw);
        observer = new ResizeObserver(() => {
            const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
            renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); draw();
        });
        observer.observe(container);
        let triangles = 0;
        pivot.traverse(object => { if (object.isMesh) triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; });
        return { type: 'model', width: size.x, depth: size.z, height: size.y, pivotOffset: offset.toArray(), thumbnail,
            details: `${Math.round(triangles).toLocaleString('ja-JP')} ポリゴン · ${(file.size / 1048576).toFixed(1)} MB`,
            dispose() { observer.disconnect(); controls.dispose(); release(pivot); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); } };
    } catch (error) { observer?.disconnect(); controls?.dispose(); renderer?.dispose(); release(pivot); throw error; }
}
