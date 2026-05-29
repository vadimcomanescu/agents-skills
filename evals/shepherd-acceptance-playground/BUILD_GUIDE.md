# Build Guide

## Stack
- Framework/runtime: node
- Package manager: npm
- Local dev URL: http://localhost:3055

## Standard Make Targets
- `check`: `npm test`
- `test`: `npm test`
- `build`: `npm run build`
- `dev`: `npm run dev`
- `test-e2e`: `npm run test:browser`

## Roots
- Source roots: app, lib
- Test roots: tests

## Conventions
Follow existing files in the target repository. Prefer make targets for verification.
