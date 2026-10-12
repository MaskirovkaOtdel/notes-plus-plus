/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Scope is optional but encouraged (e.g. api, web, shared, ci)
    "scope-enum": [
      2,
      "always",
      ["api", "web", "shared", "ui", "e2e", "ci", "release", "deps", "infra", "docs"],
    ],
    // NOTE: config-conventional already enforces
    // `subject-case: never [sentence-case, start-case, pascal-case, upper-case]`,
    // which requires a lowercase start while still allowing acronyms (API, CI,
    // PWA). Do NOT override it with `always lower-case` — that rejects any
    // legitimate acronym in the subject.
    "type-case": [2, "always", "lower-case"],
    "header-max-length": [2, "always", 100],
    // Allow release-engine markers used to force cuts
    "body-max-line-length": [1, "always", 200],
  },
};
