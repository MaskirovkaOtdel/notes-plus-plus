#!/usr/bin/env node
/**
 * ============================================================================
 *  Notes++ Version Engine
 * ============================================================================
 *
 *  Decides whether a release should be cut and, if so, what the next version
 *  is. Driven entirely by Conventional Commits, so the answer is mechanical
 *  and reproducible.
 *
 *  Version mapping (SemVer):
 *    BREAKING CHANGE / type!:  1.X.X -> 2.X.X   (important update)
 *    feat:                     X.1.X -> X.2.X   (mainstream update)
 *    fix: / perf: / revert:    X.X.1 -> X.X.2   (small patch / hotfix)
 *    chore/docs/ci/...         (no release)
 *
 *  Anti-overflow gates (a release is SKIPPED when any of these apply):
 *    1. type      - no release-worthy commit type since the last tag
 *    2. path      - only docs/meta/config files changed
 *    3. cooldown  - last release was too recent (unless forced / hotfix)
 *    4. cap       - too many releases in the rolling 24h window
 *    5. dedupe    - computed version already exists as a tag
 *
 *  Usage:
 *    node scripts/version-engine.mjs                 # full decision (JSON)
 *    node scripts/version-engine.mjs --dry-run       # no writes, human output
 *    node scripts/version-engine.mjs --github-output # append to $GITHUB_OUTPUT
 *
 *  Requires a git repo with at least one commit. Uses only stdlib.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIG = {
  /**
   * Prefix for tags, e.g. "v1.2.3". Overridable via TAG_PREFIX so the
   * premium (air-gapped) edition can use a distinct prefix ("p") without
   * ever colliding with the community "v*" tags it pulls in.
   */
  tagPrefix: process.env.TAG_PREFIX || "v",
  /** Hours that must elapse between two automatic (non-forced) releases. 0 = disabled. */
  cooldownHours: 0,
  /** Maximum automatic releases within a rolling 24h window. Infinity = unconstrained. */
  maxReleasesPer24h: Number.POSITIVE_INFINITY,
  /** Commit types that warrant a patch release. */
  patchTypes: new Set(["fix", "perf", "revert"]),
  /** Commit types that warrant a minor release. */
  minorTypes: new Set(["feat"]),
  /** Commit types that NEVER produce a release. */
  nonReleaseTypes: new Set(["chore", "docs", "ci", "refactor", "test", "style", "build"]),
  /**
   * Path globs that do NOT count as a "real" change for release purposes.
   * If every changed file since the last tag matches one of these prefixes,
   * no release is cut even if the commit types say otherwise.
   */
  metaPathPrefixes: ["docs/", ".github/", "scripts/", "e2e/", "infra/"],
  metaPathFiles: [
    "README.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "SECURITY.md",
    ".prettierrc.json",
    ".prettierignore",
    ".editorconfig",
    ".gitignore",
    ".npmrc",
    "commitlint.config.js",
    "eslint.config.js",
    "turbo.json",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
  ],
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const GITHUB_OUTPUT = args.includes("--github-output");
const FORCE_FLAG = args.includes("--force");

/** Run a git command, returning trimmed stdout. Throws on failure. */
function git(cmdArgs, { allowFail = false } = {}) {
  try {
    // Capture stderr too so an expected failure (e.g. empty repo) stays silent.
    return execFileSync("git", cmdArgs, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    if (allowFail) return "";
    throw new Error(`git ${cmdArgs.join(" ")} failed: ${err.message}`);
  }
}

function toSemver(v) {
  return v
    .replace(/^v/, "")
    .split(".")
    .map((n) => Number.parseInt(n, 10));
}

function formatSemver([maj, min, pat]) {
  return `${CONFIG.tagPrefix}${maj}.${min}.${pat}`;
}

// ---------------------------------------------------------------------------
// 1. Collect the commit range since the last release tag
// ---------------------------------------------------------------------------

/** All tags matching our prefix, sorted by creation date (newest last). */
const tags = git(["tag", "--list", `${CONFIG.tagPrefix}*`, "--sort=creatordate"], {
  allowFail: true,
})
  .split("\n")
  .filter(Boolean);

const lastTag = tags.length > 0 ? tags[tags.length - 1] : null;
const lastTagCommit = lastTag ? git(["rev-list", "-n", "1", lastTag]) : null;

// Range: commits reachable from HEAD but not from the last tag.
const rangeArgs = lastTagCommit ? [`${lastTagCommit}..HEAD`] : ["HEAD"];

// --pretty=format uses %x1F (unit separator) and %x1E (record separator)
// so we can parse multi-line commit bodies safely.
const SEP = "\x1f";
const REC = "\x1e";
const logFormat = ["%H", "%an", "%ae", "%B", "%ct"].join(SEP) + REC;

const rawLog = git(["log", `--pretty=format:${logFormat}`, ...rangeArgs], {
  allowFail: true,
});

const commits = rawLog
  .split(REC)
  .map((chunk) => chunk.trim())
  .filter(Boolean)
  .map((chunk) => {
    const [hash, author, email, body, timestamp] = chunk.split(SEP);
    return {
      hash: (hash ?? "").slice(0, 7),
      author: author ?? "",
      email: email ?? "",
      body: body ?? "",
      timestamp: Number.parseInt(timestamp ?? "0", 10),
    };
  });

// ---------------------------------------------------------------------------
// 2. Parse Conventional Commits
// ---------------------------------------------------------------------------

const CONVENTIONAL_RE =
  /^(?<type>[a-z]+)(?<scope>\([^)]+\))?(?<bang>!)?:\s*(?<subject>.+)$/;

function parseCommit(commit) {
  // The header is the first non-empty line of the body.
  const header =
    commit.body
      .split("\n")
      .map((l) => l.trimEnd())
      .find((l) => l.trim().length > 0) ?? "";

  const match = CONVENTIONAL_RE.exec(header);
  const isBreaking =
    commit.body.includes("BREAKING CHANGE:") ||
    commit.body.includes("BREAKING-CHANGE:") ||
    Boolean(match?.groups?.bang);

  if (!match) {
    return {
      ...commit,
      header,
      type: null,
      scope: null,
      subject: header,
      isBreaking,
      valid: false,
    };
  }
  return {
    ...commit,
    header,
    type: match.groups.type,
    scope: match.groups.scope?.slice(1, -1) ?? null,
    subject: match.groups.subject,
    isBreaking,
    valid: true,
  };
}

const parsed = commits.map(parseCommit);

// Split commits authored by the repo owner vs third parties. Only the owner's
// commits (plus merged third-party PRs already accepted into main) drive
// releases; we treat everything on main as release-worthy once merged, which
// is exactly the point of the landing-zone flow.
const releaseWorthy = parsed.filter(
  (c) =>
    c.valid &&
    (c.isBreaking || CONFIG.patchTypes.has(c.type) || CONFIG.minorTypes.has(c.type)),
);

// ---------------------------------------------------------------------------
// 3. Determine the requested bump level
// ---------------------------------------------------------------------------

let bump = "none"; // none | patch | minor | major

if (FORCE_FLAG) {
  bump = "patch";
}

for (const c of releaseWorthy) {
  if (c.isBreaking) {
    bump = "major";
    break; // major is the ceiling
  }
  if (CONFIG.minorTypes.has(c.type)) {
    if (bump !== "major") bump = "minor";
  } else if (CONFIG.patchTypes.has(c.type)) {
    if (bump === "none") bump = "patch";
  }
}

// ---------------------------------------------------------------------------
// 4. Compute the next version from the last tag
// ---------------------------------------------------------------------------

const baseVersion = lastTag ? toSemver(lastTag) : [0, 0, 0];
let [maj, min, pat] = baseVersion;

switch (bump) {
  case "major":
    maj += 1;
    min = 0;
    pat = 0;
    break;
  case "minor":
    min += 1;
    pat = 0;
    break;
  case "patch":
    pat += 1;
    break;
  default:
    // no bump — keep the base version, it will not be tagged
    break;
}

const nextVersion = formatSemver([maj, min, pat]);

// ---------------------------------------------------------------------------
// 5. Apply the anti-overflow gates
// ---------------------------------------------------------------------------

const gates = {
  type: {
    passed: bump !== "none",
    detail: bump === "none" ? "no release-worthy commits" : `bump=${bump}`,
  },
  path: { passed: true, detail: "ok" },
  cooldown: { passed: true, detail: "ok" },
  cap: { passed: true, detail: "ok" },
  dedupe: { passed: true, detail: "ok" },
};

// A release is "forced" when a commit carries the marker, or the caller passed
// --force. Hotfix markers short-circuit the gates.
const forcedByCommit = releaseWorthy.some((c) =>
  /\[release-now\]|\[hotfix\]/i.test(c.body),
);
const FORCE = FORCE_FLAG || forcedByCommit;

// --- Gate: path -------------------------------------------------------------
// Determine changed files since last tag and test if they are all "meta".
if (lastTagCommit) {
  const changedFiles = git(["diff", "--name-only", `${lastTagCommit}`, "HEAD"], {
    allowFail: true,
  })
    .split("\n")
    .filter(Boolean);

  if (changedFiles.length > 0) {
    const isMeta = (f) =>
      CONFIG.metaPathPrefixes.some((p) => f.startsWith(p)) ||
      CONFIG.metaPathFiles.includes(f);
    const allMeta = changedFiles.every(isMeta);
    gates.path = {
      passed: FORCE || !allMeta,
      detail: FORCE
        ? "forced release bypass"
        : allMeta
          ? `only meta files changed (${changedFiles.length} files)`
          : `${changedFiles.filter((f) => !isMeta(f)).length} source files changed`,
    };
  }
} else {
  // First release ever: always allow.
  gates.path = { passed: true, detail: "initial release" };
}

// --- Gate: cooldown ---------------------------------------------------------
const latestReleaseTime = lastTag
  ? Number.parseInt(
      git(["log", "-1", "--format=%ct", lastTag], { allowFail: true }) || "0",
      10,
    )
  : 0;

const hoursSinceRelease = latestReleaseTime
  ? (Date.now() / 1000 - latestReleaseTime) / 3600
  : Infinity;

if (!FORCE && hoursSinceRelease < CONFIG.cooldownHours) {
  gates.cooldown = {
    passed: false,
    detail: `last release ${hoursSinceRelease.toFixed(1)}h ago (< ${CONFIG.cooldownHours}h cooldown)`,
  };
}

// --- Gate: cap (rolling 24h) ------------------------------------------------
const releaseTagTimes = tags
  .map((t) => {
    const ts = git(["log", "-1", "--format=%ct", t], { allowFail: true });
    return Number.parseInt(ts || "0", 10);
  })
  .filter((t) => t > 0);

const dayAgo = Date.now() / 1000 - 24 * 3600;
const releasesLast24h = releaseTagTimes.filter((t) => t >= dayAgo).length;

if (!FORCE && releasesLast24h >= CONFIG.maxReleasesPer24h) {
  gates.cap = {
    passed: false,
    detail: `${releasesLast24h} releases in last 24h (cap ${CONFIG.maxReleasesPer24h})`,
  };
}

// --- Gate: dedupe -----------------------------------------------------------
const tagExists = git(["tag", "--list", nextVersion], { allowFail: true }) !== "";
if (bump !== "none" && tagExists) {
  gates.dedupe = { passed: false, detail: `${nextVersion} already exists` };
}

// ---------------------------------------------------------------------------
// 6. Final decision
// ---------------------------------------------------------------------------

const shouldRelease = Object.values(gates).every((g) => g.passed);

const result = {
  shouldRelease,
  bump,
  lastTag: lastTag ?? null,
  nextVersion: bump === "none" ? null : nextVersion,
  previousVersion: lastTag ?? "none",
  commitCount: commits.length,
  releaseWorthyCount: releaseWorthy.length,
  forced: FORCE,
  gates,
  commits: parsed.map((c) => ({
    hash: c.hash,
    type: c.type,
    scope: c.scope,
    subject: c.subject,
    isBreaking: c.isBreaking,
    valid: c.valid,
  })),
};

// ---------------------------------------------------------------------------
// 7. Output
// ---------------------------------------------------------------------------

if (GITHUB_OUTPUT) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    const lines = [
      `should_release=${shouldRelease}`,
      `bump=${bump}`,
      `next_version=${result.nextVersion ?? ""}`,
      `previous_version=${result.previousVersion}`,
      `release_notes_path=RELEASE_NOTES.md`,
    ];
    appendFileSync(out, lines.join("\n") + "\n");
  }
}

if (DRY_RUN || !GITHUB_OUTPUT) {
  const icon = (p) => (p ? "PASS" : "SKIP");
  console.log("\n=== Notes++ Version Engine ===");
  console.log(`commits since last tag : ${result.commitCount}`);
  console.log(`release-worthy commits : ${result.releaseWorthyCount}`);
  console.log(`last tag               : ${result.previousVersion}`);
  console.log(`detected bump          : ${result.bump}`);
  console.log(`next version           : ${result.nextVersion ?? "(none)"}`);
  console.log("\n-- gates --");
  for (const [name, g] of Object.entries(gates)) {
    console.log(`  [${icon(g.passed)}] ${name.padEnd(9)} ${g.detail}`);
  }
  console.log(
    `\nDECISION: ${shouldRelease ? `RELEASE ${nextVersion}` : "SKIP (no release)"}\n`,
  );
}

// Export for programmatic use (tests) and exit code for CI gating.
if (process.env.VERSION_ENGINE_EXPORT === "1") {
  process.stdout.write(JSON.stringify(result));
}
process.exit(shouldRelease ? 0 : 2);
