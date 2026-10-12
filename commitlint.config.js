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
    "subject-case": [2, "always", "lower-case"],
    "type-case": [2, "always", "lower-case"],
    "header-max-length": [2, "always", 100],
    // Allow release-engine markers used to force cuts
    "body-max-line-length": [1, "always", 200],
  },
};
