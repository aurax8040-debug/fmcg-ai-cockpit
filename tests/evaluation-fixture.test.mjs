import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixture = JSON.parse(await readFile(new URL('../demo-data/ai-evaluation-cases.json', import.meta.url), 'utf8'));

test('frozen evaluation set has 30 unique, labelled, checkable cases', () => {
  assert.match(fixture.label, /不代表真实用户使用/);
  assert.equal(fixture.cases.length, 30);
  assert.equal(new Set(fixture.cases.map(row => row.id)).size, 30);
  assert.deepEqual([...new Set(fixture.cases.map(row => row.category))].sort(), ['任务建议','失败兜底','时间口径','禁止越权','经营事实','证据不足'].sort());
  for (const row of fixture.cases) {
    assert.match(row.id, /^EVAL-\d{3}$/);
    assert.ok(row.question.length >= 6);
    assert.ok(row.must_include.length >= 1);
    assert.ok(row.must_not_claim.length >= 1);
  }
});
