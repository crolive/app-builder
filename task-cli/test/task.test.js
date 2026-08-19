'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN = path.join(__dirname, '..', 'bin', 'task.js');

function makeHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'task-cli-test-'));
}

function dataPath(home) {
  return path.join(home, '.task-cli', 'tasks.json');
}

function runCli(args, home) {
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args], { env, encoding: 'utf8' });
    return { stdout, stderr: '', code: 0 };
  } catch (err) {
    return {
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : '',
      code: err.status,
    };
  }
}

test('add creates a task and prints a confirmation', () => {
  const home = makeHome();
  const res = runCli(['add', 'Buy milk'], home);
  assert.strictEqual(res.code, 0);
  assert.strictEqual(res.stdout, 'Added task 1: Buy milk\n');

  const data = JSON.parse(fs.readFileSync(dataPath(home), 'utf8'));
  assert.strictEqual(data.tasks.length, 1);
  assert.deepStrictEqual(data.tasks[0], { id: 1, description: 'Buy milk', completed: false });
  assert.strictEqual(data.nextId, 2);
});

test('add trims leading/trailing whitespace from the description', () => {
  const home = makeHome();
  runCli(['add', '  Clean house  '], home);
  const data = JSON.parse(fs.readFileSync(dataPath(home), 'utf8'));
  assert.strictEqual(data.tasks[0].description, 'Clean house');
});

test('add with no description argument fails and adds nothing', () => {
  const home = makeHome();
  const res = runCli(['add'], home);
  assert.strictEqual(res.code, 1);
  assert.strictEqual(res.stderr, 'Error: task description is required\n');
  assert.strictEqual(res.stdout, '');
});

test('add with an empty string description fails', () => {
  const home = makeHome();
  const res = runCli(['add', ''], home);
  assert.strictEqual(res.code, 1);
  assert.strictEqual(res.stderr, 'Error: task description is required\n');
});

test('add with a whitespace-only description fails', () => {
  const home = makeHome();
  const res = runCli(['add', '   '], home);
  assert.strictEqual(res.code, 1);
  assert.strictEqual(res.stderr, 'Error: task description is required\n');
});

test('task ids increment starting at 1 regardless of deletions', () => {
  const home = makeHome();
  runCli(['add', 'Task 1'], home);
  runCli(['add', 'Task 2'], home);
  runCli(['delete', '1'], home);
  const res = runCli(['add', 'Task 3'], home);
  assert.strictEqual(res.stdout, 'Added task 3: Task 3\n');
});

test('list prints "No tasks found." and exits 0 when empty', () => {
  const home = makeHome();
  const res = runCli(['list'], home);
  assert.strictEqual(res.code, 0);
  assert.strictEqual(res.stdout, 'No tasks found.\n');
});

test('list prints tasks in ascending id order in the fixed format', () => {
  const home = makeHome();
  runCli(['add', 'Buy milk'], home);
  runCli(['add', 'Clean house'], home);
  runCli(['complete', '2'], home);

  const res = runCli(['list'], home);
  assert.strictEqual(res.code, 0);
  assert.strictEqual(res.stdout, '[ ] 1  Buy milk\n[x] 2  Clean house\n');
});

test('list never modifies the data file', () => {
  const home = makeHome();
  runCli(['add', 'Buy milk'], home);
  const before = fs.readFileSync(dataPath(home), 'utf8');
  runCli(['list'], home);
  const after = fs.readFileSync(dataPath(home), 'utf8');
  assert.strictEqual(before, after);
});

test('complete marks an existing task completed and prints confirmation', () => {
  const home = makeHome();
  runCli(['add', 'Buy milk'], home);
  const res = runCli(['complete', '1'], home);
  assert.strictEqual(res.code, 0);
  assert.strictEqual(res.stdout, 'Completed task 1: Buy milk\n');

  const data = JSON.parse(fs.readFileSync(dataPath(home), 'utf8'));
  assert.strictEqual(data.tasks[0].completed, true);
});

test('complete with a non-integer id fails and changes nothing', () => {
  const home = makeHome();
  runCli(['add', 'Buy milk'], home);
  const res = runCli(['complete', 'abc'], home);
  assert.strictEqual(res.code, 1);
  assert.strictEqual(res.stderr, 'Error: invalid task id "abc"\n');

  const data = JSON.parse(fs.readFileSync(dataPath(home), 'utf8'));
  assert.strictEqual(data.tasks[0].completed, false);
});

test('complete with an id that does not exist fails with not-found error', () => {
  const home = makeHome();
  const res = runCli(['complete', '99'], home);
  assert.strictEqual(res.code, 1);
  assert.strictEqual(res.stderr, 'Error: task 99 not found\n');
});

test('completing an already-completed task succeeds both times', () => {
  const home = makeHome();
  runCli(['add', 'Buy milk'], home);
  const first = runCli(['complete', '1'], home);
  const second = runCli(['complete', '1'], home);
  assert.strictEqual(first.code, 0);
  assert.strictEqual(second.code, 0);
  assert.strictEqual(second.stdout, 'Completed task 1: Buy milk\n');
});

test('delete removes an existing task and prints confirmation', () => {
  const home = makeHome();
  runCli(['add', 'Buy milk'], home);
  const res = runCli(['delete', '1'], home);
  assert.strictEqual(res.code, 0);
  assert.strictEqual(res.stdout, 'Deleted task 1: Buy milk\n');

  const data = JSON.parse(fs.readFileSync(dataPath(home), 'utf8'));
  assert.strictEqual(data.tasks.length, 0);
});

test('delete with a non-integer id fails and changes nothing', () => {
  const home = makeHome();
  runCli(['add', 'Buy milk'], home);
  const res = runCli(['delete', 'abc'], home);
  assert.strictEqual(res.code, 1);
  assert.strictEqual(res.stderr, 'Error: invalid task id "abc"\n');

  const data = JSON.parse(fs.readFileSync(dataPath(home), 'utf8'));
  assert.strictEqual(data.tasks.length, 1);
});

test('delete with an id that does not exist fails with not-found error', () => {
  const home = makeHome();
  const res = runCli(['delete', '99'], home);
  assert.strictEqual(res.code, 1);
  assert.strictEqual(res.stderr, 'Error: task 99 not found\n');
});

test('deleted ids are never reused by later adds', () => {
  const home = makeHome();
  runCli(['add', 'Task 1'], home);
  runCli(['add', 'Task 2'], home);
  runCli(['delete', '1'], home);
  runCli(['delete', '2'], home);
  const res = runCli(['add', 'Task 3'], home);
  assert.strictEqual(res.stdout, 'Added task 3: Task 3\n');
  const data = JSON.parse(fs.readFileSync(dataPath(home), 'utf8'));
  assert.deepStrictEqual(data.tasks.map((t) => t.id), [3]);
});

test('data persists across separate CLI invocations', () => {
  const home = makeHome();
  runCli(['add', 'Persisted task'], home);
  const res = runCli(['list'], home);
  assert.strictEqual(res.stdout, '[ ] 1  Persisted task\n');
});

test('first run auto-creates the directory and file with an empty list', () => {
  const home = makeHome();
  assert.strictEqual(fs.existsSync(dataPath(home)), false);

  const res = runCli(['list'], home);
  assert.strictEqual(res.code, 0);
  assert.strictEqual(fs.existsSync(dataPath(home)), true);

  const data = JSON.parse(fs.readFileSync(dataPath(home), 'utf8'));
  assert.deepStrictEqual(data, { nextId: 1, tasks: [] });
});

test('a corrupted data file causes every command to fail without overwriting it', () => {
  const home = makeHome();
  const dir = path.join(home, '.task-cli');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tasks.json'), '{ not valid json', 'utf8');

  const res = runCli(['list'], home);
  assert.strictEqual(res.code, 1);
  assert.strictEqual(res.stderr, 'Error: task data file is corrupted\n');

  const contents = fs.readFileSync(path.join(dir, 'tasks.json'), 'utf8');
  assert.strictEqual(contents, '{ not valid json');
});

test('a data file with the wrong shape is treated as corrupted', () => {
  const home = makeHome();
  const dir = path.join(home, '.task-cli');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tasks.json'), JSON.stringify({ foo: 'bar' }), 'utf8');

  const res = runCli(['add', 'Buy milk'], home);
  assert.strictEqual(res.code, 1);
  assert.strictEqual(res.stderr, 'Error: task data file is corrupted\n');
});

test('running with no subcommand prints usage and exits 1', () => {
  const home = makeHome();
  const res = runCli([], home);
  assert.strictEqual(res.code, 1);
  assert.match(res.stderr, /Usage:/);
  assert.match(res.stderr, /task add/);
  assert.match(res.stderr, /task list/);
  assert.match(res.stderr, /task complete/);
  assert.match(res.stderr, /task delete/);
});

test('running with an unrecognized subcommand prints usage and exits 1', () => {
  const home = makeHome();
  const res = runCli(['bogus'], home);
  assert.strictEqual(res.code, 1);
  assert.match(res.stderr, /Usage:/);
});

test('the source contains no HTTP client, fetch, or network socket usage', () => {
  const filesToCheck = [
    path.join(__dirname, '..', 'src', 'cli.js'),
    path.join(__dirname, '..', 'src', 'store.js'),
    path.join(__dirname, '..', 'bin', 'task.js'),
  ];
  for (const file of filesToCheck) {
    const content = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(content, /require\(\s*['"]https?['"]\s*\)/);
    assert.doesNotMatch(content, /require\(\s*['"]net['"]\s*\)/);
    assert.doesNotMatch(content, /require\(\s*['"]dgram['"]\s*\)/);
    assert.doesNotMatch(content, /\bfetch\s*\(/);
  }
});
