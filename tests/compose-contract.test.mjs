import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const compose = await readFile(new URL('../compose.mock-bi.yaml', import.meta.url), 'utf8');
const dockerfile = await readFile(new URL('../server/Dockerfile', import.meta.url), 'utf8');
const script = await readFile(new URL('../scripts/demo-stack.sh', import.meta.url), 'utf8');

test('compose joins the Dify project without exposing secrets or LAN ports', () => {
  assert.match(compose, /^name:\s*docker/m);
  assert.match(compose, /^\s{2}mock-bi:/m);
  assert.match(compose, /127\.0\.0\.1:8787:8787/);
  assert.match(compose, /fmcg_demo_state:\/data/);
  assert.match(compose, /DIFY_BASE_URL:\s*http:\/\/api:5001\/v1/);
  assert.match(compose, /DIFY_API_KEY:\s*\$\{DIFY_API_KEY:-\}/);
  assert.doesNotMatch(compose, /Bearer\s+[A-Za-z0-9_-]{20,}/);
});

test('container is non-root and stack helper never removes Dify volumes', () => {
  assert.match(dockerfile, /FROM node:22-alpine/);
  assert.match(dockerfile, /USER node/);
  assert.match(script, /stop mock-bi/);
  assert.match(script, /rm -f mock-bi/);
  assert.doesNotMatch(script, /down\s+-v|volume\s+rm|docker\s+system\s+prune/);
});
