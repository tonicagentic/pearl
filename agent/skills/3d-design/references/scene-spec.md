# Scene JSON spec

A `.scene.json` file is a JSON object:

```json
{
  "version": 1,
  "background": "#0f1115",
  "camera": {
    "position": [3, 2, 5],
    "target": [0, 0, 0],
    "fov": 45
  },
  "lights": [
    { "type": "ambient", "color": "#ffffff", "intensity": 0.4 },
    {
      "type": "directional",
      "color": "#ffffff",
      "intensity": 1,
      "position": [4, 6, 2]
    }
  ],
  "meshes": [
    {
      "id": "ground",
      "type": "plane",
      "position": [0, 0, 0],
      "rotation": [-1.5708, 0, 0],
      "scale": [6, 6, 1],
      "color": "#2a2f3a"
    },
    {
      "id": "hero",
      "type": "box",
      "position": [0, 0.5, 0],
      "rotation": [0, 0.4, 0],
      "scale": [1, 1, 1],
      "color": "#c4a574"
    }
  ]
}
```

## Fields

- `version` — must be `1`.
- `background` — CSS hex color.
- `camera.position` / `camera.target` — `[x, y, z]` numbers.
- `camera.fov` — degrees, optional (default 45).
- `lights[]` — `ambient` or `directional`; directional needs `position`.
- `meshes[]` — `type`: `box` | `sphere` | `cylinder` | `plane`.
  Optional `position`, `rotation` (radians), `scale`, `color`.
- Optional `gltfUrl` — https URL only when the user supplied the model.

Reject unknown mesh types and inline scripts. The canvas viewer builds Three.js
meshes from this data and never evaluates scene content as code.
