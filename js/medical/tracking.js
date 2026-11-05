// js/medical/tracking.js: task 3.2, tracker scheduling options + measurement.
//
//   createLandmarker(create, options)  GPU first; on failure, retry on CPU
//                                      instead of failing the whole boot.
//   wrapTracker(landmarker, options)   ?track=worker swaps in a worker-backed
//                                      tracker with the same detectForVideo()
//                                      shape. Backpressure: one frame in
//                                      flight, newer frames are dropped (not
//                                      queued), so latency can't build up.
//                                      If the worker fails, the main-thread
//                                      landmarker is kept.
//   ?perf=1                            overlay + window.__trackPerf: main-
//                                      thread frame interval (jank), detection
//                                      ms, result age, dropped frames. Lets
//                                      ADR 0005 decide from measurements,
//                                      not opinions.
//
// Default behaviour (no URL flags) is upstream's: main thread, GPU.

const Q = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();

function pct(a, p) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

/** Rolling stats store; pure enough to unit-test. */
export function makeStats(win = 300) {
  const st = { mode: "main", delegate: "GPU", detect: [], age: [], frame: [], dropped: 0, frames: 0 };
  const push = (k, v) => { st[k].push(v); if (st[k].length > win) st[k].shift(); };
  st.add = push;
  st.summary = () => ({
    mode: st.mode, delegate: st.delegate, frames: st.frames, dropped: st.dropped,
    skipped_no_picture: st.skipped || 0, detect_errors: st.errors || 0,
    detect_ms_avg: +(st.detect.reduce((a, b) => a + b, 0) / (st.detect.length || 1)).toFixed(2),
    detect_ms_p95: +pct(st.detect, 0.95).toFixed(2),
    result_age_ms_p95: +pct(st.age, 0.95).toFixed(2),
    frame_ms_p50: +pct(st.frame, 0.5).toFixed(2),
    frame_ms_p95: +pct(st.frame, 0.95).toFixed(2),
    long_frames_pct: +(100 * st.frame.filter(f => f > 25).length / (st.frame.length || 1)).toFixed(1),
  });
  return st;
}
export const STATS = makeStats();

export async function createLandmarker(create, options) {
  try {
    const lm = await create(options);
    STATS.delegate = options.baseOptions.delegate || "GPU";
    return lm;
  } catch (e) {
    if ((options.baseOptions.delegate || "GPU") === "CPU") throw e;
    console.warn("[tracking] GPU delegate failed, retrying on CPU:", e);
    STATS.delegate = "CPU (GPU failed)";
    return create({ ...options, baseOptions: { ...options.baseOptions, delegate: "CPU" } });
  }
}

/** Worker-backed tracker with the HandLandmarker detectForVideo() shape. */
export function workerTracker(worker, options, now = () => performance.now()) {
  let busy = false, latest = { landmarks: [], handedness: [] }, ready = false, sentT = 0;
  const t = {
    ready: new Promise((res, rej) => {
      worker.onmessage = ({ data }) => {
        if (data.ready) { ready = true; STATS.delegate = data.delegate; res(t); return; }
        if (data.error) { busy = false; if (!ready) rej(new Error(data.error)); else console.warn("[tracking]", data.error); return; }
        if (data.result) {
          latest = data.result; busy = false;
          STATS.add("detect", data.ms); STATS.add("age", now() - sentT);
        }
      };
      worker.onerror = e => rej(e.error || new Error(e.message || "worker error"));
    }),
    detectForVideo(video, ts) {
      STATS.frames++;
      if (noPicture(video)) { STATS.skipped = (STATS.skipped || 0) + 1; return latest; }
      if (busy) STATS.dropped++;
      else if (ready) {
        busy = true; sentT = now();
        createImageBitmap(video).then(bmp => worker.postMessage({ frame: bmp, t: ts }, [bmp]),
                                      () => { busy = false; });
      }
      return latest;              // newest finished result (may lag the video by a frame)
    },
    close() { worker.terminate(); },
  };
  worker.postMessage({ init: true, options });
  return t;
}

/** stage.html boot hook. Returns the tracker to use (never null). */
export async function wrapTracker(landmarker, options) {
  const mode = Q.get("track");
  if (Q.get("perf") === "1") startPerf();
  if (mode !== "worker" || typeof Worker === "undefined") return measured(landmarker);
  try {
    const w = new Worker(new URL("./track-worker.js", import.meta.url), { type: "module" });
    const t = await Promise.race([workerTracker(w, options).ready,
      new Promise((_, r) => setTimeout(() => r(new Error("worker init timeout")), 30000))]);
    STATS.mode = "worker";
    try { landmarker.close?.(); } catch (e) {}
    return t;
  } catch (e) {
    console.warn("[tracking] worker mode failed, staying on the main thread:", e);
    STATS.mode = "main (worker failed)";
    return measured(landmarker);
  }
}

const NO_HANDS = Object.freeze({ landmarks: [], handedness: [], worldLandmarks: [] });

/** A video element with no picture yet: 0x0 while a camera (re)starts. Feeding
 *  that to MediaPipe throws "ROI width and height must be > 0" from inside
 *  frame(), the rAF loop dies, and the whole board freezes. Measured on a
 *  camera restart (3.3); the same window exists on the C-key camera switch. */
export function noPicture(video) {
  return !video || !video.videoWidth || !video.videoHeight || (video.readyState ?? 4) < 2;
}

function measured(lm) {
  return {
    detectForVideo(video, ts) {
      STATS.frames++;
      if (noPicture(video)) { STATS.skipped = (STATS.skipped || 0) + 1; return NO_HANDS; }
      const t0 = performance.now();
      let r;
      try { r = lm.detectForVideo(video, ts); }
      catch (e) {                      // one bad frame must never stop the frame loop
        STATS.errors = (STATS.errors || 0) + 1;
        console.warn("[tracking] detect failed on one frame:", e);
        return NO_HANDS;
      }
      const ms = performance.now() - t0;
      STATS.add("detect", ms); STATS.add("age", ms);
      return r;
    },
    close() { lm.close?.(); },
  };
}

function startPerf() {
  if (typeof document === "undefined" || startPerf.on) return;
  startPerf.on = true;
  const el = document.createElement("div");
  el.id = "perf";
  el.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:9999;padding:8px 10px;border-radius:8px;"
    + "background:rgba(0,0,0,.72);color:#bfe;font:12px/1.35 ui-monospace,monospace;white-space:pre;pointer-events:none";
  document.body.appendChild(el);
  let last = performance.now(), k = 0;
  const loop = now => {
    STATS.add("frame", now - last); last = now;
    if (++k % 15 === 0) {
      const s = STATS.summary();
      window.__trackPerf = s;
      el.textContent = `track ${s.mode} · ${s.delegate}\nframe p50 ${s.frame_ms_p50} p95 ${s.frame_ms_p95} ms`
        + `  long ${s.long_frames_pct}%\ndetect avg ${s.detect_ms_avg} p95 ${s.detect_ms_p95} ms`
        + `\nresult age p95 ${s.result_age_ms_p95} ms  dropped ${s.dropped}/${s.frames}`;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
