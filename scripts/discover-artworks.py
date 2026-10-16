#!/usr/bin/env python3
"""Find public-domain Chicago paintings with dog-related titles or subject tags.

This searches catalog metadata; it does not run a vision model or prove a dog is
visible. Uses Python's standard library and the same polite fetcher as the demo.
"""

import argparse
import importlib.util
import json
from pathlib import Path
import urllib.parse


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("museum", ROOT / "scripts/fetch-artworks.py")
museum = importlib.util.module_from_spec(spec)
spec.loader.exec_module(museum)

QUERY = {
    "bool": {
        "filter": [
            {"term": {"is_public_domain": True}},
            {"term": {"artwork_type_title.keyword": "Painting"}},
            {"exists": {"field": "image_id"}},
        ],
        "should": [
            {"terms": {"subject_titles.keyword": ["dog", "dogs"]}},
            {"match": {"title": "dog dogs hound hounds puppy puppies"}},
        ],
        "minimum_should_match": 1,
    }
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path,
                        default=ROOT / "artifacts/discovery/dog-paintings.json")
    args = parser.parse_args()
    params = {
        "query": QUERY,
        "limit": 100,
        "fields": museum.FIELDS.split(",") + ["subject_titles"],
    }
    url = "https://api.artic.edu/api/v1/artworks/search?params=" + urllib.parse.quote(
        json.dumps(params, separators=(",", ":")))
    raw, _ = museum.fetch(url)
    response = json.loads(raw)
    records = response["data"]
    if any(record.get("is_public_domain") is not True
           or record.get("artwork_type_title") != "Painting"
           or not record.get("image_id") for record in records):
        raise ValueError("Search returned a record outside the requested image criteria")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(response, indent=2, ensure_ascii=False) + "\n")
    total = response["pagination"]["total"]
    print(f"Retrieved {len(records)} of {total} matching catalog records.")
    if total > len(records):
        print("Only the first page is saved. Review the results before requesting more.")
    for record in records:
        print(f"{record['id']}: {record['title']}")
    print(f"Saved catalog candidates to {args.output}")


if __name__ == "__main__":
    main()
