"""
CrowdShield Zone Mapper
=======================
Fetches all zones from the CrowdShield API and helps you
build a config.json by assigning cameras to zones interactively.

Run:
    python zone_mapper.py
"""

import json
import sys
import requests
from pathlib import Path


API = "http://localhost:8080/api"


def fetch_zones():
    try:
        r = requests.get(f"{API}/zones", timeout=5)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        print(f"\n❌  Cannot reach CrowdShield API at {API}")
        print(f"   Error: {e}")
        print("   Make sure the backend is running (mvn spring-boot:run)")
        sys.exit(1)


def detect_cameras(max_check=5):
    """Detect available webcam indices."""
    import cv2
    found = []
    for i in range(max_check):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            found.append(i)
            cap.release()
    return found


def main():
    print("\n" + "═" * 54)
    print("  CrowdShield  ·  Zone ↔ Camera Mapper")
    print("═" * 54)

    # Fetch zones
    print("\n⏳  Fetching zones from CrowdShield...")
    zones = fetch_zones()

    if not zones:
        print("\n⚠️  No zones found in CrowdShield.")
        print("   Go to the dashboard → Live Map → draw zones first.")
        sys.exit(0)

    print(f"\n✅  Found {len(zones)} zone(s):\n")
    for i, z in enumerate(zones):
        density = 0
        if z.get("capacity", 0) > 0:
            density = round(z.get("currentCount", 0) / z["capacity"] * 100)
        print(f"  [{i+1}]  {z['name']:<22}  📍 {z.get('location',''):<18}  "
              f"cap={z.get('capacity','?')}  density={density}%")
        print(f"       id: {z['id']}")

    # Detect webcams
    print("\n⏳  Scanning for USB/webcam sources...")
    try:
        import cv2
        cams = detect_cameras()
        if cams:
            print(f"   Found webcam(s): {cams}")
        else:
            print("   No USB webcams found (you can still use RTSP/HTTP sources)")
    except ImportError:
        cams = []
        print("   opencv-python not installed yet — skipping webcam scan")

    # Build config interactively
    print("\n" + "─" * 54)
    print("  Assign cameras to zones")
    print("  Press Enter to skip a zone, Ctrl+C to finish\n")

    cameras = []
    for z in zones:
        print(f"  Zone: {z['name']}  ({z.get('location','')})")
        src_raw = input("    Camera source [0 for webcam, RTSP URL, or Enter to skip]: ").strip()
        if not src_raw:
            print("    Skipped.\n")
            continue

        # Convert numeric strings to int
        try:
            src = int(src_raw)
        except ValueError:
            src = src_raw

        roi_raw = input("    ROI crop [x,y,w,h or Enter for full frame]: ").strip()
        roi = None
        if roi_raw:
            try:
                roi = list(map(int, roi_raw.split(",")))
                if len(roi) != 4:
                    print("    Invalid ROI — using full frame")
                    roi = None
            except ValueError:
                print("    Invalid ROI — using full frame")
                roi = None

        cameras.append({
            "name": z["name"],
            "source": src,
            "zone_id": z["id"],
            "roi": roi,
        })
        print(f"    ✅ Mapped '{z['name']}' → source={src}\n")

    if not cameras:
        print("\n⚠️  No cameras assigned. Nothing to save.")
        return

    # Write config
    config = {
        "crowdshield_api": API,
        "push_interval_seconds": 3,
        "model": "yolov8n.pt",
        "confidence_threshold": 0.45,
        "show_preview": True,
        "cameras": cameras,
    }

    out = Path("config.json")
    out.write_text(json.dumps(config, indent=2))

    print("═" * 54)
    print(f"  ✅  Config saved to {out.resolve()}")
    print(f"  {len(cameras)} camera(s) configured")
    print("\n  Run:  python camera_counter.py")
    print("═" * 54 + "\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nAborted.")
