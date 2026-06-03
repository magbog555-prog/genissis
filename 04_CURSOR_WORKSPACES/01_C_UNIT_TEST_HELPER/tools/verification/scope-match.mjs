/**
 * Scope classification helper — SAFE > UNSAFE > DONOR > UNKNOWN
 * No external dependencies.
 */

function globToRegExp(glob) {
  const normalized = glob.replace(/\\/g, "/");
  let re = "^";
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === "*") {
      if (normalized[i + 1] === "*") {
        re += ".*";
        i++;
      } else {
        re += "[^/]*";
      }
    } else if (ch === "?") {
      re += "[^/]";
    } else if (/[+^${}()|[\]\\.]/.test(ch)) {
      re += `\\${ch}`;
    } else {
      re += ch;
    }
  }
  re += "$";
  return new RegExp(re);
}

function matchesGlob(relativePath, glob) {
  const p = relativePath.replace(/\\/g, "/");
  const g = glob.replace(/\\/g, "/");
  if (g.endsWith("/**")) {
    const prefix = g.slice(0, -3);
    return p === prefix || p.startsWith(`${prefix}/`);
  }
  if (g.includes("*")) {
    return globToRegExp(g).test(p);
  }
  return p === g;
}

export function classifyPath(relativePath, config) {
  const p = relativePath.replace(/\\/g, "/");
  for (const root of config.safe_roots ?? []) {
    if (matchesGlob(p, root)) return "SAFE";
  }
  for (const root of config.unsafe_roots ?? []) {
    if (matchesGlob(p, root)) return "UNSAFE";
  }
  for (const root of config.donor_roots ?? []) {
    if (matchesGlob(p, root)) return "DONOR";
  }
  return "UNKNOWN";
}

export { matchesGlob };
