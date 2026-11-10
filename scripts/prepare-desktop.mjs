import { readdir, rm } from 'node:fs/promises';

const directories = { mac: 'release/mac-arm64', win: 'release/win-unpacked' };
const platform = process.argv[2] || ({ darwin: 'mac', win32: 'win' })[process.platform];
const directory = directories[platform];
if (!directory) throw new Error('Choose mac or win');
// Only remove this platform's generated app, so old updater configuration cannot
// survive a repack. Keep the other platform's installer for combined metadata.
await rm(directory, { recursive: true, force: true });
for (const file of ['release/SHA256SUMS', 'release/release-manifest.json']) {
  await rm(file, { force: true });
}
const files = await readdir('release').catch(error => {
  if (error.code === 'ENOENT') return [];
  throw error;
});
for (const file of files.filter(name => /^latest.*\.ya?ml$/.test(name))) {
  await rm(`release/${file}`);
}
