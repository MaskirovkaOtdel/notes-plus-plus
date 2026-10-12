#!/usr/bin/env node
/**
 * Generates markdown release notes from Conventional Commits in a git range.
 *
 * Grouped by commit type so batched releases (from the cooldown window) stay
 * legible instead of a flat commit dump.
 *
 * Usage:
 *   node scripts/release-notes.mjs [baseRef] [headRef] > RELEASE_NOTES.md
 *
 * Defaults: baseRef = last tag (or root), headRef = HEAD.
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const SECTIONS = [
  { title: "⚠ Breaking Changes", test: (c) => c.isBreaking },
  { title: "🚀 Features", test: (c) => c.type === "feat" },
  { title: "🐛 Bug Fixes", test: (c) => c.type === "fix" },
  { title: "⚡ Performance", test: (c) => c.type === "perf" },
  { title: "↩ Reverts", test: (c) => c.type === "revert" },
  { title: "🧹 Chores", test: (c) => ["chore", "build", "ci"].includes(c.type) },
  { title: "📚 Documentation", test: (c) => c.type === "docs" },
  { title: "♻ Refactors", test: (c) => c.type === "refactor" },
  { title: "✅ Tests", test: (c) => c.type === "test" },
];

const CONVENTIONAL_RE =
  /^(?<type>[a-z]+)(?<scope>\([^)]+\))?(?<bang>!)?:\s*(?<subject>.+)$/;

function collectCommits(baseRef, headRef) {
  const range =
    baseRef && git(["rev-parse", "--verify", baseRef])
      ? `${baseRef}..${headRef}`
      : headRef;

  const SEP = "\x1f";
  const REC = "\x1e";
  const fmt = ["%H", "%B", "%an"].join(SEP) + REC;

  const raw = git(["log", `--pretty=format:${fmt}`, range]);
  if (!raw) return [];

  return raw
    .split(REC)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [hash, body, author] = chunk.split(SEP);
      const lines = (body ?? "").split("\n");
      const header = lines.find((l) => l.trim()) ?? "";
      const m = CONVENTIONAL_RE.exec(header.trim());
      const isBreaking =
        (body ?? "").includes("BREAKING CHANGE:") || Boolean(m?.groups?.bang);
      return {
        hash: (hash ?? "").slice(0, 7),
        author: author ?? "",
        type: m?.groups?.type ?? "other",
        scope: m?.groups?.scope?.slice(1, -1) ?? null,
        subject: m?.groups?.subject ?? header.trim(),
        isBreaking,
      };
    });
}

function render(commits, version) {
  const out = [];
  out.push(`# ${version}`);
  out.push("");

  if (commits.length === 0) {
    out.push("_No changes._");
    return out.join("\n");
  }

  // Breaking changes get their own section regardless of type.
  const breaking = commits.filter((c) => c.isBreaking);
  if (breaking.length > 0) {
    out.push("## ⚠ Breaking Changes");
    out.push("");
    for (const c of breaking) out.push(`- ${c.subject} (\`${c.hash}\`)`);
    out.push("");
  }

  for (const section of SECTIONS) {
    const matching = commits.filter((c) => !c.isBreaking && section.test(c));
    if (matching.length === 0) continue;
    out.push(`## ${section.title}`);
    out.push("");
    for (const c of matching) {
      const scope = c.scope ? `**${c.scope}:** ` : "";
      out.push(`- ${scope}${c.subject} (\`${c.hash}\`)`);
    }
    out.push("");
  }

  const others = commits.filter((c) => !c.isBreaking && !SECTIONS.some((s) => s.test(c)));
  if (others.length > 0) {
    out.push("## Other");
    out.push("");
    for (const c of others) out.push(`- ${c.subject} (\`${c.hash}\`)`);
    out.push("");
  }

  return out.join("\n").trim();
}

const [, , baseRef, headRef = "HEAD", version = "unreleased"] = process.argv;

const lastTag = git(["describe", "--tags", "--abbrev=0", headRef]) || "";
const base = baseRef ?? (lastTag || "");
const commits = collectCommits(base, headRef);
const markdown = render(commits, version);

if (process.env.RELEASE_NOTES_PATH) {
  writeFileSync(process.env.RELEASE_NOTES_PATH, markdown + "\n", "utf8");
}

process.stdout.write(markdown + "\n");
