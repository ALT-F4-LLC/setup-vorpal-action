---
name: gh-attestation-verify-exit-codes
description: gh attestation verify returns exit 1 for ALL failure modes; fail-closed decisions must key on exit code, never on parsing gh's stderr text
metadata:
  type: reference
---

`gh attestation verify` (the mechanism DKT-6 uses to verify the Vorpal release
binary in `installVorpal()`) returns **exit 1 for every failure mode** and **exit 0
only on success**. Empirically observed 2026-07-12 against the real `ALT-F4-LLC/vorpal`
0.4.0 binary (sandbox disabled — sigstore TUF endpoint is blocked under the default
network allowlist, so these probes require `dangerouslyDisableSandbox: true`):

- valid (authed + correct `--signer-workflow`) → **exit 0**
- tampered binary (1-byte flip) → exit 1
- wrong signer-workflow → exit 1, stderr `Error: verifying with issuer "sigstore.dev"`
- no attestation (unknown digest) → exit 1, stderr `HTTP 404: Not Found (…/attestations/sha256:…)`
- unauthenticated / bad token → exit 1, stderr `HTTP 401: Bad credentials`

**Security-design consequence (the load-bearing part):** the fail-closed guarantee
must rest ONLY on `exitCode !== 0`. Any failure-class regex parsing of gh's
human-readable stderr is purely cosmetic (nicer error messages) and carries ZERO
security weight — because a code path that decided pass/fail by matching stderr text
could fail-OPEN on an unrecognized string. The correct shape: throw on any non-zero
exit; a "generic-fallback" classifier branch must be an _else-throw_, never an
else-proceed. `gh` absence is a separate ENOENT path (guard with a `gh --version`
precondition before verifying).

**Trust anchors verified same session:** the attestation subject is the EXTRACTED
inner binary, NOT the `.tar.gz` (verifying the tarball 404s); `gh` matches on the
file's SHA256 digest (filename-independent); signer cert SAN is
`https://github.com/ALT-F4-LLC/vorpal/.github/workflows/vorpal.yaml@refs/tags/<version>`,
issuer `token.actions.githubusercontent.com`. Attestations exist for tags 0.2.2+.
Auth is REQUIRED (no ambient token in the action env — needs a `github-token` input).

See the DKT-6 TDD (`docs/tdd/tarball-integrity-verification-in-installvorpal-via-github.md`,
ephemeral) for the full design.
