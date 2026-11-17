// Motivationswaage for ORISO (contract oriso-addon/v1), after section 2.4 of delphi's tool
// description. No build step: React comes from the host on globalThis.__ORISO_ADDON_SHARED__, the
// calculation and texts from the server's module balance.mjs.
import {
	CATEGORIES,
	EXAMPLES,
	HALVES,
	MAX_CONCLUSION_LENGTH,
	MAX_TEXT_LENGTH,
	RATINGS,
	calculate,
	formatValue,
	polesOf,
	tendency
} from './balance.mjs';
import { Scale } from './scale.js';
import { CSS, installStyles } from './styles.js';

const { react: React, reactDomClient } = globalThis.__ORISO_ADDON_SHARED__;
const h = React.createElement;
const { useCallback, useEffect, useMemo, useRef, useState } = React;
const roots = new Map();

// ---------------------------------------------------------------------------------------------
// Small helpers

const ICONS = {
	edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
	delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
	star: 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
	back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
	add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
	idea: 'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z',
	download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
	eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
	lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
	check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
	expand: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
	reset: 'M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
	close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
	info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'
};

const icon = (name, extra = {}) =>
	h('svg', { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: 'false', ...extra }, h('path', { d: ICONS[name] }));

const cx = (...names) => names.filter(Boolean).join(' ');

/** Formal or informal address. */
const tx = (informal, sie, du) => (informal ? du : sie);

const formatDate = (iso, locale, withTime = false) =>
	iso
		? new Date(iso).toLocaleString(locale || 'de', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
				...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
			})
		: '';

const newId = () =>
	(globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`)
		.replace(/-/g, '')
		.slice(0, 12);

/** Shows a message through the host's notifications; false when the host has no `notify`. */
const tell = (notify, type, text) => {
	if (typeof notify !== 'function') {
		return false;
	}
	notify({ type, text });
	return true;
};

const useJson = (api, path) => {
	const [state, setState] = useState({ loading: true, data: null, error: null });
	const reload = useCallback(
		() =>
			api(path)
				.then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
				.then(
					(data) => setState({ loading: false, data, error: null }),
					(error) => setState((previous) => ({ loading: false, data: previous.data, error: error.message }))
				),
		[api, path]
	);
	useEffect(() => {
		reload();
	}, [reload]);
	return [state, reload, setState];
};

const ratingLabel = (rating) => RATINGS.find((r) => r.value === rating)?.label ?? '';

const HALF_TEXT = {
	change: 'Wenn ich mein Ziel erreiche / mein Verhalten ändere, habe ich folgende …',
	keep: 'Wenn ich mein Verhalten nicht ändere / mein Ziel nicht erreiche, habe ich folgende …'
};

const listTitle = (category, informal) => {
	const { kind, change } = CATEGORIES[category];
	const what = kind === 'advantage' ? 'Vorteile' : 'Nachteile';
	if (change) {
		return tx(informal, `Ihre eingetragenen ${what}, wenn Sie Ihr Ziel erreichen:`, `Deine eingetragenen ${what}, wenn du dein Ziel erreichst:`);
	}
	return tx(
		informal,
		`Ihre eingetragenen ${what}, wenn Sie Ihr Verhalten nicht ändern:`,
		`Deine eingetragenen ${what}, wenn du dein Verhalten nicht änderst:`
	);
};

// ---------------------------------------------------------------------------------------------
// Building blocks

function Stars({ rating, zero = 'nicht wichtig' }) {
	if (rating === 0) {
		return h('span', { className: 'mw-stars mw-stars--zero', title: ratingLabel(0) }, zero);
	}
	return h(
		'span',
		{ className: 'mw-stars', role: 'img', 'aria-label': ratingLabel(rating), title: ratingLabel(rating) },
		...[1, 2, 3].map((n) => icon('star', { key: n, className: n <= rating ? undefined : 'mw-star--off' }))
	);
}

function SideBadge({ category }) {
	const side = CATEGORIES[category].side;
	return h('span', { className: `mw-side mw-side--${side}` }, side === 'pro' ? 'PRO' : 'CONTRA');
}

function ScaleCard({ args, poles, informal, readOnly }) {
	const result = useMemo(() => calculate(args), [args]);
	const active = result.value !== null;
	const valueClass = !active || Math.abs(result.value) < 0.05 ? '' : result.value > 0 ? 'mw-value--pro' : 'mw-value--contra';
	let hint = null;
	if (!active) {
		hint =
			args.length > 0
				? 'Alle Argumente sind mit „gar nicht wichtig“ bewertet, die Waage bleibt deshalb noch inaktiv.'
				: readOnly
					? 'Noch keine Argumente eingetragen.'
					: tx(informal, 'Bitte bearbeiten Sie zunächst die Übung.', 'Bitte bearbeite zunächst die Übung.');
	}
	return h(
		'section',
		{ className: 'mw-card', 'aria-label': 'Ergebnis der Motivationswaage' },
		h(
			'div',
			{ className: cx('mw-scale', !active && 'mw-scale--inactive') },
			h(Scale, {
				result,
				poles,
				title: active
					? `Motivationswaage: ${formatValue(result.value)}, ${tendency(result.value)}`
					: 'Motivationswaage: noch inaktiv'
			})
		),
		h(
			'div',
			{ className: 'mw-readout', style: { marginTop: '8px' } },
			active
				? [
						h('span', { key: 'v', className: cx('mw-value', valueClass) }, formatValue(result.value)),
						h('span', { key: 't', className: 'mw-subtitle' }, tendency(result.value))
					]
				: h('span', { className: 'mw-muted' }, hint)
		),
		active &&
			h(
				'div',
				{ className: 'mw-sums', style: { marginTop: '8px' } },
				h('span', { className: 'mw-sum mw-sum--pro' }, `PRO ${result.pro} ${result.pro === 1 ? 'Punkt' : 'Punkte'}`),
				h(
					'span',
					{ className: 'mw-sum mw-sum--contra' },
					`CONTRA ${result.contra} ${result.contra === 1 ? 'Punkt' : 'Punkte'}`
				)
			)
	);
}

function ArgumentList({ items, informal, onEdit, onDelete, editingId }) {
	const [confirming, setConfirming] = useState(null);
	if (items.length === 0) {
		return h('p', { className: 'mw-empty' }, 'Noch keine Einträge.');
	}
	return h(
		'ul',
		{ className: 'mw-list' },
		...items.map((item) =>
			h(
				'li',
				{ key: item.id, className: cx('mw-item', editingId === item.id && 'mw-item--editing') },
				confirming === item.id
					? h(
							'div',
							{ className: 'mw-confirm', style: { flex: 1 } },
							h('span', { style: { flex: 1 } }, tx(informal, 'Diesen Eintrag löschen?', 'Diesen Eintrag löschen?')),
							h(
								'button',
								{
									type: 'button',
									className: 'mw-btn mw-btn--danger',
									onClick: () => {
										setConfirming(null);
										onDelete(item.id);
									}
								},
								'Löschen'
							),
							h('button', { type: 'button', className: 'mw-btn mw-btn--text', onClick: () => setConfirming(null) }, 'Abbrechen')
						)
					: [
							h('span', { key: 't', className: 'mw-item__text' }, item.text),
							h(
								'span',
								{ key: 'm', className: 'mw-item__meta' },
								h(Stars, { rating: item.rating }),
								onEdit &&
									h(
										'button',
										{
											type: 'button',
											className: 'mw-icon-btn',
											title: 'Bearbeiten',
											'aria-label': `Bearbeiten: ${item.text}`,
											onClick: () => onEdit(item)
										},
										icon('edit')
									),
								onDelete &&
									h(
										'button',
										{
											type: 'button',
											className: 'mw-icon-btn mw-icon-btn--danger',
											title: 'Löschen',
											'aria-label': `Löschen: ${item.text}`,
											onClick: () => setConfirming(item.id)
										},
										icon('delete')
									)
							)
						]
			)
		)
	);
}

function HalfSection({ half, args, onOpen }) {
	return h(
		'section',
		{ className: 'mw-card' },
		h('div', { className: 'mw-half__head' }, h('h3', { className: 'mw-subtitle' }, HALF_TEXT[half])),
		h(
			'div',
			{ className: 'mw-columns' },
			...HALVES[half].categories.map((category) => {
				const items = args.filter((arg) => arg.category === category);
				const side = CATEGORIES[category].side;
				return h(
					'div',
					{ key: category, className: 'mw-column' },
					h(
						'div',
						{ className: 'mw-column__head' },
						h(
							'span',
							{ className: 'mw-column__title' },
							h('span', { className: `mw-dot mw-dot--${side}` }),
							`… ${CATEGORIES[category].title}`
						),
						h(SideBadge, { category })
					),
					h(ArgumentList, { items }),
					onOpen &&
						h(
							'div',
							null,
							h(
								'button',
								{ type: 'button', className: 'mw-btn mw-btn--text', onClick: () => onOpen(half, category) },
								icon(items.length ? 'edit' : 'add'),
								items.length ? 'Bearbeiten' : 'Hinzufügen'
							)
						)
				);
			})
		)
	);
}

function ConclusionCard({ value, hasArguments, informal, onSave }) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	useEffect(() => {
		if (!editing) {
			setDraft(value);
		}
	}, [value, editing]);

	const prompt = tx(
		informal,
		'Welches Bild ergibt sich für Sie, nachdem Sie alle Argumente gesammelt haben? Welche Schlussfolgerungen ziehen Sie für sich zum momentanen Zeitpunkt?',
		'Welches Bild ergibt sich für dich, nachdem du alle Argumente gesammelt hast? Welche Schlussfolgerungen ziehst du für dich zum momentanen Zeitpunkt?'
	);

	let body;
	if (!onSave) {
		body = value
			? h('p', { className: 'mw-conclusion' }, value)
			: h('p', { className: 'mw-empty' }, 'Noch kein Fazit eingetragen.');
	} else if (!hasArguments) {
		body = h(
			'p',
			{ className: 'mw-empty' },
			tx(informal, 'Bitte bearbeiten Sie zunächst die Übung.', 'Bitte bearbeite zunächst die Übung.')
		);
	} else if (editing) {
		body = h(
			'form',
			{
				className: 'mw-field',
				onSubmit: (event) => {
					event.preventDefault();
					onSave(draft.trim());
					setEditing(false);
				}
			},
			h('label', { className: 'mw-muted', htmlFor: 'mw-conclusion' }, prompt),
			h('textarea', {
				id: 'mw-conclusion',
				className: 'mw-textarea',
				style: { minHeight: '120px' },
				maxLength: MAX_CONCLUSION_LENGTH,
				value: draft,
				autoFocus: true,
				onChange: (event) => setDraft(event.target.value)
			}),
			h(
				'div',
				{ className: 'mw-actions' },
				h('button', { type: 'submit', className: 'mw-btn mw-btn--primary' }, icon('check'), 'Fazit speichern'),
				h(
					'button',
					{ type: 'button', className: 'mw-btn mw-btn--text', onClick: () => setEditing(false) },
					'Abbrechen'
				)
			)
		);
	} else {
		body = value ? h('p', { className: 'mw-conclusion' }, value) : h('p', { className: 'mw-muted' }, prompt);
	}

	return h(
		'section',
		{ className: 'mw-card mw-card--tinted' },
		h(
			'div',
			{ className: 'mw-head', style: { marginBottom: '8px' } },
			h('h3', { className: 'mw-subtitle' }, onSave ? 'Mein Fazit' : 'Fazit'),
			onSave &&
				hasArguments &&
				!editing &&
				h(
					'button',
					{ type: 'button', className: 'mw-btn mw-btn--text', onClick: () => setEditing(true) },
					icon('edit'),
					'Bearbeiten'
				)
		),
		body
	);
}

function ShareCard({ shared, informal, onChange }) {
	return h(
		'section',
		{ className: 'mw-card' },
		h(
			'label',
			{ className: 'mw-switch' },
			h(
				'span',
				null,
				h('span', { className: 'mw-overline', style: { display: 'block' } }, 'Sichtbarkeit für Berater/in'),
				h('span', { className: 'mw-subtitle', style: { display: 'block' } }, tx(informal, 'Mit meiner Beraterin / meinem Berater teilen', 'Mit meiner Beraterin / meinem Berater teilen')),
				h(
					'span',
					{ className: 'mw-muted mw-small', style: { display: 'block' } },
					shared
						? tx(
								informal,
								'Ihre Beraterin / Ihr Berater kann Ihre Motivationswaage einsehen und wird über Änderungen informiert.',
								'Deine Beraterin / dein Berater kann deine Motivationswaage einsehen und wird über Änderungen informiert.'
							)
						: tx(informal, 'Ihre Angaben sind nur für Sie sichtbar.', 'Deine Angaben sind nur für dich sichtbar.')
				)
			),
			h('input', { type: 'checkbox', role: 'switch', checked: shared, onChange: (event) => onChange(event.target.checked) }),
			h('span', { className: 'mw-switch__track', 'aria-hidden': true })
		)
	);
}

function Intro({ intro, informal }) {
	const steps = [
		[
			'Argumente sammeln',
			tx(
				informal,
				'Überlegen Sie für sich persönlich: Welche Folgen hat es, wenn ich mein Verhalten ändere, also bspw. mit dem Trinken, Spielen oder Kiffen aufhöre? Was passiert, wenn ich weitermache wie bisher? Seien Sie dabei ehrlich zu sich selbst!',
				'Überlege für dich persönlich: Welche Folgen hat es, wenn ich mein Verhalten ändere, also bspw. mit dem Trinken, Spielen oder Kiffen aufhöre? Was passiert, wenn ich weitermache wie bisher? Sei dabei ehrlich zu dir selbst!'
			)
		],
		[
			'Bewerten',
			tx(
				informal,
				'In beiden Fällen können die Auswirkungen einer Veränderung für Sie positiv oder negativ sein. Überlegen Sie auch, ob diese Auswirkungen für Sie besonders wichtig oder eher weniger wichtig sind.',
				'In beiden Fällen können die Auswirkungen einer Veränderung für dich positiv oder negativ sein. Überlege auch, ob diese Auswirkungen für dich besonders wichtig oder eher weniger wichtig sind.'
			)
		],
		[
			'Ergebnis ansehen',
			tx(
				informal,
				'Wenn Sie alle Vor- und Nachteile eingetragen und bewertet haben, zeigt Ihnen die Motivationswaage Ihre aktuelle innere Haltung zu dem ausgewählten Thema an.',
				'Wenn du alle Vor- und Nachteile eingetragen und bewertet hast, zeigt dir die Motivationswaage deine aktuelle innere Haltung zu dem ausgewählten Thema an.'
			)
		],
		[
			'Fazit ziehen',
			tx(
				informal,
				'Was ist Ihr Fazit? Wie schätzen Sie Ihre aktuelle Motivation ein? Sind Sie innerlich bereit, Ihr Verhalten zu verändern? Oder brauchen Sie weitere Argumente?',
				'Was ist dein Fazit? Wie schätzt du deine aktuelle Motivation ein? Bist du innerlich bereit, dein Verhalten zu verändern? Oder brauchst du weitere Argumente?'
			)
		]
	];
	return h(
		'section',
		{ className: 'mw-card' },
		h('h2', { className: 'mw-title' }, 'Motivationswaage'),
		h(
			'p',
			{ className: 'mw-intro' },
			intro ||
				tx(
					informal,
					'Die eigenen Gewohnheiten zu ändern ist immer eine herausfordernde Aufgabe. Jede Veränderung ist anstrengend, kostet Kraft und braucht Durchhaltevermögen. Die Motivationswaage hilft Ihnen dabei, sich über die Vor- und Nachteile einer Überwindung des Suchtverhaltens im Klaren zu sein.',
					'Die eigenen Gewohnheiten zu ändern ist immer eine herausfordernde Aufgabe. Jede Veränderung ist anstrengend, kostet Kraft und braucht Durchhaltevermögen. Die Motivationswaage hilft dir dabei, dir über die Vor- und Nachteile einer Überwindung des Suchtverhaltens im Klaren zu sein.'
				)
		),
		h(
			'details',
			{ className: 'mw-howto' },
			h('summary', null, 'So funktioniert die Motivationswaage', icon('expand')),
			h(
				'ol',
				{ className: 'mw-steps' },
				...steps.map(([title, text], index) =>
					h(
						'li',
						{ key: title },
						h('span', { className: 'mw-step-no', 'aria-hidden': true }, String(index + 1)),
						h('span', null, h('b', null, title), text)
					)
				)
			),
			h(
				'p',
				{ className: 'mw-muted', style: { marginTop: '12px' } },
				tx(
					informal,
					'Sie können die Übung jederzeit erneut bearbeiten und ergänzen, wenn Ihnen neue Vor- und Nachteile einfallen. Wenn Sie möchten, kann Ihre Beraterin / Ihr Berater Ihre Angaben einsehen und Sie so bei Ihrem Vorhaben optimal unterstützen.',
					'Du kannst die Übung jederzeit erneut bearbeiten und ergänzen, wenn dir neue Vor- und Nachteile einfallen. Wenn du möchtest, kann deine Beraterin / dein Berater deine Angaben einsehen und dich so bei deinem Vorhaben optimal unterstützen.'
				)
			)
		)
	);
}

function MiniResult({ args }) {
	const result = calculate(args);
	const active = result.value !== null;
	return h(
		'div',
		{ className: 'mw-mini', 'aria-live': 'polite' },
		h('span', { className: 'mw-small mw-muted' }, 'CONTRA'),
		h(
			'div',
			{ className: 'mw-mini__bar', 'aria-hidden': true },
			active && h('span', { className: 'mw-mini__dot', style: { left: `${((result.value + 10) / 20) * 100}%` } })
		),
		h('span', { className: 'mw-small mw-muted' }, 'PRO'),
		h(
			'span',
			{ className: 'mw-small', style: { fontWeight: 600, minWidth: '11em' } },
			active ? `${formatValue(result.value)} · ${tendency(result.value)}` : 'Waage noch inaktiv'
		)
	);
}

function Editor({ half, initialCategory, args, informal, onAdd, onUpdate, onDelete, onClose }) {
	const [category, setCategory] = useState(initialCategory);
	const [text, setText] = useState('');
	const [rating, setRating] = useState(null);
	const [editingId, setEditingId] = useState(null);
	const [showExamples, setShowExamples] = useState(false);
	const [problem, setProblem] = useState(null);
	const textRef = useRef(null);
	const formRef = useRef(null);
	const { kind } = CATEGORIES[category];
	const noun = kind === 'advantage' ? 'Vorteil' : 'Nachteil';

	const reset = () => {
		setText('');
		setRating(null);
		setEditingId(null);
		setProblem(null);
	};

	const choose = (next) => {
		if (next !== category) {
			setCategory(next);
			reset();
		}
	};

	const startEdit = (item) => {
		setCategory(item.category);
		setText(item.text);
		setRating(item.rating);
		setEditingId(item.id);
		setProblem(null);
		formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
		setTimeout(() => textRef.current?.focus(), 50);
	};

	const submit = (event) => {
		event.preventDefault();
		if (!text.trim()) {
			setProblem(tx(informal, `Bitte tragen Sie einen ${noun} ein.`, `Bitte trage einen ${noun} ein.`));
			textRef.current?.focus();
			return;
		}
		if (rating === null) {
			setProblem(tx(informal, 'Bitte bewerten Sie, wie wichtig dieser Aspekt für Sie ist.', 'Bitte bewerte, wie wichtig dieser Aspekt für dich ist.'));
			return;
		}
		if (editingId) {
			onUpdate({ id: editingId, category, text: text.trim(), rating });
		} else {
			onAdd({ id: newId(), category, text: text.trim(), rating });
		}
		reset();
		textRef.current?.focus();
	};

	const used = new Set(args.map((arg) => arg.text));
	const examples = EXAMPLES[category].filter((example) => !used.has(example));
	const [first, second] = HALVES[half].categories;

	return h(
		'div',
		{ className: 'mw-stack' },
		h(
			'button',
			{ type: 'button', className: 'mw-btn mw-btn--text mw-back', onClick: onClose },
			icon('back'),
			'Zur Übersicht'
		),
		h(
			'section',
			{ className: 'mw-card', ref: formRef },
			h('p', { className: 'mw-overline' }, 'Motivationswaage'),
			h('h2', { className: 'mw-title', style: { marginTop: '4px' } }, HALF_TEXT[half]),
			h(
				'div',
				{ className: 'mw-seg', role: 'group', 'aria-label': 'Art des Arguments', style: { margin: '16px 0 4px' } },
				...[first, second].map((id) =>
					h(
						'button',
						{ key: id, type: 'button', 'aria-pressed': category === id, onClick: () => choose(id) },
						category === id && icon('check'),
						`… ${CATEGORIES[id].title}`
					)
				)
			),
			h(
				'form',
				{ className: 'mw-stack', style: { marginTop: '16px', gap: '20px' }, onSubmit: submit, noValidate: true },
				h(
					'div',
					{ className: 'mw-field' },
					h(
						'label',
						{ className: 'mw-label', htmlFor: 'mw-argument' },
						editingId ? `${noun} bearbeiten` : `Neuer ${noun}`
					),
					h('textarea', {
						id: 'mw-argument',
						ref: textRef,
						className: 'mw-textarea',
						maxLength: MAX_TEXT_LENGTH,
						value: text,
						placeholder: tx(
							informal,
							`${noun} hier eintragen. Nutzen Sie für jeden ${noun} einen neuen Eintrag.`,
							`${noun} hier eintragen. Nutze für jeden ${noun} einen neuen Eintrag.`
						),
						onChange: (event) => setText(event.target.value)
					}),
					h('span', { className: 'mw-counter' }, `${text.length} / ${MAX_TEXT_LENGTH}`),
					h(
						'div',
						null,
						h(
							'button',
							{
								type: 'button',
								className: 'mw-btn mw-btn--text',
								'aria-expanded': showExamples,
								onClick: () => setShowExamples(!showExamples)
							},
							icon('idea'),
							showExamples ? 'Beispiele ausblenden' : 'Beispiele anzeigen'
						)
					),
					showExamples &&
						(examples.length
							? h(
									'div',
									{ className: 'mw-chips' },
									...examples.map((example) =>
										h(
											'button',
											{
												key: example,
												type: 'button',
												className: 'mw-chip',
												onClick: () => {
													setText(example);
													textRef.current?.focus();
												}
											},
											example
										)
									)
								)
							: h('p', { className: 'mw-empty' }, 'Alle Beispiele sind schon eingetragen.'))
				),
				h(
					'fieldset',
					{ style: { border: 0, padding: 0, margin: 0 } },
					h(
						'legend',
						{ className: 'mw-label', style: { padding: 0, marginBottom: '8px' } },
						tx(informal, 'Wie wichtig ist dieser Aspekt für Sie?', 'Wie wichtig ist dieser Aspekt für dich?')
					),
					h(
						'div',
						{ className: 'mw-ratings' },
						...RATINGS.map((option) =>
							h(
								'label',
								{ key: option.value, className: 'mw-rating' },
								h('input', {
									type: 'radio',
									name: 'mw-rating',
									value: option.value,
									checked: rating === option.value,
									onChange: () => setRating(option.value)
								}),
								h('span', null, h(Stars, { rating: option.value, zero: '–' }), option.label)
							)
						)
					)
				),
				problem && h('p', { className: 'mw-error', role: 'alert' }, problem),
				h(
					'div',
					{ className: 'mw-actions' },
					h(
						'button',
						{ type: 'submit', className: 'mw-btn mw-btn--primary' },
						icon(editingId ? 'check' : 'add'),
						editingId ? 'Änderung speichern' : 'Eintrag hinzufügen'
					),
					editingId && h('button', { type: 'button', className: 'mw-btn mw-btn--text', onClick: reset }, 'Abbrechen')
				)
			)
		),
		h('section', { className: 'mw-card mw-card--tinted' }, h(MiniResult, { args })),
		...[first, second].map((id) =>
			h(
				'section',
				{ key: id, className: 'mw-card' },
				h(
					'div',
					{ className: 'mw-column__head', style: { marginBottom: '12px' } },
					h('h3', { className: 'mw-subtitle' }, listTitle(id, informal)),
					h(SideBadge, { category: id })
				),
				h(ArgumentList, {
					items: args.filter((arg) => arg.category === id),
					informal,
					editingId,
					onEdit: startEdit,
					onDelete: (removed) => {
						if (removed === editingId) {
							reset();
						}
						onDelete(removed);
					}
				})
			)
		),
		h(
			'div',
			{ className: 'mw-actions' },
			h('button', { type: 'button', className: 'mw-btn mw-btn--outlined', onClick: onClose }, 'Beenden')
		)
	);
}

/**
 * The exercise as the client uses it. `persist` stores a state and resolves, or rejects; the
 * counsellor's preview passes one that keeps everything in memory.
 */
function Exercise({ initial, persist, settings, informal, notify, top = null }) {
	const [state, setState] = useState(() => ({
		arguments: initial.arguments ?? [],
		conclusion: initial.conclusion ?? '',
		shared: Boolean(initial.shared)
	}));
	const [screen, setScreen] = useState(null);
	const [saving, setSaving] = useState('idle');
	const queue = useRef(Promise.resolve());
	const confirmed = useRef(state);
	const rootRef = useRef(null);
	const poles = polesOf(settings.poles);

	const commit = (next, success) => {
		setState(next);
		setSaving('saving');
		queue.current = queue.current.then(async () => {
			try {
				await persist(next);
				confirmed.current = next;
				setSaving('saved');
				if (success) {
					tell(notify, 'success', success);
				}
			} catch (reason) {
				setState(confirmed.current);
				setSaving('error');
				tell(notify, 'error', `Speichern hat nicht geklappt (${reason.message}). Bitte versuchen Sie es noch einmal.`);
			}
		});
	};

	const open = (half, category) => {
		setScreen({ half, category });
		rootRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
	};

	const status =
		saving === 'saving'
			? h('span', { className: 'mw-saving' }, 'Wird gespeichert …')
			: saving === 'saved'
				? h('span', { className: 'mw-saving' }, icon('check'), 'Gespeichert')
				: saving === 'error'
					? h('span', { className: 'mw-saving mw-error' }, 'Nicht gespeichert')
					: null;

	if (screen) {
		return h(
			'div',
			{ className: 'mw-stack', ref: rootRef },
			top,
			h(Editor, {
				half: screen.half,
				initialCategory: screen.category,
				args: state.arguments,
				informal,
				onAdd: (arg) => commit({ ...state, arguments: [...state.arguments, arg] }),
				onUpdate: (arg) =>
					commit({ ...state, arguments: state.arguments.map((item) => (item.id === arg.id ? arg : item)) }),
				onDelete: (id) => commit({ ...state, arguments: state.arguments.filter((item) => item.id !== id) }),
				onClose: () => {
					setScreen(null);
					rootRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
				}
			}),
			status && h('div', { style: { textAlign: 'right' } }, status)
		);
	}

	return h(
		'div',
		{ className: 'mw-stack', ref: rootRef },
		top,
		h(Intro, { intro: settings.intro, informal }),
		h(ScaleCard, { args: state.arguments, poles, informal }),
		h(ConclusionCard, {
			value: state.conclusion,
			hasArguments: state.arguments.length > 0,
			informal,
			onSave: (conclusion) => commit({ ...state, conclusion }, tx(informal, 'Ihr Fazit ist gespeichert.', 'Dein Fazit ist gespeichert.'))
		}),
		h(HalfSection, { half: 'change', args: state.arguments, onOpen: open }),
		h(HalfSection, { half: 'keep', args: state.arguments, onOpen: open }),
		settings.allowSharing !== false &&
			h(ShareCard, {
				shared: state.shared,
				informal,
				onChange: (shared) =>
					commit(
						{ ...state, shared },
						shared
							? tx(informal, 'Ihre Beratung kann Ihre Motivationswaage jetzt einsehen.', 'Deine Beratung kann deine Motivationswaage jetzt einsehen.')
							: tx(informal, 'Ihre Motivationswaage ist wieder nur für Sie sichtbar.', 'Deine Motivationswaage ist wieder nur für dich sichtbar.')
					)
			}),
		status && h('div', { style: { textAlign: 'right' } }, status)
	);
}

// ---------------------------------------------------------------------------------------------
// Client

function AskerView({ api, informal, notify }) {
	const [{ loading, data, error }] = useJson(api, '/balance');

	if (loading && !data) {
		return h('div', { className: 'mw-card mw-muted' }, 'Wird geladen …');
	}
	if (!data) {
		return h('div', { className: 'mw-card' }, h('p', { className: 'mw-error' }, `Die Motivationswaage konnte nicht geladen werden (${error}).`));
	}
	if (!data.released) {
		return h(
			'div',
			{ className: 'mw-notice' },
			icon('lock'),
			h(
				'p',
				null,
				tx(
					informal,
					'Dieses Tool schaltet Ihre Beraterin oder Ihr Berater für Sie frei. Sprechen Sie sie oder ihn gern darauf an.',
					'Dieses Tool schaltet deine Beraterin oder dein Berater für dich frei. Sprich sie oder ihn gern darauf an.'
				)
			)
		);
	}

	const persist = async (next) => {
		const response = await api('/balance', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(next)
		});
		if (response.status === 403) {
			throw new Error(tx(informal, 'die Motivationswaage ist nicht mehr freigeschaltet', 'die Motivationswaage ist nicht mehr freigeschaltet'));
		}
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		return response.json();
	};

	return h(Exercise, {
		initial: data,
		persist,
		settings: { intro: data.intro, poles: data.poles, allowSharing: data.allowSharing },
		informal,
		notify
	});
}

// ---------------------------------------------------------------------------------------------
// Counsellor

const escapeHtml = (value) =>
	String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/** The host's colour tokens, so the exported scale has the Träger's colours. */
const themeTokens = () => {
	const style = globalThis.getComputedStyle?.(document.documentElement);
	if (!style) {
		return '';
	}
	const names = [...new Set((CSS.match(/--m3-[a-z-]+/g) ?? []))];
	return names
		.map((name) => [name, style.getPropertyValue(name).trim()])
		.filter(([, value]) => value)
		.map(([name, value]) => `${name}: ${value};`)
		.join(' ');
};

const exportDocument = ({ data, svg, sessionId, locale }) => {
	const args = data.balance.arguments;
	const { result } = data.balance;
	const title = `Motivationswaage${sessionId ? ` – Fall ${sessionId}` : ''}`;
	const stars = (rating) => (rating === 0 ? '–' : '★'.repeat(rating) + '☆'.repeat(3 - rating));
	const section = (category) => {
		const items = args.filter((arg) => arg.category === category);
		const { long, side } = CATEGORIES[category];
		return `<section class="x-cat"><h3>${escapeHtml(long)} <small class="x-${side}">${side === 'pro' ? 'PRO' : 'CONTRA'}</small></h3>${
			items.length
				? `<table>${items
						.map(
							(item) =>
								`<tr><td>${escapeHtml(item.text)}</td><td class="x-rating"><span class="x-stars">${stars(item.rating)}</span><br>${escapeHtml(ratingLabel(item.rating))}</td></tr>`
						)
						.join('')}</table>`
				: '<p class="x-empty">Keine Einträge.</p>'
		}</section>`;
	};
	return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
:root { ${themeTokens()} }
${CSS}
@page { size: A4; margin: 18mm 16mm; }
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1a1c1e; margin: 0; font-size: 11pt; }
h1 { font-size: 20pt; margin: 0 0 4px; color: var(--mw-primary); }
h2 { font-size: 13pt; margin: 18px 0 6px; }
h3 { font-size: 11pt; margin: 14px 0 6px; }
.x-meta { color: #545f63; font-size: 9.5pt; display: flex; gap: 6px 20px; flex-wrap: wrap; border-bottom: 1px solid #d6dcde; padding-bottom: 10px; }
.x-scale { max-width: 125mm; margin: 10px auto 0; }
.x-scale svg { width: 100%; height: auto; }
.x-result { text-align: center; font-size: 12pt; margin: 6px 0 0; }
.x-result b { font-size: 16pt; }
.x-conclusion { white-space: pre-wrap; background: #f4f6f7; border-radius: 8px; padding: 8px 12px; }
table { width: 100%; border-collapse: collapse; }
td { border-top: 1px solid #e3e7e9; padding: 6px 4px; vertical-align: top; }
.x-rating { width: 34mm; text-align: right; font-size: 9pt; color: #545f63; }
.x-stars { color: #c48a00; font-size: 11pt; letter-spacing: 1px; }
.x-cat { break-inside: avoid; }
.x-cat small { font-size: 8pt; border-radius: 4px; padding: 1px 5px; margin-left: 6px; }
.x-pro { background: var(--mw-primary-soft); color: var(--mw-primary); }
.x-contra { background: var(--mw-contra-soft); color: var(--mw-contra); }
.x-empty { color: #545f63; }
footer { margin-top: 20px; font-size: 8.5pt; color: #545f63; border-top: 1px solid #d6dcde; padding-top: 6px; }
</style></head><body><div class="mw">
<h1>Motivationswaage</h1>
<div class="x-meta">${sessionId ? `<span>Fall: ${escapeHtml(sessionId)}</span>` : ''}<span>Exportiert am ${escapeHtml(formatDate(data.exportedAt, locale, true))}</span>${
		data.updatedAt ? `<span>Stand der Einträge: ${escapeHtml(formatDate(data.updatedAt, locale, true))}</span>` : ''
	}</div>
<h2>Ergebnis</h2>
${svg ? `<div class="x-scale mw-scale">${svg}</div>` : ''}
<p class="x-result">${
		result.value === null
			? 'Die Waage ist noch inaktiv (keine Relevanzpunkte).'
			: `<b>${escapeHtml(formatValue(result.value))}</b> · ${escapeHtml(tendency(result.value))}<br>PRO ${result.pro} Punkte · CONTRA ${result.contra} Punkte (Skala −10 bis +10)`
	}</p>
<h2>Fazit</h2>
${data.balance.conclusion ? `<p class="x-conclusion">${escapeHtml(data.balance.conclusion)}</p>` : '<p class="x-empty">Kein Fazit eingetragen.</p>'}
<h2>Argumente</h2>
${['A', 'B', 'C', 'D'].map(section).join('')}
<footer>Vertraulich. Von der ratsuchenden Person zur Einsicht freigegebene Inhalte, nur zur Verwendung im Beratungskontext.</footer>
</div></body></html>`;
};

/** Opens the browser's print dialog for the document; "Als PDF speichern" gives the PDF. */
const printDocument = (html) =>
	new Promise((resolve) => {
		const frame = document.createElement('iframe');
		frame.setAttribute('aria-hidden', 'true');
		frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
		document.body.appendChild(frame);
		const doc = frame.contentDocument;
		doc.open();
		doc.write(html);
		doc.close();
		setTimeout(() => {
			frame.contentWindow.focus();
			frame.contentWindow.print();
			setTimeout(() => frame.remove(), 1000);
			resolve();
		}, 300);
	});

const COUNSELLOR_DESCRIPTION =
	'Die Motivationswaage hilft Betroffenen, Vor- und Nachteile der Überwindung des Suchtverhaltens abzuwägen und zu gewichten. Damit können Unsicherheiten und Bedenken aufgedeckt und klarere Entscheidungen getroffen werden. Sofern Betroffene wollen, können sie ihrer Beraterin / ihrem Berater Einblick in ihre Notizen geben.';

function Preview({ informal, notify, onClose }) {
	const [run, setRun] = useState(0);
	const banner = h(
		'div',
		{ className: 'mw-notice mw-notice--demo', role: 'status' },
		icon('eye'),
		h(
			'div',
			{ style: { flex: 1 } },
			h('b', null, 'User-Vorschau / Demo – keine Speicherung im realen Fall'),
			h('p', { className: 'mw-small' }, 'So sehen Ratsuchende die Übung. Ihre Eingaben hier sind Testdaten und verschwinden beim Schließen.'),
			h(
				'div',
				{ className: 'mw-actions', style: { marginTop: '8px' } },
				h(
					'button',
					{ type: 'button', className: 'mw-btn mw-btn--outlined', onClick: () => setRun(run + 1) },
					icon('reset'),
					'Demo zurücksetzen'
				),
				h('button', { type: 'button', className: 'mw-btn mw-btn--text', onClick: onClose }, icon('close'), 'Vorschau beenden')
			)
		)
	);
	return h(Exercise, {
		key: run,
		initial: { arguments: [], conclusion: '', shared: false },
		persist: async (next) => next,
		settings: { allowSharing: true },
		informal,
		notify: null,
		top: banner
	});
}

function CounsellorView({ api, locale, notify, informal, sessionId }) {
	const [{ loading, data, error }, reload] = useJson(api, '/balance/client');
	const [busy, setBusy] = useState(null);
	const [message, setMessage] = useState(null);
	const [preview, setPreview] = useState(false);
	const [confirmRevoke, setConfirmRevoke] = useState(false);
	const rootRef = useRef(null);

	const say = (type, text) => {
		if (!tell(notify, type, text)) {
			setMessage({ type, text });
		}
	};

	if (preview) {
		return h(Preview, { informal, notify, onClose: () => setPreview(false) });
	}
	if (loading && !data) {
		return h('div', { className: 'mw-card mw-muted' }, 'Wird geladen …');
	}
	if (!data) {
		return h('div', { className: 'mw-card' }, h('p', { className: 'mw-error' }, `Status nicht verfügbar (${error}).`));
	}

	const release = async () => {
		setBusy('release');
		setMessage(null);
		try {
			const response = await api('/balance/client/release', { method: 'POST' });
			if (response.status === 409) {
				say('warning', 'Freischalten gerade nicht möglich: Der Träger hat den aktuellen Auftragsverarbeitungsvertrag noch nicht bestätigt.');
				return;
			}
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			await reload();
			say('success', 'Die Motivationswaage ist freigeschaltet. Die ratsuchende Person wird benachrichtigt.');
		} catch (reason) {
			say('error', `Freischalten hat nicht geklappt (${reason.message}).`);
		} finally {
			setBusy(null);
		}
	};

	const revoke = async () => {
		setConfirmRevoke(false);
		setBusy('revoke');
		setMessage(null);
		try {
			const response = await api('/balance/client/release', { method: 'DELETE' });
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			await reload();
			say('success', 'Die Freischaltung ist aufgehoben. Die Einträge bleiben gespeichert und sind nach einer neuen Freischaltung wieder da.');
		} catch (reason) {
			say('error', `Aufheben hat nicht geklappt (${reason.message}).`);
		} finally {
			setBusy(null);
		}
	};

	const exportPdf = async () => {
		setBusy('export');
		setMessage(null);
		try {
			const response = await api('/balance/client/export', { method: 'POST' });
			if (response.status === 403) {
				await reload();
				say('warning', 'Die ratsuchende Person hat die Einsicht zurückgenommen. Ein Export ist nicht möglich.');
				return;
			}
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			const exported = await response.json();
			const svg = rootRef.current?.querySelector('.mw-scale svg')?.outerHTML ?? '';
			await printDocument(exportDocument({ data: exported, svg, sessionId, locale }));
		} catch (reason) {
			say('error', `Export hat nicht geklappt (${reason.message}).`);
		} finally {
			setBusy(null);
		}
	};

	const [statusText, statusClass] = !data.released
		? ['Nicht freigeschaltet', 'mw-status--off']
		: data.shared
			? ['Einsicht freigegeben', 'mw-status--shared']
			: data.started
				? ['Freigeschaltet · keine Einsicht', 'mw-status--on']
				: ['Freigeschaltet · noch keine Einträge', 'mw-status--on'];

	const meta = [
		data.released && `Freigeschaltet am ${formatDate(data.releasedAt, locale)}`,
		data.shared && data.updatedAt && `Zuletzt bearbeitet am ${formatDate(data.updatedAt, locale, true)}`
	].filter(Boolean);

	const poles = polesOf(data.poles);

	return h(
		'div',
		{ className: 'mw-stack', ref: rootRef },
		h(
			'section',
			{ className: 'mw-card' },
			h(
				'div',
				{ className: 'mw-head' },
				h('div', null, h('p', { className: 'mw-overline' }, 'Digitales Tool'), h('h2', { className: 'mw-title' }, 'Motivationswaage')),
				h('span', { className: cx('mw-status', statusClass) }, statusText)
			),
			h('p', { className: 'mw-intro' }, COUNSELLOR_DESCRIPTION),
			meta.length > 0 && h('p', { className: 'mw-small mw-muted', style: { marginTop: '8px' } }, meta.join(' · ')),
			h(
				'div',
				{ className: 'mw-actions', style: { marginTop: '16px' } },
				!data.released &&
					h(
						'button',
						{ type: 'button', className: 'mw-btn mw-btn--primary', onClick: release, disabled: busy !== null },
						icon('lock'),
						busy === 'release' ? 'Wird freigeschaltet …' : 'Freischalten'
					),
				data.shared &&
					h(
						'button',
						{ type: 'button', className: 'mw-btn mw-btn--primary', onClick: exportPdf, disabled: busy !== null },
						icon('download'),
						busy === 'export' ? 'Export wird erstellt …' : 'Als PDF exportieren'
					),
				h(
					'button',
					{ type: 'button', className: 'mw-btn mw-btn--outlined', onClick: () => setPreview(true) },
					icon('eye'),
					'User-Vorschau'
				),
				data.released &&
					!confirmRevoke &&
					h(
						'button',
						{ type: 'button', className: 'mw-btn mw-btn--text', onClick: () => setConfirmRevoke(true), disabled: busy !== null },
						busy === 'revoke' ? 'Wird aufgehoben …' : 'Freischaltung aufheben'
					)
			),
			confirmRevoke &&
				h(
					'div',
					{ className: 'mw-confirm mw-confirm--box', style: { marginTop: '12px' } },
					h(
						'span',
						{ style: { flex: '1 1 260px' } },
						'Freischaltung aufheben? Das Tool verschwindet für die ratsuchende Person und Sie sehen keine Inhalte mehr. Die Einträge bleiben gespeichert.'
					),
					h('button', { type: 'button', className: 'mw-btn mw-btn--danger', onClick: revoke }, 'Aufheben'),
					h('button', { type: 'button', className: 'mw-btn mw-btn--text', onClick: () => setConfirmRevoke(false) }, 'Abbrechen')
				),
			message && h('p', { className: message.type === 'error' ? 'mw-error' : 'mw-muted', role: 'alert', style: { marginTop: '12px' } }, message.text)
		),
		data.released &&
			!data.shared &&
			h(
				'div',
				{ className: 'mw-notice' },
				icon('info'),
				h(
					'p',
					null,
					data.started
						? 'Die ratsuchende Person bearbeitet die Motivationswaage, hat die Einsicht aber nicht freigegeben. Inhalte sehen Sie erst, wenn sie sie mit Ihnen teilt.'
						: 'Die ratsuchende Person hat noch keine Einträge vorgenommen. Sobald sie ihre Motivationswaage teilt, sehen Sie sie hier.'
				)
			),
		data.shared &&
			data.balance && [
				h(ScaleCard, { key: 'scale', args: data.balance.arguments, poles, readOnly: true }),
				h(ConclusionCard, { key: 'conclusion', value: data.balance.conclusion }),
				h(HalfSection, { key: 'change', half: 'change', args: data.balance.arguments }),
				h(HalfSection, { key: 'keep', half: 'keep', args: data.balance.arguments })
			]
	);
}

// ---------------------------------------------------------------------------------------------
// Lifecycle (contract oriso-addon/v1)

function Motivationswaage(props) {
	const style = useMemo(() => ({ ...(props.theme ?? {}) }), [props.theme]);
	return h(
		'div',
		{ className: 'mw', style },
		props.slot === 'asker.navigation' ? h(AskerView, props) : h(CounsellorView, props)
	);
}

export async function mount(props) {
	installStyles(props.domElement.ownerDocument);
	const root = reactDomClient.createRoot(props.domElement);
	roots.set(props.domElement, root);
	root.render(h(Motivationswaage, props));
}

export async function update(props) {
	roots.get(props.domElement)?.render(h(Motivationswaage, props));
}

export async function unmount(props) {
	roots.get(props.domElement)?.unmount();
	roots.delete(props.domElement);
}
