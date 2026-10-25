import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dsl = await readFile(new URL('../dify/ka-activity-analysis.yml', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../dify/analysis-output-schema.json', import.meta.url), 'utf8'));

test('Dify artifact names the dedicated workflow and exposes bounded inputs', () => {
  assert.match(dsl, /name: 快消智析·KA活动研判/);
  for (const input of ['activity_id', 'question', 'role', 'evidence_json', 'data_version']) assert.match(dsl, new RegExp(`variable: ${input}`));
  for (const node of ['type: start', 'type: code', 'type: llm', 'type: end']) assert.match(dsl, new RegExp(node));
});

test('workflow and schema enforce citations and contain no credential literal', () => {
  for (const key of ['facts', 'data_gaps', 'hypotheses', 'recommended_checks', 'boundaries', 'management_summary', 'citations']) {
    assert.ok(schema.required.includes(key));
  }
  assert.match(dsl, /unknown citation/);
  assert.doesNotMatch(dsl, /Bearer\s+[A-Za-z0-9_-]{20,}|DIFY_API_KEY\s*[:=]\s*\S+/);
});
