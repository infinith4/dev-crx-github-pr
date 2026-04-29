import { readFileSync } from 'node:fs';
import process from 'node:process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

if (pkg.version !== manifest.version) {
  console.error(
    `Error: package.json version (${pkg.version}) does not match manifest.json version (${manifest.version})`
  );
  process.exit(1);
}

console.log(`Version check passed: ${pkg.version}`);
