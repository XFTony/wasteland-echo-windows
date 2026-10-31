const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");

test("retired study records remain specific, inactive and recoverable without weakening live asset checks", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "art/manifest.json"), "utf8"));
  const retired = manifest.archivedAssets || [];
  if (!retired.length) return;
  const plan = JSON.parse(fs.readFileSync(path.join(root, "docs/cleanup/retirement-plan.json"), "utf8"));
  assert.deepEqual(retired.map(a=>a.id).sort(), [...plan.retiredStudyIds].sort());
  const activeIds = new Set(manifest.assets.map(a=>a.id));
  for (const record of retired) {
    assert.equal(record.status, "inactive");
    assert(record.id.startsWith("study.ranger."));
    assert(!activeIds.has(record.id));
    assert.match(record.retirement.baselineCommit, /^[a-f0-9]{40}$/);
    assert(record.retirement.files.length > 0);
    for (const file of record.retirement.files) {
      assert.match(file.sha256, /^[a-f0-9]{64}$/);
      assert.match(file.gitBlob, /^[a-f0-9]{40}$/);
      assert(file.path.startsWith("art/animation/ranger/"));
    }
  }
  assert.equal(manifest.policy.deleteInactiveAssets, false);
});

test("current compact character reference is preserved with its original content hash", () => {
  const metadata = JSON.parse(fs.readFileSync(path.join(root, "art/characters/ranger/compact-pixel-v1/metadata.json"), "utf8"));
  const filename = path.join(root, metadata.sourceReference);
  assert(fs.existsSync(filename));
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex").toUpperCase(), metadata.referenceSha256);
});
