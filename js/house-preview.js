import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export async function createHousePreview(url) {
    const host = document.createElement('div');
    host.id = 'house-preview';
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', '住宅3Dプレビュー。ドラッグで回転、ピンチで拡大できます。');
    const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.append(renderer.domElement);
    document.body.append(host);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f5f7fb');
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI - 0.05;
    const sky = new THREE.HemisphereLight(0xeaf2ff, 0x999087, 0.55);
    scene.add(sky);
    const sun = new THREE.DirectionalLight(0xfff9f0, 3.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.015;
    scene.add(sun, sun.target);
    let model, observer, environment, pmrem;
    const render = () => { if (!document.hidden && !document.body.classList.contains('webxr-active')) renderer.render(scene, camera); };
    try {
        const gltf = await new GLTFLoader().loadAsync(url);
        model = gltf.scene;
        const initial = new THREE.Box3().setFromObject(model);
        const center = initial.getCenter(new THREE.Vector3());
        model.position.x -= center.x;
        model.position.z -= center.z;
        model.position.y -= initial.min.y;
        model.traverse(mesh => {
            if (!mesh.isMesh) return;
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mesh.castShadow = !materials.every(m => m.transmission > 0.5 || ['glass', 'window'].includes(m.name));
            mesh.receiveShadow = true;
            for (const m of materials) {
                if (m.transparent && m.map && !m.transmission) m.alphaTest = Math.max(m.alphaTest, 0.35);
                for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
                    if (m[key]) m[key].anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
                }
            }
        });
        scene.add(model);
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.z);
        controls.target.set(0, size.y * 0.45, 0);
        const target = controls.target.clone();
        sun.position.copy(target).add(new THREE.Vector3(-0.7, 1.5, 1).normalize().multiplyScalar(radius * 2));
        sun.target.position.copy(target);
        Object.assign(sun.shadow.camera, {left:-radius, right:radius, top:radius, bottom:-radius, near:0.1, far:radius*5});
        sun.shadow.camera.updateProjectionMatrix();
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(radius*3, radius*3), new THREE.ShadowMaterial({opacity:0.38}));
        ground.rotation.x = -Math.PI/2;
        ground.position.y = -0.003;
        ground.receiveShadow = true;
        scene.add(ground);
        // Neutral daylight reflection environment; the directional sun casts the shadows.
        const width=128, height=64, data=new Float32Array(width*height*4);
        for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
            const elevation=(y/height-.5)*Math.PI, phi=(x/width-.5)*2*Math.PI;
            const sy=Math.sin(elevation), sx=Math.cos(elevation)*Math.cos(phi), sz=Math.cos(elevation)*Math.sin(phi);
            const ambient=0.25+0.16*Math.max(sy,0);
            const reflection=5*Math.exp((sx*(-.36)+sy*.77+sz*.52-1)/.04);
            const i=(y*width+x)*4;
            data[i]=ambient+reflection;
            data[i+1]=ambient*1.02+reflection*.99;
            data[i+2]=ambient*1.04+reflection*.97;
            data[i+3]=1;
        }
        const image=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);
        image.mapping=THREE.EquirectangularReflectionMapping;
        image.needsUpdate=true;
        pmrem=new THREE.PMREMGenerator(renderer);
        environment=pmrem.fromEquirectangular(image);
        scene.environment=environment.texture;
        scene.environmentIntensity=0.35;
        image.dispose();
        let initiallyFitted=false;
        function resize() {
            const width=host.clientWidth, height=host.clientHeight;
            if(!width || !height) return;
            renderer.setSize(width,height,false);
            camera.aspect=width/height;
            camera.updateProjectionMatrix();
            if(!initiallyFitted) {
                const direction=new THREE.Vector3(.6,.45,1).normalize();
                camera.position.copy(target).add(direction);
                camera.lookAt(target);
                const inverse=camera.quaternion.clone().invert();
                const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)), tanH=tanV*camera.aspect;
                let distance=1;
                for(const x of [bounds.min.x,bounds.max.x]) for(const y of [bounds.min.y,bounds.max.y]) for(const z of [bounds.min.z,bounds.max.z]) {
                    const point=new THREE.Vector3(x,y,z).sub(target).applyQuaternion(inverse);
                    distance=Math.max(distance,point.z+Math.abs(point.x)*1.12/tanH,point.z+Math.abs(point.y)*1.25/tanV);
                }
                camera.position.copy(target).addScaledVector(direction,distance);
                controls.minDistance=radius*.4;
                controls.maxDistance=distance*3;
                controls.update();
                initiallyFitted=true;
            }
            render();
        }
        observer=new ResizeObserver(resize);
        observer.observe(host);
        controls.addEventListener('change',render);
        document.addEventListener('visibilitychange',render);
        resize();
        return {
            setColor(name, color) {
                model.traverse(mesh=>{if(mesh.isMesh) for(const m of (Array.isArray(mesh.material)?mesh.material:[mesh.material])) if(m.name===name) m.color.setStyle(color, THREE.LinearSRGBColorSpace);});
                render();
            },
            refresh:render,
            dispose() {
                observer.disconnect(); controls.dispose();
                document.removeEventListener('visibilitychange',render);
                environment.dispose(); pmrem.dispose(); renderer.dispose(); host.remove();
            }
        };
    } catch(error) {
        observer?.disconnect(); controls.dispose(); environment?.dispose(); pmrem?.dispose(); renderer.dispose(); host.remove(); throw error;
    }
}
