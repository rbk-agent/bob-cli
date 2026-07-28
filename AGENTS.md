# bob-cli

Debian/Ubuntu system information CLI — outputs JSON or pretty tables, with an interactive mode.

## Stack

- Node.js (>=18), ESM
- Commander for CLI args
- @inquirer/prompts for interactive mode
- Built-in `node --test` for tests

## Commands

- `node index.js` — run bob CLI
- `npm test` — run test suite
- Binary: `bob` (via `./index.js`)

## Conventions

- Source in `src/`, entry point `index.js`
- Docs in `docs/`
- Output as JSON (`--json`) or pretty tables (default)
- Interactive mode with `@inquirer/prompts`