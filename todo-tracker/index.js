#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TRACKER_DIR = path.join(os.homedir(), '.todo-tracker');
const TASKS_FILE = path.join(TRACKER_DIR, 'tasks.json');

function ensureDir() {
  if (!fs.existsSync(TRACKER_DIR)) {
    fs.mkdirSync(TRACKER_DIR, { recursive: true });
  }
}

function readTasks() {
  if (!fs.existsSync(TASKS_FILE)) {
    return { tasks: [] };
  }

  let raw;
  try {
    raw = fs.readFileSync(TASKS_FILE, 'utf8');
  } catch (err) {
    process.stderr.write('Error: tasks.json is corrupted. Please delete ~/.todo-tracker/tasks.json and try again.\n');
    process.exit(1);
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    process.stderr.write('Error: tasks.json is corrupted. Please delete ~/.todo-tracker/tasks.json and try again.\n');
    process.exit(1);
  }
}

function writeTasks(data) {
  ensureDir();
  const tmpFile = path.join(TRACKER_DIR, '.tasks.tmp');
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpFile, TASKS_FILE);
}

function nextId(tasks) {
  if (tasks.length === 0) return 1;
  return Math.max(...tasks.map(t => t.id)) + 1;
}

program
  .name('todo')
  .description('A lightweight command-line task manager')
  .exitOverride()
  .configureOutput({ writeErr: () => {} });

program
  .command('add <description>')
  .description('Add a new task')
  .action((description) => {
    if (!description || description.trim() === '') {
      process.stderr.write('Error: task description is required.\n');
      process.exit(1);
    }

    const data = readTasks();
    const id = nextId(data.tasks);
    data.tasks.push({ id, description, status: 'pending' });
    writeTasks(data);
    process.stdout.write(`Added task ${id}: ${description}\n`);
    process.exit(0);
  });

program
  .command('list')
  .description('List all tasks')
  .action(() => {
    const data = readTasks();
    const tasks = data.tasks.slice().sort((a, b) => a.id - b.id);

    if (tasks.length === 0) {
      process.stdout.write('No tasks found.\n');
      process.exit(0);
    }

    for (const task of tasks) {
      process.stdout.write(`[${task.id}] [${task.status}] ${task.description}\n`);
    }
    process.exit(0);
  });

program
  .command('complete <id>')
  .description('Mark a task as complete')
  .action((idStr) => {
    const id = parseInt(idStr, 10);
    const data = readTasks();
    const task = data.tasks.find(t => t.id === id);

    if (!task) {
      process.stderr.write(`Error: task ${id} not found.\n`);
      process.exit(1);
    }

    if (task.status === 'complete') {
      process.stdout.write(`Task ${id} is already complete.\n`);
      process.exit(0);
    }

    task.status = 'complete';
    writeTasks(data);
    process.stdout.write(`Completed task ${id}.\n`);
    process.exit(0);
  });

program
  .command('delete <id>')
  .description('Delete a task')
  .action((idStr) => {
    const id = parseInt(idStr, 10);
    const data = readTasks();
    const index = data.tasks.findIndex(t => t.id === id);

    if (index === -1) {
      process.stderr.write(`Error: task ${id} not found.\n`);
      process.exit(1);
    }

    data.tasks.splice(index, 1);
    writeTasks(data);
    process.stdout.write(`Deleted task ${id}.\n`);
    process.exit(0);
  });

const subcommand = process.argv[2];

try {
  program.parse(process.argv);
} catch (err) {
  if (err.code === 'commander.missingArgument') {
    if (subcommand === 'complete' || subcommand === 'delete') {
      process.stderr.write('Error: task ID is required.\n');
    } else {
      process.stderr.write('Error: task description is required.\n');
    }
    process.exit(1);
  }
  if (err.code === 'commander.unknownCommand') {
    process.stderr.write(err.message + '\n');
    program.outputHelp();
    process.exit(1);
  }
  if (err.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  process.exit(1);
}
