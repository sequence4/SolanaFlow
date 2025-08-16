/**
 * Turns any project name into a `snake_case` string that is **always**
 * accepted by Rust (module identifiers) and Cargo (package names).
 *
 * Rules:
 *  • ASCII lowercase only
 *  • non-alphanumerics ⇒ single underscore
 *  • never starts with a digit
 *  • never empty  →  "my_program"
 */
export function normalizeProjectName(name: string): string {
  let out = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")   // collapse to underscores
    .replace(/_+/g, "_")           // remove double underscores
    .replace(/^_+|_+$/g, "");      // trim edges

  if (/^[0-9]/.test(out)) out = `_${out}`; // Rust idents can't start with a digit
  return out || "my_program";
}
