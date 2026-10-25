import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { loadFixture } from '../server/domain.mjs';

export const dataset = loadFixture(await readFile(new URL('../demo-data/ka-a-activity.json', import.meta.url), 'utf8'));

export async function withServer(listener, run) {
  const server = createServer(listener);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try { return await run(baseUrl); } finally { await new Promise(resolve => server.close(resolve)); }
}

export async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  return { response, body: await response.json() };
}
