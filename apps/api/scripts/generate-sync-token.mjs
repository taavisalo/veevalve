#!/usr/bin/env node
import { randomBytes } from 'node:crypto';

const DEFAULT_BYTES = 48;
const MIN_BYTES = 32;
const MAX_BYTES = 128;

const usage = () => {
  console.error('Usage: node scripts/generate-sync-token.mjs [--bytes <32-128>] [--env]');
};

const args = process.argv.slice(2);
let byteLength = DEFAULT_BYTES;
let emitEnvLine = false;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];

  if (arg === '--') {
    continue;
  }

  if (arg === '--env') {
    emitEnvLine = true;
    continue;
  }

  if (arg === '--bytes') {
    const rawValue = args[index + 1];
    if (!rawValue) {
      usage();
      process.exit(1);
    }

    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed) || parsed < MIN_BYTES || parsed > MAX_BYTES) {
      console.error(`--bytes must be between ${String(MIN_BYTES)} and ${String(MAX_BYTES)}.`);
      process.exit(1);
    }

    byteLength = parsed;
    index += 1;
    continue;
  }

  usage();
  process.exit(1);
}

const token = randomBytes(byteLength).toString('base64url');
if (emitEnvLine) {
  process.stdout.write(`SYNC_API_TOKEN=${token}\n`);
} else {
  process.stdout.write(`${token}\n`);
}
