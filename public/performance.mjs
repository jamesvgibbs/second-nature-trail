// Opt-in local QA recorder. No measurements leave this browser.
export class FrameRecorder {
  constructor() {
    this.windows = [];
    this.current = null;
    this.segment = 0;
  }
  frame(now, phase, visible = true) {
    if (!visible || !["chapter", "finale"].includes(phase)) {
      this.current = null; // Partial windows are excluded, never counted as passing.
      return;
    }
    if (!this.current || this.current.phase !== phase) {
      this.current = { start: now, phase, frames: 0, segment: ++this.segment };
    }
    while (now - this.current.start >= 1000) {
      this.windows.push({ ...this.current });
      this.current.start += 1000;
      this.current.frames = 0;
    }
    this.current.frames++;
  }
  report() {
    const passing = this.windows.filter((w) => w.frames >= 30).length;
    return {
      method:
        "Completed one-second visible chapter/finale windows; requestAnimationFrame callbacks per window. Hidden, paused, non-play, and partial windows excluded. Stalled visible windows count, including zero-frame windows.",
      measuredSeconds: this.windows.length,
      secondsAtLeast30FPS: passing,
      percentAtLeast30FPS: this.windows.length
        ? (100 * passing) / this.windows.length
        : null,
      threshold: { fps: 30, percent: 95 },
      meetsMeasuredThreshold: this.windows.length
        ? passing / this.windows.length >= 0.95
        : null,
      windows: this.windows.map((w) => ({ ...w })),
    };
  }
}

export function localFrameMeasurement() {
  if (new URLSearchParams(location.search).get("measure") !== "1")
    return () => {};
  const recorder = new FrameRecorder();
  const started = new Date().toISOString();
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "QA: download frame measurements";
  button.style.cssText =
    "position:fixed;bottom:58px;left:12px;z-index:10;font-size:12px;padding:6px;background:#f7f2df;color:#142b35";
  button.onclick = () => {
    const report = {
      recordedAt: new Date().toISOString(),
      started,
      browser: navigator.userAgent,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        pixelRatio: devicePixelRatio,
      },
      hardwareAndNetwork:
        "Record agreed hardware, browser version, workload, and network separately. This file alone does not establish release acceptance.",
      ...recorder.report(),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `trail-frames-${Date.now()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  document.body.append(button);
  document.addEventListener("visibilitychange", () =>
    recorder.frame(performance.now(), null, false),
  );
  return (now, phase) =>
    recorder.frame(now, phase, document.visibilityState === "visible");
}
