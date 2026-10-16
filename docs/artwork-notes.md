# Artwork sources and visual inspection

The 40 demo images come from the Art Institute of Chicago's public API and
official IIIF image service. Each record was checked on October 16, 2026 for
`is_public_domain: true`, `artwork_type_title: "Painting"`, and a nonempty image
identifier before its image was retrieved. Titles, artist text, dates, and credit
lines in `public/artworks.json` are copied from those API records.

- API and image guidance: <https://api.artic.edu/docs/>
- Open-access image policy: <https://www.artic.edu/open-access/open-access-images>
- Image URL: `https://www.artic.edu/iiif/2/{image_id}/full/843,/0/default.jpg`
- Metadata URL: `https://api.artic.edu/api/v1/artworks/{id}`

The museum's API metadata is generally CC0; its `description` field is CC BY.
This project does not copy that field. The selected artworks are marked public
domain by the museum; do not assume that every image available through its IIIF
service has the same rights. Preserve the source link and credit line when
displaying an artwork. The museum does not endorse this project.

## Reproduce the image set

```sh
python3 scripts/fetch-artworks.py
```

To find additional catalog candidates, run `python3 scripts/discover-artworks.py`.
On October 16, 2026, its search returned 66 public-domain paintings with an image
and either a dog/dogs subject tag or a dog-related title. The gallery keeps the
original eight works and adds 32 candidates selected for varied settings,
periods, styles, dog sizes, and image aspect ratios. The two original negative
controls remain. We did not select additions based on whether the model found
their dogs.

Python 3's standard library is sufficient. The script makes sequential requests
at least one second apart, uses an identifying User-Agent, requests the museum's
recommended 843-pixel image width, and verifies JPEG dimensions. It refuses
records that are not public-domain paintings. Existing qualitative `note` values
are preserved when refreshing the manifest. A custom set can be requested with
`--ids 886 561`; use `--output-dir /path/to/public` for a separate destination.

The data is deliberately small and selected for demonstration. Model results
must not be represented as a collection-wide accuracy study. No model outputs
or bounding-box annotations are included in this asset manifest.

## Original eight-image pilot: visual inspection

These observations come from inspecting the actual local 843-pixel JPEGs. They
are qualitative reference notes, not independently reviewed ground truth or
model predictions. Counts refer to dogs visible during this inspection.

| ID | Artwork | Visual observation | Useful test |
| --- | --- | --- | --- |
| [20697](https://www.artic.edu/artworks/20697) | Portrait of a Lady with a Dog | One dog on the woman's lap, lower right. The museum-supplied reproduction is grayscale. | Soft edges, low contrast, partial occlusion by an arm. |
| [886](https://www.artic.edu/artworks/886) | Three Little Girls | A large dog stands at lower right; a smaller puppy is held in the seated girl's lap. | Large dog plus small, partly occluded puppy. |
| [896](https://www.artic.edu/artworks/896) | The Road to Market | One dark dog at the far-right edge, behind the sheep. | Sheep and a horse should not be labeled as dogs; edge clipping. |
| [497](https://www.artic.edu/artworks/497) | A Mother Feeding her Child (The Happy Mother) | One small dog sits at the mother's feet, lower left of center. | Small dog in a detailed, dark interior. |
| [561](https://www.artic.edu/artworks/561) | The Family Concert | One dog at lower left approaches a black cat near the dish. | Distinguish the dog from the cat. |
| [27992](https://www.artic.edu/artworks/27992) | A Sunday on La Grande Jatte — 1884 | Two foreground dogs: a dark dog left of center and a smaller brown dog near the lower right. A monkey is beside the right-hand woman. | Stylized dogs at different scales; distinguish the monkey. |
| [20684](https://www.artic.edu/artworks/20684) | Paris Street; Rainy Day | No dog observed in the retrieved image. | Negative control with people and a busy street. |
| [111436](https://www.artic.edu/artworks/111436) | The Basket of Apples | No dog observed in the retrieved image. | Negative control with fruit, cloth, and a bottle. |

## Expanded gallery

The additional 32 image files were visually checked for successful downloads and
variety before inference. They include these contrasting examples:

- [Landscape with Dog](https://www.artic.edu/artworks/120081), Thomas Doughty:
  a large white dog in a landscape.
- [Portrait of a Girl with a Dog](https://www.artic.edu/artworks/59907), attributed
  to Alessandro Longhi: a lap dog in a grayscale reproduction.
- [Woman with Puppies](https://www.artic.edu/artworks/202666), Kitagawa Utamaro:
  small puppies near the bottom of a very tall, narrow painting.
- [Winter Scene](https://www.artic.edu/artworks/93450), Francisco de Goya:
  a small dark dog against snow.
- [The Music Lesson](https://www.artic.edu/artworks/16398), Jacob Ochtervelt:
  a dog resting on a chair in an interior.
- [Notre Dame de Paris](https://www.artic.edu/artworks/81568), Jean François
  Raffaëlli: a small dog in a busy, loosely painted urban scene.

All 40 titles, dates, credits, source links, and image identifiers are in
`public/artworks.json`. The expansion has no independently annotated dog counts;
its model outputs are examples to inspect, not a new accuracy measurement.

## Honest comparison with catalog search

The six positive examples above already have `dog` or `dogs` among the museum's
subject tags. The portrait also includes "Dog" in its title. Do not claim these
dogs are missing from the catalog. The demo adds visual localization and a way
to inspect possible dog details; it can show how a model handles size, style,
occlusion, and other animals. If comparing against title-only search, label that
baseline explicitly. Finding a dog in an untagged work would require a separate
verified example.
