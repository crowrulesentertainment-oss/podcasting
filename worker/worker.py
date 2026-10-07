import json
import logging
import os
import shutil
import subprocess
import tempfile
import time
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime, timezone
from urllib.parse import quote
from pathlib import Path

import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
INTERVAL = int(os.getenv("WORKER_INTERVAL_SECONDS", "5"))
REST = f"{SUPABASE_URL}/rest/v1"
STORAGE = f"{SUPABASE_URL}/storage/v1"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

def db_get(table, params):
    r = requests.get(f"{REST}/{table}", headers=HEADERS, params=params, timeout=30)
    r.raise_for_status()
    return r.json()

def db_patch(table, params, payload):
    h = dict(HEADERS)
    h["Prefer"] = "return=representation"
    r = requests.patch(f"{REST}/{table}", headers=h, params=params, json=payload, timeout=30)
    r.raise_for_status()
    return r.json()

def db_insert(table, payload):
    h = dict(HEADERS)
    h["Prefer"] = "return=representation"
    r = requests.post(f"{REST}/{table}", headers=h, json=payload, timeout=30)
    r.raise_for_status()
    return r.json()

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def sign_storage_url(bucket, path, expires=3600):
    r = requests.post(
        f"{STORAGE}/object/sign/{bucket}/{quote(path, safe="/")}",
        headers=HEADERS,
        json={"expiresIn": expires},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    signed = data.get("signedURL") or data.get("signedUrl")
    if not signed:
        raise RuntimeError("Supabase did not return a signed storage URL")
    if signed.startswith("/"):
        return STORAGE + signed
    return signed

def upload_storage(bucket, path, local_path, content_type):
    with open(local_path, "rb") as fh:
        h = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}", "Content-Type": content_type, "x-upsert": "true"}
        r = requests.post(f"{STORAGE}/object/{bucket}/{path}", headers=h, data=fh, timeout=1800)
    r.raise_for_status()

def run(cmd, *, check=True, capture=False):
    logging.info("RUN %s", " ".join(map(str, cmd)))
    return subprocess.run(cmd, check=check, text=True, capture_output=capture)

def probe_duration(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)], capture=True)
    return float(r.stdout.strip())

def measure_loudness(path):
    r = run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
        check=False, capture=True,
    )
    text = r.stderr
    start = text.rfind("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None

def detect_silence(path):
    r = run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af", "silencedetect=noise=-45dB:d=1", "-f", "null", "-"],
        check=False, capture=True,
    )
    lines = r.stderr.splitlines()
    starts = [x for x in lines if "silence_start:" in x]
    ends = [x for x in lines if "silence_end:" in x]
    return {"silence_regions": len(starts), "silence_start_count": len(starts), "silence_end_count": len(ends)}

def normalize_audio(source, mp3_out, m4a_out):
    measured = measure_loudness(source)
    if measured:
        filt = (
            "loudnorm=I=-16:TP=-1.5:LRA=11:"
            f"measured_I={measured.get('input_i', -16)}:"
            f"measured_TP={measured.get('input_tp', -1.5)}:"
            f"measured_LRA={measured.get('input_lra', 11)}:"
            f"measured_thresh={measured.get('input_thresh', -30)}:"
            f"offset={measured.get('target_offset', 0)}:linear=true:print_format=summary"
        )
    else:
        filt = "loudnorm=I=-16:TP=-1.5:LRA=11"

    run(["ffmpeg", "-y", "-hide_banner", "-i", str(source), "-af", filt, "-ar", "48000", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k", str(mp3_out)])
    run(["ffmpeg", "-y", "-hide_banner", "-i", str(source), "-af", filt, "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(m4a_out)])
    return measured

def waveform(path, bins=200):
    cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "8000", "-f", "s16le", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    raw = p.stdout.read()
    p.wait()
    if p.returncode != 0:
        raise RuntimeError("Unable to decode processed master for waveform")
    import array
    samples = array.array("h")
    samples.frombytes(raw)
    if not samples:
        return []
    step = max(1, len(samples) // bins)
    out = []
    for i in range(bins):
        chunk = samples[i * step:min(len(samples), (i + 1) * step)]
        if not chunk:
            out.append(0.0)
        else:
            peak = max(abs(x) for x in chunk) / 32768.0
            out.append(round(peak, 4))
    return out

def claim_job():
    jobs = db_get(
        "podcast_media_processing_jobs",
        {"select": "*", "job_type": "eq.audio_normalize", "status": "eq.queued", "order": "created_at.asc", "limit": "1"},
    )
    if not jobs:
        return None
    job = jobs[0]
    claimed = db_patch(
        "podcast_media_processing_jobs",
        {"id": f"eq.{job['id']}", "status": "eq.queued"},
        {"status": "processing", "started_at": now_iso(), "attempts": int(job.get("attempts", 0)) + 1, "updated_at": now_iso()},
    )
    return claimed[0] if claimed else None

def process(job):
    asset_id = job["media_asset_id"]
    upload = db_get("podcast_media_uploads", {"id": f"eq.{job['upload_id']}", "select": "*"})
    if not upload:
        raise RuntimeError("Upload session not found")
    upload = upload[0]
    asset = db_get("podcast_media_assets", {"id": f"eq.{asset_id}", "select": "*"})
    if not asset:
        raise RuntimeError("Media asset not found")
    asset = asset[0]

    tmp = Path(tempfile.mkdtemp(prefix="crp-media-"))
    try:
        source = tmp / upload["file_name"]
        source_url = sign_storage_url(upload["storage_bucket"], upload["storage_path"])
        logging.info("Downloading source %s", upload["storage_path"])
        with requests.get(source_url, stream=True, timeout=120) as r:
            r.raise_for_status()
            with open(source, "wb") as fh:
                for chunk in r.iter_content(1024 * 1024):
                    if chunk:
                        fh.write(chunk)

        duration = probe_duration(source)
        silence = detect_silence(source)
        mp3 = tmp / "episode.mp3"
        m4a = tmp / "episode.m4a"
        measured = normalize_audio(source, mp3, m4a)
        final_duration = probe_duration(mp3)
        wave = waveform(mp3)

        base = f"{job['user_id']}/{job['episode_id'] or asset_id}"
        mp3_path = f"{base}/episode.mp3"
        m4a_path = f"{base}/episode.m4a"
        upload_storage("cr-podcast-delivery", mp3_path, mp3, "audio/mpeg")
        upload_storage("cr-podcast-delivery", m4a_path, m4a, "audio/mp4")

        delivery_url = f"{SUPABASE_URL}/storage/v1/object/public/cr-podcast-delivery/{mp3_path}"
        loudness = None
        if measured:
            try:
                loudness = float(measured.get("input_i"))
            except (TypeError, ValueError):
                pass

        db_patch("podcast_media_assets", {"id": f"eq.{asset_id}"}, {
            "status": "ready",
            "duration_seconds": round(final_duration),
            "waveform": wave,
            "loudness_lufs": loudness,
            "normalized_path": mp3_path,
            "updated_at": now_iso(),
        })

        if job.get("episode_id"):
            db_patch("podcast_episodes", {"id": f"eq.{job['episode_id']}"}, {
                "audio_url": delivery_url,
                "duration_seconds": round(final_duration),
            })

        db_patch("podcast_media_processing_jobs", {"media_asset_id": f"eq.{asset_id}", "job_type": "eq.audio_metadata", "status": "eq.queued"}, {"status": "completed", "result": {"duration_seconds": round(final_duration)}, "completed_at": now_iso(), "updated_at": "now()"})
        db_patch("podcast_media_processing_jobs", {"media_asset_id": f"eq.{asset_id}", "job_type": "eq.waveform", "status": "eq.queued"}, {"status": "completed", "result": {"waveform": wave, "source": "processed_master"}, "completed_at": "now()", "updated_at": "now()"})

        return {
            "duration_source": duration,
            "duration_final": final_duration,
            "loudness": loudness,
            "silence": silence,
            "delivery_mp3": mp3_path,
            "delivery_m4a": m4a_path,
            "waveform_points": len(wave),
        }
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ("/", "/health", "/healthz"):
            body = b"{\"ok\":true,\"service\":\"crowrules-podcast-media-worker\"}"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):
        return

def start_health_server():
    port = int(os.getenv("PORT", "10000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), HealthHandler)
    logging.info("Health server listening on port %s", port)
    server.serve_forever()

def main():
    threading.Thread(target=start_health_server, daemon=True).start()
    logging.info("CrowRules Podcasting FFmpeg worker online")
    while True:
        try:
            job = claim_job()
            if not job:
                time.sleep(INTERVAL)
                continue
            logging.info("Claimed audio_normalize job %s", job["id"])
            try:
                result = process(job)
                db_patch("podcast_media_processing_jobs", {"id": f"eq.{job['id']}"}, {"status": "completed", "result": result, "completed_at": "now()", "updated_at": "now()"})
                logging.info("Completed job %s", job["id"])
            except Exception as exc:
                logging.exception("Job %s failed", job["id"])
                attempts = int(job.get("attempts", 1))
                status = "queued" if attempts < 3 else "failed"
                db_patch("podcast_media_processing_jobs", {"id": f"eq.{job['id']}"}, {"status": status, "error_message": str(exc)[:2000], "updated_at": "now()"})
        except Exception:
            logging.exception("Worker loop error")
            time.sleep(INTERVAL)

if __name__ == "__main__":
    main()
