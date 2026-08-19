'use strict';

const { parseArgs } = require('util');
const store = require('./store');

const USAGE = [
  'Usage:',
  '  task add "<description>"',
  '  task list',
  '  task complete <id>',
  '  task delete <id>',
].join('\n');

const VALID_COMMANDS = ['add', 'list', 'complete', 'delete'];

// Accepts an optional leading/trailing-whitespace base-10 integer string
// (e.g. "5", " 5 "); rejects anything else (e.g. "abc", "1.5", "").
function parseTaskId(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
}

function run(argv) {
  let positionals;
  try {
    ({ positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: false,
    }));
  } catch (err) {
    process.stderr.write(USAGE + '\n');
    return 1;
  }

  const [command, ...rest] = positionals;

  if (!command || !VALID_COMMANDS.includes(command)) {
    process.stderr.write(USAGE + '\n');
    return 1;
  }

  let data;
  try {
    data = store.loadData();
  } catch (err) {
    if (err instanceof store.CorruptedDataError) {
      process.stderr.write('Error: task data file is corrupted\n');
      return 1;
    }
    throw err;
  }

  if (command === 'add') {
    return handleAdd(data, rest[0]);
  }
  if (command === 'list') {
    return handleList(data);
  }
  if (command === 'complete') {
    return handleComplete(data, rest[0]);
  }
  return handleDelete(data, rest[0]);
}

function handleAdd(data, rawDescription) {
  const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';
  if (!description) {
    process.stderr.write('Error: task description is required\n');
    return 1;
  }

  const id = data.nextId;
  data.tasks.push({ id, description, completed: false });
  data.nextId = id + 1;
  store.saveData(data);

  process.stdout.write(`Added task ${id}: ${description}\n`);
  return 0;
}

function handleList(data) {
  if (data.tasks.length === 0) {
    process.stdout.write('No tasks found.\n');
    return 0;
  }

  const sorted = [...data.tasks].sort((a, b) => a.id - b.id);
  for (const task of sorted) {
    const mark = task.completed ? 'x' : ' ';
    process.stdout.write(`[${mark}] ${task.id}  ${task.description}\n`);
  }
  return 0;
}

function handleComplete(data, rawId) {
  const id = parseTaskId(rawId);
  if (id === null) {
    process.stderr.write(`Error: invalid task id "${rawId}"\n`);
    return 1;
  }

  const task = data.tasks.find((t) => t.id === id);
  if (!task) {
    process.stderr.write(`Error: task ${id} not found\n`);
    return 1;
  }

  task.completed = true;
  store.saveData(data);

  process.stdout.write(`Completed task ${id}: ${task.description}\n`);
  return 0;
}

function handleDelete(data, rawId) {
  const id = parseTaskId(rawId);
  if (id === null) {
    process.stderr.write(`Error: invalid task id "${rawId}"\n`);
    return 1;
  }

  const index = data.tasks.findIndex((t) => t.id === id);
  if (index === -1) {
    process.stderr.write(`Error: task ${id} not found\n`);
    return 1;
  }

  const [removed] = data.tasks.splice(index, 1);
  store.saveData(data);

  process.stdout.write(`Deleted task ${id}: ${removed.description}\n`);
  return 0;
}

module.exports = { run, USAGE, parseTaskId };
