#!/usr/bin/env python3
"""Fetch the demo's public-domain paintings from the Art Institute of Chicago.

Uses only Python's standard library. Run: python3 scripts/fetch-artworks.py
Museum API docs: https://api.artic.edu/docs/
"""

import argparse
import json
from pathlib import Path
import struct
import time
import urllib.error
import urllib.parse
import urllib.request


DEFAULT_IDS = [20697, 886, 896, 497, 561, 27992, 20684, 111436]
USER_AGENT = "ArtSearchAssessment/0.1 (small public-domain demo)"
API = "https://api.artic.edu/api/v1/artworks/"
FIELDS = "id,title,artist_display,date_display,image_id,is_public_domain,artwork_type_title,credit_line"
last_request = 0.0


def fetch(url):
    """Make sequential requests, at least one second apart."""
    global last_request
    for attempt in range(3):
        time.sleep(max(0, 1.0 - (time.monotonic() - last_request)))
        last_request = time.monotonic()
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read(), response.headers.get_content_type()
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError("Request failed")


def jpeg_size(data):
    """Read JPEG frame dimensions without adding an image library dependency."""
    if not data.startswith(b"\xff\xd8"):
        raise ValueError("Expected a JPEG image")
    offset = 2
    frame_markers = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                     0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    while offset < len(data):
        if data[offset] != 0xFF:
            raise ValueError("Invalid JPEG marker")
        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        marker = data[offset]
        offset += 1
        if marker in (0xD8, 0xD9, 0x01) or 0xD0 <= marker <= 0xD7:
            continue
        length = struct.unpack_from(">H", data, offset)[0]
        if length < 2 or offset + length > len(data):
            raise ValueError("Invalid JPEG segment length")
        if marker in frame_markers:
            height, width = struct.unpack_from(">HH", data, offset + 3)
            return width, height
        if marker == 0xDA:
            break
        offset += length
    raise ValueError("JPEG dimensions not found")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ids", type=int, nargs="+", default=DEFAULT_IDS)
    parser.add_argument("--output-dir", type=Path,
                        default=Path(__file__).resolve().parents[1] / "public")
    args = parser.parse_args()
    if len(set(args.ids)) != len(args.ids):
        parser.error("Artwork IDs must be unique")
    output = args.output_dir.resolve()
    images = output / "images"
    images.mkdir(parents=True, exist_ok=True)
    manifest_path = output / "artworks.json"
    existing = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
    notes = {item["id"]: item["note"] for item in existing if item.get("note")}
    manifest = []
    for artwork_id in args.ids:
        raw, _ = fetch(f"{API}{artwork_id}?fields={urllib.parse.quote(FIELDS)}")
        response = json.loads(raw)
        artwork = response["data"]
        if artwork.get("is_public_domain") is not True:
            raise ValueError(f"Artwork {artwork_id} is not marked public domain")
        if artwork.get("artwork_type_title") != "Painting" or not artwork.get("image_id"):
            raise ValueError(f"Artwork {artwork_id} must be a painting with an image")
        image_id = artwork["image_id"]
        image_url = f"{response['config']['iiif_url']}/{image_id}/full/843,/0/default.jpg"
        data, content_type = fetch(image_url)
        if content_type != "image/jpeg":
            raise ValueError(f"Unexpected image content type: {content_type}")
        width, height = jpeg_size(data)
        image_path = images / f"{artwork_id}.jpg"
        image_path.write_bytes(data)
        entry = {
            "id": artwork["id"],
            "title": artwork["title"],
            "artist": artwork["artist_display"],
            "date": artwork["date_display"],
            "image": f"/images/{artwork_id}.jpg",
            "imageId": image_id,
            "sourceUrl": f"https://www.artic.edu/artworks/{artwork_id}",
            "width": width,
            "height": height,
            "credit": artwork["credit_line"],
            "publicDomain": True,
        }
        if artwork_id in notes:
            entry["note"] = notes[artwork_id]
        manifest.append(entry)
        print(f"{artwork_id}: {artwork['title']} ({width} x {height})", flush=True)
    temporary = manifest_path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    temporary.replace(manifest_path)
    print(f"Wrote {len(manifest)} verified public-domain paintings to {manifest_path}")


if __name__ == "__main__":
    main()
