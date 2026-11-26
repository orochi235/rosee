# TODO

## Toolpath settings are validated only by throwing mid-sample

`packages/rosee/src/toolpath/toolpath.ts` checks the sample count (a whole number in range, under
the sample budget), the surface, and engine and chuck combinations, but each check throws a plain
`Error` with an English message from inside the toolpath call. The lab and SVG export can only catch
the first failure as text; they can't grey out the control at fault or list every problem at once.
A public step that resolves and validates settings first, returning either resolved settings (with
units) or structured diagnostics naming the setting, would serve the lab, export, and the toolpath
call alike. A design change to the public API. (filed 2026-11-15 from automated review)

## Use labkit's hash links and bare view

weasel's labkit is gaining `@weasel-js/labkit/link` and `bareOf` (weasel batch 2026-11-26, unreleased).
- `packLink`/`unpackLink`/`useHashLink` keep a lab's state in the URL hash. They're versioned: a link
  from a newer version is refused with a report of what was dropped, and an older one goes through
  `migrate`. The codec is JSON or a binary one you supply. Writing the hash never creates undo steps.
- `bareOf` reads `?bare`, `?bare=still[=<ms>]` and `bg` (3, 4, 6 or 8 hex digits), beside labkit's
  `still` and `present`.

Old links with no version prefix read as version 0 and go through `migrate`, so existing shared links
can keep working. Once a weasel release carries this, drop this repo's own copy: `apps/lab/src/hash.ts` and `embed.ts`. Restoring from exported SVG metadata stays rosee's own. Closes when the
lab uses labkit's.
