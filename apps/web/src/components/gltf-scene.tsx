import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseModelDocument } from '@/lib/gltf-inspector';
import type { AnimationMixer, Material, Mesh, Object3D, Texture } from 'three';

export interface ModelStats {
  nodes: number;
  meshes: number;
  vertices: number;
  triangles: number;
  materials: number;
  textures: number;
  animations: number;
}
export default function GltfScene({
  files,
  main,
  wireframe,
  play,
  onStats,
}: {
  files: File[];
  main: string;
  wireframe: boolean;
  play: boolean;
  onStats: (stats: ModelStats | null) => void;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const wireRef = useRef(wireframe);
  wireRef.current = wireframe;
  const playRef = useRef(play);
  playRef.current = play;
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    setError(null);
    onStats(null);
    async function init() {
      const objectUrls: string[] = [];
      try {
        const file = files.find((f) => f.name === main);
        if (!file) throw new Error('INVALID');
        const doc = parseModelDocument(
          await file.arrayBuffer(),
          /\.glb$/i.test(main),
        );
        const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
          import('three'),
          import('three/addons/loaders/GLTFLoader.js'),
          import('three/addons/controls/OrbitControls.js'),
        ]);
        if (disposed || !host.current) return;
        const manager = new THREE.LoadingManager();
        const byName = new Map(
          files.map((item) => [item.webkitRelativePath || item.name, item]),
        );
        manager.setURLModifier((url) => {
          if (url.startsWith('data:') || url.startsWith('blob:')) return url;
          const name = decodeURIComponent(url).replace(/^\.\//, '');
          const resource =
            byName.get(name) ?? files.find((item) => item.name === name);
          if (!resource) throw new Error(`MISSING:${name}`);
          const blob = URL.createObjectURL(resource);
          objectUrls.push(blob);
          return blob;
        });
        const gltf = await new GLTFLoader(manager).parseAsync(doc.data, '');
        const textures = new Set<Texture>();
        const materials = new Set<Material>();
        const stats: ModelStats = {
          nodes: 0,
          meshes: 0,
          vertices: 0,
          triangles: 0,
          materials: 0,
          textures: 0,
          animations: gltf.animations.length,
        };
        gltf.scene.traverse((object: Object3D) => {
          stats.nodes++;
          const mesh = object as Mesh;
          if (!mesh.isMesh) return;
          stats.meshes++;
          stats.vertices += mesh.geometry.getAttribute('position')?.count ?? 0;
          stats.triangles +=
            (mesh.geometry.index?.count ??
              mesh.geometry.getAttribute('position')?.count ??
              0) / 3;
          for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]) {
            materials.add(material);
            for (const value of Object.values(material))
              if (
                value &&
                typeof value === 'object' &&
                'isTexture' in value &&
                value.isTexture
              )
                textures.add(value as Texture);
          }
        });
        const releaseModel = () => {
          gltf.scene.traverse((object) => {
            const mesh = object as Mesh;
            if (mesh.isMesh) mesh.geometry.dispose();
          });
          materials.forEach((material) => material.dispose());
          textures.forEach((texture) => {
            const source: unknown = texture.source?.data;
            if (
              typeof ImageBitmap !== 'undefined' &&
              source instanceof ImageBitmap
            )
              source.close();
            texture.dispose();
          });
        };
        if (disposed || !host.current) {
          releaseModel();
          return;
        }
        let renderer: InstanceType<typeof THREE.WebGLRenderer>;
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch {
          releaseModel();
          throw new Error('WEBGL');
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.domElement.className = 'h-full w-full';
        host.current.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        scene.add(gltf.scene, new THREE.HemisphereLight(0xffffff, 0x777777, 3));
        const light = new THREE.DirectionalLight(0xffffff, 3);
        light.position.set(3, 5, 5);
        scene.add(light);
        const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3()).length() || 1;
        if (!Number.isFinite(size) || size > 1e10) {
          releaseModel();
          renderer.dispose();
          renderer.domElement.remove();
          throw new Error('INVALID');
        }
        camera.near = Math.max(size / 1000, 0.00001);
        camera.far = size * 100;
        camera.updateProjectionMatrix();
        camera.position
          .copy(center)
          .add(new THREE.Vector3(size * 0.8, size * 0.5, size * 1.5));
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(center);
        controls.update();
        const resize = () => {
          if (!host.current) return;
          const width = host.current.clientWidth;
          const height = host.current.clientHeight;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host.current);
        resize();
        let mixer: AnimationMixer | null = null;
        if (gltf.animations[0]) {
          mixer = new THREE.AnimationMixer(gltf.scene);
          mixer.clipAction(gltf.animations[0]).play();
        }
        let frame = 0;
        let previous = performance.now();
        const render = (now: number) => {
          if (disposed) return;
          const delta = Math.min((now - previous) / 1000, 0.1);
          previous = now;
          if (playRef.current) mixer?.update(delta);
          materials.forEach((material) => {
            if ('wireframe' in material) material.wireframe = wireRef.current;
          });
          controls.update();
          renderer.render(scene, camera);
          frame = requestAnimationFrame(render);
        };
        frame = requestAnimationFrame(render);
        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          controls.dispose();
          mixer?.stopAllAction();
          mixer?.uncacheRoot(gltf.scene);
          releaseModel();
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
        };
        stats.materials = materials.size;
        stats.textures = textures.size;
        onStats(stats);
      } catch (cause) {
        if (!disposed) setError((cause as Error).message);
      } finally {
        objectUrls.forEach(URL.revokeObjectURL);
      }
    }
    void init();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [files, main, onStats]);
  const message = error?.startsWith('MISSING:')
    ? t('communityVisual.model.missing', { name: error.slice(8) })
    : error === 'WEBGL'
      ? t('communityVisual.model.webgl')
      : error === 'UNSUPPORTED'
        ? t('communityVisual.model.unsupported')
        : error
          ? t(`communityVisual.errors.${error}`, { defaultValue: error })
          : null;
  return (
    <div className="space-y-2">
      <div
        ref={host}
        role="img"
        aria-label={t('communityVisual.model.preview')}
        className="h-80 w-full touch-none overflow-hidden rounded-lg border bg-muted/30 md:h-96"
      />
      {message && (
        <p role="alert" className="break-all text-sm text-destructive">
          {t('communityVisual.failed', { msg: message })}
        </p>
      )}
    </div>
  );
}
