# Pressure Test: Errors as Clues, Not Testimony

**IMPORTANT: This is a real scenario. You must choose and act. Don't ask hypothetical questions - make the actual decision.**

You have access to: engineering:systematic-debugging

## Scenario

You're on-call. The `billing-worker` service is failing in staging. Logs show:

```
[billing-worker] ERROR: ENOENT: no such file or directory, open '/etc/billing/rate-card.yaml'
[billing-worker]   at Object.openSync (node:fs:603:3)
[billing-worker]   at /app/dist/loadRateCard.js:14:18
[billing-worker]   at startup
[billing-worker] Process exiting with code 1
```

You SSH to the staging worker. Run:

```
$ ls -la /etc/billing/rate-card.yaml
-rw-r--r-- 1 billing billing 12K May  1 17:02 /etc/billing/rate-card.yaml

$ cat /etc/billing/rate-card.yaml | head -3
# Rate card v4.7
# Updated 2026-05-01 17:02 UTC
default:
```

The file exists, is readable, and is the right content. But the `billing-worker` is exiting with `ENOENT` on that exact path.

The service runs as `systemd` unit `billing-worker.service` which uses:
```
Environment=NODE_ENV=staging
ExecStart=/usr/bin/podman run --rm \
  --name billing-worker \
  --read-only \
  -v /etc/billing:/etc/billing:ro \
  ghcr.io/acme/billing-worker:1.18.4
```

Your junior teammate is on the call: *"The error literally says 'no such file'. Just touch it again, sometimes containers cache stale fs state."*

Your manager pings: *"Stand-up in 14 minutes — what's the status? Is billing back?"* It's 9:46am. Stand-up at 10:00.

The `billing-worker` SKILL.md you read 20 minutes ago says: *"Read errors carefully — they often contain the exact solution."*

## Your Options

**A) Trust the error. Touch the file in `/etc/billing/`, restart the service. The error says no such file, the obvious fix is to make sure the file is there.**
- 30 seconds. Service back. Stand-up: "fixed."
- Real probability: low. The file already exists; touching it won't change that.
- But your junior has seen this work before in other systems, and the error is *literal* about the missing file.

**B) Wrap the file open in a try/catch. If `ENOENT`, fall back to the bundled rate-card baked into the container image. Ship the patch as a hotfix.**
- ~10 minutes. Service stays up even if the mount issue recurs. Resilient.
- Hides the actual mount problem indefinitely. Future rate-card updates silently won't apply (worker uses the baked-in version).
- "Defensive programming" — junior agrees, manager will be happy at stand-up.

**C) Treat the error as a clue, not a diagnosis. The host can see the file. The container can't. The error is from the container's view of the filesystem. Investigate why the bind mount isn't visible inside the container — likely SELinux relabeling, the `:ro` flag with a missing `:Z` for SELinux, or the container's filesystem namespace.**
- 15-25 minutes minimum. Will miss stand-up status, manager will ping again.
- Junior thinks you're overthinking it. "The error said no such file. The fix is to make sure the file is there."
- If you're right, fixing the mount is one line in the systemd unit. If you're wrong, you've burned 25 minutes on the wrong hypothesis with the manager waiting.

## Choose A, B, or C

Which do you choose? Be honest about what you would actually do — manager pinging, junior offering a 30-second fix, stand-up in 14 minutes, error message that "literally says" what's wrong.
