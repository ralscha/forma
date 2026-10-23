# Forma

A browser-based generative art studio built with Angular and TypeScript. Choose a generator, adjust its rules, explore seeded variations, and keep the results as images or reusable recipes. Rendering and image processing happen locally; there is no backend, analytics, or external API dependency.

Inspiration came from Preslav Rachev's [*Generative Art in Go*](https://preslav.me/generative-art-in-golang/) and its [companion repository](https://github.com/preslavrachev/generative-art-in-go). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and the companion code's license.


## Demo

Explore the demo at [forma.rasc.ch](https://forma.rasc.ch).


## Run it locally

Start the application with:

```sh
npm ci
npm start
```

Open [http://127.0.0.1:4200](http://127.0.0.1:4200) in your browser.


## Build and test

Production builds and browser tests use:

```sh
npm run build
npm test
```

Playwright uses the installed Microsoft Edge executable on Windows when available. Otherwise, install its Chromium browser with `npx playwright install chromium`. Set `PLAYWRIGHT_EXECUTABLE_PATH` to use another compatible browser executable. Tests start the development server automatically or reuse an existing server at port 4200.

Production output is static content in `dist/forma/browser`. Deploy that entire directory to an HTTP(S) static host, including its generated JavaScript worker files. `npm run build` includes the project license, attribution, and dependency license notices in that directory. Serve JavaScript with a JavaScript MIME type such as `text/javascript`; HTML responses for missing worker files will prevent worker loading.

## Generators

The library contains ten generators, each with its own composition controls:

| Generator | Explore |
| --- | --- |
| Flow field | Thread count, trail length, field scale, turbulence, curl, and step length |
| Contour atlas | Contour levels, terrain scale, fine detail, island shape, and grid resolution |
| Orbital harmonics | Layers, petals, petal depth, twist, inner opening, and eccentricity |
| Recursive branches | Growth points, branching depth, branch angle, length decay, wind, and foliage |
| Circle packing | Circle limit, radius range, spacing, filled circles, and inner rings |
| Truchet tiles | Tile count, orientation bias, parallel paths, and path spacing |
| Constellation | Star count, connection distance, cluster count, spread, and star size |
| Parametric waves | Wave count, frequency, amplitude, noise distortion, and phase drift |
| Cellular mosaic | Cell count, irregularity, relaxation, spacing, and color coverage |
| Image painter | Stroke count, brush size and decay, jitter, polygon sides, starting opacity, opacity buildup, outline threshold, and outline strength |

Every generator also offers a seed, eight palettes, paper color, line weight, ink opacity, grain, rotation, and scale. Use **New seed** to explore another arrangement or **Randomize settings** to change the composition and palette. **Reset settings** restores the current generator's defaults while preserving the seed. Three suggested variations provide additional starting points.

The same recipe, source image, output dimensions, and browser renderer reproduce the same artwork. Canvas rasterization can vary across browsers, operating systems, or browser updates, so byte-identical images across platforms are not guaranteed. Different output resolutions are rendered again at their target size. Imports validate generator names, recipe versions, colors, and numeric values; controls are clamped to their supported ranges.

**Undo** and **Redo** retain up to 80 recipe edits during the session. Aspect-ratio changes and source-image replacement are separate from this recipe history. Keyboard shortcuts are `N` for a new seed, `S` to save a study, `Ctrl/Cmd+Z` to undo, `Ctrl/Cmd+Shift+Z` to redo, and `Escape` to leave fullscreen or close the information dialog. Shortcuts do not interrupt typing in inputs.

**Save study** keeps a recipe and thumbnail in this browser's local storage. A collection holds up to 24 studies, subject to the browser's storage quota. The latest successfully rendered study is also restored on the next visit when storage is available. This automatic restore is best effort; browser data removal or private browsing can remove local work. Export a recipe for a portable copy.

**Export recipe** downloads versioned JSON containing the settings and aspect ratio, plus the source image for Image painter studies. **Import recipe** restores it. Image painter accepts PNG, JPEG, and WebP files up to 20 MB and resizes sources to a maximum 768-pixel edge for processing and storage. This processed source is embedded in saved painter studies and exported painter recipes. Recipe imports are limited to 8 MB. **Copy study link** encodes settings into a `#study=` URL fragment; image-based painter studies use recipe files because links do not contain source images.

**Export PNG** renders at 1024, 2048, or 4096 pixels on the longest edge, using the selected square, landscape 4:3, or portrait 3:4 aspect ratio. Exported PNGs are freshly rendered from the recipe rather than enlarged preview screenshots.


## License

Forma is licensed under the [MIT License](LICENSE). Third-party components retain their respective licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
