/* A hand landmark and a model canvas meet in CSS client pixels. Device
 * pixel ratio affects the drawing buffer and never this coordinate chain. */
import { sceneToPatientMatrix } from "./patient-space.js";

export function videoToBoard(landmark, video, rect, { mirror = true } = {}) {
  const { width, height } = video;
  if (!(width > 0 && height > 0 && rect.width > 0 && rect.height > 0) ||
      !Number.isFinite(landmark?.x) || !Number.isFinite(landmark?.y)) return null;
  const scale = Math.max(rect.width / width, rect.height / height);
  const drawnWidth = width * scale, drawnHeight = height * scale;
  return {
    x: rect.left + (rect.width - drawnWidth) / 2 + (mirror ? 1 - landmark.x : landmark.x) * drawnWidth,
    y: rect.top + (rect.height - drawnHeight) / 2 + landmark.y * drawnHeight,
  };
}

export function pointToNdc(point, rect) {
  if (!(rect?.width > 0 && rect.height > 0) ||
      !Number.isFinite(point?.x) || !Number.isFinite(point.y)) return null;
  const nx = (point.x - rect.left) / rect.width;
  const ny = (point.y - rect.top) / rect.height;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  return { x: nx * 2 - 1, y: 1 - ny * 2 };
}

export function selectScene(scenes, point) {
  let top = null, topOrder = -1;
  for (const sc of scenes) {
    const canvas = sc.canvas;
    const card = canvas?.parentElement;
    if (!sc.med?.idx || !card?.isConnected) continue;
    const rect = canvas.getBoundingClientRect?.() ?? card.getBoundingClientRect();
    const ndc = pointToNdc(point, rect);
    if (!ndc) continue;
    // A grab brings its card to the end of the stage's sibling list.
    const order = card.parentElement
      ? Array.prototype.indexOf.call(card.parentElement.children, card)
      : 0;
    if (order > topOrder) { top = { sc, ndc }; topOrder = order; }
  }
  return top;
}

function hidden(hit) {
  for (let p = hit.object; p; p = p.parent) if (p.visible === false) return true;
  const paints = hit.object.material;
  const paint = Array.isArray(paints) ? paints[hit.face?.materialIndex] : paints;
  return paint?.visible === false || (paint?.transparent && paint.opacity === 0);
}

const AMBIGUITY_MM = 0.5;  // engineering threshold for indistinguishable front surfaces

/** Give nearby, visible anatomical surfaces priority over a guess.
 * The mesh index excludes controls, volume proxy meshes and cut caps. */
export function castStructure(sc, ndc, { raycaster } = {}) {
  const M = sc.med, bundle = sc.bundle;
  const model = M?.src.split("/").pop()?.split("?")[0];
  const target = bundle ? { model, bundleRevision: bundle.revision } : { model };
  if (!M?.idx || !ndc) return { status: "miss", ...target };
  const ray = raycaster ?? new sc.THREE.Raycaster();
  sc.scene.updateMatrixWorld?.(true);
  sc.camera.updateWorldMatrix?.(true, false);
  ray.setFromCamera(ndc, sc.camera);
  const hits = ray.intersectObjects([...M.idx.meshSid.keys()], false);
  let front, rear, sawHidden = false, sawClipped = false;
  for (const hit of hits) {
    const id = M.idx.meshSid.get(hit.object);
    if (id === undefined) continue;
    if (hidden(hit)) { sawHidden = true; continue; }
    if (M.plane?.distanceToPoint(hit.point) < -1e-8) { sawClipped = true; continue; }
    if (!front) front = { hit, id };
    else if (id !== front.id) { rear = { hit, id }; break; }
  }
  if (!front) return { status: sawClipped ? "clipped" : sawHidden ? "hidden" : "miss", ...target };
  const picked = { status: "hit", ...target, structure: front.id, mesh: front.hit.object.name || "" };
  if (!bundle) return picked;

  const sceneToMm = sceneToPatientMatrix(sc);
  const point = front.hit.point.clone().applyMatrix4(sceneToMm);
  if (rear) {
    const rearPoint = rear.hit.point.clone().applyMatrix4(sceneToMm);
    const gap = point.distanceTo(rearPoint);
    if (gap <= AMBIGUITY_MM)
      return { status: "ambiguous", ...target, ambiguous: true, candidates: [front.id, rear.id] };
    picked.gapMm = gap;
  }
  picked.pointMm = point.toArray();
  picked.depthMm = point.distanceTo(ray.ray.origin.clone().applyMatrix4(sceneToMm));
  const structure = M.structs[front.id];
  picked.teachingStatus = structure?.teach?.function ? "verified"
    : structure?.teaching_reference?.review_status ?? "unavailable";
  return picked;
}

export function mergeSelections(selections) {
  const hits = selections.filter(s => s?.structure && (s.status === "hit" || s.status == null));
  const ambiguous = selections.find(s => s?.ambiguous);
  const identities = new Set(hits.map(s => JSON.stringify([s.bundleRevision ?? s.model, s.structure])));
  if (ambiguous || identities.size > 1) {
    const candidates = new Set(hits.map(s => s.structure));
    for (const s of selections) if (s?.ambiguous) s.candidates.forEach(id => candidates.add(id));
    const model = ambiguous?.model ?? hits[0].model;
    const revisions = new Set(selections.map(s => s?.bundleRevision));
    return { status: "ambiguous", ambiguous: true, model, candidates: [...candidates],
      ...(revisions.size === 1 && selections[0].bundleRevision ? {bundleRevision: selections[0].bundleRevision} : {}) };
  }
  return hits[0] ?? selections.find(s => s && s.status !== "miss") ?? null;
}
