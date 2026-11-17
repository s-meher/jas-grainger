// Volume geometry/integrity checks against the real exporter fixture and an
// independent ramp, whose position/intensity checks catch axis swaps.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { loadVolume, orthogonalPlane, parseVolumeNrrd, sampleVolume, sliceFrame } from "../js/medical/volume.js";

const phantomDir = new URL("../media/models/phantom/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", phantomDir), "utf8"));
const volumeBytes = () => Uint8Array.from(readFileSync(new URL("volume.nrrd", phantomDir)));
const signal = new AbortController().signal;
const phantom = await loadVolume({ manifest, signal, get: async (path, forwarded) => {
  assert.equal(path, "volume.nrrd");
  assert.equal(forwarded, signal);
  return volumeBytes().buffer;
} });
assert(phantom.data instanceof Int16Array);
assert.deepEqual(phantom.shape, [48, 40, 30]);
assert.deepEqual(phantom.voxelToMm, [[-0.8, 0, 0, 20], [0, 0, -0.8, 12], [0, 2, 0, -40], [0, 0, 0, 1]]);
assert.equal(sampleVolume(phantom, [20, 12, -40]), phantom.data[0]);

const transform = [[-1, 0, 0.5, 10], [0, 2, 0, 20], [0, 0, 3, 30], [0, 0, 0, 1]];
const geometry = { axes: "RAS", units: "mm", shape: [2, 3, 4], voxel_to_world: transform };
const data = new Float32Array(24);
for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) {
  data[i + 2 * (j + 3 * k)] = i + 10 * j + 100 * k + 0.25;
}
function nrrd(text, dataBytes) {
  return Uint8Array.from(Buffer.concat([Buffer.from(text), Buffer.from(dataBytes)])).buffer;
}
const header = `NRRD0005
type: float
dimension: 3
space: right-anterior-superior
sizes: 2 3 4
space directions: (-1,0,0) (0,2,0) (0.5,0,3)
space origin: (10,20,30)
endian: little
encoding: gzip

`;
const decoded = await parseVolumeNrrd(nrrd(header, gzipSync(new Uint8Array(data.buffer))), geometry);
assert(decoded.data instanceof Float32Array);
assert.equal(sampleVolume(decoded, [10, 20, 30]), 0.25);
assert.equal(sampleVolume(decoded, [10, 24, 36]), 221.25);
assert.equal(sampleVolume(decoded, [10.25, 22, 34.5]), 160.75); // (0.5, 1, 1.5)
assert.equal(sampleVolume(decoded, [12, 24, 36]), null);

const sagittal = orthogonalPlane(decoded, "sagittal", 10);
const frame = sliceFrame(decoded, sagittal, 64);
assert.deepEqual(sagittal.normal, [1, 0, 0]);
assert.equal(sagittal.originMm[0], 10);
assert.deepEqual(frame.right, [0, 1, 0]);
assert.deepEqual(frame.up, [0, 0, 1]);
const [firstX, firstY] = frame.project(frame.start);
assert(Math.abs(firstX - 0.5) < 1e-9 && Math.abs(firstY - 0.5) < 1e-9);
const oblique = sliceFrame(decoded, { originMm: [10, 20, 30], normal: [1, 1, 1] }, 64);
assert(Math.abs(oblique.right.reduce((sum, value, i) => sum + value * oblique.up[i], 0)) < 1e-12);

const raw = header.replace("encoding: gzip", "encoding: raw").replaceAll("\n", "\r\n");
assert.deepEqual((await parseVolumeNrrd(nrrd(raw, new Uint8Array(data.buffer)), geometry)).data, data);
await assert.rejects(parseVolumeNrrd(nrrd(header, gzipSync(Buffer.alloc(data.byteLength + 1))), geometry), /expands beyond/);
await assert.rejects(parseVolumeNrrd(nrrd(header, gzipSync(Buffer.alloc(data.byteLength - 1))), geometry), /payload length/);
await assert.rejects(parseVolumeNrrd(nrrd(header.replace("(10,20,30)", "(11,20,30)"), Buffer.alloc(0)), geometry), /geometry/);
await assert.rejects(parseVolumeNrrd(nrrd(header.replace("-1,0,0", "0,0,0"), Buffer.alloc(0)), geometry), /singular/);
await assert.rejects(parseVolumeNrrd(nrrd(header.replace("2 3 4", "512 512 512"), Buffer.alloc(0)), geometry), /256 MiB/);
await assert.rejects(parseVolumeNrrd(nrrd(header.replace("little", "big"), Buffer.alloc(0)), geometry), /little-endian/);
await assert.rejects(parseVolumeNrrd(nrrd(header.replace("endian:", 'space units: "cm" "cm" "cm"\nendian:'), Buffer.alloc(0)), geometry), /millimeters/);
await assert.rejects(parseVolumeNrrd(nrrd(header.replace("endian:", "data file: outside.raw\nendian:"), Buffer.alloc(0)), geometry), /inline/);
await assert.rejects(loadVolume({ manifest, get: async () => null }), /missing or size/);
const edited = volumeBytes();
edited[edited.length - 1] ^= 1;
await assert.rejects(loadVolume({ manifest, get: async () => edited.buffer }), /hash check/);
await assert.rejects(loadVolume({ manifest, get: async () => { throw new Error("fetched while canceled"); }, signal: AbortSignal.abort() }), { name: "AbortError" });
const surfaceOnly = { ...manifest, assets: manifest.assets.filter(asset => asset.role !== "volume") };
assert.equal(await loadVolume({ manifest: surfaceOnly, get: async () => { throw new Error("unexpected fetch"); } }), null);
console.log("Volume checks passed: verified exporter bytes, mirrored/oblique mapping, sampling, MPR, size limits and fallback.");
