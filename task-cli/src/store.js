'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

class CorruptedDataError extends Error {}

function getDataDir() {
  return path.join(os.homedir(), '.task-cli');
}

function getDataPath() {
  return path.join(getDataDir(), 'tasks.json');
}

function emptyData() {
  return { nextId: 1, tasks: [] };
}

function isValidData(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  if (!Number.isInteger(data.nextId)) return false;
  if (!Array.isArray(data.tasks)) return false;
  for (const task of data.tasks) {
    if (typeof task !== 'object' || task === null) return false;
    if (!Number.isInteger(task.id)) return false;
    if (typeof task.description !== 'string') return false;
    if (typeof task.completed !== 'boolean') return false;
  }
  return true;
}

// Reads the persisted task data, creating the directory/file with the
// empty-list default on first run. Throws CorruptedDataError if the file
// exists but does not contain valid JSON matching the data model shape.
function loadData() {
  const dataDir = getDataDir();
  const dataPath = getDataPath();

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataPath)) {
    const fresh = emptyData();
    fs.writeFileSync(dataPath, JSON.stringify(fresh, null, 2) + '\n', 'utf8');
    return fresh;
  }

  const raw = fs.readFileSync(dataPath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new CorruptedDataError('task data file is corrupted');
  }

  if (!isValidData(parsed)) {
    throw new CorruptedDataError('task data file is corrupted');
  }

  return parsed;
}

function saveData(data) {
  fs.writeFileSync(getDataPath(), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

module.exports = {
  getDataDir,
  getDataPath,
  emptyData,
  isValidData,
  loadData,
  saveData,
  CorruptedDataError,
};
