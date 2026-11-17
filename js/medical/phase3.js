// Scan views share the verified bundle and the board's existing model scene.
const AXES = ["sagittal", "coronal", "axial"];
const VIEWS = new Map();

function viewState(sc) {
  let state = VIEWS.get(sc);
  if (!state) {
    state = {mode: "surface", center: 40, width: 400, opacity: 0.5,
      offsets: {}, segments: new Map(), canRender3d: true, dirty: true};
    VIEWS.set(sc, state);
  }
  return state;
}

function node(parent, tag, text) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  parent.append(el);
  return el;
}

function button(parent, text, action) {
  const el = node(parent, "button", text);
  el.type = "button";
  el.addEventListener("click", action);
  return el;
}

function input(parent, title, type, value, min, max, step, change) {
  const label = node(parent, "label", title + " ");
  const el = node(label, "input");
  Object.assign(el, {type, value, min, max, step});
  el.addEventListener(type === "range" ? "input" : "change", () => {
    if (el.value !== "" && Number.isFinite(el.valueAsNumber))
      change(Math.max(+el.min, Math.min(+el.max, el.valueAsNumber)));
  });
  return el;
}

function showLatestControls() {
  const panels = [...VIEWS.values()].filter(v => v.panel);
  for (const [i, v] of panels.entries()) v.panel.hidden = i !== panels.length - 1;
}

export function installScanControls(sc, applyCut) {
  const state = viewState(sc);
  const panel = state.panel = node(document.body, "section");
  panel.className = "jas-scan-controls";
  panel.setAttribute("aria-label", "Scan controls");
  const title = node(panel, "strong", "Scan " + sc.bundle.manifest.bundle_id);
  title.className = "jas-scan-name";
  const modes = node(panel, "div");
  state.modeButtons = ["surface", "slices", "volume"].map((mode, i) =>
    button(modes, ["Surface", "CT slices", "3D volume"][i], () => setMode(sc, state, mode)));
  const hasVolume = sc.bundle.manifest.assets.some(a => a.role === "volume");
  state.modeButtons[1].disabled = state.modeButtons[2].disabled = !hasVolume;
  state.status = node(panel, "p", hasVolume ? "Surface view" : "Surface view · no CT volume");
  state.status.setAttribute("role", "status");

  const display = state.display = node(panel, "div");
  display.hidden = true;
  const update = () => { state.dirty = true; };
  const level = input(display, "CT level", "number", 40, -4096, 8192, 1, v => { state.center = v; update(); });
  const width = input(display, "CT width", "number", 400, 1, 16384, 1, v => { state.width = v; update(); });
  const opacity = input(display, "3D opacity", "range", 0.5, 0, 1, 0.05, v => { state.opacity = v; update(); });
  button(display, "Reset CT view", () => {
    Object.assign(state, {center: 40, width: 400, opacity: 0.5, offsets: {}});
    level.value = 40; width.value = 400; opacity.value = 0.5;
    update();
  });

  const cuts = node(panel, "div");
  const preset = state.preset = node(node(cuts, "label", "Cut plane "), "select");
  for (const axis of ["off", "hand", ...AXES]) {
    const option = node(preset, "option", axis === "hand" ? "Hand-defined" : axis === "off" ? "Off" : axis);
    option.value = axis;
    if (axis === "hand" || axis === "off") option.disabled = true;
  }
  preset.value = "off";
  preset.addEventListener("change", () => {
    if (AXES.includes(preset.value)) applyCut({plane: preset.value, t: 0.5});
  });
  const depth = state.depth = input(cuts, "Cut depth", "range", 50, 0, 100, 1, v => {
    applyCut({t: v / 100, manualDepth: true});
  });
  depth.disabled = true;
  state.arm = button(cuts, "Arm cut", () => applyCut(sc.med.st.cut?.arm ? "lock" : "arm"));
  button(cuts, "Pause", () => applyCut("pause"));
  button(cuts, "Clear cut", () => applyCut({off: 1}));
  state.cutStatus = node(panel, "span", "Cut off");
  state.selection = node(panel, "p", "Selection: no hit");
  state.selection.setAttribute("aria-live", "polite");
  const mousePick = button(panel, "Mouse pick", () => {
    state.mousePicking = !state.mousePicking;
    mousePick.setAttribute("aria-pressed", state.mousePicking);
  });
  mousePick.setAttribute("aria-pressed", false);
  state.mousePickListener = event => {
    if (!state.mousePicking || panel.hidden || panel.contains(event.target) || event.button !== 0) return;
    const rect = sc.canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) return;
    state.mousePicking = false;
    mousePick.setAttribute("aria-pressed", false);
    event.preventDefault();
    event.stopImmediatePropagation();
    applyCut({screenPoint: {x: event.clientX, y: event.clientY}});
  };
  document.addEventListener("pointerdown", state.mousePickListener, true);

  const slices = state.slices = node(panel, "div");
  slices.className = "jas-scan-slices";
  slices.hidden = true;
  state.panels = Object.fromEntries([...AXES, "cut"].map(axis => {
    const fig = node(slices, "div");
    const caption = node(fig, "span", axis === "cut" ? "Active cut" : axis);
    const canvas = node(fig, "canvas");
    canvas.setAttribute("aria-label", caption.textContent + " CT slice");
    const slider = axis === "cut" ? null : input(fig, "Position (mm)", "range", 0, 0, 1, 0.1, v => {
      state.offsets[axis] = v; update();
    });
    return [axis, {fig, canvas, slider}];
  }));

  state.contextLost = () => {
    state.view?.dispose();
    state.view = null;
    state.canRender3d = false;
    if (state.mode === "volume") setMode(sc, state, "surface");
    state.status.textContent = "3D graphics context lost · reopen the model to retry";
    state.modeButtons[2].disabled = true;
  };
  sc.canvas.addEventListener("webglcontextlost", state.contextLost);
  showLatestControls();
  setMode(sc, state, "surface");
}

async function loadScan(sc, state) {
  if (!state.loading) {
    const controller = state.controller = new AbortController();
    state.loading = import("./volume.js").then(async api => {
      const volume = await api.loadVolume({...sc.bundle, signal: controller.signal});
      if (controller.signal.aborted) return null;
      if (!volume) throw new Error("this bundle has no CT volume");
      state.api = api;
      state.volume = volume;
      return volume;
    }).catch(error => {
      state.loading = null;
      throw error;
    });
  }
  return state.loading;
}

async function setMode(sc, state, mode) {
  state.mode = mode;
  state.dirty = true;
  state.modeButtons?.forEach((el, i) => el.setAttribute("aria-pressed", ["surface", "slices", "volume"][i] === mode));
  if (state.display) state.display.hidden = mode === "surface";
  if (state.slices) state.slices.hidden = mode !== "slices";
  if (mode === "surface") {
    if (state.status) state.status.textContent = state.modeButtons[1].disabled ? "Surface view · no CT volume" : "Surface view";
    state.view?.setMode("surface");
    return;
  }
  if (state.status) state.status.textContent = "Loading verified CT volume…";
  try {
    if (!await loadScan(sc, state) || VIEWS.get(sc) !== state || state.mode !== mode) return;
    if (mode === "volume" && !state.view) {
      if (!state.canRender3d) throw new Error("3D volume rendering is unavailable");
      state.view = state.api.createVolumeView(sc.THREE, state.volume, {renderer: sc.renderer});
      sc.bundle.patientRoot.add(state.view.root);
    }
    if (state.status) state.status.textContent = mode === "slices" ? "CT slices · RAS mm" : "3D CT with surface overlay";
    state.dirty = true;
  } catch (e) {
    if (VIEWS.get(sc) !== state || state.mode !== mode) return;
    setMode(sc, state, "surface");
    if (state.status) state.status.textContent = `Surface view · ${e.message}`;
  }
}

// Take a plane section of the visible triangle surfaces in patient mm. Compute
// on demand so the live tracking loop does not recast the entire mesh per frame.
function sliceSegments(sc, plane) {
  const segments = [];
  const T = sc.THREE;
  const normal = new T.Vector3().fromArray(plane.normal);
  const anchor = new T.Vector3().fromArray(plane.originMm);
  const offset = normal.dot(anchor);
  const vertices = [new T.Vector3(), new T.Vector3(), new T.Vector3()];
  const distances = [0, 0, 0];
  const inverse = sc.bundle.patientRoot.matrixWorld.clone().invert();
  const transform = new T.Matrix4();
  for (const mesh of sc.med.idx.meshSid.keys()) {
    let visible = true;
    for (let p = mesh; p; p = p.parent) if (!p.visible) { visible = false; break; }
    if (!visible) continue;
    const pos = mesh.geometry?.getAttribute("position");
    if (!pos) continue;
    transform.multiplyMatrices(inverse, mesh.matrixWorld);
    const index = mesh.geometry.index;
    const count = index?.count ?? pos.count;
    for (let i = 0; i + 2 < count; i += 3) {
      for (let j = 0; j < 3; j++) {
        vertices[j].fromBufferAttribute(pos, index ? index.getX(i + j) : i + j).applyMatrix4(transform);
        distances[j] = normal.dot(vertices[j]) - offset;
      }
      if (distances.every(v => v > 0) || distances.every(v => v < 0)) continue;
      const points = [];
      for (let j = 0; j < 3; j++) {
        const k = (j + 1) % 3, a = distances[j], b = distances[k];
        if ((a < 0) === (b < 0)) continue;
        points.push(vertices[j].clone().lerp(vertices[k], a / (a - b)).toArray());
      }
      if (points.length === 2) segments.push(points);
    }
  }
  return segments;
}

function visibleSegments(segments, cut) {
  if (!cut) return segments;
  const distance = point => cut.normal.reduce((sum, n, k) => sum + n * (point[k] - cut.originMm[k]), 0);
  const visible = [];
  for (const [start, end] of segments) {
    const a = distance(start), b = distance(end);
    if (a < -1e-6 && b < -1e-6) continue;
    if (a >= -1e-6 && b >= -1e-6) visible.push([start, end]);
    else {
      const boundary = start.map((x, k) => x + (end[k] - x) * a / (a - b));
      visible.push(a < -1e-6 ? [boundary, end] : [start, boundary]);
    }
  }
  return visible;
}

export function scanCameraDistance(sc) {
  const state = VIEWS.get(sc);
  if (state?.mode !== "volume" || !state.view || sc.exC > 0.001) return 0;
  const maxRadius = Math.max(...state.volume.corners.map(v => sc.bundle.mmToScene(v).length()));
  return maxRadius * 1.06 / Math.sin(sc.camera.fov * Math.PI / 360);
}

export function syncScanView(sc) {
  const state = VIEWS.get(sc);
  if (!state) return;
  const M = sc.med, cut = M.st.cut;
  const status = M.cutPaused || (cut?.arm ? "Armed" : cut ? "Cut set" : "Cut off");
  if (state.cutStatus && state.cutStatus.textContent !== status) {
    state.cutStatus.textContent = status;
    state.arm.textContent = cut?.arm ? "Lock cut" : M.cutPaused ? "Resume cut" : "Arm cut";
  }
  if (state.selection) {
    const hit = M.pointDisplay;
    const detail = status === "Tracking lost" ? "tracking lost" : hit?.ambiguous ? "ambiguous" :
      hit?.structure ? (M.structs[hit.structure]?.name || hit.structure) +
        (hit.teachingStatus === "verified" ? "" : " · teaching unreviewed or unavailable") :
      performance.now() - M.lastPickAt < 400 && ["hidden", "clipped"].includes(M.lastPickStatus)
        ? M.lastPickStatus : "no hit";
    const text = "Selection: " + detail;
    if (state.selection.textContent !== text) state.selection.textContent = text;
  }
  if (state.depth) {
    state.depth.disabled = !cut || Boolean(M.cutPaused);
    state.preset.disabled = Boolean(M.cutPaused);
    state.preset.value = !cut ? "off" : typeof cut.plane === "string" ? cut.plane : "hand";
    if (cut) {
      state.depth.value = 100 * cut.t;
    }
  }
  const exploded = sc.exC > 0.001;
  const visibility = [M.st.iso, [...M.st.hid], M.st.layer, exploded];
  const signature = JSON.stringify([M.patientCut, visibility]);
  if (state.signature !== signature) { state.signature = signature; state.dirty = true; }
  if (!state.dirty || !state.volume) return;
  if (state.mode === "slices" && performance.now() - (state.lastDraw || 0) < 100) return;
  state.dirty = false;
  state.view?.setMode(!exploded && state.mode === "volume" ? "volume" : "surface");
  state.view?.setWindowLevel(state.center, state.width);
  state.view?.setOpacity(state.opacity);
  state.view?.setCut(M.patientCut || null);
  if (state.status && state.mode !== "surface") state.status.textContent = exploded
    ? "Reassemble the model to restore volume alignment"
    : state.mode === "slices" ? "CT slices · RAS mm" : "3D CT with surface overlay";
  if (state.mode !== "slices" || !state.panels) return;
  state.lastDraw = performance.now();
  sc.scene.updateMatrixWorld(true);
  for (const [axis, panel] of Object.entries(state.panels)) {
    const activeAxis = cut?.plane === axis;
    const plane = axis === "cut" ? (typeof cut?.plane === "object" && M.patientCut) :
      activeAxis && M.patientCut ? {...M.patientCut, axis} : state.api.orthogonalPlane(state.volume, axis, state.offsets[axis]);
    panel.fig.hidden = !plane;
    if (!plane) continue;
    if (panel.slider) {
      const i = AXES.indexOf(axis);
      const bounds = state.volume.bounds;
      if (bounds) {
        panel.slider.min = bounds[i][0];
        panel.slider.max = bounds[i][1];
      }
      panel.slider.disabled = Boolean(activeAxis);
      panel.slider.value = plane.originMm[i];
    }
    const key = JSON.stringify([visibility, plane]);
    let memo = state.segments.get(axis);
    if (!memo || memo.key !== key) {
      memo = {key, values: exploded ? [] : sliceSegments(sc, plane)};
      state.segments.set(axis, memo);
    }
    const frame = state.api.drawSlice(panel.canvas, state.volume, plane, {center: state.center,
      width: state.width, maxSize: 160, segments: visibleSegments(memo.values, M.patientCut)});
    const orientation = vector => vector.map((value, i) => Math.abs(value) < 0.25 ? "" :
      ["LR", "PA", "IS"][i][+(value > 0)]).join("");
    panel.canvas.setAttribute("aria-label", `${axis} CT · screen right ${orientation(frame.right)}, up ${orientation(frame.up)}`);
    panel.fig.firstElementChild.textContent = `${axis === "cut" ? "Active cut" : axis} · ↑${orientation(frame.up)} →${orientation(frame.right)}`;
  }
}

export function disposeScanView(sc) {
  const state = VIEWS.get(sc);
  if (!state) return;
  VIEWS.delete(sc);
  state.controller?.abort();
  state.view?.dispose();
  state.panel?.remove();
  if (state.contextLost) sc.canvas.removeEventListener("webglcontextlost", state.contextLost);
  if (state.mousePickListener) document.removeEventListener("pointerdown", state.mousePickListener, true);
  showLatestControls();
}
