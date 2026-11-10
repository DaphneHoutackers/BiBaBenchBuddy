import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const mac = `BiBaBenchBuddy-${version}-mac-arm64.dmg`;
const win = `BiBaBenchBuddy-${version}-Setup.exe`;
const dmgFixture = Buffer.alloc(1024);
dmgFixture.write('koly', dmgFixture.length - 512);
const exeFixture = Buffer.from('MZ-test-fixture');
const metadata = directory => spawnSync(process.execPath, ['scripts/release-metadata.mjs', directory], { encoding: 'utf8' });

test('release metadata binds exact filenames, platform, size and checksum', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'biba-release-'));
  try {
    await writeFile(path.join(directory, mac), dmgFixture);
    await writeFile(path.join(directory, win), exeFixture);
    const result = metadata(directory);
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(await readFile(path.join(directory, 'release-manifest.json'), 'utf8'));
    assert.equal(manifest.version, version);
    assert.equal(manifest.updatePolicy, 'manual');
    assert.equal(manifest.bundleIdentifier, 'com.bibabenchbuddy.app');
    assert.deepEqual(manifest.artifacts.map(item => [item.file, item.platform, item.arch, item.size]), [
      [mac, 'mac', 'arm64', dmgFixture.length], [win, 'win', 'x64', exeFixture.length],
    ]);
    const digest = createHash('sha256').update(exeFixture).digest('hex');
    assert.equal(manifest.artifacts[1].sha256, digest);
    assert.ok((await readFile(path.join(directory, 'SHA256SUMS'), 'utf8')).includes(`${digest}  ${win}\n`));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('release collection rejects missing, stale and corrupt installers and updater feeds', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'biba-release-'));
  try {
    await writeFile(path.join(directory, mac), dmgFixture);
    assert.notEqual(metadata(directory).status, 0, 'A missing Windows installer must block a combined release');
    await writeFile(path.join(directory, win), exeFixture);
    await writeFile(path.join(directory, 'stale.dmg'), dmgFixture);
    assert.notEqual(metadata(directory).status, 0, 'A stale filename must not be published');
    await rm(path.join(directory, 'stale.dmg'));
    await writeFile(path.join(directory, 'latest-mac.yml'), 'version: 0.0.0');
    assert.notEqual(metadata(directory).status, 0, 'Do not ship an unreliable updater feed');
    await rm(path.join(directory, 'latest-mac.yml'));
    await writeFile(path.join(directory, win), 'not an executable');
    assert.notEqual(metadata(directory).status, 0, 'Corrupt installer header must fail');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('release preflight accepts the matching tag and rejects a different version', () => {
  const check = ref => spawnSync(process.execPath, ['scripts/check-release.mjs'], {
    encoding: 'utf8', env: { ...process.env, GITHUB_REF: ref },
  });
  assert.equal(check(`refs/tags/v${version}`).status, 0);
  assert.notEqual(check('refs/tags/v0.0.0').status, 0);
});
