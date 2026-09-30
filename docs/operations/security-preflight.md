# Security preflight and scanner recovery

Review workflow and policy changes before manually merging a pull request. Address
relevant review findings and resolve their threads after verification. The required
`Security preflight` check must pass on the latest candidate; `Expected` means that
no result has been published yet. The repository owner decides when to merge.

## Resume the scanner after an incident

Inventory workflows before enabling GitHub Actions. Disable authored application
workflows individually and enable only the reviewed static scanner. Preserve
GitHub-generated Dependabot workflows. The scanner has a read-only token and no
application secrets; it reads project files as data and does not install or run the
application. Verify the tested commit and each scanner step in GitHub Actions.

Application CI and deployment recovery additionally require review of dependencies
and execution paths and rotation of potentially exposed credentials. Keep rotation
status in the incident record, without copying secrets into repository documents.

## Change the policy

The scanner script and Semgrep rules come from a separate checkout pinned to a
reviewed immutable commit in this repository. Candidate policy edits do not change
the executed policy. Review and test a new policy commit before updating that pin.
Tools and actions are pinned and the rules-pack digest is checked before use.

VS Code tasks are parsed as JSONC. Automatic tasks, ambiguous or invalid task files,
and symlinks at reserved editor configuration paths fail the scan. Semgrep checks
all configured severities, with its vendored rules pack excluded from source
analysis because its pattern examples are not application code. Gitleaks and the
incident scanner still inspect that file. Reports print locations and rule IDs,
without source snippets or secret values.

Workflow YAML remains part of the policy to review. Binding the required check to
GitHub Actions does not make its definition immutable on a personal repository.
The scan and automated reviews support the owner's review; they do not prove that
a repository is free of malware.
