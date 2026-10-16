#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

// Archive only committed files. Git-ignored credentials and build output cannot enter it.
const changed = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
if (changed.trim()) throw new Error('Commit source changes and new files before packaging a reproducible source snapshot.');
mkdirSync('public', { recursive: true });
execFileSync('git', [
  'archive', '--format=zip', '--prefix=dogs-in-the-details/',
  '--output=public/dogs-in-the-details-source.zip', 'HEAD',
]);
const revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
console.log(`Packaged committed source at ${revision}; credentials and generated output excluded.`);
