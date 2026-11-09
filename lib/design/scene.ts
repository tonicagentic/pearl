/**
 * Constrained 3D scene JSON for the canvas viewer. Unknown mesh types and
 * inline scripts are rejected; glTF is allowed only as an https URL.
 */

export type Vec3 = readonly [number, number, number];

export type SceneLight =
  | {
      readonly type: "ambient";
      readonly color?: string;
      readonly intensity?: number;
    }
  | {
      readonly type: "directional";
      readonly color?: string;
      readonly intensity?: number;
      readonly position: Vec3;
    };

export type SceneMeshType = "box" | "sphere" | "cylinder" | "plane";

export type SceneMesh = {
  readonly id: string;
  readonly type: SceneMeshType;
  readonly position?: Vec3;
  readonly rotation?: Vec3;
  readonly scale?: Vec3;
  readonly color?: string;
};

export type DesignScene = {
  readonly version: 1;
  readonly background?: string;
  readonly camera: {
    readonly position: Vec3;
    readonly target: Vec3;
    readonly fov?: number;
  };
  readonly lights: readonly SceneLight[];
  readonly meshes: readonly SceneMesh[];
  /** https URL only; set when the user supplied a model. */
  readonly gltfUrl?: string;
};

const MESH_TYPES = new Set<SceneMeshType>([
  "box",
  "sphere",
  "cylinder",
  "plane",
]);

function isVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

export type SceneParseResult =
  | { readonly ok: true; readonly scene: DesignScene }
  | { readonly ok: false; readonly error: string };

/** Parse and validate a `.scene.json` document. */
export function parseDesignScene(raw: string): SceneParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Scene JSON is not valid JSON." };
  }
  return validateDesignScene(data);
}

export function validateDesignScene(data: unknown): SceneParseResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "Scene must be a JSON object." };
  }
  const obj = data as Record<string, unknown>;
  if (obj.version !== 1) {
    return { ok: false, error: 'Scene version must be 1.' };
  }
  if (obj.background !== undefined && !isHexColor(obj.background)) {
    return { ok: false, error: "background must be a #RGB or #RRGGBB color." };
  }
  if (!obj.camera || typeof obj.camera !== "object" || Array.isArray(obj.camera)) {
    return { ok: false, error: "camera is required." };
  }
  const camera = obj.camera as Record<string, unknown>;
  if (!isVec3(camera.position) || !isVec3(camera.target)) {
    return { ok: false, error: "camera.position and camera.target must be [x,y,z]." };
  }
  if (
    camera.fov !== undefined &&
    (typeof camera.fov !== "number" || !Number.isFinite(camera.fov))
  ) {
    return { ok: false, error: "camera.fov must be a number." };
  }
  if (!Array.isArray(obj.lights) || obj.lights.length === 0) {
    return { ok: false, error: "lights must be a non-empty array." };
  }
  const lights: SceneLight[] = [];
  for (const light of obj.lights) {
    if (!light || typeof light !== "object" || Array.isArray(light)) {
      return { ok: false, error: "Each light must be an object." };
    }
    const l = light as Record<string, unknown>;
    if (l.type === "ambient") {
      if (l.color !== undefined && !isHexColor(l.color)) {
        return { ok: false, error: "ambient light color must be hex." };
      }
      lights.push({
        type: "ambient",
        color: typeof l.color === "string" ? l.color : undefined,
        intensity: typeof l.intensity === "number" ? l.intensity : undefined,
      });
      continue;
    }
    if (l.type === "directional") {
      if (!isVec3(l.position)) {
        return { ok: false, error: "directional light needs position [x,y,z]." };
      }
      if (l.color !== undefined && !isHexColor(l.color)) {
        return { ok: false, error: "directional light color must be hex." };
      }
      lights.push({
        type: "directional",
        position: l.position,
        color: typeof l.color === "string" ? l.color : undefined,
        intensity: typeof l.intensity === "number" ? l.intensity : undefined,
      });
      continue;
    }
    return { ok: false, error: `Unknown light type: ${String(l.type)}` };
  }

  if (!Array.isArray(obj.meshes)) {
    return { ok: false, error: "meshes must be an array." };
  }
  const meshes: SceneMesh[] = [];
  for (const mesh of obj.meshes) {
    if (!mesh || typeof mesh !== "object" || Array.isArray(mesh)) {
      return { ok: false, error: "Each mesh must be an object." };
    }
    const m = mesh as Record<string, unknown>;
    if (typeof m.id !== "string" || !m.id.trim()) {
      return { ok: false, error: "Each mesh needs a string id." };
    }
    if (typeof m.type !== "string" || !MESH_TYPES.has(m.type as SceneMeshType)) {
      return {
        ok: false,
        error: `Unknown mesh type "${String(m.type)}". Use box, sphere, cylinder, or plane.`,
      };
    }
    if (m.position !== undefined && !isVec3(m.position)) {
      return { ok: false, error: `mesh ${m.id}: position must be [x,y,z].` };
    }
    if (m.rotation !== undefined && !isVec3(m.rotation)) {
      return { ok: false, error: `mesh ${m.id}: rotation must be [x,y,z].` };
    }
    if (m.scale !== undefined && !isVec3(m.scale)) {
      return { ok: false, error: `mesh ${m.id}: scale must be [x,y,z].` };
    }
    if (m.color !== undefined && !isHexColor(m.color)) {
      return { ok: false, error: `mesh ${m.id}: color must be hex.` };
    }
    meshes.push({
      id: m.id,
      type: m.type as SceneMeshType,
      position: m.position as Vec3 | undefined,
      rotation: m.rotation as Vec3 | undefined,
      scale: m.scale as Vec3 | undefined,
      color: typeof m.color === "string" ? m.color : undefined,
    });
  }

  let gltfUrl: string | undefined;
  if (obj.gltfUrl !== undefined) {
    if (typeof obj.gltfUrl !== "string" || !/^https:\/\//i.test(obj.gltfUrl)) {
      return { ok: false, error: "gltfUrl must be an https URL when set." };
    }
    gltfUrl = obj.gltfUrl;
  }

  return {
    ok: true,
    scene: {
      version: 1,
      background: typeof obj.background === "string" ? obj.background : undefined,
      camera: {
        position: camera.position,
        target: camera.target,
        fov: typeof camera.fov === "number" ? camera.fov : undefined,
      },
      lights,
      meshes,
      gltfUrl,
    },
  };
}
