# @rbk-agent/bob

Debian/Ubuntu system information CLI — outputs JSON or pretty tables, with an interactive mode.

## Install

```sh
npm install -g @rbk-agent/bob
```

Requires Node.js >= 18 and runs on Debian/Ubuntu (reads `/proc`, `lshw`,
`systemctl`, `rfkill`, etc. as the current user).

## Usage

```sh
bob                  # show help
bob all              # show every category
bob cpu              # CPU info
bob volumes          # mounted volumes
bob --json cpu       # JSON output
bob -i               # interactive menu
```

Each category command supports:

- `--json` — output JSON instead of a table
- `-v, --verbose` — show extra detail in tables
- `-o, --output <file>` — write output to a file

## Categories

CPU, OS, network, volumes, software, services, devices, audio, bluetooth, SSH.

## Development

```sh
npm test      # node --test
node index.js # run from source
```

## License

MIT