# Contributing to WebSquared

Thanks for considering contributing, pull requests, bug reports, and
ideas are all welcome.

## Before you start

For anything beyond a small fix, please open an issue first to discuss the
change. This avoids wasted effort on a PR that doesn't end up fitting the
project's direction.

Read [ARCHITECTURE.md](./ARCHITECTURE.md) first if you're touching the
proxy pipeline, HTML/CSS rewriting, or the injected client script, it
explains the non-obvious parts (cookie namespacing, why the client script
is inlined rather than linked, the self-loop/SSRF guards) that are easy to
accidentally break.

## Setting up

```bash
git clone https://github.com/Hexadecinull/WebSquared.git
cd WebSquared
npm install
npm run dev
```

See the main [README](../README.md) for what each script does.

## Before opening a PR

All of these must pass:

```bash
npm run check   # svelte-check, type errors
npm run lint    # eslint
npm run build   # full production build
```

A PR that doesn't build or introduces new type errors/lint warnings won't
be merged as-is.

## Code style

- No comments explaining *what* code obviously does, only comments
  explaining *why*, when the reasoning isn't self-evident from the code.
  Keep them to one line, not a paragraph.
- No comments referencing specific people, conversations, or PRs by name.
- Match the existing formatting/structure of the file you're editing
  rather than introducing a different style within the same file.
- Prefer fixing the root cause of a bug over papering over the symptom.
  If you're not sure which one you've done, say so in the PR description.

## Reporting bugs

Open an issue with:
- What you expected to happen vs. what actually happened
- Steps to reproduce, if you can find them
- Browser/OS, and whether it happens on a specific site or generally
- Console output, if there's an error (right-click → Inspect → Console)

## Reporting security issues

Please don't open a public issue for a security vulnerability, see
[SECURITY.md](./SECURITY.md) for how to report it privately.

## Automated checks

Every push and pull request runs the CI workflow (type-check, lint, build)
and CodeQL static analysis. Dependabot opens PRs for outdated dependencies
on its own schedule. None of these replace `npm run check`/`lint`/`build`
locally before you push. They just catch what a local run might miss.

## License

By contributing, you agree your contributions are licensed under the
project's [AGPL-3.0 license](../LICENSE).
