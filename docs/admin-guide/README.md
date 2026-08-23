# Administrator Guide

The customer-facing manual for the admin panel. Written for whoever runs the
catalogue, not for whoever wrote the code — no schema, no file paths, no
internals.

## Building it

```bash
node docs/admin-guide/build.mjs
```

Assembles `sections/*.html` in filename order, inlines the screenshots, and
prints `BOXX-Admin-Guide.pdf` through headless Chrome. Chapters that have no
screenshot yet render a labelled placeholder, so a draft always builds.

```bash
node docs/admin-guide/preview.mjs     # read it at http://localhost:4599
node docs/admin-guide/shot.mjs 1 6    # photograph pages 1-6 for design review
```

## Adding a chapter

1. Add `sections/NN-name.html` — a plain fragment, no `<html>` wrapper. Number it
   with room to spare; the files are sorted by name.
2. Add its screenshots to `shots.config.mjs` and capture them (below).
3. Add it to `sections/10-contents.html`.
4. Rebuild.

Available blocks: `.lede`, `.where`, `ol.steps`, `ul.plain`, `table`, `figure`,
`.note`, `.warn`, and `.visitor` for the "What the customer sees" panels that
close every chapter. Palette and type live in `assets/guide.css`.

## Screenshots

`shots.config.mjs` records how each picture was taken, so it can be retaken when
the admin changes. Rings and numbered badges are drawn into the live page by
`lib/annotate.js`, which means they land on the element rather than on guessed
coordinates, and the numbers match the figure captions.

```bash
node docs/admin-guide/capture.mjs                 # everything it can reach
node docs/admin-guide/capture.mjs 03-quiz-step2   # just one
```

### Screens behind the login

Recipes marked `auth: true` need a signed-in browser. Nothing here ever handles
a password — instead, sign in once by hand:

```bash
node docs/admin-guide/login.mjs
```

That opens a Chrome window on the guide's own profile
(`.build/chrome-profile`). Sign in, close the window, and every later
`capture.mjs` run inherits the session from it. Until then those recipes are
skipped and the build shows labelled placeholders in their place.

Close that window before capturing: Chrome will not share a profile directory
with a second instance, and the copy taken from it fails on the locked cookie
file. Delete `.build/chrome-profile` to sign out and start over.

Set `GUIDE_APP` to point at something other than `http://localhost:3000`.

## Notes

The admin renders in whatever theme the signed-in account uses, so the figures
inherit it. Switch it in `/admin/account` before capturing if the document wants
the other one.
