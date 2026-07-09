#!/usr/bin/env node
const fs = require('node:fs');
const { program } = require('commander');
const collectors = require('./src/collectors');
const { renderTable, jsonError } = require('./src/output');

function emit(payload, opts) {
  const text = opts.json ? JSON.stringify(payload, null, 2) : payload;
  if (opts.output) fs.writeFileSync(opts.output, text + '\n');
  else console.log(text);
}

async function emitOne(collector, opts) {
  const res = await collector.collect();
  if (opts.json) {
    emit(res.available ? res.data : jsonError(res.reason), opts);
    process.exitCode = res.available ? 0 : 1;
    return;
  }
  if (!res.available) {
    console.error(`${collector.title}: ${res.reason}`);
    process.exitCode = 1;
    return;
  }
  emit(`${collector.title}\n${renderTable(collector.table(res.data, { verbose: opts.verbose }))}`, opts);
}

async function emitAll(opts) {
  if (opts.json) {
    const obj = {};
    for (const c of collectors) {
      const res = await c.collect();
      obj[c.name] = res.available ? res.data : jsonError(res.reason);
    }
    emit(obj, opts);
    return;
  }
  const blocks = [];
  for (const c of collectors) {
    const res = await c.collect();
    blocks.push(
      res.available
        ? `${c.title}\n${renderTable(c.table(res.data, { verbose: opts.verbose }))}`
        : `${c.title}\n(unavailable: ${res.reason})`
    );
  }
  emit(blocks.join('\n\n'), opts);
}

const addOpts = (cmd) =>
  cmd
    .option('--json', 'output JSON instead of a table')
    .option('-v, --verbose', 'show extra detail in tables')
    .option('-o, --output <file>', 'write output to a file');

program.name('bob').description('Debian/Ubuntu system information').version('0.1.0');
program.option('-i, --interactive', 'launch the interactive menu');

for (const c of collectors) {
  addOpts(program.command(c.name).description(`Show ${c.title.toLowerCase()}`))
    .action((opts) => emitOne(c, opts));
}
addOpts(program.command('all').description('Show every category'))
  .action((opts) => emitAll(opts));

program.command('interactive')
  .description('launch the interactive menu')
  .action(async () => {
    const { runInteractive } = require('./src/interactive');
    await runInteractive();
  });

program.action(async () => {
  if (program.opts().interactive) {
    const { runInteractive } = require('./src/interactive');
    await runInteractive();
  } else {
    program.help();
  }
});

program.parseAsync(process.argv);
