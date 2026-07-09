const { execFile } = require('node:child_process');

function run(cmd, args = [], { timeout = 5000 } = {}) {
  return new Promise((resolve) => {
    try {
      execFile(cmd, args, { timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          resolve({
            ok: false,
            stdout: stdout || '',
            stderr: stderr || err.message,
            code: typeof err.code === 'number' ? err.code : null,
          });
        } else {
          resolve({ ok: true, stdout, stderr, code: 0 });
        }
      });
    } catch (e) {
      resolve({ ok: false, stdout: '', stderr: String(e), code: null });
    }
  });
}

async function hasCommand(cmd) {
  const res = await run('which', [cmd]);
  return res.ok && res.stdout.trim().length > 0;
}

module.exports = { run, hasCommand };
