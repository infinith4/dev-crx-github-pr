import { build } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

const outdir = 'dist';

await rm(outdir, { force: true, recursive: true });
await mkdir(outdir, { recursive: true });

const common = {
  bundle: true,
  format: 'esm',
  target: 'es2022',
  sourcemap: true,
  logLevel: 'info',
};

await build({
  ...common,
  entryPoints: {
    content: 'src/content/index.ts',
    background: 'src/background/index.ts',
    options: 'src/options/index.ts',
  },
  outdir,
});

await mkdir(dirname(`${outdir}/options.html`), { recursive: true });
await copyFile('src/options/index.html', `${outdir}/options.html`);
await copyFile('src/content/styles.css', `${outdir}/styles.css`);
