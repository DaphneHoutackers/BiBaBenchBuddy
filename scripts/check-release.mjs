import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'Release version must be stable semver');
assert.equal(lock.version, pkg.version, 'Lockfile version differs');
assert.equal(lock.packages[''].version, pkg.version, 'Lockfile root version differs');
assert.equal(pkg.name, 'bibabenchbuddy', 'Keep the existing data-directory identity');
assert.equal(pkg.build.productName, 'BiBaBenchBuddy');
assert.equal(pkg.build.appId, 'com.bibabenchbuddy.app');
await access(`docs/releases/${pkg.version}.md`);
assert.equal(pkg.build.publish, null, 'Manual releases must not infer updater feeds');
for (const name of ['app:build', 'app:mac', 'app:win']) {
  assert.ok(pkg.scripts[name].includes('--publish never'), `${name} could publish implicitly`);
}
if (process.env.GITHUB_REF?.startsWith('refs/tags/')) {
  assert.equal(process.env.GITHUB_REF, `refs/tags/v${pkg.version}`, 'Tag and packaged version differ');
}
console.log(`Release ${pkg.version}: versions, identity and manual-publishing policy verified`);
