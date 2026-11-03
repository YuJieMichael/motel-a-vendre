// Keep a fresh unzip testable without npm installation; preserve any reviewed
// direct-enquiry candidate already prepared for deployment.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
async function run() {
  if (!fs.existsSync(path.join(root, 'release/manifest.json'))) {
    await require('./prepare-release.cjs').prepare();
  }
  const files = fs.readdirSync(path.join(root, 'tests'))
    .filter(name => /\.test\.[cm]js$/.test(name))
    .sort().map(name => path.join('tests', name));
  if (!files.length) throw Error('No project tests found');
  const result = spawnSync(process.execPath, ['--test', ...files], {cwd: root, stdio: 'inherit'});
  process.exitCode = result.status ?? 1;
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
