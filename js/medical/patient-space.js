/* RAS+ millimeters are independent of the board's fit, zoom, and rotation.
 * Three.js receives the complete affine so plane normals are transformed
 * correctly even when the source and display axes have different scales. */

const RAS_NORMALS = {
  sagittal: [-1, 0, 0],
  coronal: [0, 1, 0],
  axial: [0, 0, 1],
};

function finiteTriple(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

export function patientToSceneMatrix(sc) {
  const root = sc.bundle.patientRoot;
  root.updateWorldMatrix(true, false);
  return root.matrixWorld.clone();
}

export function sceneToPatientMatrix(sc) {
  return patientToSceneMatrix(sc).invert();
}

function asThreePlane(T, plane) {
  if (!finiteTriple(plane?.originMm) || !finiteTriple(plane.normal)) return null;
  const normal = new T.Vector3().fromArray(plane.normal);
  if (normal.lengthSq() < 1e-12) return null;
  return new T.Plane().setFromNormalAndCoplanarPoint(
    normal.normalize(), new T.Vector3().fromArray(plane.originMm));
}

function fromThreePlane(T, plane) {
  return {
    originMm: plane.coplanarPoint(new T.Vector3()).toArray(),
    normal: plane.normal.toArray(),
  };
}

export function patientPlaneToScene(sc, plane) {
  const p = asThreePlane(sc.THREE, plane);
  return p?.applyMatrix4(patientToSceneMatrix(sc)) ?? null;
}

export function scenePlaneToPatient(sc, plane) {
  return fromThreePlane(sc.THREE, plane.clone().applyMatrix4(sceneToPatientMatrix(sc)));
}

export function patientPlaneToGroup(sc, plane) {
  const p = asThreePlane(sc.THREE, plane);
  if (!p) return null;
  sc.group.updateWorldMatrix(true, false);
  const patientToGroup = sc.group.matrixWorld.clone().invert().multiply(patientToSceneMatrix(sc));
  return p.applyMatrix4(patientToGroup);
}

/** Move an existing plane along its normal across the bundle's RAS bounds. */
export function patientPlaneAtDepth(sc, plane, t) {
  const T = sc.THREE;
  const p = asThreePlane(T, plane);
  if (!p) return null;
  const { min, max } = sc.bundle.manifest.geometry.bounds_mm;
  let lo = 0, hi = 0;
  p.normal.toArray().forEach((n, axis) => {
    const a = n * min[axis], b = n * max[axis];
    lo += Math.min(a, b);
    hi += Math.max(a, b);
  });
  const fraction = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0.5;
  const point = new T.Vector3().fromArray(plane.originMm);
  point.addScaledVector(p.normal, lo + (hi - lo) * fraction - p.normal.dot(point));
  return { originMm: point.toArray(), normal: p.normal.toArray() };
}

/** Adapt the existing wire format and the gesture's normalized group box. */
export function legacyCutToPatientPlane(sc, cut, groupLocalBounds) {
  if (!sc.bundle || !cut) return null;
  const p = cut.plane;
  if (typeof p === "string") {
    if (!Object.hasOwn(RAS_NORMALS, p)) return null;
    const { min, max } = sc.bundle.manifest.geometry.bounds_mm;
    const center = min.map((lo, i) => (lo + max[i]) / 2);
    return patientPlaneAtDepth(sc, { originMm: center, normal: RAS_NORMALS[p] }, cut.t);
  }
  if (!finiteTriple(p?.n) || (p.o != null && !finiteTriple(p.o)) || !groupLocalBounds) return null;
  const T = sc.THREE;
  const boxCenter = groupLocalBounds.getCenter(new T.Vector3());
  const halfSize = groupLocalBounds.getSize(new T.Vector3()).multiplyScalar(0.5);
  const groupPoint = new T.Vector3().fromArray(p.o ?? [0, 0, 0])
    .multiply(halfSize).add(boxCenter);
  const groupPlane = asThreePlane(T, { originMm: groupPoint.toArray(), normal: p.n });
  if (!groupPlane) return null;
  sc.group.updateWorldMatrix(true, false);
  const groupToPatient = sceneToPatientMatrix(sc).multiply(sc.group.matrixWorld);
  return fromThreePlane(T, groupPlane.applyMatrix4(groupToPatient));
}
