# Security controls

The `Security preflight` job scans files as data before the existing project CI. It uses Gitleaks 8.30.1 with fully redacted output, a frozen 225-rule Semgrep security-audit pack, and the known September 2026 incident markers. It rejects VS Code tasks that run automatically when a folder opens. No application secret, package installation, source import or build is used in this job. The Semgrep container has no network access during analysis. Findings are not a guarantee that all malware will be detected.

Actions and the scanner container are pinned to immutable commits/digests. The Gitleaks download and the Semgrep rule pack are checked by SHA-256. Repository ignore files and inline suppression comments cannot silently suppress the security scans. Updating the rule pack requires a reviewed PR and an updated digest in the workflow.

This change requires independent review and merge. Actions is currently suspended after the incident. Do not re-enable old workflows until their secrets and execution paths have been reviewed. After the first successful run, require the exact `Security preflight` check on `main` and `preprod`, restricted to the GitHub Actions application. Keep existing human-approval protections active. Use read-only default tokens and do not pass secrets to this reusable workflow.

Dependabot updates require review. CodeQL and dependency review are included for this public repository where its languages are supported. Dependency review runs when a supported dependency manifest is present and requires the GitHub dependency graph; a repository without a manifest does not have dependency changes to review. Harden-Runner Community observes public runner traffic in audit mode; it does not block all outbound traffic.

GitHub security/Actions email preferences must be set and delivery tested by the account owner. This workflow does not configure the cross-provider email monitor, Doppler, remote deployment approvals, OIDC or key rotation. Those are tracked in the incident follow-up.
