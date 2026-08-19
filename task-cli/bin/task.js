#!/usr/bin/env node
'use strict';

const { run } = require('../src/cli');

const exitCode = run(process.argv.slice(2));
process.exit(exitCode);
