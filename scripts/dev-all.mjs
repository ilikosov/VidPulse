// Self-restarting dev launcher.
//
// Runs the full dev stack (`npm run dev:all:once`) and, while it runs, polls the current branch's
// upstream for new commits. When the remote branch advances, it stops the stack, fast-forwards the
// working tree (`git pull --ff-only`), and starts the stack again — so `dev:all` always runs the
// latest pushed code (re-installing deps, rebuilding packages, and re-running migrations each time,
// because those steps live in dev:all:once).
//
// Config via env:
//   DEV_WATCH_INTERVAL_MS  poll interval in ms (default 15000)
//   DEV_WATCH_DISABLED     set to "1"/"true" to run the stack once without watching
//   DEV_WATCH_INNER        override the stack command (default "npm run dev:all:once")
//
// The watch is best-effort: with no upstream, or while offline, polling is skipped and the stack
// keeps running — the dev experience never depends on the network.

import { spawn, spawnSync } from 'node:child_process';

const POLL_MS = Number(process.env.DEV_WATCH_INTERVAL_MS ?? 15000);
const WATCH_DISABLED = /^(1|true)$/i.test(process.env.DEV_WATCH_DISABLED ?? '');
const INNER_COMMAND = process.env.DEV_WATCH_INNER ?? 'npm run dev:all:once';

const log = (msg) => console.log(`\x1b[35m[dev:all]\x1b[0m ${msg}`);

/** Run a git command, returning trimmed stdout, or null on any failure (offline, no upstream…). */
function git(args) {
  const res = spawnSync('git', args, { encoding: 'utf8' });
  if (res.status !== 0 || typeof res.stdout !== 'string') return null;
  return res.stdout.trim();
}

const currentBranch = () => git(['rev-parse', '--abbrev-ref', 'HEAD']);
const localHead = () => git(['rev-parse', 'HEAD']);

/** Fetch the branch and return the remote head, or null when there's no upstream / no network. */
function remoteHead(branch) {
  if (git(['fetch', 'origin', branch, '--quiet']) === null) return null;
  return git(['rev-parse', `origin/${branch}`]);
}

let child = null;
let restarting = false;
let shuttingDown = false;

function startStack() {
  log('starting dev stack…');
  // detached → its own process group, so we can signal the whole tree (concurrently + BE/FE).
  child = spawn(INNER_COMMAND, { shell: true, stdio: 'inherit', detached: true });
  child.on('exit', (code) => {
    child = null;
    if (restarting || shuttingDown) return; // intentional stop — a restart will follow
    // The stack exited on its own (finished or crashed) — mirror its exit code and stop watching.
    process.exit(code ?? 0);
  });
}

/** Stop the running stack (whole process group) and resolve once it has exited. */
function stopStack() {
  return new Promise((resolve) => {
    if (!child) return resolve();
    const c = child;
    c.once('exit', () => resolve());
    const signal = (sig) => {
      try {
        process.kill(-c.pid, sig); // negative pid → the process group
      } catch {
        try {
          c.kill(sig);
        } catch {
          /* already gone */
        }
      }
    };
    signal('SIGTERM');
    setTimeout(() => signal('SIGKILL'), 5000);
  });
}

async function restartFromRemote(branch) {
  restarting = true;
  log('new commits detected → stopping stack');
  await stopStack();
  log('pulling new commits');
  const pull = spawnSync('git', ['pull', '--ff-only', 'origin', branch], { stdio: 'inherit' });
  if (pull.status !== 0) {
    log('git pull --ff-only failed (diverged or local changes?) — restarting on current HEAD');
  }
  restarting = false;
  startStack();
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  stopStack().then(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function main() {
  const branch = currentBranch();
  startStack();

  if (WATCH_DISABLED || !branch || branch === 'HEAD') {
    if (!WATCH_DISABLED) log('detached HEAD or unknown branch — running without commit watching');
    return;
  }

  log(`watching branch "${branch}" for new commits (every ${POLL_MS}ms)`);
  const timer = setInterval(async () => {
    if (restarting || shuttingDown || !child) return;
    const remote = remoteHead(branch);
    if (!remote || remote === localHead()) return;
    await restartFromRemote(branch);
  }, POLL_MS);
  timer.unref();
}

main();
