import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const openStore = (file) => {
	if (file !== ':memory:') {
		mkdirSync(dirname(file), { recursive: true });
	}
	const db = new DatabaseSync(file);
	db.exec(`
		CREATE TABLE IF NOT EXISTS views (
			tenant_id INTEGER NOT NULL,
			asker_id TEXT NOT NULL,
			counsellor_id TEXT NOT NULL,
			seen_at TEXT NOT NULL,
			PRIMARY KEY (tenant_id, asker_id, counsellor_id)
		);
		CREATE TABLE IF NOT EXISTS releases (
			tenant_id INTEGER NOT NULL,
			asker_id TEXT NOT NULL,
			released_by TEXT NOT NULL,
			released_at TEXT NOT NULL,
			opened_at TEXT,
			PRIMARY KEY (tenant_id, asker_id)
		);
		CREATE TABLE IF NOT EXISTS balances (
			tenant_id INTEGER NOT NULL,
			asker_id TEXT NOT NULL,
			data TEXT NOT NULL,
			shared INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL,
			notified_at TEXT,
			PRIMARY KEY (tenant_id, asker_id)
		);
	`);

	const findRelease = db.prepare(
		'SELECT released_by AS releasedBy, released_at AS releasedAt, opened_at AS openedAt FROM releases WHERE tenant_id = ? AND asker_id = ?'
	);
	const markOpened = db.prepare('UPDATE releases SET opened_at = ? WHERE tenant_id = ? AND asker_id = ? AND opened_at IS NULL');
	const insertRelease = db.prepare(
		'INSERT OR IGNORE INTO releases (tenant_id, asker_id, released_by, released_at) VALUES (?, ?, ?, ?)'
	);
	const findBalance = db.prepare(
		'SELECT data, shared, updated_at AS updatedAt, notified_at AS notifiedAt FROM balances WHERE tenant_id = ? AND asker_id = ?'
	);
	const upsertBalance = db.prepare(`
		INSERT INTO balances (tenant_id, asker_id, data, shared, updated_at) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (tenant_id, asker_id) DO UPDATE SET data = excluded.data, shared = excluded.shared, updated_at = excluded.updated_at
	`);
	const setNotified = db.prepare('UPDATE balances SET notified_at = ? WHERE tenant_id = ? AND asker_id = ?');
	const findSeen = db.prepare('SELECT seen_at AS seenAt FROM views WHERE tenant_id = ? AND asker_id = ? AND counsellor_id = ?');
	const upsertSeen = db.prepare(
		'INSERT INTO views (tenant_id, asker_id, counsellor_id, seen_at) VALUES (?, ?, ?, ?) ON CONFLICT (tenant_id, asker_id, counsellor_id) DO UPDATE SET seen_at = excluded.seen_at'
	);
	const deleteViewsOfAsker = db.prepare('DELETE FROM views WHERE asker_id = ?');
	const deleteViewsOfCounsellor = db.prepare('DELETE FROM views WHERE counsellor_id = ?');
	const deleteRelease = db.prepare('DELETE FROM releases WHERE tenant_id = ? AND asker_id = ?');
	const deleteReleasesOf = db.prepare('DELETE FROM releases WHERE asker_id = ?');
	const deleteBalancesOf = db.prepare('DELETE FROM balances WHERE asker_id = ?');
	const forgetReleaser = db.prepare("UPDATE releases SET released_by = 'deleted' WHERE released_by = ?");
	const counts = db.prepare(`
		SELECT
			(SELECT COUNT(*) FROM releases WHERE tenant_id = ?) AS released,
			(SELECT COUNT(*) FROM balances WHERE tenant_id = ?) AS started,
			(SELECT COUNT(*) FROM balances WHERE tenant_id = ? AND shared = 1) AS shared
	`);

	const balanceOf = (tenantId, askerId) => {
		const row = findBalance.get(tenantId, askerId);
		return row
			? { ...JSON.parse(row.data), shared: row.shared === 1, updatedAt: row.updatedAt, notifiedAt: row.notifiedAt }
			: null;
	};

	return {
		release(tenantId, askerId, by) {
			insertRelease.run(tenantId, askerId, by, new Date().toISOString());
			return findRelease.get(tenantId, askerId);
		},
		/** Withdraws the release; the client's entries stay and are back with a new release. */
		revoke(tenantId, askerId) {
			return Number(deleteRelease.run(tenantId, askerId).changes) > 0;
		},
		releaseOf(tenantId, askerId) {
			return findRelease.get(tenantId, askerId) ?? null;
		},
		markOpened(tenantId, askerId) {
			markOpened.run(new Date().toISOString(), tenantId, askerId);
		},
		balanceOf,
		/** Stores arguments and conclusion with the sharing choice; returns the stored state. */
		/** When this counsellor last opened the client's entries; null if never. */
		seenBy(tenantId, askerId, counsellorId) {
			return findSeen.get(tenantId, askerId, counsellorId)?.seenAt ?? null;
		},
		markSeen(tenantId, askerId, counsellorId, at) {
			upsertSeen.run(tenantId, askerId, counsellorId, at);
		},
		saveBalance(tenantId, askerId, { arguments: args, conclusion, conclusionChangedAt = null }, shared) {
			upsertBalance.run(
				tenantId,
				askerId,
				JSON.stringify({ arguments: args, conclusion, conclusionChangedAt }),
				shared ? 1 : 0,
				new Date().toISOString()
			);
			return balanceOf(tenantId, askerId);
		},
		markNotified(tenantId, askerId, at = new Date().toISOString()) {
			setNotified.run(at, tenantId, askerId);
		},
		/** Removes everything stored about a client; unknown ids are fine. Returns the rows removed. */
		deleteAsker(askerId) {
			deleteViewsOfAsker.run(askerId);
			return Number(deleteReleasesOf.run(askerId).changes) + Number(deleteBalancesOf.run(askerId).changes);
		},
		/** A deleted counsellor stays in no release; the release itself belongs to the client. */
		forgetCounsellor(counsellorId) {
			deleteViewsOfCounsellor.run(counsellorId);
			return Number(forgetReleaser.run(counsellorId).changes);
		},
		statistics(tenantId) {
			const row = counts.get(tenantId, tenantId, tenantId);
			return { released: row.released, started: row.started, shared: row.shared };
		},
		close() {
			db.close();
		}
	};
};
