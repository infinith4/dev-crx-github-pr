import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import process from 'node:process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

if (pkg.version !== manifest.version) {
  console.error(
    `Error: package.json version (${pkg.version}) does not match manifest.json version (${manifest.version})`
  );
  process.exit(1);
}

const version = pkg.version;
const releaseDir = 'release';
const stageDir = join(releaseDir, 'package');
const zipName = `github-pr-comment-tools-${version}.zip`;
const zipPath = join(releaseDir, zipName);

console.log(`Packaging extension v${version}...`);

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });
cpSync('manifest.json', join(stageDir, 'manifest.json'));
cpSync('dist', join(stageDir, 'dist'), { recursive: true });

removeSourceMaps(join(stageDir, 'dist'));

const absStageDir = resolve(stageDir);
const absZipPath = resolve(zipPath);

if (process.platform === 'win32') {
  execSync(
    `powershell -NoProfile -Command "Push-Location '${absStageDir}'; Compress-Archive -Path manifest.json,dist -DestinationPath '${absZipPath}' -Force; Pop-Location"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`zip -r "${absZipPath}" manifest.json dist`, {
    cwd: absStageDir,
    stdio: 'inherit',
  });
}

console.log(`\nPackaged: ${zipPath}`);
console.log(`  manifest.json`);
console.log(`  dist/`);

function removeSourceMaps(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      removeSourceMaps(full);
    } else if (entry.name.endsWith('.map')) {
      rmSync(full);
    }
  }
}
