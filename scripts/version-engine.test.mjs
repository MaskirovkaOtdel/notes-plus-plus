// ============================================================================
// Regression coverage for the release engine's decision rules.
// ============================================================================
// Each case builds a throwaway git repo, runs the engine in --dry-run mode,
// and asserts the decision it would cut. These lock the rules that protect
// releases from repeating the withdrawn v1.0.0 mistake:
//
//   * Breaking changes on the 0.x line bump the MINOR, never a major —
//     reaching 1.0.0 is only possible via an explicit --set-version cut.
//   * After 1.0 exists, breaking changes bump the MAJOR (SemVer-honest).
//   * Docs/meta-only history skips the release.
//
// Run with: node --test scripts/version-engine.test.mjs
// Wired into the Release workflow before the engine decides (fail-close).
// ============================================================================

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, "version-engine.mjs");

function newRepo() {
  const dir = mkdtempSync(join(tmpdir(), "notespp-engine-"));

  const git = (...args) => {
    const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
    }
    return (r.stdout || "").trim();
  };

  git("init", "-q");
  git("config", "user.email", "engine-test@example.com");
  git("config", "user.name", "Engine Test");

  return {
    tag: (name) => git("tag", name),
    commit: (...messages) =>
      git("commit", "--allow-empty", "-q", ...messages.flatMap((m) => ["-m", m])),
    engine: (...args) => {
      const r = spawnSync(process.execPath, [ENGINE, "--dry-run", ...args], {
        cwd: dir,
        encoding: "utf8",
      });
      return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
    },
  };
}

test("breaking change below 1.0 bumps the minor (v0.8.x -> v0.9.0)", () => {
  const repo = newRepo();
  repo.commit("chore: seed");
  repo.tag("v0.8.1");
  repo.commit("feat!: breaking change below 1.0");
  const { code, out } = repo.engine();
  assert.equal(code, 0);
  assert.match(out, /detected bump\s*: minor/);
  assert.match(out, /next version\s*: v0\.9\.0/);
  assert.match(out, /DECISION: RELEASE v0\.9\.0/);
});

test("a BREAKING CHANGE footer below 1.0 also bumps the minor", () => {
  const repo = newRepo();
  repo.commit("chore: seed");
  repo.tag("v0.8.1");
  repo.commit("chore: follow-up", "BREAKING CHANGE: surface changed");
  const { code, out } = repo.engine();
  assert.equal(code, 0);
  assert.match(out, /detected bump\s*: minor/);
  assert.match(out, /DECISION: RELEASE v0\.9\.0/);
});

test("breaking change at 1.0+ still bumps the major (v1.0.0 -> v2.0.0)", () => {
  const repo = newRepo();
  repo.commit("chore: seed");
  repo.tag("v1.0.0");
  repo.commit("feat!: breaking change after 1.0");
  const { code, out } = repo.engine();
  assert.equal(code, 0);
  assert.match(out, /detected bump\s*: major/);
  assert.match(out, /next version\s*: v2\.0\.0/);
});

test("docs-only history skips the release (exit 2)", () => {
  const repo = newRepo();
  repo.commit("chore: seed");
  repo.tag("v0.8.1");
  repo.commit("docs: note something");
  const { code, out } = repo.engine();
  assert.equal(code, 2);
  assert.match(out, /DECISION: SKIP/);
});

test("no tags yet: the first bump computes v0.1.0, breaking stays minor", () => {
  const repo = newRepo();
  repo.commit("feat!: first change is breaking");
  const { code, out } = repo.engine();
  assert.equal(code, 0);
  assert.match(out, /detected bump\s*: minor/);
  assert.match(out, /next version\s*: v0\.1\.0/);
});
