# Spec

{
  "commands": {
    "check": "npm test",
    "test": "npm test",
    "build": "npm run build",
    "test-e2e": "npm run test:browser"
  },
  "structure": "Existing Next.js app with app/ routes, lib/ workflow logic, Vitest tests, and Playwright acceptance tests.",
  "testing": "Vitest for library behavior and Playwright for browser acceptance.",
  "boundaries": [
    "Do not rewrite the existing app structure.",
    "Do not remove current quote, evidence, dossier, import, handoff, or browser acceptance tests.",
    "Do not deploy.",
    "Do not introduce external services."
  ]
}
