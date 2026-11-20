#!/usr/bin/env node
import { createVaultPluginCli } from '../src/cli.js';

createVaultPluginCli(process.argv.slice(2)).catch((error) => {
  console.error('\n✗ ' + (error && error.message ? error.message : String(error)) + '\n');
  process.exit(1);
});
