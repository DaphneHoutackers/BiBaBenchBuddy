import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const directory = process.argv[2] || 'release';
const platform = process.argv[3] || 'all';
if (!['all', 'mac', 'win'].includes(platform)) throw new Error('Use platform all, mac or win');
const expected = [
  { platform: 'mac', arch: 'arm64', file: `BiBaBenchBuddy-${pkg.version}-mac-arm64.dmg` },
  { platform: 'win', arch: 'x64', file: `BiBaBenchBuddy-${pkg.version}-Setup.exe` },
].filter(item => platform === 'all' || item.platform === platform);
const files = await readdir(directory);
if (files.some(file => /^latest.*\.ya?ml$/.test(file))) {
  throw new Error('Unexpected updater feed in a manual-update release');
}
const installers = files.filter(file => /\.(dmg|exe|zip)$/.test(file)).sort();
if (JSON.stringify(installers) !== JSON.stringify(expected.map(item => item.file).sort())) {
  throw new Error(`Expected exactly these installers: ${expected.map(item => item.file).join(', ')}`);
}
const artifacts = [];
for (const item of expected) {
  const filePath = path.join(directory, item.file);
  const { size } = await stat(filePath);
  const handle = await open(filePath, 'r');
  try {
    const magic = Buffer.alloc(4);
    const position = item.platform === 'mac' ? size - 512 : 0;
    if (position < 0) throw new Error(`Truncated installer: ${item.file}`);
    await handle.read(magic, 0, 4, position);
    if (item.platform === 'mac' ? magic.toString() !== 'koly' : magic.subarray(0, 2).toString() !== 'MZ') {
      throw new Error(`Invalid installer header: ${item.file}`);
    }
  } finally {
    await handle.close();
  }
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  artifacts.push({ ...item, size, sha256: hash.digest('hex') });
}
const manifest = {
  schemaVersion: 1,
  version: pkg.version,
  productName: pkg.build.productName,
  bundleIdentifier: pkg.build.appId,
  updatePolicy: 'manual',
  sourceCommit: process.env.GITHUB_SHA || null,
  artifacts,
};
await writeFile(path.join(directory, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(path.join(directory, 'SHA256SUMS'), artifacts.map(item => `${item.sha256}  ${item.file}\n`).join(''));
console.log(`Verified ${artifacts.length} installer(s); wrote manual-release manifest and SHA256SUMS`);
