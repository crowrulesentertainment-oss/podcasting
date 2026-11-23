# CrowRules Podcasting RTMP Server

This directory contains a MediaMTX RTMP ingest server configuration and a GitHub Actions deployment workflow. The server is designed to run on a VPS with a public TCP port; GitHub Pages does not host RTMP streams.

## What it provides

- RTMP ingest on TCP port 1935 for OBS Studio or Streamlabs Desktop.
- HLS playback on TCP port 8888 for browser-based monitoring.
- Authenticated publishing to the `live` stream path.
- Public read access to the HLS output.
- GitHub Actions deployment over SSH after the VPS is prepared.

## VPS requirements

Use a Linux VPS that supports Docker Engine and Docker Compose. Configure the provider firewall and host firewall to allow:

- TCP 22 (or your custom SSH port) from trusted administration IPs.
- TCP 1935 for RTMP publishing.
- TCP 8888 for HLS playback/monitoring.

The server must have a stable public IP or DNS name. Install Docker Engine and the Docker Compose plugin before running the GitHub workflow.

**Important security note:** This starter uses standard RTMP on port 1935. Standard RTMP does not encrypt the stream or its publishing credentials in transit. Do not use it for a production broadcast over an untrusted network until RTMPS/TLS is configured, or protect the ingest path with a VPN/private network and strict firewall allowlisting. Never put a stream password in website JavaScript or commit it to this repository.

## GitHub Actions repository secrets

Add these secrets in the repository's Settings → Secrets and variables → Actions:

| Secret | Meaning |
|---|---|
| `RTMP_HOST` | VPS public IP address or DNS hostname |
| `RTMP_SSH_PORT` | SSH port; usually `22` |
| `RTMP_SSH_USER` | VPS deployment user with permission to run Docker |
| `RTMP_SSH_KEY` | Private SSH key for that deployment user |
| `RTMP_KNOWN_HOSTS` | Verified known_hosts entry for the VPS |
| `RTMP_PUBLISH_USER` | Username used by OBS/Streamlabs to publish |
| `RTMP_PUBLISH_PASSWORD` | Long, unique publishing password |

The workflow creates the runtime MediaMTX configuration from the template using the two publishing secrets. The generated file is copied to the VPS and is not committed.

## Deploy

1. Provision the VPS and install Docker Engine + Docker Compose.
2. Configure firewall rules and create a dedicated deployment user.
3. Add all seven repository Actions secrets.
4. Open Actions → Deploy CrowRules RTMP Server → Run workflow.
5. Confirm the MediaMTX container is running on the VPS.

A push affecting `streaming/mediamtx/` also triggers deployment automatically once the secrets and VPS are configured.

## OBS / Streamlabs connection

Use the following as a starting point after deployment:

- Service: Custom
- Server: `rtmp://YOUR_VPS_HOST/live?user=YOUR_PUBLISH_USER&pass=YOUR_PUBLISH_PASSWORD`
- Stream key: leave blank

The HLS preview URL is:

`http://YOUR_VPS_HOST:8888/live/index.m3u8`

Replace all example values. Treat the publish URL as a secret because it contains the publishing credentials.

## Relationship to CrowRules Podcasting

The existing Creator Studio remains the control panel for broadcast records, VDO.Ninja guest links, host shifts, and OBS WebSocket controls. This MediaMTX service is a separate media server; it does not replace OBS/Streamlabs, VDO.Ninja, Supabase, or the YouTube destination.

The current server configuration is an ingest and HLS-monitoring endpoint. It does not automatically forward the stream to YouTube. Configure a separate OBS/Streamlabs output to YouTube, or add a separately secured server-side relay after validating the ingest server.
