# Feature Specification: CI/CD Pipeline (GitHub Actions)

**Feature Branch**: `016-ci-cd-pipeline`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "смотри, давай напишем простой ci/cd на базе github, что мне надо
1) pr-check — на пул реквесты — просто сборка и прогонка линтеров, тестов, сканеров и так далее бекенда и фронта
2) ci — на пуш/влитие в main — сборка docker образов в selectel CR, поставка на VPS по SSH ключу — со всеми необходимыми секретами и переменными
3) должна быть нотификация в slack канал — с пометкой успех/неуспех сборки / URL стенда, версии и что было изменено — LLM суммаризация по содержимому коммитов"

## Overview

Automate quality gating, delivery, and team notification for the omnius.team CRM using a Git-hosted CI/CD platform. The feature has three independent slices:

1. **PR check** — every pull request is automatically built and validated (lint, tests, security scans) for both backend and frontend, so broken or unsafe code is caught before merge.
2. **Continuous delivery** — every merge to the main branch builds Docker images, publishes them to the team's container registry, and deploys them to the production VPS automatically, so the running stand always reflects `main`.
3. **Team notification** — after each delivery, the team's chat channel receives a message stating success/failure, the deployed version, the stand URL, and a human-readable, AI-generated summary of what changed.

## Clarifications

### Session 2026-07-14

- Q: How should the main-branch deploy update the VPS and behave on a failed post-deploy health check? → A: The VPS `docker-compose` references images pulled from Selectel CR by a fixed tag; deploy = pull + `up -d`. On a failed post-deploy health check, **automatically roll back** to the previous image tag.
- Q: What tag/version identifies the Docker images (also shown in the Slack notification)? → A: A version is read from a committed **`VERSION` file**, bumped manually per release. Images are tagged with that version, and a PR check verifies the `VERSION` value was incremented when deployable code changes.
- Q: How are Slack notifications sent? → A: **Slack Incoming Webhook** (a single webhook URL bound to one channel), stored as a secret.
- Q: How should the PR vulnerability/secret scan react to high/critical findings? → A: **Hard-fail** the check on any high/critical dependency vulnerability or any detected committed secret, blocking merge.
- Q: How is TLS/domain handled for the stand? → A: The domain is already provisioned; the stand is served over **HTTPS** with certificates issued/renewed **automatically via Let's Encrypt** (ACME).
- Q: Is the TLS-terminating reverse proxy (ACME on :443) part of this feature or pre-existing infra? → A: **In scope** — this feature adds an edge reverse proxy with automatic Let's Encrypt to the deployment topology (version-controlled compose).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automated PR validation (Priority: P1)

A developer opens or updates a pull request. The system automatically builds both the backend and the frontend, runs linters, runs the test suites, and runs security/vulnerability scanners. The pull request shows a clear pass/fail status, and the developer (and reviewers) can see which check failed and why before the code is merged.

**Why this priority**: Catching defects and vulnerabilities before they reach `main` is the highest-value, lowest-risk slice. It requires no production credentials and protects the main branch immediately. It is a prerequisite for trusting automated delivery.

**Independent Test**: Open a PR with a deliberate lint error (and separately a failing test); confirm the corresponding check turns red and blocks a "green" status. Open a clean PR and confirm all checks pass.

**Acceptance Scenarios**:

1. **Given** a pull request targeting the main branch, **When** it is opened or new commits are pushed to it, **Then** backend and frontend build, lint, test, and scan checks run automatically without manual triggering.
2. **Given** a pull request whose frontend code has a lint violation, **When** the checks run, **Then** the lint check reports a failure with the offending file/rule, and the overall PR status is "failed".
3. **Given** a pull request that introduces a dependency with a known high/critical vulnerability (or a committed secret), **When** the security scan runs, **Then** the scan reports the finding and the check **hard-fails**, blocking merge.
4. **Given** a pull request where all checks succeed, **When** the run completes, **Then** the PR shows an all-green status indicating it is safe to review/merge.
5. **Given** a component that currently has no test suite, **When** checks run, **Then** the missing-test situation is handled gracefully (skipped/neutral, not a hard error) and is visible in the logs.
6. **Given** a pull request that changes deployable code but leaves the `VERSION` file unchanged, **When** checks run, **Then** the version-bump check fails and instructs the author to increment `VERSION`.

---

### User Story 2 - Automatic build & deploy on merge to main (Priority: P1)

When code is merged (pushed) to the main branch, the system builds the backend and frontend Docker images, tags them with a traceable version, pushes them to the team's Selectel container registry, and deploys the new images to the production VPS over an SSH connection using stored credentials. Database migrations required by the release are applied as part of deployment. After it finishes, the live stand serves the new version.

**Why this priority**: This is the core delivery automation the user asked for and removes manual, error-prone SSH deployments. It is P1 but depends operationally on registry and VPS credentials being available.

**Independent Test**: Merge a trivial visible change (e.g., a version string) to `main`; confirm new images appear in the registry tagged with the commit/version, the VPS runs the new containers, and the stand URL serves the change. Verify no secrets are printed in logs.

**Acceptance Scenarios**:

1. **Given** a commit is pushed/merged to the main branch, **When** the delivery pipeline runs, **Then** backend and frontend Docker images are built and pushed to the Selectel container registry, each tagged with the version from the `VERSION` file.
2. **Given** freshly pushed images, **When** deployment runs, **Then** the pipeline connects to the VPS over SSH using stored key-based credentials and updates the running containers to the new images.
3. **Given** a release that includes new database migrations, **When** deployment runs, **Then** pending migrations are applied before (or as part of) bringing up the new backend, and the app starts against the migrated schema.
4. **Given** all required secrets and environment variables (registry credentials, SSH key, database URL, OAuth credentials, session secret, etc.), **When** the pipeline runs, **Then** they are injected from a secure store and never appear in logs or in the repository.
5. **Given** the post-deploy health check fails after the new images are brought up, **When** the failure is detected, **Then** the pipeline automatically rolls back to the previous release's image tag, restores a healthy stand, and reports the run as failed. (A build/push/SSH failure before cutover simply stops and reports failure, leaving the running stand untouched.)
6. **Given** a successful deployment, **When** the pipeline completes, **Then** a post-deploy health check confirms the stand responds successfully before the run is marked green.

---

### User Story 3 - Slack notification with AI change summary (Priority: P2)

After a delivery pipeline run on `main` completes, the team channel receives a single notification message. The message clearly indicates success or failure, the deployed version, and the stand URL, and includes a concise, human-readable summary of what changed in this release, generated by an LLM from the commit contents (messages and/or diffs) included in the release.

**Why this priority**: High-value for team awareness but not required for the pipeline to function. It builds on Story 2's outputs (version, URL, commit range) and can be added independently.

**Independent Test**: Trigger a `main` deployment containing 2–3 commits; confirm exactly one channel message arrives with a success badge, the correct version, a clickable stand URL, and a readable multi-point summary that reflects the actual commits. Force a failure and confirm the message shows a failure badge.

**Acceptance Scenarios**:

1. **Given** a delivery pipeline run finishes on the main branch, **When** it completes, **Then** exactly one message is posted to the configured team channel.
2. **Given** a successful run, **When** the message is posted, **Then** it shows a success indicator, the deployed version (from `VERSION`), and a clickable stand URL.
3. **Given** a failed run, **When** the message is posted, **Then** it shows a failure indicator and links to the failed run for troubleshooting.
4. **Given** the set of commits included in the release, **When** the notification is prepared, **Then** an LLM produces a concise, human-readable summary (a short list of meaningful changes) that is included in the message.
5. **Given** the LLM summarization service is unavailable or errors, **When** the notification is prepared, **Then** the message is still delivered with a graceful fallback (e.g., raw commit subjects) instead of being dropped.

---

### Edge Cases

- **No tests/linters for a component**: A component (e.g., backend) currently has no test or lint configuration. PR checks must treat this as neutral/skipped with a visible log note, not a spurious pass or a hard failure.
- **Concurrent merges to main**: Two merges land close together. Deployments must not race and corrupt the stand; runs are serialized or the newest wins, and the final deployed version is well-defined.
- **Secret missing or invalid**: A required secret (SSH key, registry token, LLM key, Slack webhook URL) is absent or wrong. The pipeline fails fast with a clear, non-leaking error message.
- **Registry push succeeds but VPS unreachable**: Images are published but SSH/deploy fails before cutover. The run is marked failed, the notification reports failure, and the previous version keeps running (no rollback needed — cutover never happened).
- **VERSION not bumped**: A PR changes deployable code without incrementing `VERSION`. The version-bump check fails and blocks merge. (Docs/spec-only PRs are exempt.)
- **Duplicate VERSION on main**: If a merged `VERSION` collides with an existing registry tag, the pipeline flags it rather than silently overwriting a prior release image.
- **Rollback target missing**: A post-cutover failure occurs but no previous image tag exists (e.g., first-ever deploy). The pipeline reports failure and alerts, since there is nothing to roll back to.
- **Rollback stays unhealthy (incompatible migration)**: A release ships a non-backward-compatible migration and then fails health; rolling back the image leaves old code on new schema, so the stand is still unhealthy. The pipeline reports failure and alerts for manual intervention (this is prohibited by FR-034 but handled defensively).
- **TLS certificate issuance/renewal fails**: The ACME challenge fails (e.g., rate limit, DNS/port issue). The stand keeps serving the existing valid certificate if any, and the failure is surfaced (health check/alert) rather than silently serving an expired or invalid certificate.
- **Migration failure**: A migration errors mid-deploy. Deployment halts, is reported as failed, and the operator is alerted; the release does not silently continue.
- **Forked/external PRs**: A PR from outside the team must run checks without exposing deployment secrets.
- **Very large or empty commit range**: The change summary handles a release with many commits (truncates/condenses) and with only a merge commit (still produces something meaningful).
- **PR check on non-code changes**: A PR touching only docs/specs still completes quickly and green rather than failing for lack of buildable changes.
- **Re-run / retry**: A failed deploy can be safely re-run without producing duplicate registry tags that overwrite unrelated builds or double-posting conflicting notifications.

## Requirements *(mandatory)*

### Functional Requirements

#### PR Checks (User Story 1)

- **FR-001**: The system MUST automatically run a validation pipeline on every pull request targeting the main branch, on both open and subsequent pushes to that PR.
- **FR-002**: The system MUST build the backend and the frontend to prove the PR is buildable.
- **FR-003**: The system MUST run the configured linter(s) for the frontend and, where present, the backend, and fail the check on lint violations.
- **FR-004**: The system MUST run automated tests for the backend and frontend where a test suite exists, and fail the check on test failures.
- **FR-005**: The system MUST run security/vulnerability scanning covering at least dependency vulnerabilities and exposed secrets, surface findings on the PR, and **hard-fail** the check (blocking merge) on any high/critical dependency vulnerability or any detected committed secret.
- **FR-006**: The system MUST report each check's pass/fail status back to the pull request so it is visible to authors and reviewers before merge.
- **FR-007**: The system MUST handle components lacking a test or lint configuration gracefully (neutral/skipped with a log note) rather than failing or falsely passing.
- **FR-008**: PR checks MUST NOT require or expose any production/deployment secrets.

#### Build & Deploy on main (User Story 2)

- **FR-009**: The system MUST trigger a delivery pipeline automatically on push/merge to the main branch.
- **FR-010**: The system MUST build Docker images for the backend and frontend as part of delivery.
- **FR-011**: The system MUST tag each image with the version from the `VERSION` file (FR-030) and push it to the team's Selectel container registry; because `VERSION` is bumped every release, each release's tag is immutable and retained for rollback.
- **FR-012**: The system MUST authenticate to the container registry using stored, secret credentials.
- **FR-013**: The system MUST deploy to the production VPS over an SSH connection authenticated by a stored SSH key, where the VPS `docker-compose` references the CR images by the release tag and deployment pulls those images and brings services up (pull + `up -d`) rather than building on the VPS.
- **FR-014**: The system MUST apply pending database migrations as part of deployment, before the new backend serves traffic.
- **FR-015**: The system MUST inject all required runtime secrets and environment variables (registry credentials, SSH key/host, database URL, Google OAuth credentials, session secret, and any others the app needs) from a secure secret store.
- **FR-016**: The system MUST NOT print secret values in logs or persist them in the repository.
- **FR-017**: The system MUST verify the stand is healthy after deployment by checking the public `https://` stand URL (post-deploy health check) before marking the run successful.
- **FR-018**: If the post-deploy health check fails after cutover, the system MUST automatically roll back to the previous release's image tag and restore service, then mark the run failed. On any earlier failure (build, push, SSH), the system MUST stop and mark the run failed without disturbing the running stand. Image rollback restores health only when the release's migrations are backward-compatible (see FR-034); a rollback that stays unhealthy MUST still be reported as failed and alerted for manual intervention.
- **FR-034**: Database migrations MUST be backward-compatible with the immediately previous release (expand-then-contract), because image rollback (FR-018) does not revert migrations. A migration that would break the previous image is prohibited without a coordinated manual release.
- **FR-019**: The system MUST serialize or otherwise safely handle overlapping deployments so the final deployed state is deterministic.

#### Notification (User Story 3)

- **FR-020**: The system MUST post a notification to the configured team Slack channel via a stored Slack Incoming Webhook after each delivery pipeline run on the main branch.
- **FR-021**: The notification MUST clearly indicate success or failure of the run.
- **FR-022**: The notification MUST include the deployed version identifier and a clickable stand URL (for successful runs) and a link to the pipeline run.
- **FR-023**: The system MUST generate a concise, human-readable summary of the changes in the release using an LLM applied to the commit contents (messages and/or diffs) in the deployed commit range.
- **FR-024**: The notification MUST include the AI-generated change summary.
- **FR-025**: If LLM summarization fails or is unavailable, the system MUST still deliver the notification with a graceful fallback summary (e.g., raw commit subjects).
- **FR-026**: The system MUST send exactly one notification per delivery run (no duplicates) and must not block/rollback a successful deployment if only the notification step fails.

#### Cross-cutting

- **FR-027**: Pipeline definitions and configuration MUST live in the repository (version-controlled) so changes are reviewable.
- **FR-028**: All secrets MUST be stored in the CI/CD platform's secret store and referenced by name, never committed.
- **FR-029**: Pipeline runs MUST produce accessible logs sufficient to diagnose a failure without exposing secrets.

#### Versioning & Release Identity

- **FR-030**: The repository MUST contain a committed `VERSION` file holding the release version, bumped manually per release; this value is the canonical version identifier used for image tags and the Slack notification.
- **FR-031**: The PR check MUST verify that the `VERSION` value has been incremented relative to the main branch when the PR changes deployable code, and fail the check if deployable code changed without a version bump.

#### Edge / TLS

- **FR-032**: The deployment topology MUST include a version-controlled edge reverse proxy that terminates TLS on the provisioned domain and forwards traffic to the frontend/backend containers, so the stand is reachable over `https://`.
- **FR-033**: TLS certificates MUST be obtained and renewed automatically via Let's Encrypt (ACME) without manual steps, and renewed certificates MUST take effect without a full redeploy.

### Key Entities *(include if feature involves data)*

- **Pipeline Run**: One execution of a workflow. Attributes: trigger (PR vs. push-to-main), status (success/failure), commit range/version, start/end time, link to logs.
- **Container Image**: A built artifact per service (backend, frontend). Attributes: service name, tag (= `VERSION`), registry location, digest.
- **Release Version**: The value in the committed `VERSION` file. Attributes: version string, previous value (for bump validation and rollback target).
- **Deployment**: The act of running specific image versions on the VPS. Attributes: version deployed, previous version (rollback target), target host/stand URL, migration status, health-check result, rollback-performed flag, timestamp.
- **Change Summary**: AI-generated release notes. Attributes: source commit range, generated summary text, fallback flag.
- **Edge Proxy**: The TLS-terminating reverse proxy fronting the stand. Attributes: domain, certificate (auto-issued via ACME), upstream routes to frontend/backend.
- **Notification**: The message sent to the team channel. Attributes: status badge, version, stand URL (`https://`), run link, summary body.
- **Secret / Variable**: A named, secured configuration value (registry credentials, SSH key/host, DB URL, OAuth creds, session secret, OpenRouter API key, Slack webhook URL, stand URL). Attributes: name, scope (PR vs. deploy), sensitivity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pull requests targeting main automatically receive build, lint, test, and security-scan results without any manual action.
- **SC-002**: A pull request that introduces a lint error, a failing test, or a known high/critical dependency vulnerability is blocked (shows a failing status) in 100% of cases.
- **SC-003**: Every merge to main results in updated images in the registry and the new version running on the stand, with no manual SSH steps, in at least 95% of runs (excluding infrastructure outages).
- **SC-004**: From merge to `main` to the stand serving the new version takes under 15 minutes for a typical change.
- **SC-005**: A team-channel notification for every main deployment arrives within 2 minutes of the run finishing, with correct success/failure status, version, and stand URL in 100% of runs.
- **SC-006**: The AI change summary accurately reflects the release's commits (as judged by the team) for at least 90% of deployments, and a fallback summary is delivered in 100% of the remaining cases.
- **SC-007**: Zero secret values appear in any pipeline log or in the repository across all runs.
- **SC-008**: When a post-deploy health check fails, the pipeline automatically rolls back to the last-known-good release and the stand serves a healthy version again within 5 minutes, in 100% of detected post-cutover failures **where the release's migrations are backward-compatible (FR-034)**; pre-cutover failures never disturb the running stand. A rollback that remains unhealthy (incompatible migration) is reported as failed and alerted for manual intervention.
- **SC-009**: The stand is reachable over `https://` on the provisioned domain with a valid, auto-renewed certificate; no browser certificate warning occurs and certificate renewal requires zero manual intervention.

## Assumptions

- **Platform**: The CI/CD platform is GitHub Actions (the repository is hosted on GitHub, per the request "на базе github"). Secrets are stored in GitHub Actions encrypted secrets/variables.
- **Environments**: There is a single deployment target — one production "stand" on one VPS. Multi-environment (staging/prod) promotion is out of scope for this feature.
- **Container registry**: Images are published to Selectel Container Registry using team-provided registry credentials.
- **Deployment mechanism**: The VPS already runs the app via `docker-compose`. Deployment references CR images by the release tag, pulls them, and runs `up -d` over SSH (no build on the VPS). On a failed post-deploy health check it auto-rolls back to the previous release tag. The deployment topology adds an edge reverse proxy (with automatic Let's Encrypt/ACME) in front of the app; base VPS provisioning (installing Docker, firewall, DNS) is out of scope and assumed pre-existing. This implies the deployed `docker-compose` uses `image:` references (from CR) rather than `build:` for the app services.
- **Stand URL / TLS**: The domain is already provisioned; the stand is served over **HTTPS** with certificates issued and renewed **automatically via Let's Encrypt** (ACME). The stand URL used in the notification is the `https://` domain. DNS/domain registration is out of scope.
- **Backend tests/linter**: The backend currently has no configured test or lint script; PR checks will run what exists and treat absent suites as neutral. Adding backend tests/linters is out of scope but the pipeline must not break when they appear later.
- **Frontend tooling**: The frontend uses `oxlint` for linting and `vite build` for build; no frontend test suite currently exists.
- **Security scanning scope**: "Scanners" means, at minimum, dependency-vulnerability scanning and secret scanning; container image scanning is included where feasible. Full SAST/DAST is out of scope for v1.
- **LLM for summarization**: An LLM accessed via API generates the change summary; its API key is stored as a secret. The team uses **OpenRouter** (OpenAI-compatible API, `OPENROUTER_API_KEY`) with model `anthropic/claude-3.5-haiku`. The requirements (FR-023/FR-024/FR-025) remain provider-agnostic; only the implementation targets OpenRouter.
- **Notification channel**: A single team-internal Slack channel receives notifications via a stored **Incoming Webhook** URL. Because a webhook posts (not edits/threads), each run produces one new message; the channel is bound to the webhook URL.
- **Versioning**: A committed `VERSION` file is the single source of the release version, bumped manually per release. Image tags and the Slack "version" both read from it; a PR check enforces the bump when deployable code changes.
- **Database**: The existing PostgreSQL runs on/with the VPS (as in `docker-compose`); the pipeline applies migrations via the existing `npm run migrate` mechanism.
- **Branch model**: `main` is the deployment branch; PRs target `main`. No release branches or tags are required to trigger deployment (push to `main` is the trigger).
