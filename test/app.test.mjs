import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { createApp } from '../src/app.mjs';
import { createVerifier } from '../src/auth.mjs';
import { createHost } from '../src/host.mjs';
import { openStore } from '../src/store.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwks = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }] };
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

const token = (claims) => {
	const head = b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
	const body = b64({
		iss: 'oriso-addonservice',
		aud: ['motivationswaage'],
		exp: Math.floor(Date.now() / 1000) + 60,
		tenantId: 1,
		...claims
	});
	return `${head}.${body}.${sign('sha256', Buffer.from(`${head}.${body}`), privateKey).toString('base64url')}`;
};

const asker = token({ sub: 'asker-1', roles: ['user'] });
const otherTenantAsker = token({ sub: 'asker-1', roles: ['user'], tenantId: 2 });
const counsellor = token({ sub: 'consultant-1', roles: ['consultant'], askerId: 'asker-1', sessionId: 5 });
const counsellorWithoutClient = token({ sub: 'consultant-1', roles: ['consultant'] });
const service = token({ sub: 'addonservice', roles: ['addon-service'] });

let settings = { intro: 'Hallo', allowSharing: true, poles: 'keine Veränderung / Ich möchte etwas ändern!' };
let clock = Date.parse('2026-11-17T10:00:00Z');
let gates = { dpa: { status: 'VALID', newCounsellingAllowed: true } };
let hostBehaviour = 'ok';
let hostCalls = [];
let server;
let hostServer;
let base;

const takeHostCalls = () => {
	const calls = hostCalls;
	hostCalls = [];
	return calls;
};

const startHost = () =>
	createServer(async (req, res) => {
		if (req.url === '/addons/host/settings') {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			return res.end(JSON.stringify(settings));
		}
		if (req.url === '/addons/host/gates') {
			if (gates === null) {
				res.writeHead(502);
				return res.end();
			}
			res.writeHead(200, { 'Content-Type': 'application/json' });
			return res.end(JSON.stringify(gates));
		}
		const chunks = [];
		for await (const chunk of req) {
			chunks.push(chunk);
		}
		hostCalls.push({
			method: req.method,
			path: req.url,
			authorization: req.headers.authorization,
			body: JSON.parse(Buffer.concat(chunks).toString('utf8'))
		});
		if (hostBehaviour === 'hang') {
			return;
		}
		const status = hostBehaviour === 'fail' ? 500 : req.url.endsWith('/audit') ? 201 : 202;
		res.writeHead(status, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(status === 202 ? { id: 'n1' } : {}));
	});

const fetchImpl = async (url, init) => {
	if (String(url).endsWith('/jwks.json')) {
		return new Response(JSON.stringify(jwks));
	}
	return fetch(url, init);
};

const call = async (path, { auth, method = 'GET', body } = {}) => {
	const response = await fetch(`${base}${path}`, {
		method,
		headers: {
			...(auth ? { Authorization: `Bearer ${auth}` } : {}),
			...(body ? { 'Content-Type': 'application/json' } : {})
		},
		body: body ? JSON.stringify(body) : undefined
	});
	const type = response.headers.get('content-type') ?? '';
	return { status: response.status, body: type.includes('json') ? await response.json() : await response.text() };
};

before(async () => {
	hostServer = startHost();
	await new Promise((resolve) => hostServer.listen(0, '127.0.0.1', resolve));
	const hostUrl = `http://127.0.0.1:${hostServer.address().port}/addons/host`;
	const store = openStore(':memory:');
	const verify = createVerifier({
		jwksUrl: 'http://addonservice/addons/.well-known/jwks.json',
		issuer: 'oriso-addonservice',
		audience: 'motivationswaage',
		fetchImpl
	});
	server = createApp({ store, verify, host: createHost({ url: hostUrl, fetchImpl, timeoutMs: 300 }), now: () => clock });
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
	server.close();
	hostServer.closeAllConnections();
	hostServer.close();
});

const arg = (id, category, text, rating) => ({ id, category, text, rating });
const askerToken = (sub) => token({ sub, roles: ['user'] });
const counsellorFor = (askerId) => token({ sub: 'consultant-1', roles: ['consultant'], askerId, sessionId: 9 });

describe('public files', () => {
	it('serves manifest, settings schema and the UI modules', async () => {
		const manifest = await call('/.well-known/oriso-addon.json');
		assert.equal(manifest.body.name, 'motivationswaage');
		assert.equal(manifest.body.apps[0].id, 'balance');
		assert.equal(manifest.body.apps[0].visibility, 'dynamic');
		assert.deepEqual(manifest.body.apps[0].slots, ['asker.navigation', 'consultant.session', 'consultant.asker-profile']);
		const schema = (await call('/schema/settings.json')).body;
		assert.equal(schema.properties.poles.enum.length, 3);
		assert.match((await call('/ui/entry.js')).body, /export async function mount/);
		assert.match((await call('/ui/scale.js')).body, /export function Scale/);
		assert.match((await call('/ui/styles.js')).body, /export const installStyles/);
		assert.match((await call('/ui/balance.mjs')).body, /export const calculate/);
		assert.equal((await call('/health')).body.status, 'UP');
	});
});

describe('the balance', () => {
	beforeEach(() => takeHostCalls());

	it('rejects missing or foreign tokens', async () => {
		assert.equal((await call('/api/balance')).status, 401);
		const foreign = token({ sub: 'x', roles: ['user'], aud: ['other'] });
		assert.equal((await call('/api/balance', { auth: foreign })).status, 401);
	});

	it('is invisible and closed for clients until a counsellor releases it', async () => {
		assert.deepEqual((await call('/visibility', { auth: asker })).body, { apps: { balance: { visible: false } } });
		assert.deepEqual((await call('/visibility', { auth: counsellor })).body, { apps: { balance: { visible: true } } });
		const before = await call('/api/balance', { auth: asker });
		assert.equal(before.body.released, false);
		assert.equal(before.body.intro, 'Hallo');
		assert.equal(before.body.poles, 'keine Veränderung / Ich möchte etwas ändern!');
		const write = await call('/api/balance', { auth: asker, method: 'PUT', body: { arguments: [] } });
		assert.equal(write.status, 403);
	});

	it('needs the client from a verified session for counsellors', async () => {
		assert.equal((await call('/api/balance/client', { auth: counsellorWithoutClient })).status, 400);
		assert.equal((await call('/api/balance/client', { auth: asker })).status, 403);
		assert.equal((await call('/api/balance', { auth: counsellor })).status, 403);
	});

	it('releases once, with audit entry and notification to the client', async () => {
		const released = await call('/api/balance/client/release', { auth: counsellor, method: 'POST' });
		assert.equal(released.body.released, true);
		const calls = takeHostCalls();
		assert.deepEqual(calls.map((c) => c.path).sort(), ['/addons/host/audit', '/addons/host/notifications']);
		const notification = calls.find((c) => c.path.endsWith('/notifications')).body;
		assert.equal(notification.recipient, 'asker');
		assert.equal(notification.appId, 'balance');
		assert.match(notification.text.de, /Ihre Beratung/);

		await call('/api/balance/client/release', { auth: counsellor, method: 'POST' });
		assert.equal(takeHostCalls().length, 0);
		assert.deepEqual((await call('/visibility', { auth: asker })).body.apps.balance, { visible: true, badge: 1 });
		assert.equal((await call('/api/balance', { auth: asker })).body.released, true);
		assert.deepEqual((await call('/visibility', { auth: asker })).body.apps.balance, { visible: true });
		assert.equal((await call('/api/balance', { auth: otherTenantAsker })).body.released, false);
	});

	it('stores arguments with the calculation and keeps them from counsellors until shared', async () => {
		const saved = await call('/api/balance', {
			auth: asker,
			method: 'PUT',
			body: {
				arguments: [arg('a1', 'A', 'Mehr Geld', 3), arg('b1', 'B', 'Der Rausch wird mir fehlen.', 1)],
				conclusion: 'Ich will es versuchen.',
				shared: false
			}
		});
		assert.equal(saved.status, 200);
		assert.deepEqual(saved.body.result, { pro: 3, contra: 1, raw: 2, value: 5 });
		assert.equal(takeHostCalls().length, 0);

		const hidden = await call('/api/balance/client', { auth: counsellor });
		assert.equal(hidden.body.started, true);
		assert.equal(hidden.body.shared, false);
		assert.equal(hidden.body.balance, null);
		assert.equal((await call('/api/balance/client/export', { auth: counsellor, method: 'POST' })).status, 403);

		const read = await call('/api/balance', { auth: asker });
		assert.equal(read.body.arguments.length, 2);
		assert.equal(read.body.conclusion, 'Ich will es versuchen.');
	});

	it('notifies the counsellors when shared and folds quick changes into one notification', async () => {
		const state = {
			arguments: [arg('a1', 'A', 'Mehr Geld', 3), arg('b1', 'B', 'Der Rausch wird mir fehlen.', 1)],
			conclusion: 'Ich will es versuchen.'
		};
		await call('/api/balance', { auth: asker, method: 'PUT', body: { ...state, shared: true } });
		let calls = takeHostCalls();
		assert.deepEqual(calls.map((c) => c.path).sort(), ['/addons/host/audit', '/addons/host/notifications']);
		assert.equal(calls.find((c) => c.path.endsWith('/notifications')).body.recipient, 'counsellors');
		assert.equal(calls.find((c) => c.path.endsWith('/audit')).body.action, 'balance.shared');

		const visible = await call('/api/balance/client', { auth: counsellor });
		assert.equal(visible.body.shared, true);
		assert.equal(visible.body.balance.arguments.length, 2);
		assert.equal(visible.body.balance.result.value, 5);

		clock += 5 * 60 * 1000;
		state.arguments.push(arg('d1', 'D', 'Schulden bleiben.', 2));
		await call('/api/balance', { auth: asker, method: 'PUT', body: { ...state, shared: true } });
		assert.equal(takeHostCalls().length, 0, 'within 30 minutes of the last notification');

		clock += 31 * 60 * 1000;
		state.arguments[0] = { ...state.arguments[0], rating: 2 };
		await call('/api/balance', { auth: asker, method: 'PUT', body: { ...state, shared: true } });
		calls = takeHostCalls();
		assert.equal(calls.length, 1);
		assert.match(calls[0].body.text.de, /geändert/);
		assert.doesNotMatch(calls[0].body.text.de, /Geld/, 'no content in notifications');

		clock += 31 * 60 * 1000;
		await call('/api/balance', { auth: asker, method: 'PUT', body: { ...state, shared: true } });
		assert.equal(takeHostCalls().length, 0, 'nothing changed');
	});

	it('exports only shared content, with an audit entry', async () => {
		const exported = await call('/api/balance/client/export', { auth: counsellor, method: 'POST' });
		assert.equal(exported.status, 200);
		assert.equal(exported.body.balance.arguments.length, 3);
		assert.ok(exported.body.exportedAt);
		assert.deepEqual(
			takeHostCalls().map((c) => c.body.action),
			['balance.exported']
		);
	});

	it('takes the content away again when the client stops sharing', async () => {
		const read = (await call('/api/balance', { auth: asker })).body;
		await call('/api/balance', {
			auth: asker,
			method: 'PUT',
			body: { arguments: read.arguments, conclusion: read.conclusion, shared: false }
		});
		assert.deepEqual(
			takeHostCalls().map((c) => c.body.action),
			['balance.unshared']
		);
		assert.equal((await call('/api/balance/client', { auth: counsellor })).body.balance, null);
		assert.equal((await call('/api/balance/client/export', { auth: counsellor, method: 'POST' })).status, 403);
	});

	it('does not share when the Träger switched sharing off', async () => {
		settings = { ...settings, allowSharing: false };
		const saved = await call('/api/balance', { auth: asker, method: 'PUT', body: { arguments: [], shared: true } });
		assert.equal(saved.body.shared, false);
		assert.equal((await call('/api/balance', { auth: asker })).body.allowSharing, false);
		settings = { ...settings, allowSharing: true };
	});

	it('rejects invalid arguments', async () => {
		const bad = await call('/api/balance', { auth: asker, method: 'PUT', body: { arguments: [arg('x', 'A', 'ohne', 5)] } });
		assert.equal(bad.status, 400);
	});

	it('withdraws a release: tool hidden, content closed, entries kept for a new release', async () => {
		await call('/api/balance', { auth: asker, method: 'PUT', body: { arguments: [arg('k1', 'A', 'bleibt', 2)], shared: true } });
		takeHostCalls();
		const revoked = await call('/api/balance/client/release', { auth: counsellor, method: 'DELETE' });
		assert.equal(revoked.status, 200);
		assert.equal(revoked.body.released, false);
		assert.deepEqual(takeHostCalls().map((c) => c.body.action), ['tool.revoked']);
		assert.equal((await call('/api/balance', { auth: asker })).body.released, false);
		assert.deepEqual((await call('/visibility', { auth: asker })).body.apps.balance, { visible: false });
		const put = await call('/api/balance', { auth: asker, method: 'PUT', body: { arguments: [], shared: true } });
		assert.equal(put.status, 403);
		const state = await call('/api/balance/client', { auth: counsellor });
		assert.equal(state.body.released, false);
		assert.equal(state.body.balance, null);

		await call('/api/balance/client/release', { auth: counsellor, method: 'POST' });
		const back = await call('/api/balance', { auth: asker });
		assert.equal(back.body.released, true);
		assert.deepEqual(back.body.arguments.map((a) => a.text), ['bleibt'], 'entries are back after a new release');
		await call('/api/balance', { auth: asker, method: 'PUT', body: { arguments: back.body.arguments, shared: false } });
		takeHostCalls();
	});

	it('refuses a new release when the Träger has not confirmed the DPA', async () => {
		gates = { dpa: { status: 'MISSING', newCounsellingAllowed: false } };
		const refused = await call('/api/balance/client/release', { auth: counsellorFor('asker-9'), method: 'POST' });
		assert.equal(refused.status, 409);
		gates = null;
		const allowed = await call('/api/balance/client/release', { auth: counsellorFor('asker-9'), method: 'POST' });
		assert.equal(allowed.status, 200, 'the release goes ahead when the host cannot tell');
		gates = { dpa: { status: 'VALID', newCounsellingAllowed: true } };
	});

	it('reports statistics to the AddonService for its own Träger only', async () => {
		assert.equal((await call('/stats?tenantId=1', { auth: asker })).status, 403);
		assert.equal((await call('/stats?tenantId=2', { auth: service })).status, 403);
		const stats = await call('/stats?tenantId=1', { auth: service });
		assert.deepEqual(stats.body.values, { released: 2, started: 1, shared: 0 });
	});

	it('keeps working when the host does not answer', async () => {
		hostBehaviour = 'hang';
		const released = await call('/api/balance/client/release', { auth: counsellorFor('asker-7'), method: 'POST' });
		assert.equal(released.status, 200);
		hostBehaviour = 'ok';
	});
});

describe('lifecycle events', () => {
	it('accept the service token only', async () => {
		const event = { id: 'e1', type: 'user.deleted', userId: 'asker-1' };
		assert.equal((await call('/events', { auth: asker, method: 'POST', body: event })).status, 403);
	});

	it('remove a deleted client and forget a deleted counsellor', async () => {
		const deleted = await call('/events', {
			auth: service,
			method: 'POST',
			body: { id: 'e2', type: 'user.deleted', userId: 'asker-1', role: 'user' }
		});
		assert.equal(deleted.status, 204);
		assert.equal((await call('/api/balance', { auth: asker })).body.released, false);
		assert.equal((await call('/api/balance/client', { auth: counsellor })).body.started, false);

		const forgotten = await call('/events', {
			auth: service,
			method: 'POST',
			body: { id: 'e3', type: 'user.deleted', userId: 'consultant-1', role: 'consultant' }
		});
		assert.equal(forgotten.status, 204);
		assert.equal((await call('/api/balance', { auth: askerToken('asker-9') })).body.released, true);
	});
});
