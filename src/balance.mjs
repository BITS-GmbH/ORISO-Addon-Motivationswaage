// The Motivationswaage itself: categories, ratings, the calculation (delphi's tool description,
// section 2.4.5) and the example texts (2.4.4). Shared by the server and the UI (/ui/balance.mjs).

export const MAX_TEXT_LENGTH = 500;
export const MAX_CONCLUSION_LENGTH = 4000;
export const MAX_ARGUMENTS = 200;

/** Ratings of "Wie wichtig ist dieser Aspekt für Sie?" with their points. */
export const RATINGS = [
	{ value: 3, label: 'sehr wichtig' },
	{ value: 2, label: 'ziemlich wichtig' },
	{ value: 1, label: 'etwas wichtig' },
	{ value: 0, label: 'gar nicht wichtig' }
];

/**
 * A: advantages of the change (PRO), B: disadvantages of the change (CONTRA),
 * C: advantages of no change (CONTRA), D: disadvantages of no change (PRO).
 */
export const CATEGORIES = {
	A: { side: 'pro', change: true, kind: 'advantage', title: 'Vorteile', long: 'Vorteile der Verhaltensänderung' },
	B: { side: 'contra', change: true, kind: 'disadvantage', title: 'Nachteile', long: 'Nachteile der Verhaltensänderung' },
	C: { side: 'contra', change: false, kind: 'advantage', title: 'Vorteile', long: 'Vorteile, wenn sich nichts ändert' },
	D: { side: 'pro', change: false, kind: 'disadvantage', title: 'Nachteile', long: 'Nachteile, wenn sich nichts ändert' }
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);

/** The two halves of the exercise: change (A, B) and no change (C, D). */
export const HALVES = {
	change: { categories: ['A', 'B'] },
	keep: { categories: ['C', 'D'] }
};

/**
 * Pole labels (left = CONTRA, right = PRO); the tool description names three variants, the Träger
 * picks one in the settings. The setting stores the readable "left / right" text.
 */
export const POLE_VARIANTS = [
	'CONTRA Veränderung / PRO Veränderung',
	'keine Veränderung / Ich möchte etwas ändern!',
	'gut so, wie es ist / es muss sich was ändern!'
];

export const polesOf = (variant) => {
	const [contra, pro] = (POLE_VARIANTS.includes(variant) ? variant : POLE_VARIANTS[0]).split(' / ');
	return { contra, pro };
};

export const EXAMPLES = {
	A: [
		'Ich kriege wieder mehr auf die Reihe.',
		'Ich habe wieder Zeit für Hobbys.',
		'Ich kann wieder klar denken.',
		'Mehr Geld / weniger Schulden.',
		'Mein Körper wird nicht mehr so stark belastet.',
		'Ich fühle mich besser.',
		'Gutes Gefühl, weil ich das Problem angehe.',
		'Weniger Stress mit Freunden / Familie.',
		'Ich kann besser einschlafen.'
	],
	B: [
		'Es wird schwierig mit dem alten Freundeskreis.',
		'Der Rausch wird mir fehlen.',
		'Es könnte ganz schön langweilig werden.',
		'Vieles macht dann deutlich weniger Spaß.',
		'Der Entzug / Verzicht wird hart.',
		'Die Hoffnung auf den großen Gewinn fällt weg.'
	],
	C: [
		'Lustigeres Beisammensein mit Freunden.',
		'Beim Trinken / Spielen / Kiffen habe ich meine Ruhe.',
		'Ich kann mich auch mal richtig „wegschießen“ und alles um mich rum vergessen.',
		'Die Chance auf einen Gewinn bleibt.'
	],
	D: [
		'Ich tue kaum etwas anderes.',
		'Ich lasse viele andere Dinge schleifen.',
		'Ich ärgere mich immer mehr über mich selbst.',
		'Weiterhin Ärger und Streit mit meiner Familie.',
		'Ich komme morgens kaum aus dem Bett.',
		'Schulden bleiben / nehmen weiter zu.',
		'Es geht gesundheitlich weiter bergab.',
		'Mein Leben ist weiterhin auf ein Problem reduziert.'
	]
};

/**
 * PRO = Σ rating(A) + Σ rating(D), CONTRA = Σ rating(B) + Σ rating(C),
 * value = 10 × (PRO − CONTRA) / (PRO + CONTRA), only when PRO + CONTRA > 0; otherwise the
 * scale stays inactive (value null), also when all arguments are rated 0.
 */
export const calculate = (args = []) => {
	let pro = 0;
	let contra = 0;
	for (const { category, rating } of args) {
		const side = CATEGORIES[category]?.side;
		if (side === 'pro') {
			pro += rating;
		} else if (side === 'contra') {
			contra += rating;
		}
	}
	const total = pro + contra;
	return { pro, contra, raw: pro - contra, value: total > 0 ? (10 * (pro - contra)) / total : null };
};

/** The value as shown: one decimal, German comma, with a sign; '–' when inactive. */
export const formatValue = (value) => {
	if (value === null || value === undefined) {
		return '–';
	}
	const rounded = Math.round(value * 10) / 10;
	const text = Math.abs(rounded).toFixed(1).replace('.', ',');
	return rounded > 0 ? `+${text}` : rounded < 0 ? `−${text}` : text;
};

const invalid = (message) => Object.assign(new Error(message), { status: 400 });

/** The client's state, checked and limited to known fields. Ids are kept, missing ones are created. */
export const cleanBalance = (body, makeId) => {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		throw invalid('body must be an object');
	}
	const args = body.arguments ?? [];
	if (!Array.isArray(args) || args.length > MAX_ARGUMENTS) {
		throw invalid(`arguments must be a list of at most ${MAX_ARGUMENTS}`);
	}
	const seen = new Set();
	const clean = args.map((arg) => {
		if (typeof arg !== 'object' || arg === null) {
			throw invalid('argument must be an object');
		}
		if (!CATEGORY_IDS.includes(arg.category)) {
			throw invalid('category must be one of A, B, C, D');
		}
		if (typeof arg.text !== 'string' || !arg.text.trim() || arg.text.length > MAX_TEXT_LENGTH) {
			throw invalid(`text must be non-empty and at most ${MAX_TEXT_LENGTH} characters`);
		}
		if (!Number.isInteger(arg.rating) || arg.rating < 0 || arg.rating > 3) {
			throw invalid('rating must be 0, 1, 2 or 3');
		}
		let id = typeof arg.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(arg.id) ? arg.id : makeId();
		if (seen.has(id)) {
			id = makeId();
		}
		seen.add(id);
		return { id, category: arg.category, text: arg.text.trim(), rating: arg.rating };
	});
	const conclusion = body.conclusion ?? '';
	if (typeof conclusion !== 'string' || conclusion.length > MAX_CONCLUSION_LENGTH) {
		throw invalid(`conclusion must be text of at most ${MAX_CONCLUSION_LENGTH} characters`);
	}
	return { arguments: clean, conclusion: conclusion.trim() };
};

/** What changed between two states: arguments added, arguments or conclusion edited. */
export const diffBalance = (before, after) => {
	const old = new Map((before?.arguments ?? []).map((arg) => [arg.id, arg]));
	let added = 0;
	let changed = 0;
	for (const arg of after.arguments) {
		const previous = old.get(arg.id);
		if (!previous) {
			added += 1;
		} else if (previous.text !== arg.text || previous.rating !== arg.rating || previous.category !== arg.category) {
			changed += 1;
		}
	}
	const removed = [...old.keys()].filter((id) => !after.arguments.some((arg) => arg.id === id)).length;
	if ((before?.conclusion ?? '') !== after.conclusion) {
		changed += 1;
	}
	return { added, changed, removed };
};

/** A short reading of the value, as in the examples of section 2.4.5. */
export const tendency = (value) => {
	if (value === null || value === undefined) {
		return 'Noch nicht berechenbar';
	}
	const size = Math.abs(value);
	const side = value > 0 ? 'PRO' : 'CONTRA';
	if (size < 0.5) {
		return 'Ausgeglichen';
	}
	if (size >= 10) {
		return `Maximale ${side}-Tendenz`;
	}
	return size >= 3 ? `${side}-Tendenz` : `Leichte ${side}-Tendenz`;
};

/**
 * Stamps when each argument (and the conclusion) last changed, so counsellors can see what is new
 * to them (tool description 1.6.1). Unchanged entries keep their stamp.
 */
export const stampChanges = (before, clean, at) => {
	const old = new Map((before?.arguments ?? []).map((arg) => [arg.id, arg]));
	const args = clean.arguments.map((arg) => {
		const previous = old.get(arg.id);
		const same =
			previous && previous.text === arg.text && previous.rating === arg.rating && previous.category === arg.category;
		return { ...arg, changedAt: same ? (previous.changedAt ?? at) : at };
	});
	const sameConclusion = (before?.conclusion ?? '') === clean.conclusion;
	return {
		arguments: args,
		conclusion: clean.conclusion,
		conclusionChangedAt: clean.conclusion ? (sameConclusion ? (before?.conclusionChangedAt ?? at) : at) : null
	};
};

/** Entries changed after `seenAt` (all of them when the counsellor never looked). */
export const isNewSince = (changedAt, seenAt) => Boolean(changedAt) && (!seenAt || changedAt > seenAt);
