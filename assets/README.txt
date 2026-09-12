YI.WANG V6 — original fictional world assets

Runtime terrain pairs:
- world-day.webp / world-night.webp: the original summer/daytime world and registered night repaint.
- spring-day.webp / spring-night.webp: matching spring terrain.
- autumn-day.webp / autumn-night.webp: matching autumn terrain.
- winter-day.webp / winter-night.webp: matching terrain with snow on the slope, cottage roof and fence.
Desktop terrain size is 1672 x 941. These are fictional environmental paintings, not personal photographs or real private places.

Transparent source artwork:
- clouds.webp: painted cloud bank.
- foreground.webp: original plants used to prepare a single viewport-sized foreground.
- window.webp: wood window/sill, cup and curtain with genuine transparent outdoor opening.

Mobile:
assets/mobile/ contains the eight seasonal terrain files plus clouds.webp, foreground.webp and window.webp.
These WebP sources have longest edge 1100 pixels; transparent sources retain alpha.
scene-painter.js chooses these files for viewports at or below 760 pixels and prepares viewport-specific foreground/window crops.

Rendering:
The painter loads and decodes sources on demand, then paints seasonal/day-night/weather appearance once into cached canvases. Two canvas buffers blend on the same 1200ms state clock. Continuous CSS color filters and CSS image masks are not used.
Rain mist/wetness and cloud colors are baked during appearance preparation; sparse live precipitation uses the environment canvas.
Snow weather uses winter terrain regardless of the selected season, so snow cover is part of the landscape, not just particles.
Autumn foreground removes the bottom flowers/grass and retains only restrained edge branches. Winter foreground is cleared; the winter main terrain provides the snow and seasonal plants.

Removed from V6 runtime:
- cat-sleeping.webp is not requested or displayed. A 35% size reduction and edge-placement screenshot trial still showed perspective, ground-contact and night-color mismatches; the cat was removed.
- winter-foreground.webp is not used. Its old opaque snow/checkerboard overlay and CSS alpha-mask workaround are retired.
If these legacy source files remain in a working copy, they are not active scene layers.

Other files:
- social-preview.jpg: JPEG social-sharing preview.
- favicon.svg / apple-touch-icon.png: original site icons.
- User-supplied photos may be placed here and referenced with relative paths in PHOTOS in ../script.js.
- No audio files: environmental sound is generated locally with Web Audio only after user opt-in.

Full generation prompts and provenance: ../ASSET-PROMPTS.md.
Do not label environment artwork as the user's personal photos, locations, history, pet ownership or actual local weather.
Implementation notes are not a claim that all V6 browser tests passed; see ../VALIDATION.md for actual evidence and limits.
