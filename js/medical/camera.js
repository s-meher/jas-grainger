// js/medical/camera.js: task 3.3, webcam states the user can see and recover from.
//
// Upstream barehands had one failure screen ("STAGE FAILED TO BOOT" + the raw
// exception text) and no reaction to a camera disappearing mid-session.
// Through optional MEDICAL HOOKs in stage.html, this adds:
//   - explainCameraError(e): a plain-language reason and next step for each
//     getUserMedia failure, with a Retry button (bootFailed)
//   - watchCamera: "camera disconnected" banner when the live track ends
//     (unplugged, another app took it, the OS revoked it). Recovery is
//     automatic: when a camera reappears (devicechange) or on a timer, it restarts.
//   - cameraMenu (K): pick a camera by name from a list, not by cycling;
//     the existing C-cycle and its `stage-cam` memory are kept
//   - togglePreview (V): hide the mirrored camera picture while tracking
//     continues, for screen sharing or bystanders. Remembered per browser.
// The tracker keeps reading frames in every preview state: only the picture
// is hidden, never the camera itself.

const PREVIEW_KEY = "stage-preview-hidden";

/** getUserMedia / boot error -> {kind, title, help, retry}. Pure. */
export function explainCameraError(e) {
  const name = (e && e.name) || "";
  const msg = (e && e.message) || String(e || "");
  if (name === "NotAllowedError" || name === "SecurityError" || /permission/i.test(msg))
    return { kind: "denied", retry: true, title: "Camera access is blocked",
      help: "Click the camera icon at the right of Chrome's address bar, choose “Allow”, then press Retry. "
          + "(macOS: also System Settings → Privacy & Security → Camera → Google Chrome.)" };
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || /Requested device not found/i.test(msg))
    return { kind: "none", retry: true, title: "No camera found",
      help: "Plug in a webcam (or open the laptop lid), then press Retry." };
  if (name === "NotReadableError" || name === "TrackStartError" || /Could not start video source/i.test(msg))
    return { kind: "busy", retry: true, title: "The camera is in use by another app",
      help: "Close Zoom, Teams, FaceTime, Photo Booth or another Chrome tab using the camera, then press Retry." };
  if (name === "OverconstrainedError")
    return { kind: "constraints", retry: true, title: "That camera can't provide the requested picture size",
      help: "Press Retry to try again, or press K after it starts to choose a different camera." };
  if (name === "TypeError" && /secure|https|getUserMedia/i.test(msg) ||
      (typeof location !== "undefined" && !/^(https:|http:\/\/(127\.0\.0\.1|localhost))/.test(location.href)))
    return { kind: "insecure", retry: false, title: "The camera only works on localhost",
      help: "Run `python3 server.py` and open http://127.0.0.1:8794/stage.html (not the file directly)." };
  return { kind: "other", retry: true, title: "The stage could not start",
    help: "Check your internet connection (the hand tracker downloads on first run), then press Retry. "
        + "Details: " + msg.slice(0, 200) };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/** stage.html boot catch: render the explanation into #boot. true = handled. */
export function bootFailed(e, retry) {
  if (typeof document === "undefined") return false;
  const box = document.getElementById("boot");
  if (!box) return false;
  const x = explainCameraError(e);
  box.dataset.camError = x.kind;
  box.innerHTML = `<div style="max-width:560px;text-align:center;line-height:1.5">
    <div style="font-size:20px;letter-spacing:.08em">${esc(x.title)}</div>
    <div style="color:#a8d8cf;font-size:14px;margin:14px 0 18px">${esc(x.help)}</div>
    ${x.retry ? '<button id="cam-retry" style="font:inherit;font-size:15px;padding:8px 22px;border-radius:8px;border:1px solid #6fe5d6;background:transparent;color:#6fe5d6;cursor:pointer">Retry</button>' : ""}
  </div>`;
  const b = document.getElementById("cam-retry");
  if (b) b.onclick = () => retry();
  return true;
}

// ------------------------------------------------------------ disconnects
let _banner = null;
function banner(text) {
  if (typeof document === "undefined") return;
  if (!text) { if (_banner) { _banner.remove(); _banner = null; } return; }
  if (!_banner) {
    _banner = document.createElement("div");
    _banner.id = "cam-banner";
    _banner.style.cssText = "position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:9999;"
      + "padding:10px 18px;border-radius:10px;background:rgba(20,20,24,.88);color:#ffd27a;"
      + "font:14px/1.4 system-ui,sans-serif;pointer-events:none";
    document.body.appendChild(_banner);
  }
  _banner.textContent = text;
}

/** stage.html startCam hook, called after every new stream. restart() must
 *  reopen a camera (stage.html's pickInitialCam). The returned state is for tests. */
export function watchCamera(stream, restart, opts = {}) {
  const md = opts.mediaDevices || (typeof navigator !== "undefined" && navigator.mediaDevices);
  const every = opts.retryMs ?? 3000;
  const st = { lost: false, attempts: 0, timer: null };
  const track = stream && stream.getVideoTracks && stream.getVideoTracks()[0];
  if (!track) return st;
  const tryRestart = async () => {
    if (!st.lost || st.busy) return;
    st.busy = true; st.attempts++;
    try {
      await restart();
      st.lost = false;
      clearInterval(st.timer); st.timer = null;
      if (md && md.removeEventListener) md.removeEventListener("devicechange", onChange);
      banner(null);
    } catch (e) {
      banner("Camera disconnected - " + explainCameraError(e).title.toLowerCase() + ". Retrying…");
    } finally { st.busy = false; }
  };
  const onChange = () => tryRestart();
  track.addEventListener("ended", () => {
    if (st.lost) return;
    st.lost = true;
    banner("Camera disconnected - plug it back in; tracking resumes automatically");
    if (md && md.addEventListener) md.addEventListener("devicechange", onChange);
    st.timer = setInterval(tryRestart, every);
  });
  st.tryRestart = tryRestart;
  return st;
}

// --------------------------------------------------------- camera picker
/** -> [{n, label, current}] for the menu. Pure. */
export function menuItems(devices, currentIdx) {
  return (devices || []).map((d, i) => ({ n: i + 1, label: d.label || `Camera ${i + 1}`,
                                          current: i === currentIdx, deviceId: d.deviceId }));
}

let _menu = null;
/** K key: list cameras; click or press its number to switch. */
export function cameraMenu(api) {
  if (typeof document === "undefined") return;
  if (_menu) { closeMenu(); return; }
  const items = menuItems(api.list(), api.current());
  if (!items.length) return;
  _menu = document.createElement("div");
  _menu.id = "cam-menu";
  _menu.style.cssText = "position:fixed;right:24px;top:24px;z-index:9999;padding:14px 16px;border-radius:12px;"
    + "background:rgba(16,18,22,.92);color:#e8f7f4;font:14px/1.6 system-ui,sans-serif;min-width:260px";
  _menu.innerHTML = `<div style="opacity:.7;margin-bottom:6px">Camera (press a number, K to close)</div>`
    + items.map(it => `<div data-n="${it.n}" style="cursor:pointer;padding:2px 6px;border-radius:6px;${it.current ? "background:rgba(111,229,214,.18)" : ""}">`
      + `${it.n}. ${esc(it.label)}${it.current ? " ✓" : ""}</div>`).join("");
  _menu.addEventListener("click", ev => {
    const n = +(ev.target.closest("[data-n]") || {}).dataset?.n;
    if (n) pick(api, items, n);
  });
  _menu._keys = ev => { const n = +ev.key; if (n >= 1 && n <= items.length) pick(api, items, n); };
  addEventListener("keydown", _menu._keys);
  document.body.appendChild(_menu);
}
function closeMenu() {
  if (!_menu) return;
  removeEventListener("keydown", _menu._keys);
  _menu.remove(); _menu = null;
}
async function pick(api, items, n) {
  const it = items[n - 1];
  closeMenu();
  if (it && !it.current) await api.choose(it.deviceId);
}

// --------------------------------------------------------- preview privacy
/** V key, and once at boot with initial=true to restore the saved choice. */
export function togglePreview(video, initial = false, storage) {
  const ls = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  let hidden = ls ? ls.getItem(PREVIEW_KEY) === "1" : false;
  if (!initial) hidden = !hidden;
  if (ls) ls.setItem(PREVIEW_KEY, hidden ? "1" : "0");
  // opacity, not display/visibility: a hidden <video> can stop decoding frames,
  // and the tracker must keep seeing the camera
  if (video && video.style) video.style.opacity = hidden ? "0" : "";
  if (typeof document !== "undefined" && document.body) {
    let tag = document.getElementById("cam-private");
    if (hidden && !tag) {
      tag = document.createElement("div");
      tag.id = "cam-private";
      tag.textContent = "camera preview hidden - tracking on (V to show)";
      tag.style.cssText = "position:fixed;left:16px;bottom:14px;z-index:9999;color:#9fd;opacity:.75;"
        + "font:12px system-ui,sans-serif;pointer-events:none";
      document.body.appendChild(tag);
    } else if (!hidden && tag) tag.remove();
  }
  return hidden;
}
