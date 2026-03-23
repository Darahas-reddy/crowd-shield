# CrowdShield — Automatic Camera Counter

Replaces manual crowd counting with **real-time YOLOv8 people detection**.  
Each camera feed maps to one CrowdShield zone. Counts are pushed automatically — no human input needed.

---

## How It Works

```
CCTV / Webcam
     │
     ▼
YOLOv8 (detects every person in frame)
     │
     ▼  every 3 seconds
CrowdShield API  →  /api/zones/{id}/count
     │
     ▼
Dashboard updates live  →  alerts fire automatically
```

---

## Quick Start

### 1. Install dependencies

```bash
cd camera-counter
pip install -r requirements.txt
```

> YOLOv8 will auto-download `yolov8n.pt` (~6 MB) on first run.

---

### 2. Test with your webcam (no setup needed)

```bash
python camera_counter.py --demo
```

You'll see a window with live people detection. Press **Q** to quit.

---

### 3. Test on a video file

```bash
python test_video.py --video crowd_footage.mp4
```

This lets you verify detection accuracy before connecting live cameras.

---

### 4. Map your cameras to zones

Make sure the CrowdShield backend is running, then:

```bash
python zone_mapper.py
```

This will:
1. Fetch all zones you drew in the dashboard
2. Ask you to assign a camera source to each zone
3. Write a ready-to-use `config.json`

---

### 5. Run the counter

```bash
python camera_counter.py
```

Or with a custom config:

```bash
python camera_counter.py --config my_venue_config.json
```

---

## Config Reference

`config.json`:

```json
{
  "crowdshield_api": "http://localhost:8080/api",
  "push_interval_seconds": 3,
  "model": "yolov8n.pt",
  "confidence_threshold": 0.45,
  "show_preview": true,
  "cameras": [
    {
      "name": "Main Entrance",
      "source": 0,
      "zone_id": "abc123...",
      "roi": null
    }
  ]
}
```

| Field | Description |
|---|---|
| `source` | `0` = first webcam, `1` = second webcam, `"rtsp://..."` = IP camera, `"video.mp4"` = file |
| `zone_id` | Copy from CrowdShield dashboard → Zones tab |
| `roi` | `[x, y, width, height]` to crop the frame, or `null` for full frame |
| `push_interval_seconds` | How often counts are sent to the API (default: 3) |
| `show_preview` | Set `false` for headless/server deployments |

---

## Camera Source Examples

| Camera Type | Source Value |
|---|---|
| Built-in webcam | `0` |
| Second USB webcam | `1` |
| Hikvision / Dahua RTSP | `"rtsp://admin:pass@192.168.1.100:554/Streaming/Channels/101"` |
| Generic IP camera HTTP | `"http://192.168.1.101:8080/video"` |
| Pre-recorded video file | `"recordings/gate_cam.mp4"` |

---

## Model Options

| Model | Speed | Accuracy | Best For |
|---|---|---|---|
| `yolov8n.pt` | ⚡ Fastest | Good | Webcam, low-spec laptop |
| `yolov8s.pt` | Fast | Better | Most use cases |
| `yolov8m.pt` | Medium | Best | GPU available |

Change `"model"` in config.json. Downloads automatically on first use.

---

## ROI (Region of Interest)

If your camera covers a wider area than the zone, crop it:

```json
"roi": [x, y, width, height]
```

Example — use only the right half of a 1280×720 camera:
```json
"roi": [640, 0, 640, 720]
```

Use `test_video.py` to find the right crop values before going live.

---

## Headless / Server Deployment

Set `"show_preview": false` in config.json to run without a display (e.g. on a Raspberry Pi or remote server).

```bash
# Run in background
nohup python camera_counter.py --config config.json > counter.log 2>&1 &
```

---

## Troubleshooting

**"Cannot open source: 0"** — No webcam found. Check USB connection or try source `1`.

**"API push failed"** — Backend not running. Start with `mvn spring-boot:run` in the `backend/` folder.

**Low accuracy** — Try a higher model (`yolov8s.pt`), lower `confidence_threshold` to `0.35`, or adjust your ROI to exclude background clutter.

**High CPU usage** — Use `yolov8n.pt` and set `show_preview: false`.
