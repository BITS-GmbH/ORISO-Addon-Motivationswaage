import { APP_ID } from './manifest.mjs';

/** Changes within this window after a notification are folded into it (tool description 1.6). */
export const NOTIFY_QUIET_MS = 30 * 60 * 1000;

export const isInformal = (claims) => claims.informal === true || claims.formalLanguage === false;

export const releaseNotification = (informal) => ({
	recipient: 'asker',
	appId: APP_ID,
	important: true,
	title: { de: 'Neues Tool freigegeben', en: 'New tool released' },
	text: {
		de: informal
			? 'Deine Beratung hat die „Motivationswaage“ für dich freigegeben.'
			: 'Ihre Beratung hat die „Motivationswaage“ für Sie freigegeben.',
		en: 'Your counsellor released the “decisional balance” for you.'
	},
	target: { slot: 'asker.navigation' }
});

/** First share: existing entries become readable for the counsellors. */
export const sharedNotification = () => ({
	recipient: 'counsellors',
	appId: APP_ID,
	important: false,
	title: { de: 'Motivationswaage geteilt', en: 'Decisional balance shared' },
	text: {
		de: 'Eine ratsuchende Person hat ihre Motivationswaage zur Einsicht freigegeben.',
		en: 'A client shared their decisional balance with you.'
	},
	target: { slot: 'consultant.session' }
});

/** New or edited entries in a shared balance; no content, only what kind of change. */
export const changedNotification = ({ added, changed }) => {
	const de =
		added > 0 && changed > 0
			? 'Eine ratsuchende Person hat neue Einträge in der Motivationswaage vorgenommen und Einträge geändert.'
			: added > 0
				? 'Eine ratsuchende Person hat neue Einträge in der Motivationswaage vorgenommen.'
				: 'Eine ratsuchende Person hat Einträge in der Motivationswaage geändert.';
	return {
		recipient: 'counsellors',
		appId: APP_ID,
		important: false,
		title: { de: 'Motivationswaage aktualisiert', en: 'Decisional balance updated' },
		text: { de, en: 'A client updated their decisional balance.' },
		target: { slot: 'consultant.session' }
	};
};

export const RELEASED_AUDIT = {
	action: 'tool.released',
	appId: APP_ID,
	summary: { de: 'Tool „Motivationswaage“ freigegeben', en: 'Released tool “decisional balance”' },
	subject: 'asker'
};

export const SHARED_AUDIT = {
	action: 'balance.shared',
	appId: APP_ID,
	summary: { de: 'Motivationswaage mit der Beratung geteilt', en: 'Shared the decisional balance with counselling' },
	subject: 'self'
};

export const UNSHARED_AUDIT = {
	action: 'balance.unshared',
	appId: APP_ID,
	summary: { de: 'Einsicht in die Motivationswaage zurückgenommen', en: 'Stopped sharing the decisional balance' },
	subject: 'self'
};

export const EXPORTED_AUDIT = {
	action: 'balance.exported',
	appId: APP_ID,
	summary: { de: 'Motivationswaage als PDF exportiert', en: 'Exported the decisional balance as PDF' },
	subject: 'asker'
};
