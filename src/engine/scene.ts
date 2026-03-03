import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  dispose: () => void;
}

export function createScene(container: HTMLElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#11161c");

  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / Math.max(1, container.clientHeight),
    0.01,
    500
  );
  camera.position.set(2.5, 1.8, 2.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0.5, 0);

  const grid = new THREE.GridHelper(10, 20, "#64748b", "#334155");
  scene.add(grid);

  const hemi = new THREE.HemisphereLight("#ffffff", "#223344", 0.9);
  scene.add(hemi);

  const directional = new THREE.DirectionalLight("#ffffff", 1.2);
  directional.position.set(4, 8, 2);
  scene.add(directional);

  const ambient = new THREE.AmbientLight("#ffffff", 0.35);
  scene.add(ambient);

  let frameId = 0;
  const animate = () => {
    frameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  const onResize = () => {
    const width = container.clientWidth;
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  window.addEventListener("resize", onResize);

  const dispose = () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", onResize);
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  };

  return {
    scene,
    camera,
    renderer,
    controls,
    dispose,
  };
}

