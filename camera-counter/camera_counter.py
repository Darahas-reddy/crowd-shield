"""
CrowdShield Camera Counter
==========================
Automatically counts people in each camera feed using YOLOv8
and pushes live counts to the CrowdShield backend API.

No manual data entry needed.

Setup:
    pip install ultralytics opencv-python requests

Run:
    python camera_counter.py
    python camera_counter.py --config my_config.json
    python camera_counter.py --demo          (uses webcam, no zones needed)
"""

import cv2
import time
import json
import argparse
import threading
import requests
import logging
import sys
import os
from datetime import datetime
from pathlib import Path

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("CrowdCounter")

# ── Default config ────────────────────────────────────────────────────────────
DEFAULT_CONFIG = {
    "crowdshield_api": "http://localhost:8080/api",
    "push_interval_seconds": 3,
    "model": "yolov8n.pt",          # nano = fastest; use yolov8s/m for better accuracy
    "confidence_threshold": 0.45,
    "show_preview": True,           # set False for headless/server use
    "cameras": [
        # Each camera maps to one CrowdShield zone.
        # zone_id must match a zone already created in the dashboard.
        {
            "name": "Main Entrance",
            "source": 0,            # 0 = first webcam; or "rtsp://...", "http://...", "/dev/video1"
            "zone_id": "REPLACE_WITH_ZONE_ID_FROM_DASHBOARD",
            "roi": None             # None = full frame; or [x, y, w, h] to crop a region of interest
        }
        # Add more cameras:
        # {
        #     "name": "North Gate",
        #     "source": "rtsp://192.168.1.20:554/stream",
        #     "zone_id": "REPLACE_WITH_ZONE_ID",
        #     "roi": [100, 0, 1200, 900]
        # },
    ]
}


# ── API client ────────────────────────────────────────────────────────────────
class CrowdShieldAPI:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def push_count(self, zone_id: str, count: int) -> bool:
        try:
            url = f"{self.base_url}/zones/{zone_id}/count"
            r = self.session.patch(url, json={"count": count}, timeout=5)
            r.raise_for_status()
            return True
        except requests.RequestException as e:
            log.warning(f"API push failed for zone {zone_id}: {e}")
            return False

    def get_zones(self):
        try:
            r = self.session.get(f"{self.base_url}/zones", timeout=5)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            log.warning(f"Could not fetch zones: {e}")
            return []


# ── People detector ───────────────────────────────────────────────────────────
class PeopleDetector:
    def __init__(self, model_name: str, confidence: float):
        self.confidence = confidence
        self.model = None
        self._load_model(model_name)

    def _load_model(self, model_name: str):
        try:
            from ultralytics import YOLO
            log.info(f"Loading model: {model_name}")
            self.model = YOLO(model_name)
            log.info("Model loaded ✓")
        except ImportError:
            log.error("ultralytics not installed. Run:  pip install ultralytics")
            sys.exit(1)
        except Exception as e:
            log.error(f"Could not load model: {e}")
            sys.exit(1)

    def count_people(self, frame):
        """
        Returns (count, annotated_frame).
        YOLO class 0 = person.
        """
        results = self.model(
            frame,
            classes=[0],                   # only detect people
            conf=self.confidence,
            verbose=False,
        )
        count = 0
        annotated = frame.copy()

        for result in results:
            boxes = result.boxes
            count += len(boxes)

            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0])

                # Color: green → yellow → red by density feel
                color = (0, 220, 120)   # green default
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                cv2.putText(
                    annotated,
                    f"{conf:.0%}",
                    (x1, y1 - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1,
                )

        return count, annotated


# ── Per-camera worker ─────────────────────────────────────────────────────────
class CameraWorker(threading.Thread):
    def __init__(self, cfg: dict, detector: PeopleDetector,
                 api: CrowdShieldAPI, push_interval: int, show_preview: bool):
        super().__init__(daemon=True)
        self.cfg           = cfg
        self.detector      = detector
        self.api           = api
        self.push_interval = push_interval
        self.show_preview  = show_preview
        self.name_str      = cfg.get("name", "Camera")
        self.zone_id       = cfg["zone_id"]
        self.source        = cfg["source"]
        self.roi           = cfg.get("roi")      # [x, y, w, h] or None

        self.current_count = 0
        self.running       = True
        self.last_push     = 0
        self.fps           = 0.0
        self._lock         = threading.Lock()

    def stop(self):
        self.running = False

    def get_count(self):
        with self._lock:
            return self.current_count

    def _apply_roi(self, frame):
        if self.roi is None:
            return frame
        x, y, w, h = self.roi
        return frame[y:y+h, x:x+w]

    def _draw_overlay(self, frame, count):
        h, w = frame.shape[:2]
        # Background bar
        cv2.rectangle(frame, (0, 0), (w, 44), (0, 0, 0), -1)
        cv2.rectangle(frame, (0, 0), (w, 44), (30, 80, 30), 1)

        label = f"{self.name_str}  |  People: {count}  |  {self.fps:.1f} fps"
        cv2.putText(frame, label, (10, 29),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 230, 150), 2)

        ts = datetime.now().strftime("%H:%M:%S")
        cv2.putText(frame, ts, (w - 90, 29),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (100, 180, 100), 1)
        return frame

    def run(self):
        log.info(f"[{self.name_str}] Opening source: {self.source}")
        cap = cv2.VideoCapture(self.source)

        if not cap.isOpened():
            log.error(f"[{self.name_str}] Cannot open source: {self.source}")
            return

        log.info(f"[{self.name_str}] Stream opened ✓  zone_id={self.zone_id}")
        frame_times = []

        while self.running:
            t0 = time.time()
            ok, raw_frame = cap.read()

            if not ok:
                log.warning(f"[{self.name_str}] Frame read failed — retrying in 2s")
                time.sleep(2)
                cap.release()
                cap = cv2.VideoCapture(self.source)
                continue

            frame = self._apply_roi(raw_frame)
            count, annotated = self.detector.count_people(frame)

            with self._lock:
                self.current_count = count

            # FPS tracking
            frame_times.append(time.time())
            frame_times = [t for t in frame_times if time.time() - t < 2]
            self.fps = len(frame_times) / 2.0

            # Push to API on interval
            if time.time() - self.last_push >= self.push_interval:
                success = self.api.push_count(self.zone_id, count)
                status = "✓" if success else "✗"
                log.info(f"[{self.name_str}] Count={count:3d}  push={status}")
                self.last_push = time.time()

            # Preview window
            if self.show_preview:
                display = self._draw_overlay(annotated, count)
                cv2.imshow(f"CrowdShield — {self.name_str}", display)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    self.running = False
                    break

            # Cap to ~15 fps to save CPU
            elapsed = time.time() - t0
            if elapsed < 0.067:
                time.sleep(0.067 - elapsed)

        cap.release()
        log.info(f"[{self.name_str}] Worker stopped.")


# ── Status printer ────────────────────────────────────────────────────────────
class StatusPrinter(threading.Thread):
    def __init__(self, workers: list):
        super().__init__(daemon=True)
        self.workers = workers

    def run(self):
        while True:
            time.sleep(10)
            print("\n── Live Counts ─────────────────────────────")
            for w in self.workers:
                print(f"  {w.name_str:<22} {w.get_count():>4} people  ({w.fps:.1f} fps)")
            print("────────────────────────────────────────────\n")


# ── Demo mode (no zone IDs needed) ───────────────────────────────────────────
def run_demo(model_name: str, confidence: float):
    """Quick demo with webcam — prints count, no API push."""
    log.info("Running in DEMO mode (webcam, no API push)")
    try:
        from ultralytics import YOLO
        model = YOLO(model_name)
    except ImportError:
        log.error("Install ultralytics:  pip install ultralytics opencv-python")
        return

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        log.error("No webcam found.")
        return

    log.info("Press Q to quit.")
    while True:
        ok, frame = cap.read()
        if not ok:
            break

        results = model(frame, classes=[0], conf=confidence, verbose=False)
        count = sum(len(r.boxes) for r in results)
        annotated = results[0].plot()

        cv2.rectangle(annotated, (0, 0), (annotated.shape[1], 44), (0, 0, 0), -1)
        cv2.putText(annotated, f"People detected: {count}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 230, 150), 2)
        cv2.imshow("CrowdShield — DEMO (press Q to quit)", annotated)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


# ── Entry point ───────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="CrowdShield Camera Counter")
    parser.add_argument("--config", default="config.json",
                        help="Path to config JSON (default: config.json)")
    parser.add_argument("--demo", action="store_true",
                        help="Run demo mode with webcam — no API or zone IDs needed")
    parser.add_argument("--generate-config", action="store_true",
                        help="Write a starter config.json and exit")
    args = parser.parse_args()

    # Generate starter config
    if args.generate_config:
        path = Path("config.json")
        path.write_text(json.dumps(DEFAULT_CONFIG, indent=2))
        print(f"Config written to {path.resolve()}")
        print("Edit it to add your zone IDs from the CrowdShield dashboard.")
        return

    # Demo mode
    if args.demo:
        run_demo(DEFAULT_CONFIG["model"], DEFAULT_CONFIG["confidence_threshold"])
        return

    # Load config
    config_path = Path(args.config)
    if not config_path.exists():
        log.warning(f"Config not found: {config_path}")
        log.info("Generating default config.json …")
        config_path.write_text(json.dumps(DEFAULT_CONFIG, indent=2))
        log.info(f"Edit {config_path.resolve()} then run again.")
        log.info("Or run:  python camera_counter.py --demo   to test with webcam")
        return

    with open(config_path) as f:
        config = json.load(f)

    if not config.get("cameras"):
        log.error("No cameras defined in config. Add at least one camera entry.")
        return

    # Warn about placeholder zone IDs
    for cam in config["cameras"]:
        if "REPLACE_WITH" in str(cam.get("zone_id", "")):
            log.error(
                f"Camera '{cam.get('name')}' has a placeholder zone_id.\n"
                "  1. Open the CrowdShield dashboard\n"
                "  2. Draw a zone on the map\n"
                "  3. Copy the zone ID from the Zones tab\n"
                "  4. Paste it into config.json"
            )
            return

    api      = CrowdShieldAPI(config["crowdshield_api"])
    detector = PeopleDetector(config["model"], config["confidence_threshold"])

    # Print available zones to help user match IDs
    zones = api.get_zones()
    if zones:
        log.info("Available zones in CrowdShield:")
        for z in zones:
            log.info(f"  {z['id']}  →  {z['name']}  ({z.get('location','')})")
    else:
        log.warning("Could not reach CrowdShield API — counts will be queued and retried")

    # Start camera workers
    workers = []
    for cam_cfg in config["cameras"]:
        w = CameraWorker(
            cfg           = cam_cfg,
            detector      = detector,
            api           = api,
            push_interval = config.get("push_interval_seconds", 3),
            show_preview  = config.get("show_preview", True),
        )
        w.start()
        workers.append(w)

    # Status printer
    StatusPrinter(workers).start()

    log.info(f"Running {len(workers)} camera(s). Press Ctrl+C to stop.")

    try:
        while True:
            time.sleep(1)
            # Check if all workers died
            if all(not w.is_alive() for w in workers):
                log.info("All camera workers stopped.")
                break
    except KeyboardInterrupt:
        log.info("Stopping...")
        for w in workers:
            w.stop()

    cv2.destroyAllWindows()
    log.info("Done.")


if __name__ == "__main__":
    main()
