# Third-party notices

Forma's Image painter is a TypeScript adaptation of the progressive polygon-painting technique demonstrated in Preslav Rachev's *Generative Art in Go* and its companion code, also reflected in the user-provided Go example. The source image supplies sample positions and colors; polygon strokes shrink over time, gain opacity, receive positional jitter, and can gain contrasting outlines when small.

- Book: [*Generative Art in Go: A creative guide*](https://preslav.me/generative-art-in-golang/), Preslav Rachev, copyright 2020–2021.
- Companion repository: [preslavrachev/generative-art-in-go](https://github.com/preslavrachev/generative-art-in-go).
- Reviewed companion revision: `d3783dde2a06`, locally available as Go module version `v0.0.0-20260629084947-d3783dde2a06`.

The user-provided book was consulted for inspiration. Its text, illustrations, and PDF are not redistributed with the application. The MIT license below applies to the companion software; it does not license the book or its illustrations. The other nine generators are original implementations of established algorithms and geometric techniques.

The following license is reproduced from the companion repository's `LICENSE.md`:

```text
MIT License

Copyright (c) 2021 Preslav Rachev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Angular, RxJS, TypeScript, Playwright, tslib, and other dependencies retain their respective licenses. Their exact installed versions are recorded in `package-lock.json`; license files accompany their packages in `node_modules`. Angular's production build also extracts bundled dependency notices into `dist/forma/3rdpartylicenses.txt`.
