// Phase 3 scalar CT and reconstruction views. Voxel indices address centers;
// the manifest and the NRRD header describe the same affine in RAS millimeters.
const MAX_HEADER_BYTES = 16 * 1024;
const MAX_VOLUME_BYTES = 256 * 1024 * 1024;
const AXES = {
  sagittal: { axis: 0, normal: [1, 0, 0], right: [0, 1, 0], up: [0, 0, 1] },
  coronal: { axis: 1, normal: [0, 1, 0], right: [1, 0, 0], up: [0, 0, 1] },
  axial: { axis: 2, normal: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] },
};
const TYPES = { int16: Int16Array, short: Int16Array, float: Float32Array, float32: Float32Array };

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => a.map((value, i) => value - b[i]);
const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
const finiteVector = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

function normalize(v) {
  if (!finiteVector(v)) throw new Error("invalid plane vector");
  const length = Math.hypot(...v);
  if (!Number.isFinite(length) || length < 1e-10) throw new Error("invalid plane vector");
  return v.map(value => value / length);
}

function transform(matrix, p) {
  return matrix.slice(0, 3).map(row => dot(row, p) + row[3]);
}

function inverseAffine(matrix) {
  const [a, b, c] = [0, 1, 2].map(i => matrix.slice(0, 3).map(row => row[i]));
  const rows = [cross(b, c), cross(c, a), cross(a, b)];
  const det = dot(a, rows[0]);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-10) throw new Error("singular volume affine");
  const origin = matrix.slice(0, 3).map(row => row[3]);
  return rows.map(row => [...row.map(value => value / det), -dot(row, origin) / det]);
}

function nrrdHeader(bytes) {
  const cap = Math.min(bytes.length, MAX_HEADER_BYTES);
  let end = -1, offset;
  for (let i = 0; i + 1 < cap; i++) {
    if (bytes[i] === 10 && bytes[i + 1] === 10) {
      end = i;
      offset = i + 2;
      break;
    }
    if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) {
      end = i;
      offset = i + 4;
      break;
    }
  }
  if (end < 0) throw new Error("invalid or oversized NRRD header");
  const [signature, ...lines] = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, end)).split(/\r?\n/);
  if (!/^NRRD000[1-5]$/.test(signature)) throw new Error("not a supported NRRD file");
  const fields = new Map();
  for (const line of lines) {
    if (!line.trim() || line.startsWith("#")) continue;
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (!match) throw new Error("invalid NRRD header field");
    const key = match[1].trim().toLowerCase();
    if (fields.has(key)) throw new Error(`duplicate NRRD field ${key}`);
    fields.set(key, match[2].trim());
  }
  return { fields, payload: bytes.subarray(offset) };
}

function headerVectors(value, count) {
  const parts = value?.match(/\([^()]+\)/g) || [];
  const vectors = parts.map(part => part.slice(1, -1).split(",").map(v => v.trim() ? Number(v) : NaN));
  if (vectors.length !== count || value.replace(/\([^()]+\)/g, "").trim() || !vectors.every(finiteVector)) {
    throw new Error("invalid NRRD space directions or origin");
  }
  return vectors;
}

async function unpack(payload, encoding, length, signal) {
  if (encoding === "raw") {
    if (payload.length !== length) throw new Error("NRRD payload length does not match its dimensions");
    return payload.slice().buffer;
  }
  if (encoding !== "gzip" && encoding !== "gz") throw new Error("unsupported NRRD encoding");
  if (!globalThis.DecompressionStream) throw new Error("this browser cannot decompress NRRD gzip");
  const reader = new Blob([payload]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const output = new Uint8Array(length);
  let written = 0, complete = false;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      if (written + value.length > length) throw new Error("NRRD expands beyond its declared dimensions");
      output.set(value, written);
      written += value.length;
    }
    if (written !== length) throw new Error("NRRD payload length does not match its dimensions");
    complete = true;
    return output.buffer;
  } finally {
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function parseVolumeNrrd(buffer, geometry, { signal } = {}) {
  signal?.throwIfAborted();
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength > MAX_VOLUME_BYTES) throw new Error("NRRD exceeds the supported volume size");
  const { fields, payload } = nrrdHeader(new Uint8Array(buffer));
  const get = name => fields.get(name)?.toLowerCase();
  const Scalar = Object.hasOwn(TYPES, get("type")) ? TYPES[get("type")] : null;
  if (get("dimension") !== "3" || get("space") !== "right-anterior-superior" ||
      get("endian") !== "little" || !Scalar || ["data file", "datafile", "byte skip", "line skip"].some(key => fields.has(key))) {
    throw new Error("expected an inline 3D little-endian RAS int16 or float32 NRRD");
  }
  if (fields.has("space units") && !/^"mm"\s+"mm"\s+"mm"$/.test(get("space units"))) {
    throw new Error("NRRD space units must be millimeters");
  }
  const shape = get("sizes")?.split(/\s+/).map(Number);
  if (shape?.length !== 3 || !shape.every(n => Number.isSafeInteger(n) && n > 0)) throw new Error("invalid NRRD dimensions");
  const length = shape.reduce((a, b) => a * b, Scalar.BYTES_PER_ELEMENT);
  if (!Number.isSafeInteger(length) || length > MAX_VOLUME_BYTES) throw new Error("decoded volume exceeds the 256 MiB limit");
  const directions = headerVectors(fields.get("space directions"), 3);
  const [origin] = headerVectors(fields.get("space origin"), 1);
  const voxelToMm = origin.map((offset, i) => [...directions.map(direction => direction[i]), offset]);
  voxelToMm.push([0, 0, 0, 1]);
  const mmToVoxel = inverseAffine(voxelToMm);
  const manifestAffine = geometry?.voxel_to_world;
  if (geometry?.axes !== "RAS" || geometry.units !== "mm" || geometry.shape?.length !== 3 ||
      !shape.every((n, i) => n === geometry.shape?.[i]) || manifestAffine?.length !== 4 ||
      !voxelToMm.every((row, i) => Array.isArray(manifestAffine[i]) && manifestAffine[i].length === 4 &&
        row.every((value, j) => Math.abs(value - manifestAffine[i][j]) <= 1e-5 && Number.isFinite(manifestAffine[i][j])))) {
    throw new Error("NRRD geometry does not match the manifest");
  }
  const storage = await unpack(payload, get("encoding"), length, signal);
  signal?.throwIfAborted();
  const data = new Scalar(storage); // Supported browser/host platforms use little-endian typed arrays.
  if (data instanceof Float32Array && !data.every(Number.isFinite)) throw new Error("NRRD contains non-finite intensities");
  const corners = [];
  for (const i of [-0.5, shape[0] - 0.5]) {
    for (const j of [-0.5, shape[1] - 0.5]) {
      for (const k of [-0.5, shape[2] - 0.5]) corners.push(transform(voxelToMm, [i, j, k]));
    }
  }
  const bounds = [0, 1, 2].map(i => {
    const values = corners.map(p => p[i]);
    return [Math.min(...values), Math.max(...values)];
  });
  return { data, shape, voxelToMm, mmToVoxel, corners, bounds };
}

// get(path, signal) must return an ArrayBuffer or null for a missing file.
// The Phase 2 manifest has already passed the mesh/sidecar gate when called.
export async function loadVolume({ manifest, get, signal }) {
  const volumes = manifest?.assets?.filter(asset => asset.role === "volume") || [];
  if (!volumes.length) return null;
  const [entry] = volumes;
  if (volumes.length !== 1 || entry.path !== "volume.nrrd" ||
      !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || entry.bytes > MAX_VOLUME_BYTES ||
      typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
    throw new Error("invalid or oversized volume entry in bundle manifest");
  }
  signal?.throwIfAborted();
  const buffer = await get(entry.path, signal);
  signal?.throwIfAborted();
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== entry.bytes) throw new Error("bundle volume missing or size mismatch");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  const hex = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  if (hex !== entry.sha256) throw new Error("bundle volume failed its hash check");
  return parseVolumeNrrd(buffer, manifest.geometry, { signal });
}

function sampleIndex(volume, x, y, z) {
  const [nx, ny, nz] = volume.shape;
  if (x < -0.5 || y < -0.5 || z < -0.5 || x > nx - 0.5 || y > ny - 0.5 || z > nz - 0.5) return null;
  x = clamp(x, 0, nx - 1);
  y = clamp(y, 0, ny - 1);
  z = clamp(z, 0, nz - 1);
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const sx = i === nx - 1 ? 0 : 1, sy = j === ny - 1 ? 0 : nx, sz = k === nz - 1 ? 0 : nx * ny;
  const p = i + nx * (j + ny * k), { data } = volume;
  const lerp = (a, b, t) => a + (b - a) * t;
  const xy = q => lerp(lerp(data[q], data[q + sx], x - i), lerp(data[q + sy], data[q + sy + sx], x - i), y - j);
  return lerp(xy(p), xy(p + sz), z - k);
}

export function sampleVolume(volume, pointMm) {
  return sampleIndex(volume, ...transform(volume.mmToVoxel, pointMm));
}

export function orthogonalPlane(volume, axis, coordinateMm) {
  if (!Object.hasOwn(AXES, axis)) throw new Error(`unknown slice axis ${axis}`);
  const specification = AXES[axis];
  const originMm = volume.bounds.map(([a, b]) => (a + b) / 2);
  if (Number.isFinite(coordinateMm)) originMm[specification.axis] = clamp(coordinateMm, ...volume.bounds[specification.axis]);
  return { originMm, normal: specification.normal.slice(), axis };
}

export function sliceFrame(volume, plane, maxSize = 192) {
  if (!finiteVector(plane?.originMm)) throw new Error("invalid slice origin");
  const origin = plane.originMm, normal = normalize(plane.normal);
  const basis = Object.hasOwn(AXES, plane.axis) ? AXES[plane.axis] : null;
  const right = basis?.right || normalize(cross(Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0], normal));
  const up = basis?.up || cross(normal, right);
  const points = volume.corners.map(p => sub(p, origin));
  const horizontal = points.map(p => dot(p, right)), vertical = points.map(p => dot(p, up));
  const left = Math.min(...horizontal), top = Math.max(...vertical);
  const limit = Number.isFinite(maxSize) ? clamp(Math.floor(maxSize), 2, 512) : 192;
  const step = Math.max(Math.max(...horizontal) - left, top - Math.min(...vertical)) / limit;
  const width = Math.max(1, Math.ceil((Math.max(...horizontal) - left) / step));
  const height = Math.max(1, Math.ceil((top - Math.min(...vertical)) / step));
  const start = origin.map((v, i) => v + right[i] * (left + step / 2) + up[i] * (top - step / 2));
  return {
    width, height, start, right, up, step,
    project(pointMm) {
      const d = sub(pointMm, origin);
      return [(dot(d, right) - left) / step, (top - dot(d, up)) / step];
    },
  };
}

// Render on demand; callers can request all three panels and the active cut.
// Optional mesh contours use patient-mm endpoint pairs in the same projection.
export function drawSlice(canvas, volume, plane, { center = 40, width = 400, maxSize = 192, segments = [] } = {}) {
  if (!Number.isFinite(center) || !Number.isFinite(width) || width <= 0) throw new Error("invalid volume window/level");
  const frame = sliceFrame(volume, plane, maxSize);
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("slice canvas is unavailable");
  const pixels = ctx.createImageData(frame.width, frame.height);
  const origin = transform(volume.mmToVoxel, frame.start);
  const dx = volume.mmToVoxel.map(row => dot(row, frame.right) * frame.step);
  const dy = volume.mmToVoxel.map(row => -dot(row, frame.up) * frame.step);
  const low = center - width / 2;
  let offset = 0;
  for (let y = 0; y < frame.height; y++) {
    let vx = origin[0] + y * dy[0], vy = origin[1] + y * dy[1], vz = origin[2] + y * dy[2];
    for (let x = 0; x < frame.width; x++) {
      const value = sampleIndex(volume, vx, vy, vz);
      const grey = value === null ? 0 : clamp((value - low) / width, 0, 1) * 255;
      pixels.data[offset++] = grey;
      pixels.data[offset++] = grey;
      pixels.data[offset++] = grey;
      pixels.data[offset++] = 255;
      vx += dx[0];
      vy += dx[1];
      vz += dx[2];
    }
  }
  ctx.putImageData(pixels, 0, 0);
  if (segments.length) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#56e4ff";
    ctx.beginPath();
    for (const [a, b] of segments) {
      ctx.moveTo(...frame.project(a));
      ctx.lineTo(...frame.project(b));
    }
    ctx.stroke();
  }
  return frame;
}

const VERTEX = `
out vec3 boxPoint;
flat out vec3 localCamera;
flat out vec3 localDirection;
void main() {
  mat4 inverseModelView = inverse(modelViewMatrix);
  boxPoint = position;
  localCamera = (inverseModelView * vec4(0., 0., 0., 1.)).xyz;
  localDirection = (inverseModelView * vec4(0., 0., -1., 0.)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;

const FRAGMENT = `
#ifdef JAS_INT16
uniform highp isampler3D voxels;
#else
uniform highp sampler3D voxels;
#endif
uniform vec3 shape;
uniform mat4 boxToMm;
uniform vec4 cutPlane;
uniform bool useCut;
uniform vec2 windowRange;
uniform float opacity;
in vec3 boxPoint;
flat in vec3 localCamera;
flat in vec3 localDirection;
out vec4 color;

void main() {
  vec3 ray = normalize(isOrthographic ? localDirection : boxPoint - localCamera);
  vec3 start = isOrthographic ? boxPoint - ray * 2. : localCamera;
  vec3 safeRay = mix(vec3(-1.), vec3(1.), step(vec3(0.), ray)) * max(abs(ray), 1.e-7);
  vec3 a = -start / safeRay;
  vec3 b = (1. - start) / safeRay;
  vec3 lo = min(a, b), hi = max(a, b);
  float nearT = max(max(max(lo.x, lo.y), lo.z), 0.);
  float farT = min(min(hi.x, hi.y), hi.z);
  if (farT <= nearT || opacity <= 0.) discard;
  if (useCut) {
    float signedStart = dot(cutPlane, boxToMm * vec4(start, 1.));
    float slope = dot(cutPlane, boxToMm * vec4(ray, 0.));
    if (abs(slope) < 1.e-6) {
      if (signedStart < 0.) discard;
    } else if (slope > 0.) {
      nearT = max(nearT, -signedStart / slope);
    } else {
      farT = min(farT, -signedStart / slope);
    }
    if (farT <= nearT) discard;
  }
  float travel = farT - nearT;
  // Approximately one sample per voxel along the ray, capped for interaction.
  float steps = clamp(ceil(length(ray * shape) * travel), 1., 384.);
  float delta = travel / steps;
  vec4 accumulated = vec4(0.);
  for (int i = 0; i < 384; ++i) {
    if (float(i) >= steps || accumulated.a >= 0.985) break;
    vec3 p = start + ray * (nearT + (float(i) + 0.5) * delta);
    float value = float(texture(voxels, clamp(p, 0., 1.)).r);
    float grey = clamp((value - windowRange.x) / windowRange.y, 0., 1.);
    float contribution = (1. - accumulated.a) * (1. - exp(-grey * grey * opacity * delta * 12.));
    accumulated.rgb += vec3(grey) * contribution;
    accumulated.a += contribution;
  }
  if (accumulated.a < 0.002) discard;
  color = vec4(accumulated.rgb / accumulated.a, accumulated.a);
}`;

// Parent root to the shared patient-mm frame. The renderer composites this
// transparent research overlay with board meshes. It is never a raycast target.
export function createVolumeView(THREE, volume, { renderer } = {}) {
  const gl = renderer?.getContext();
  if (!renderer?.capabilities.isWebGL2 || !gl || gl.isContextLost()) throw new Error("3D volume requires WebGL2");
  const maximum = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
  if (!Number.isFinite(maximum) || volume.shape.some(n => n > maximum)) throw new Error("volume exceeds this GPU's 3D texture dimensions");
  const int16 = volume.data instanceof Int16Array;
  const texture = new THREE.Data3DTexture(volume.data, ...volume.shape);
  texture.format = int16 ? THREE.RedIntegerFormat : THREE.RedFormat;
  texture.type = int16 ? THREE.ShortType : THREE.FloatType;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  // Upload inside the caller's error boundary. Three.js normally waits until
  // draw time, where a failed allocation could leave an empty "3D volume" view.
  try {
    for (let i = 0; i < 8 && gl.getError() !== gl.NO_ERROR; i++) { /* clear prior draw errors */ }
    renderer.initTexture(texture);
    if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR) throw new Error("GPU could not upload this CT volume");
  } catch (error) {
    texture.dispose();
    throw error;
  }
  const boxToMm = new THREE.Matrix4().set(...volume.voxelToMm.flat())
    .multiply(new THREE.Matrix4().makeTranslation(-0.5, -0.5, -0.5))
    .scale(new THREE.Vector3(...volume.shape));
  const geometry = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5);
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: FRAGMENT,
    defines: int16 ? { JAS_INT16: 1 } : {},
    side: THREE.BackSide, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {
      voxels: { value: texture }, boxToMm: { value: boxToMm },
      shape: { value: new THREE.Vector3(...volume.shape) },
      useCut: { value: false }, cutPlane: { value: new THREE.Vector4() },
      windowRange: { value: new THREE.Vector2(-160, 400) }, opacity: { value: 0.65 },
    },
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(boxToMm);
  mesh.renderOrder = -1;
  mesh.raycast = () => {};
  const root = new THREE.Group();
  root.name = "JAS volume";
  root.userData.phase3Volume = true;
  mesh.userData.phase3Volume = true;
  root.add(mesh);
  root.visible = false;
  return {
    root,
    setMode(mode) { root.visible = mode === "volume"; },
    setWindowLevel(center, width) {
      if (!Number.isFinite(center) || !Number.isFinite(width) || width <= 0) throw new Error("invalid volume window/level");
      material.uniforms.windowRange.value.set(center - width / 2, width);
    },
    setOpacity(value) {
      if (!Number.isFinite(value)) throw new Error("invalid volume opacity");
      material.uniforms.opacity.value = clamp(value, 0, 1);
    },
    setCut(plane) {
      if (plane) {
        if (!finiteVector(plane.originMm)) throw new Error("invalid cut origin");
        const normal = normalize(plane.normal);
        material.uniforms.cutPlane.value.set(...normal, -dot(normal, plane.originMm));
      }
      material.uniforms.useCut.value = Boolean(plane);
    },
    dispose() {
      root.removeFromParent();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
