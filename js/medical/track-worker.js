// js/medical/track-worker.js: task 3.2 prototype, hand tracking off the main thread.
// A module worker running the same pinned MediaPipe HandLandmarker as
// stage.html. It receives video frames as transferred ImageBitmaps (zero-copy)
// and posts back landmark results. Only used with stage.html?track=worker.

// tasks-vision's wasm loader calls importScripts(), which module workers lack
// (measured: "Module scripts don't support importScripts()"). This shim runs
// the loader as a classic script via synchronous XHR, which workers allow.
self.importScripts = (...urls) => {
  for (const u of urls) {
    const x = new XMLHttpRequest();
    x.open("GET", u, false);
    x.send();
    if (x.status !== 200) throw new Error("worker could not load " + u);
    (0, eval)(x.responseText);
  }
};

const TV = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
let landmarker = null;

self.onmessage = async ({ data }) => {
  try {
    if (data.init) {
      const { HandLandmarker, FilesetResolver } = await import(TV + "/vision_bundle.mjs");
      const vision = await FilesetResolver.forVisionTasks(TV + "/wasm");
      let delegate = data.options.baseOptions.delegate || "GPU";
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, data.options);
      } catch (e) {
        delegate = "CPU";
        landmarker = await HandLandmarker.createFromOptions(vision,
          { ...data.options, baseOptions: { ...data.options.baseOptions, delegate } });
      }
      self.postMessage({ ready: true, delegate });
      return;
    }
    if (data.frame) {
      const t0 = performance.now();
      const r = landmarker.detectForVideo(data.frame, data.t);
      data.frame.close();
      self.postMessage({ result: { landmarks: r.landmarks, handedness: r.handedness,
                                   worldLandmarks: r.worldLandmarks },
                         t: data.t, ms: performance.now() - t0 });
    }
  } catch (e) {
    try { data.frame && data.frame.close(); } catch (_) {}
    self.postMessage({ error: String((e && e.message) || e) });
  }
};
