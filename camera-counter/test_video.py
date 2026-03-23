"""
CrowdShield - Video File Tester
================================
Test your YOLO detection on a pre-recorded video file
before deploying to live cameras.

Usage:
    python test_video.py
    python test_video.py --video crowd.mp4
    python test_video.py --video crowd.mp4 --confidence 0.4
    python test_video.py --video crowd.mp4 --push --zone ZONE_ID
"""

import cv2
import time
import argparse
import requests
import sys
from datetime import datetime


def parse_args():
    p = argparse.ArgumentParser(description="Test YOLOv8 people detection on a video file")
    p.add_argument("--video",      default=None,    help="Path to video file (default: webcam)")
    p.add_argument("--model",      default="yolov8n.pt", help="YOLO model")
    p.add_argument("--confidence", type=float, default=0.45, help="Detection confidence 0-1")
    p.add_argument("--push",       action="store_true", help="Push counts to CrowdShield API")
    p.add_argument("--zone",       default=None,    help="Zone ID to push counts to")
    p.add_argument("--api",        default="http://localhost:8080/api", help="CrowdShield API URL")
    p.add_argument("--roi",        default=None,    help="ROI as x,y,w,h  e.g. 100,0,800,600")
    return p.parse_args()


def push_count(api, zone_id, count):
    try:
        r = requests.patch(
            f"{api}/zones/{zone_id}/count",
            json={"count": count},
            timeout=3,
        )
        return r.ok
    except Exception:
        return False


def main():
    args = parse_args()

    try:
        from ultralytics import YOLO
    except ImportError:
        print("❌  Install ultralytics first:  pip install ultralytics opencv-python")
        sys.exit(1)

    print(f"\nLoading model: {args.model}")
    model = YOLO(args.model)
    print("Model ready ✓\n")

    roi = None
    if args.roi:
        try:
            roi = list(map(int, args.roi.split(",")))
            print(f"ROI: {roi}")
        except ValueError:
            print("Invalid ROI format, ignoring")

    source = args.video if args.video else 0
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"❌  Cannot open source: {source}")
        sys.exit(1)

    fps_cap = cap.get(cv2.CAP_PROP_FPS) or 25
    total   = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or -1
    print(f"Source: {source}")
    print(f"FPS: {fps_cap:.1f}   Frames: {'live' if total < 0 else total}")
    print("Press Q to quit, SPACE to pause\n")

    last_push   = 0
    frame_count = 0
    paused      = False
    counts      = []

    while True:
        if not paused:
            ok, frame = cap.read()
            if not ok:
                print("\nEnd of video.")
                break
            frame_count += 1

        # Apply ROI
        display_frame = frame.copy()
        work_frame = frame
        if roi:
            x, y, w, h = roi
            cv2.rectangle(display_frame, (x, y), (x+w, y+h), (0, 200, 255), 2)
            work_frame = frame[y:y+h, x:x+w]

        # Detect
        results = model(work_frame, classes=[0], conf=args.confidence, verbose=False)
        count   = sum(len(r.boxes) for r in results)
        counts.append(count)

        # Draw boxes
        annotated = results[0].plot()
        if roi:
            x, y, w, h = roi
            display_frame[y:y+h, x:x+w] = annotated
        else:
            display_frame = annotated

        # Push to API
        if args.push and args.zone and time.time() - last_push > 3:
            ok = push_count(args.api, args.zone, count)
            last_push = time.time()
            push_str = "✓" if ok else "✗"
        else:
            push_str = "-"

        # Overlay HUD
        h_f, w_f = display_frame.shape[:2]
        cv2.rectangle(display_frame, (0, 0), (w_f, 50), (0, 0, 0), -1)
        avg = round(sum(counts[-30:]) / max(len(counts[-30:]), 1), 1)
        hud = (f"People: {count}  |  Avg(30f): {avg}  |  "
               f"Frame: {frame_count}  |  Push: {push_str}  |  {'PAUSED' if paused else datetime.now().strftime('%H:%M:%S')}")
        cv2.putText(display_frame, hud, (10, 33),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 230, 150), 2)

        cv2.imshow("CrowdShield — Video Tester  (Q=quit, Space=pause)", display_frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        elif key == ord(" "):
            paused = not paused

    cap.release()
    cv2.destroyAllWindows()

    # Summary
    if counts:
        print("\n── Detection Summary ──────────────────────────")
        print(f"  Frames processed : {frame_count}")
        print(f"  Average count    : {sum(counts)/len(counts):.1f}")
        print(f"  Peak count       : {max(counts)}")
        print(f"  Min count        : {min(counts)}")
        print("───────────────────────────────────────────────\n")


if __name__ == "__main__":
    main()
