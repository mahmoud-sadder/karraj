# Attribution

The MIT licence in `LICENSE` covers this repository's source code. The 3D assets
it ships are third-party works under Creative Commons terms, which require
attribution wherever the work is distributed or displayed.

## public/models/car.glb

> Car Concept © 2024 Darmstadt Graphics Group GmbH, model and textures by Eric
> Chadwick, CC BY 4.0

Arabic:

> ‏Car Concept © 2024 Darmstadt Graphics Group GmbH، النموذج والخامات من إعداد
> ‏Eric Chadwick، رخصة CC BY 4.0

- **Source:** [KhronosGroup/glTF-Sample-Assets — CarConcept](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept)
- **Licence:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Modifications:** the file in this repository is a derivative. `tools/prepare-car.mjs`
  removes Khronos trade marks, renames materials to stable slugs, strips the
  `KHR_materials_variants` and `KHR_materials_transmission` extensions, simplifies
  selected meshes, and recompresses geometry and textures. See the pipeline table
  in `README.md`.

### Trade mark removal is a licence condition, not a courtesy

The CC BY 4.0 grant on the Khronos sample assets does **not** extend to Khronos
trade marks. `tools/prepare-car.mjs` therefore deletes the `Khronos_C.png` image,
clears the emissive texture and factor from the six materials that referenced it,
and deletes the `License Plate` and `InteriorSteeringEmblem` nodes. The build
asserts all of this and fails if any of it regresses.
