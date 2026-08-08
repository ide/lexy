import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The mirror invariant from README.md: every route file under src/app has
// exactly one spec here, and every spec (README and this test aside) has
// exactly one route file. Comparing the two whole sets — rather than checking
// one direction — makes a renamed route and its left-behind spec fail as a
// pair, which is the moment the contract and the code would otherwise drift.

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function walk(dir: string, extension: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .map((path) => path.split(sep).join("/"));
}

describe("specs mirror src/app", () => {
  const routes = walk(join(repoRoot, "src/app"), ".tsx").map((path) =>
    path.replace(/\.tsx$/, ""),
  );
  const specs = walk(join(repoRoot, "specs"), ".md")
    .filter((path) => path !== "README.md")
    .map((path) => path.replace(/\.md$/, ""));

  it("every route file has a spec", () => {
    expect(routes.filter((route) => !specs.includes(route)).sort()).toEqual([]);
  });

  it("every spec has a route file", () => {
    expect(specs.filter((spec) => !routes.includes(spec)).sort()).toEqual([]);
  });
});
