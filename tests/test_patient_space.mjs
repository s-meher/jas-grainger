/* Phase 3 geometry and selection with the exact Three.js version used by
 * stage.html. For offline runs, set THREE_MODULE to a local r160 .mjs file. */
import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  legacyCutToPatientPlane, patientPlaneAtDepth, patientPlaneToGroup,
  patientPlaneToScene, patientToSceneMatrix, scenePlaneToPatient, sceneToPatientMatrix,
} from "../js/medical/patient-space.js";
import { castStructure, mergeSelections, pointToNdc, selectScene, videoToBoard }
  from "../js/medical/selection.js";

async function loadThree() {
  if (process.env.THREE_MODULE) return import(pathToFileURL(resolve(process.env.THREE_MODULE)));
  const res = await fetch("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js");
  if (!res.ok) throw new Error("Could not download Three.js r160: " + res.status);
  const source = Buffer.from(await res.arrayBuffer()).toString("base64");
  return import("data:text/javascript;base64," + source);
}
const T = await loadThree();
assert.equal(T.REVISION, "160");
const vec = (x, y, z) => new T.Vector3(x, y, z);
const same = (a, b, epsilon = 1e-9) => {
  assert.equal(a.length, b.length);
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < epsilon, a + " vs " + b));
};
const identity = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];

function setup(worldToModel = identity) {
  const scene = new T.Scene();
  const group = new T.Group();
  const obj = new T.Group();
  scene.add(group);
  group.add(obj);
  const camera = new T.PerspectiveCamera(40, 1, 0.01, 200);
  camera.position.z = 50;
  const geometry = {
    world_to_model: worldToModel,
    bounds_mm: { min: [-30, 10, -40], max: [50, 70, 160] },
  };
  const patientRoot = new T.Group();
  patientRoot.matrixAutoUpdate = false;
  patientRoot.matrix.set(...worldToModel.flat());
  obj.add(patientRoot);
  const bundle = { patientRoot, revision: "revision-a", manifest: { geometry } };
  const med = { src: "/media/models/phantom/model.glb", idx: { meshSid: new Map() }, structs: {} };
  return { THREE: T, scene, group, bundle, camera, med, obj };
}

test("patient coordinates round-trip through a transformed, reflected model", () => {
  // Now the GLB's local frame differs from patient space, and the board
  // wraps it in a translated, rotated, non-uniformly scaled group.
  const sc = setup([[0,2,0,4], [0,0,3,-7], [-1,0,0,9], [0,0,0,1]]);
  sc.scene.position.set(2, 4, 6);
  sc.group.rotation.set(0.2, -0.5, 0.7);
  sc.group.scale.set(0.05, 0.8, 1.7);
  sc.obj.position.set(-12, 5, 3);
  const input = vec(12, 16, -4);
  const scene = input.clone().applyMatrix4(patientToSceneMatrix(sc));
  same(scene.clone().applyMatrix4(sceneToPatientMatrix(sc)).toArray(), input.toArray());
  const modelPoint = vec(36, -19, -3);
  same(scene.toArray(), sc.obj.localToWorld(modelPoint).toArray());
});

test("patient planes retain coplanarity and cut side through scale and rotation", () => {
  const sc = setup([[0,2,0,0], [0,0,4,0], [-1,0,0,3], [0,0,0,1]]);
  sc.group.rotation.set(0.2, 0.6, -0.9);
  sc.group.scale.set(0.25, 0.6, 1.5);
  sc.obj.position.set(15, -4, 7);
  const cut = { originMm: [13, 29, 48], normal: [1, 1, 0] };
  const scenePlane = patientPlaneToScene(sc, cut);
  const transform = patientToSceneMatrix(sc);
  const pointOn = vec(13, 29, 48).applyMatrix4(transform);
  const pointOutside = vec(12, 28, 48).applyMatrix4(transform);
  assert.ok(Math.abs(scenePlane.distanceToPoint(pointOn)) < 1e-9);
  assert.ok(scenePlane.distanceToPoint(pointOutside) < 0);
  const inGroup = sc.group.worldToLocal(pointOn.clone());
  assert.ok(Math.abs(patientPlaneToGroup(sc, cut).distanceToPoint(inGroup)) < 1e-9);
  const roundTrip = scenePlaneToPatient(sc, scenePlane);
  same(roundTrip.normal, [Math.SQRT1_2, Math.SQRT1_2, 0]);
  assert.ok(Math.abs(roundTrip.originMm[0] + roundTrip.originMm[1] - 42) < 1e-9);
});

test("legacy presets and normalized custom cuts map to patient millimeters", () => {
  const sc = setup();
  sc.obj.position.set(-10, -40, -60);
  sc.group.rotation.z = 0.75;
  const bounds = new T.Box3(vec(-40, -30, -100), vec(40, 30, 100));
  same(legacyCutToPatientPlane(sc, { plane: "sagittal", t: 0.25 }, bounds).originMm,
    [30, 40, 60]);
  same(legacyCutToPatientPlane(sc, { plane: "axial", t: 1 }, bounds).originMm,
    [10, 40, 160]);
  const custom = legacyCutToPatientPlane(sc, { plane: { o: [0.5, 0, 0], n: [1, 0, 0] } }, bounds);
  same(custom.normal, [1, 0, 0]);
  assert.ok(Math.abs(custom.originMm[0] - 30) < 1e-9);
  const swept = patientPlaneAtDepth(sc, { originMm: [0, 0, 0], normal: [1, 1, 0] }, 1);
  assert.ok(Math.abs(swept.originMm[0] + swept.originMm[1] - 120) < 1e-9);
  assert.equal(legacyCutToPatientPlane(sc, { plane: { o: [0], n: [1, 0, 0] } }, bounds), null);
  assert.equal(patientPlaneToScene(sc, { originMm: [0, 0, 0], normal: [0, 0, 0] }), null);
});

test("mirrored cover crop maps hands to the correct CSS canvas after resize", () => {
  const video = { width: 1920, height: 1080 };
  const view = { left: 100, top: 60, width: 600, height: 600 };
  const canvas = { left: 200, top: 210, width: 400, height: 300 };
  const centered = videoToBoard({ x: 0.5, y: 0.5 }, video, view);
  same(Object.values(centered), [400, 360]);
  same(Object.values(pointToNdc(centered, canvas)), [0, 0]);
  const right = videoToBoard({ x: 0.4, y: 0.5 }, video, view);
  const left = videoToBoard({ x: 0.6, y: 0.5 }, video, view);
  assert.ok(pointToNdc(right, canvas).x > 0);
  assert.ok(pointToNdc(left, canvas).x < 0);
  const resized = { left: 180, top: 140, width: 800, height: 400 };
  const board = videoToBoard({ x: 0.4, y: 0.5 }, video, resized);
  same(Object.values(board), [660, 340]);
  assert.equal(pointToNdc(board, canvas), null);
  assert.equal(videoToBoard({ x: 0.5, y: 0.5 }, { width: 0, height: 0 }, view), null);
});

test("card ordering only wins inside the actual model canvas", () => {
  const stack = { children: [] };
  const outer = { left: 0, top: 0, width: 100, height: 100 };
  const makeScene = rect => {
    const card = { isConnected: true, parentElement: stack, getBoundingClientRect: () => outer };
    stack.children.push(card);
    const canvas = { parentElement: card, getBoundingClientRect: () => rect };
    return { med: { idx: {} }, canvas };
  };
  const low = makeScene(outer);
  const high = makeScene({ left: 20, top: 20, width: 40, height: 40 });
  assert.equal(selectScene([low, high], { x: 10, y: 10 }).sc, low);
  assert.deepEqual(selectScene([high, low], { x: 40, y: 40 }), { sc: high, ndc: { x: 0, y: 0 } });
});

function addMesh(sc, id, z) {
  const mesh = new T.Mesh(new T.PlaneGeometry(6,6), new T.MeshBasicMaterial());
  mesh.name = id + "_mesh";
  mesh.position.z = z;
  sc.obj.add(mesh);
  sc.med.idx.meshSid.set(mesh, id);
  return mesh;
}

test("pick reports hit point, depth and review status, skips caps/hidden/clipped anatomy", () => {
  const sc = setup();
  sc.obj.position.x = 2;
  const front = addMesh(sc, "liver", 5);
  addMesh(sc, "tumor", 2);
  sc.med.structs.liver = { teaching_reference: { review_status: "pending_review" } };
  const cap = addMesh(sc, "synthetic_cap", 6);
  sc.med.idx.meshSid.delete(cap);
  const center = { x: 0, y: 0 };
  let result = castStructure(sc, center);
  assert.equal(result.structure, "liver");
  assert.equal(result.teachingStatus, "pending_review");
  assert.equal(result.bundleRevision, "revision-a");
  assert.equal(result.depthMm, 45);
  assert.equal(result.gapMm, 3);
  same(result.pointMm, [-2, 0, 5]);

  front.visible = false;
  assert.equal(castStructure(sc, center).structure, "tumor");
  sc.med.plane = new T.Plane(vec(0, 0, 1), -3);
  result = castStructure(sc, center);
  assert.equal(result.status, "clipped");
  assert.equal(result.structure, undefined);
  sc.med.plane = null;
  sc.obj.visible = false;
  assert.equal(castStructure(sc, center).status, "hidden");
});

test("near-coincident surfaces and disagreeing hands publish ambiguity without a name", () => {
  const sc = setup();
  addMesh(sc, "liver", 5);
  addMesh(sc, "tumor", 4.8);
  const ambiguous = castStructure(sc, { x: 0, y: 0 });
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(ambiguous.structure, undefined);
  assert.deepEqual(ambiguous.candidates, ["liver", "tumor"]);
  const liver = { status: "hit", model: "model.glb", bundleRevision: "revision-a", structure: "liver" };
  assert.equal(mergeSelections([liver, liver]), liver);
  assert.equal(mergeSelections([liver, { ...liver, bundleRevision: "revision-b" }]).ambiguous, true);
  assert.equal(mergeSelections([ambiguous, liver]).structure, undefined);
});
