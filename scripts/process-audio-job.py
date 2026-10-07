#!/usr/bin/env python3
import os, subprocess, tempfile, json, math, requests
from pathlib import Path
from urllib.parse import quote

SB=os.environ["SUPABASE_URL"].rstrip("/")
KEY=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json"}
BASE=SB+"/rest/v1"
def req(method,path,**kw):
    h=H.copy(); h.update(kw.pop("headers",{}))
    r=requests.request(method,BASE+path,headers=h,**kw); r.raise_for_status()
    return r.json() if r.content else None
jobs=req("GET","/podcast_media_processing_jobs?select=*&status=eq.queued&job_type=eq.audio_normalize&order=created_at.asc&limit=1")
if not jobs: print("No audio jobs."); raise SystemExit(0)
job=jobs[0]
jid=job["id"]; aid=job["media_asset_id"]
req("PATCH",f"/podcast_media_processing_jobs?id=eq.{jid}",json={"status":"processing","attempts":job.get("attempts",0)+1,"started_at":"now()","updated_at":"now()"})
assets=req("GET",f"/podcast_media_assets?id=eq.{aid}&select=*")
if not assets: raise RuntimeError("Asset not found")
asset=assets[0]; bucket=asset["storage_bucket"]; path=asset["storage_path"]
sign=req("POST",f"/storage/v1/object/sign/{bucket}",json={"expiresIn":3600,"paths":[path]})
signed=sign[0]["signedURL"] if isinstance(sign,list) else sign["signedURL"]
if signed.startswith("/"): signed=SB+"/storage/v1"+signed
with tempfile.TemporaryDirectory() as td:
    src=Path(td)/"source"; mp3=Path(td)/"delivery.mp3"; m4a=Path(td)/"delivery.m4a"; report=Path(td)/"ffmpeg.txt"; wav=Path(td)/"wave.json"
    with requests.get(signed,stream=True,timeout=120) as rr:
        rr.raise_for_status()
        with open(src,"wb") as f:
            for chunk in rr.iter_content(1024*1024):
                if chunk: f.write(chunk)
    probe=subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","json",str(src)],text=True)
    duration=float(json.loads(probe)["format"]["duration"])
    loud=subprocess.run(["ffmpeg","-hide_banner","-i",str(src),"-af","ebur128=framelog=verbose","-f","null","-"],capture_output=True,text=True)
    sil=subprocess.run(["ffmpeg","-hide_banner","-i",str(src),"-af","silencedetect=noise=-45dB:d=1","-f","null","-"],capture_output=True,text=True)
    (Path(td)/"analysis.json").write_text(json.dumps({"duration_seconds":round(duration),"ebur128":loud.stderr[-12000:],"silence":sil.stderr[-12000:]},indent=2))
    subprocess.run(["ffmpeg","-y","-i",str(src),"-af","loudnorm=I=-16:TP=-1.5:LRA=11","-codec:a","libmp3lame","-b:a","128k","-ar","48000",str(mp3)],check=True)
    subprocess.run(["ffmpeg","-y","-i",str(src),"-af","loudnorm=I=-16:TP=-1.5:LRA=11","-c:a","aac","-b:a","128k","-movflags","+faststart","-ar","48000",str(m4a)],check=True)
    pcm=subprocess.Popen(["ffmpeg","-v","error","-i",str(mp3),"-ac","1","-ar","8000","-f","s16le","-"],stdout=subprocess.PIPE)
    samples=[]; block=16000
    while True:
        b=pcm.stdout.read(block*2)
        if not b: break
        vals=[abs(int.from_bytes(b[i:i+2],"little",signed=True))/32768 for i in range(0,len(b)-1,2)]
        if vals: samples.append(max(vals))
    peak=max(samples) if samples else 0
    # downsample to 200 bars
    n=200; step=max(1,math.ceil(len(samples)/n)); waveform=[round(max(samples[i:i+step]),4) for i in range(0,len(samples),step)][:n]
    outbase=f"{asset['user_id']}/{asset.get('episode_id') or asset['id']}/"
    def upload(local,name,ctype):
        up=f"{SB}/storage/v1/object/cr-podcast-delivery/{quote(outbase+name,safe='/')}"
        with open(local,"rb") as fh:
            r=requests.post(up,headers={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":ctype,"x-upsert":"true"},data=fh)
        r.raise_for_status()
    upload(mp3,"episode.mp3","audio/mpeg"); upload(m4a,"episode.m4a","audio/mp4")
    mp3url=f"{SB}/storage/v1/object/public/cr-podcast-delivery/{outbase}episode.mp3"
    m4aurl=f"{SB}/storage/v1/object/public/cr-podcast-delivery/{outbase}episode.m4a"
    result={"duration_seconds":round(duration),"waveform":waveform,"peak":peak,"delivery_mp3":mp3url,"delivery_m4a":m4aurl,"silence_analysis":sil.stderr[-4000:],"loudness_analysis":loud.stderr[-4000:]}
    req("PATCH",f"/podcast_media_assets?id=eq.{aid}",json={"status":"ready","duration_seconds":round(duration),"waveform":waveform,"loudness_lufs":-16,"normalized_path":outbase+"episode.mp3","updated_at":"now()"})
    if asset.get("episode_id"):
        req("PATCH",f"/podcast_episodes?id=eq.{asset['episode_id']}",json={"duration_seconds":round(duration),"audio_url":mp3url,"updated_at":"now()"})
    req("PATCH",f"/podcast_media_processing_jobs?id=eq.{jid}",json={"status":"completed","result":result,"completed_at":"now()","updated_at":"now()"})
print("Processed",aid)
