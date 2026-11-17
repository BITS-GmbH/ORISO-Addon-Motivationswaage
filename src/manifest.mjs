export const NAME = 'motivationswaage';
export const APP_ID = 'balance';

export const manifest = {
	name: NAME,
	version: '0.1.0',
	contract: 'oriso-addon/v1',
	react: '^19',
	ui: '/ui/entry.js',
	settings: '/schema/settings.json',
	events: ['user.deleted'],
	stats: [
		{ id: 'released', label: { de: 'Freigegeben', en: 'Released' }, type: 'count' },
		{ id: 'started', label: { de: 'Bearbeitet', en: 'Started' }, type: 'count' },
		{ id: 'shared', label: { de: 'Mit der Beratung geteilt', en: 'Shared with counselling' }, type: 'count' }
	],
	apps: [
		{
			id: APP_ID,
			title: { de: 'Motivationswaage', en: 'Decisional balance' },
			slots: ['asker.navigation', 'consultant.session', 'consultant.asker-profile'],
			visibility: 'dynamic'
		}
	],
	health: '/health'
};

export const settingsSchema = {
	type: 'object',
	properties: {
		intro: {
			type: 'string',
			title: 'Einleitung für Ratsuchende',
			description: 'Steht auf der Startseite der Übung. Leer lassen für den Standardtext.',
			maxLength: 1500,
			format: 'textarea',
			default: ''
		},
		poles: {
			type: 'string',
			title: 'Beschriftung der Waage',
			description: 'Die Varianten aus der Tool-Beschreibung (links / rechts).',
			enum: [
				'CONTRA Veränderung / PRO Veränderung',
				'keine Veränderung / Ich möchte etwas ändern!',
				'gut so, wie es ist / es muss sich was ändern!'
			],
			default: 'CONTRA Veränderung / PRO Veränderung'
		},
		allowSharing: {
			type: 'boolean',
			title: 'Ratsuchende können ihre Waage mit der Beratung teilen',
			default: true
		}
	}
};
