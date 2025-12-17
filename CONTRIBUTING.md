# Contributing

Please follow these simple rules when contributing.

## Node and Package manager

The repo uses `pnpm` as its package manager. We use `fnm` to setup proper node version automatically.

## Commit messages

Try to match this regex (we might generate changelogs from the commit messages later on):

```
/^(revert: )?(feat|fix|docs|dx|style|refactor|perf|test|workflow|build|ci|chore|types|wip)(\(.+\))?: .{1,50}/
```

For example:

```
feat(input): add masking using cleave.js
```

If you have a redmine ticket number, you can add it on the second line like this:

```
feat(input): add masking using cleave.js
!t: #33154
```

## Direct pushes to `main` are not allowed

All changes must go through a Pull Request (PR) and a reviewing process before merging.

## Branching strategy

You don't need to specify both ticket and summary in case if for example you don't have a ticket for your feature/fix.

### New features

- Branch from: `main`
- Open a PR targeting: `main`
- Branch name `feat/ticket/very_short_summary`

### Bugfixes

- Branch from: `main`
- Open a PR targeting: `main`
- Branch name `fix/ticket/very_short_summary`

### Hotfixes (critical fixes for production)

- Branch from: `main`
- Open a PR targeting: `main`
- Branch name `hotfix/ticket/very_short_summary`

## Before opening a PR

- Make sure your changes do **not break** any existing functionality.
- Test thoroughly across supported frameworks and use cases.
- Keep your PR focused and clear — one purpose per PR.
