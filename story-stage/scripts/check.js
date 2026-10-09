import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

for (const directory of ['src', 'public', 'scripts', 'test', 'examples']) {
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.js')).sort()) {
    const result = spawnSync(process.execPath, ['--check', `${directory}/${file}`], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
console.log('JavaScript syntax checks passed.');
