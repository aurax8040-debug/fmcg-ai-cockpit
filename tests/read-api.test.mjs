import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { dataset, jsonRequest, withServer } from './helpers.mjs';

const stateStore = { snapshot: () => ({ data_version: 1, tasks: [], evidence: [] }) };

test('read API exposes governed evidence and sources', async () => {
  await withServer(createApp({ dataset, stateStore }), async base => {
    const health = await jsonRequest(`${base}/api/health`);
    assert.equal(health.response.status, 200);
    assert.equal(health.body.status, 'ok');
    assert.equal(health.response.headers.get('content-type'), 'application/json; charset=utf-8');
    const sources = await jsonRequest(`${base}/api/data-sources`);
    assert.equal(sources.body.source_type, 'anonymous_simulation');
    assert.ok(sources.body.sources.some(row => row.truth_label === '真实样例'));
    const evidence = await jsonRequest(`${base}/api/activities/ACT-KA-A-001/evidence`);
    for (const key of ['source_type', 'as_of', 'data_version', 'completeness', 'trace_ids']) assert.ok(key in evidence.body);
    assert.equal(evidence.body.activity.ka_id, 'KA-A');
    const tasks = await jsonRequest(`${base}/api/tasks`);
    assert.deepEqual(tasks.body.tasks, []);
  });
});

test('unknown and malformed IDs return structured errors without Dify', async () => {
  let calls = 0;
  const difyClient = { configured: true, async run() { calls += 1; return {}; } };
  await withServer(createApp({ dataset, stateStore, difyClient }), async base => {
    const unknown = await jsonRequest(`${base}/api/activities/ACT-NOPE/evidence`);
    assert.equal(unknown.response.status, 404);
    assert.equal(unknown.body.error.code, 'NOT_FOUND');
    const malformed = await jsonRequest(`${base}/api/activities/bad%20id/reanalyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(malformed.response.status, 400);
    assert.equal(malformed.body.error.code, 'INVALID_ID');
    assert.equal(calls, 0);
  });
});

test('CORS permits loopback preview and rejects non-loopback preflight', async () => {
  await withServer(createApp({ dataset, stateStore }), async base => {
    const allowed = await fetch(`${base}/api/health`, { headers: { origin: 'http://127.0.0.1:58044' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://127.0.0.1:58044');
    assert.equal(allowed.headers.get('access-control-allow-private-network'), 'true');
    const blocked = await jsonRequest(`${base}/api/health`, { method: 'OPTIONS', headers: { origin: 'https://example.com' } });
    assert.equal(blocked.response.status, 403);
  });
});
