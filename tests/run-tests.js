#!/usr/bin/env node

const { spawnSync } = require('node:child_process')

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

run('node', ['tests/validate-examples.js'])
run('node', ['--test', 'tests/runtime/memory-service.test.js'])

console.log('✅ all tests passed')
