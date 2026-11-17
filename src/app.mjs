import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { APP_ID, manifest, settingsSchema } from './manifest.mjs';
import { calculate, cleanBalance, diffBalance } from './balance.mjs';
import { hasRole } from './auth.mjs';
import {
	changedNotification,
	EXPORTED_AUDIT,
	isInformal,
	NOTIFY_QUIET_MS,
	releaseNotification,
	RELEASED_AUDIT,
	REVOKED_AUDIT,
	SHARED_AUDIT,
	sharedNotification,
	UNSHARED_AUDIT
} from './messages.mjs';

const SERVICE_ROLE = 'addon-service';
const DEFAULT_SETTINGS = Object.fromEntries(
	Object.entries(settingsSchema.properties).map(([key, definition]) => [key, definition.default])
);

const send = (res, status, type, body, extra = {}) => {
	res.writeHead(status, { 'Content-Type': type, ...extra });
	res.end(body);
};

const json = (res, status, body) =>
	send(res, status, 'application/json; charset=utf-8', JSON.stringify(body), { 'Cache-Control': 'no-store' });

const readJson = async (req) => {
	let size = 0;
	const chunks = [];
	for await (const chunk of req) {
		size += chunk.length;
		if (size > 256 * 1024) {
			throw Object.assign(new Error('too large'), { status: 413 });
		}
		chunks.push(chunk);
	}
	try {
		return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
	} catch {
		throw Object.assign(new Error('invalid json'), { status: 400 });
	}
};

/** The UI modules; `balance.mjs` is shared with the server. */
export const UI_FILES = {
	'/ui/entry.js': new URL('../ui/entry.js', import.meta.url),
	'/ui/scale.js': new URL('../ui/scale.js', import.meta.url),
	'/ui/styles.js': new URL('../ui/styles.js', import.meta.url),
	'/ui/balance.mjs': new URL('./balance.mjs', import.meta.url)
};

const isAsker = (claims) => hasRole(claims, 'user') && !hasRole(claims, 'consultant');

/** What a stored balance looks like on the wire, with the calculation the scale shows. */
const view = (balance) => ({
	arguments: balance?.arguments ?? [],
	conclusion: balance?.conclusion ?? '',
	result: calculate(balance?.arguments ?? [])
});

export const createApp = ({ store, verify, host = null, uiFiles = UI_FILES, now = () => Date.now() }) => {
	/** Clients see the tool once it is released, with a badge until they open it; counsellors always. */
	const visibilityOf = (claims, tenantId) => {
		if (!isAsker(claims)) {
			return { visible: true };
		}
		const release = store.releaseOf(tenantId, claims.sub);
		if (!release) {
			return { visible: false };
		}
		return release.openedAt ? { visible: true } : { visible: true, badge: 1 };
	};

	const loadSettings = async (claims) => ({ ...DEFAULT_SETTINGS, ...((await host?.settings(claims)) ?? {}) });

	/** Audit entries and notifications for the client's sharing choice and changes while shared. */
	const reportSave = async (claims, tenantId, before, after) => {
		if (!host) {
			return;
		}
		const wasShared = before?.shared ?? false;
		if (after.shared && !wasShared) {
			await Promise.all([host.audit(claims, SHARED_AUDIT), host.notify(claims, sharedNotification())]);
			store.markNotified(tenantId, claims.sub, new Date(now()).toISOString());
			return;
		}
		if (!after.shared && wasShared) {
			await host.audit(claims, UNSHARED_AUDIT);
			return;
		}
		if (!after.shared) {
			return;
		}
		const diff = diffBalance(before, after);
		if (diff.added === 0 && diff.changed === 0) {
			return;
		}
		const last = before?.notifiedAt ? Date.parse(before.notifiedAt) : 0;
		if (now() - last < NOTIFY_QUIET_MS) {
			return;
		}
		if (await host.notify(claims, changedNotification(diff))) {
			store.markNotified(tenantId, claims.sub, new Date(now()).toISOString());
		}
	};

	const asker = async (req, res, claims, tenantId) => {
		const askerId = claims.sub;
		const release = store.releaseOf(tenantId, askerId);
		if (req.method === 'GET') {
			if (release && !release.openedAt) {
				store.markOpened(tenantId, askerId);
			}
			const settings = await loadSettings(claims);
			const balance = store.balanceOf(tenantId, askerId);
			return json(res, 200, {
				released: Boolean(release),
				...view(balance),
				shared: balance?.shared ?? false,
				updatedAt: balance?.updatedAt ?? null,
				intro: settings.intro || '',
				poles: settings.poles,
				allowSharing: settings.allowSharing !== false
			});
		}
		if (req.method === 'PUT') {
			if (!release) {
				return json(res, 403, { error: 'not released' });
			}
			const body = await readJson(req);
			const clean = cleanBalance(body, () => randomUUID().slice(0, 12));
			const settings = await loadSettings(claims);
			const before = store.balanceOf(tenantId, askerId);
			const shared = settings.allowSharing !== false && body.shared === true;
			const saved = store.saveBalance(tenantId, askerId, clean, shared);
			await reportSave(claims, tenantId, before, saved);
			return json(res, 200, { ...view(saved), shared: saved.shared, updatedAt: saved.updatedAt });
		}
		return json(res, 405, { error: 'method not allowed' });
	};

	/** The client's balance for a counsellor: only released and shared content leaves the add-on. */
	const clientState = async (claims, tenantId) => {
		const release = store.releaseOf(tenantId, claims.askerId);
		const balance = store.balanceOf(tenantId, claims.askerId);
		const readable = Boolean(release) && Boolean(balance?.shared);
		const settings = await loadSettings(claims);
		return {
			released: Boolean(release),
			releasedAt: release?.releasedAt ?? null,
			started: Boolean(balance),
			updatedAt: balance?.updatedAt ?? null,
			shared: readable,
			balance: readable ? view(balance) : null,
			poles: settings.poles
		};
	};

	const counsellor = async (req, res, claims, tenantId, path) => {
		if (!claims.askerId) {
			return json(res, 400, { error: 'no client context' });
		}
		if (path === '/api/balance/client' && req.method === 'GET') {
			return json(res, 200, await clientState(claims, tenantId));
		}
		if (path === '/api/balance/client/export' && req.method === 'POST') {
			// Checked again right before the export (tool description 1.7.4).
			const state = await clientState(claims, tenantId);
			if (!state.shared) {
				return json(res, 403, { error: 'not shared' });
			}
			await host?.audit(claims, EXPORTED_AUDIT);
			return json(res, 200, { ...state, exportedAt: new Date(now()).toISOString() });
		}
		if (path === '/api/balance/client/release' && req.method === 'POST') {
			const isNew = !store.releaseOf(tenantId, claims.askerId);
			// A new release starts new counselling work; it follows the Träger's DPA gate. If the host
			// cannot tell, the release goes ahead (the Träger switch is the operator's control).
			if (isNew && host) {
				const gates = await host.gates(claims);
				if (gates?.dpa?.newCounsellingAllowed === false) {
					return json(res, 409, { error: 'dpa', message: 'The Träger has not confirmed the current DPA' });
				}
			}
			const release = store.release(tenantId, claims.askerId, claims.sub);
			if (isNew && host) {
				await Promise.all([
					host.audit(claims, RELEASED_AUDIT),
					host.notify(claims, releaseNotification(isInformal(claims)))
				]);
			}
			return json(res, 200, { released: true, releasedAt: release.releasedAt });
		}
		if (path === '/api/balance/client/release' && req.method === 'DELETE') {
			if (store.revoke(tenantId, claims.askerId)) {
				await host?.audit(claims, REVOKED_AUDIT);
			}
			return json(res, 200, { released: false });
		}
		return json(res, 404, { error: 'not found' });
	};

	return createServer(async (req, res) => {
		const url = new URL(req.url, 'http://localhost');
		const path = url.pathname;
		try {
			if (path === '/.well-known/oriso-addon.json') {
				return json(res, 200, manifest);
			}
			if (path === '/schema/settings.json') {
				return json(res, 200, settingsSchema);
			}
			if (path === '/health') {
				return json(res, 200, { status: 'UP' });
			}
			if (Object.hasOwn(uiFiles, path)) {
				return send(res, 200, 'text/javascript; charset=utf-8', await readFile(uiFiles[path]), {
					'Cache-Control': 'no-cache'
				});
			}

			const claims = await verify(req.headers.authorization);
			if (!claims) {
				return json(res, 401, { error: 'invalid token' });
			}
			const tenantId = Number(claims.tenantId);
			if (!Number.isFinite(tenantId)) {
				return json(res, 403, { error: 'no Träger' });
			}

			if (path === '/events' && req.method === 'POST') {
				if (!hasRole(claims, SERVICE_ROLE)) {
					return json(res, 403, { error: 'forbidden' });
				}
				const event = await readJson(req);
				if (event.type === 'user.deleted' && typeof event.userId === 'string' && event.userId) {
					const removed =
						event.role === 'consultant' ? store.forgetCounsellor(event.userId) : store.deleteAsker(event.userId);
					console.log(`lifecycle ${event.id} user.deleted (${event.role ?? 'asker'}): ${removed} row(s)`);
				}
				res.writeHead(204);
				return res.end();
			}
			if (path === '/stats') {
				if (!hasRole(claims, SERVICE_ROLE) || Number(url.searchParams.get('tenantId')) !== tenantId) {
					return json(res, 403, { error: 'forbidden' });
				}
				return json(res, 200, { values: store.statistics(tenantId) });
			}
			if (path === '/visibility' && req.method === 'GET') {
				return json(res, 200, { apps: { [APP_ID]: visibilityOf(claims, tenantId) } });
			}
			if (path === '/api/balance' && isAsker(claims)) {
				return await asker(req, res, claims, tenantId);
			}
			if (path.startsWith('/api/balance/client') && hasRole(claims, 'consultant')) {
				return await counsellor(req, res, claims, tenantId, path);
			}
			return json(res, path.startsWith('/api/') ? 403 : 404, { error: 'not allowed' });
		} catch (error) {
			if (error.status) {
				return json(res, error.status, { error: error.message });
			}
			console.error(error);
			return json(res, 500, { error: 'internal error' });
		}
	});
};
