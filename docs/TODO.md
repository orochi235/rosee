# TODO

## Toolpath settings are validated only by throwing mid-sample

`packages/rosee/src/toolpath/toolpath.ts` checks the sample count (a whole number in range, under
the sample budget), the surface, and engine and chuck combinations, but each check throws a plain
`Error` with an English message from inside the toolpath call. The lab and SVG export can only catch
the first failure as text; they can't grey out the control at fault or list every problem at once.
A public step that resolves and validates settings first, returning either resolved settings (with
units) or structured diagnostics naming the setting, would serve the lab, export, and the toolpath
call alike. A design change to the public API. (filed 2026-11-15 from automated review)
