#!/usr/bin/env node
import { createVaultThemeCli } from '../src/cli.js';

createVaultThemeCli(process.argv.slice(2)).catch((error) => {
  console.error('\n✗ ' + (error && error.message ? error.message : String(error)) + '\n');
  process.exit(1);
});
