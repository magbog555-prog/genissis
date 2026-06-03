/**
 * Shared relative import extraction and resolution (P0.2)
 */
import fs from "node:fs";
import path from "node:path";

export function extractImportSpecs(content) {
  const specs = [];
  const normalized = content.replace(/\r\n/g, "\n");
  const fromRe = /from\s+['"]([^'"]+)['"]/g;
  const sideEffectRe = /import\s+['"]([^'"]+)['"]/g;
  const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = fromRe.exec(normalized))) specs.push(m[1]);
  while ((m = sideEffectRe.exec(normalized))) specs.push(m[1]);
  while ((m = requireRe.exec(normalized))) specs.push(m[1]);
  return specs;
}

export function resolveRelativeImport(fromFileAbs, spec) {
  if (!spec.startsWith(".")) return { kind: "external", spec };
  const base = path.dirname(fromFileAbs);
  const noExt = spec.replace(/\.(js|mjs|ts|tsx)$/i, "");
  const candidates = [
    spec,
    `${noExt}.ts`,
    `${noExt}.tsx`,
    `${noExt}.js`,
    `${noExt}.mjs`,
    path.join(noExt, "index.ts"),
    path.join(noExt, "index.js")
  ].map((c) => path.normalize(path.join(base, c)));
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return { kind: "resolved", abs: c, spec };
    }
  }
  return { kind: "missing", spec, tried: candidates };
}
