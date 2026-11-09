"use client";

import { useEffect, useRef } from "react";
import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  parseDesignScene,
  type DesignScene,
  type SceneMesh,
} from "@/lib/design/scene";
import { cn } from "@/lib/utils";

function meshGeometry(mesh: SceneMesh) {
  switch (mesh.type) {
    case "box":
      return new BoxGeometry(1, 1, 1);
    case "sphere":
      return new SphereGeometry(0.5, 32, 16);
    case "cylinder":
      return new CylinderGeometry(0.5, 0.5, 1, 32);
    case "plane":
      return new PlaneGeometry(1, 1);
  }
}

function buildScene(data: DesignScene): Scene {
  const scene = new Scene();
  scene.background = new Color(data.background ?? "#0f1115");

  for (const light of data.lights) {
    if (light.type === "ambient") {
      scene.add(
        new AmbientLight(light.color ?? "#ffffff", light.intensity ?? 0.4),
      );
      continue;
    }
    const directional = new DirectionalLight(
      light.color ?? "#ffffff",
      light.intensity ?? 1,
    );
    directional.position.set(...light.position);
    scene.add(directional);
  }

  for (const mesh of data.meshes) {
    const material = new MeshStandardMaterial({
      color: mesh.color ?? "#c4a574",
    });
    const object = new Mesh(meshGeometry(mesh), material);
    if (mesh.position) object.position.set(...mesh.position);
    if (mesh.rotation) object.rotation.set(...mesh.rotation);
    if (mesh.scale) object.scale.set(...mesh.scale);
    object.name = mesh.id;
    scene.add(object);
  }

  return scene;
}

export function SceneViewer({
  content,
  className,
}: {
  readonly content: string;
  readonly className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const parsed = parseDesignScene(content);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !parsed.ok) return;

    const width = host.clientWidth || 640;
    const height = host.clientHeight || 360;
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    host.replaceChildren(renderer.domElement);

    const scene = buildScene(parsed.scene);
    const camera = new PerspectiveCamera(
      parsed.scene.camera.fov ?? 45,
      width / height,
      0.1,
      1000,
    );
    camera.position.set(...parsed.scene.camera.position);
    camera.lookAt(...parsed.scene.camera.target);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...parsed.scene.camera.target);
    controls.enableDamping = true;

    let cancelled = false;
    if (parsed.scene.gltfUrl) {
      const loader = new GLTFLoader();
      loader.load(
        parsed.scene.gltfUrl,
        (gltf) => {
          if (!cancelled) scene.add(gltf.scene);
        },
        undefined,
        () => {
          // Leave primitives; glTF failure is non-fatal for the rest of the scene.
        },
      );
    }

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const nextWidth = host.clientWidth || width;
      const nextHeight = host.clientHeight || height;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      host.replaceChildren();
    };
  }, [parsed, content]);

  if (!parsed.ok) {
    return (
      <div
        className={cn(
          "text-destructive flex h-full items-center justify-center p-4 text-[13px]",
          className,
        )}
      >
        {parsed.error}
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className={cn("bg-foreground/[0.03] relative min-h-0 h-full w-full", className)}
      aria-label="3D scene viewer"
    />
  );
}
