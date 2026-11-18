"use client";

import { httpsPosterSrc, isHttpsGltfUrl } from "@/lib/json-render/model-3d";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export function Model3DViewer({
  src,
  title,
  caption,
  poster,
  autoRotate,
}: {
  readonly src: string;
  readonly title: string | null;
  readonly caption: string | null;
  readonly poster: string | null;
  readonly autoRotate: boolean | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const gltfSrc = isHttpsGltfUrl(src) ? src.trim() : null;
  const posterSrc = httpsPosterSrc(poster);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !gltfSrc) {
      setStatus("error");
      return;
    }

    setStatus("loading");
    const width = host.clientWidth || 320;
    const height = host.clientHeight || 240;
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    host.replaceChildren(renderer.domElement);

    const scene = new Scene();
    scene.background = new Color("#111318");
    scene.add(new AmbientLight("#ffffff", 0.7));
    const key = new DirectionalLight("#ffffff", 1.1);
    key.position.set(2, 4, 3);
    scene.add(key);

    const camera = new PerspectiveCamera(45, width / height, 0.01, 1000);
    camera.position.set(1.8, 1.2, 2.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = autoRotate !== false;
    controls.autoRotateSpeed = 1.2;

    let cancelled = false;
    let frame = 0;
    const loader = new GLTFLoader();
    loader.load(
      gltfSrc,
      (gltf) => {
        if (cancelled) return;
        const root = gltf.scene;
        scene.add(root);
        const box = new Box3().setFromObject(root);
        const size = box.getSize(new Vector3());
        const center = box.getCenter(new Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const dist = maxDim * 2.2;
        camera.position.set(center.x + dist * 0.7, center.y + dist * 0.45, center.z + dist);
        controls.target.copy(center);
        controls.update();
        setStatus("ready");
      },
      undefined,
      () => {
        if (!cancelled) setStatus("error");
      },
    );

    const tick = () => {
      frame = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      const nextW = host.clientWidth || width;
      const nextH = host.clientHeight || height;
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
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
  }, [gltfSrc, autoRotate]);

  if (!gltfSrc) {
    return (
      <div className="text-muted-foreground text-[13px]">
        Model needs an https .glb or .gltf URL.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-slot="model-3d">
      {title ? (
        <div className="text-foreground text-[15px] font-medium">{title}</div>
      ) : null}
      <div className="border-border/50 relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-[#111318]">
        {status === "loading" && posterSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterSrc}
            alt={title ?? "3D model"}
            className="absolute inset-0 z-10 h-full w-full object-cover"
          />
        ) : null}
        {status === "loading" ? (
          <div className="text-muted-foreground absolute inset-0 z-20 flex items-center justify-center text-[12px]">
            Loading model…
          </div>
        ) : null}
        {status === "error" ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 px-4 text-center">
            {posterSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterSrc}
                alt={title ?? "3D model"}
                className="max-h-32 rounded object-contain"
              />
            ) : null}
            <a
              href={gltfSrc}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground text-[12px] underline-offset-2 hover:underline"
            >
              Open model
            </a>
          </div>
        ) : null}
        <div
          ref={hostRef}
          className={cn(
            "absolute inset-0",
            status !== "ready" && "pointer-events-none opacity-0",
          )}
          aria-label={title ?? "3D model viewer"}
        />
      </div>
      {caption ? (
        <div className="text-muted-foreground text-[12px]">{caption}</div>
      ) : null}
    </div>
  );
}
