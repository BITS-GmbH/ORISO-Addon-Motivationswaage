// Styles of the add-on, scoped to `.mw`. Colours come from the host's Material 3 tokens (`--m3-*`,
// set per Träger) with the DigiSucht colours as fallback.

export const CSS = `
.mw {
	--mw-primary: var(--m3-primary, #225e65);
	--mw-on-primary: var(--m3-on-primary, #fff);
	--mw-primary-soft: color-mix(in srgb, var(--mw-primary) 12%, var(--mw-surface));
	--mw-contra: #c25e22;
	--mw-contra-soft: color-mix(in srgb, var(--mw-contra) 12%, var(--mw-surface));
	--mw-pro: var(--mw-primary);
	--mw-pro-soft: var(--mw-primary-soft);
	--mw-surface: var(--m3-surface-container-lowest, #fff);
	--mw-surface-low: var(--m3-surface-container-low, #f4f6f7);
	--mw-surface-high: var(--m3-surface-container-high, #e7eaec);
	--mw-text: var(--m3-on-surface, #1a1c1e);
	--mw-muted: var(--m3-on-surface-variant, #545f63);
	--mw-outline: var(--m3-outline, #8a9599);
	--mw-outline-soft: var(--m3-outline-variant, #d6dcde);
	--mw-error: var(--m3-error, #b3261e);
	--mw-success: var(--m3-success, #2e7d32);
	container-type: inline-size;
	width: 100%;
	color: var(--mw-text);
	font: inherit;
	font-size: 15px;
	line-height: 1.5;
	max-width: 920px;
	box-sizing: border-box;
}
.mw *, .mw *::before, .mw *::after { box-sizing: border-box; }
.mw h2, .mw h3, .mw h4, .mw p { margin: 0; }
.mw-stack { display: flex; flex-direction: column; gap: 16px; }
.mw-card {
	background: var(--mw-surface);
	border: 1px solid var(--mw-outline-soft);
	border-radius: 16px;
	padding: 20px 24px;
}
.mw-card--tinted { background: var(--mw-surface-low); }
.mw-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.mw-title { font-size: 22px; font-weight: 700; line-height: 1.3; color: var(--mw-text); }
.mw-subtitle { font-size: 17px; font-weight: 600; line-height: 1.35; }
.mw-overline { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mw-muted); }
.mw-muted { color: var(--mw-muted); }
.mw-small { font-size: 13px; }
.mw-intro { margin-top: 8px; color: var(--mw-muted); max-width: 70ch; }

.mw-btn {
	display: inline-flex; align-items: center; justify-content: center; gap: 8px;
	min-height: 40px; padding: 8px 20px; border-radius: 999px;
	font: inherit; font-weight: 600; font-size: 14px; letter-spacing: .01em;
	border: 1px solid transparent; cursor: pointer; text-decoration: none;
	transition: background-color .15s, box-shadow .15s, border-color .15s, color .15s;
	white-space: nowrap;
}
.mw-btn:focus-visible, .mw-icon-btn:focus-visible, .mw-chip:focus-visible, .mw-seg button:focus-visible,
.mw-rating input:focus-visible + span, .mw-switch input:focus-visible + .mw-switch__track {
	outline: 3px solid color-mix(in srgb, var(--mw-primary) 45%, transparent); outline-offset: 2px;
}
.mw-btn[disabled] { opacity: .5; cursor: default; }
.mw-btn--primary { background: var(--mw-primary); color: var(--mw-on-primary); }
.mw-btn--primary:not([disabled]):hover { box-shadow: 0 1px 3px rgba(0,0,0,.25); background: color-mix(in srgb, var(--mw-primary) 88%, #000); }
.mw-btn--outlined { background: transparent; color: var(--mw-primary); border-color: var(--mw-primary); }
.mw-btn--outlined:not([disabled]):hover { background: var(--mw-primary-soft); }
.mw-btn--text { background: transparent; color: var(--mw-primary); padding-inline: 12px; }
.mw-btn--text:not([disabled]):hover { background: var(--mw-primary-soft); }
.mw-btn--danger { background: var(--mw-error); color: #fff; }
.mw-btn svg, .mw-icon-btn svg { width: 18px; height: 18px; fill: currentColor; flex: none; }
.mw-actions { display: flex; gap: 8px 12px; flex-wrap: wrap; align-items: center; }

.mw-icon-btn {
	display: inline-flex; align-items: center; justify-content: center;
	width: 36px; height: 36px; border-radius: 999px; border: 0; background: transparent;
	color: var(--mw-muted); cursor: pointer; flex: none;
}
.mw-icon-btn:hover { background: var(--mw-surface-high); color: var(--mw-text); }
.mw-icon-btn--danger:hover { color: var(--mw-error); background: color-mix(in srgb, var(--mw-error) 10%, transparent); }

.mw-status { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; padding: 3px 10px; font-size: 12px; font-weight: 700; }
.mw-status--off { background: #fbefe2; color: #8a4b12; }
.mw-status--on { background: #e3f3e6; color: #1e6b2b; }
.mw-status--shared { background: var(--mw-primary-soft); color: var(--mw-primary); }

.mw-notice {
	display: flex; gap: 12px; align-items: flex-start; border-radius: 12px; padding: 12px 16px;
	background: var(--mw-surface-low); color: var(--mw-text); border: 1px solid var(--mw-outline-soft);
}
.mw-notice svg { width: 20px; height: 20px; fill: var(--mw-muted); flex: none; margin-top: 2px; }
.mw-notice--demo { background: #fff6e0; border-color: #f0d18a; }
.mw-notice--demo svg { fill: #8a6100; }
.mw-error { color: var(--mw-error); }

/* how it works */
.mw-howto summary { cursor: pointer; font-weight: 600; color: var(--mw-primary); list-style: none; display: inline-flex; align-items: center; gap: 4px; margin-top: 12px; }
.mw-howto summary::-webkit-details-marker { display: none; }
.mw-howto summary svg { width: 20px; height: 20px; fill: currentColor; transition: transform .2s; }
.mw-howto[open] summary svg { transform: rotate(180deg); }
.mw-steps { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 12px; }
.mw-steps li { display: grid; grid-template-columns: 32px 1fr; gap: 12px; align-items: start; }
.mw-steps b { display: block; }
.mw-step-no {
	width: 32px; height: 32px; border-radius: 999px; display: grid; place-items: center;
	background: var(--mw-primary-soft); color: var(--mw-primary); font-weight: 700;
}

/* scale */
.mw-scale { display: grid; gap: 8px; justify-items: center; text-align: center; }
.mw-scale svg { width: 100%; max-width: 560px; height: auto; display: block; overflow: visible; }
.mw-scale .mw-beam, .mw-scale .mw-pan, .mw-scale .mw-needle {
	transition: transform .9s cubic-bezier(.34, 1.36, .5, 1);
}
.mw-scale--inactive svg { filter: grayscale(1); opacity: .55; }
.mw-readout { display: flex; gap: 8px 20px; flex-wrap: wrap; justify-content: center; align-items: baseline; }
.mw-value { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
.mw-value--pro { color: var(--mw-primary); }
.mw-value--contra { color: var(--mw-contra); }
.mw-sums { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.mw-sum { border-radius: 999px; padding: 2px 12px; font-size: 13px; font-weight: 600; }
.mw-sum--pro { background: var(--mw-primary-soft); color: var(--mw-primary); }
.mw-sum--contra { background: var(--mw-contra-soft); color: var(--mw-contra); }

/* sharing switch */
.mw-switch { display: flex; gap: 16px; align-items: center; justify-content: space-between; cursor: pointer; }
.mw-switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.mw-switch__track {
	position: relative; width: 52px; height: 32px; border-radius: 999px; flex: none;
	background: var(--mw-surface-high); border: 2px solid var(--mw-outline); transition: background .2s, border-color .2s;
}
.mw-switch__track::after {
	content: ''; position: absolute; top: 50%; left: 6px; width: 16px; height: 16px; border-radius: 999px;
	background: var(--mw-outline); transform: translateY(-50%); transition: left .2s, width .2s, height .2s, background .2s;
}
.mw-switch input:checked + .mw-switch__track { background: var(--mw-primary); border-color: var(--mw-primary); }
.mw-switch input:checked + .mw-switch__track::after { left: 24px; width: 24px; height: 24px; background: var(--mw-on-primary); }
.mw-switch input:disabled + .mw-switch__track { opacity: .5; }

/* halves and argument lists */
.mw-half__head { display: flex; gap: 12px; align-items: baseline; justify-content: space-between; flex-wrap: wrap; margin-bottom: 12px; }
.mw-columns { display: grid; gap: 12px; grid-template-columns: 1fr; }
@container (min-width: 620px) { .mw-columns { grid-template-columns: 1fr 1fr; } }
.mw-column { border-radius: 12px; padding: 14px 16px; background: var(--mw-surface-low); display: flex; flex-direction: column; gap: 10px; }
.mw-column__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mw-column__title { font-weight: 700; display: flex; align-items: center; gap: 8px; }
.mw-dot { width: 10px; height: 10px; border-radius: 999px; flex: none; }
.mw-dot--pro { background: var(--mw-primary); }
.mw-dot--contra { background: var(--mw-contra); }
.mw-side { font-size: 11px; font-weight: 700; letter-spacing: .05em; border-radius: 6px; padding: 1px 6px; }
.mw-side--pro { background: var(--mw-primary-soft); color: var(--mw-primary); }
.mw-side--contra { background: var(--mw-contra-soft); color: var(--mw-contra); }
.mw-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.mw-item {
	display: flex; gap: 10px; align-items: flex-start; background: var(--mw-surface);
	border: 1px solid var(--mw-outline-soft); border-radius: 10px; padding: 10px 12px;
	animation: mw-in .25s ease-out;
}
.mw-item--editing { border-color: var(--mw-primary); box-shadow: 0 0 0 1px var(--mw-primary); }
.mw-item__text { flex: 1; min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.mw-item__meta { display: flex; align-items: center; gap: 2px; flex: none; }
.mw-empty { color: var(--mw-muted); font-size: 14px; }
.mw-confirm { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 14px; }
.mw-confirm--box { padding: 12px 14px; border-radius: 12px; background: var(--mw-surface-low); border: 1px solid var(--mw-outline-soft); }
@keyframes mw-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

.mw-stars { display: inline-flex; gap: 1px; align-items: center; color: #e0a100; }
.mw-stars svg { width: 16px; height: 16px; fill: currentColor; }
.mw-stars .mw-star--off { fill: var(--mw-outline-soft); }
.mw-stars--zero { color: var(--mw-muted); font-size: 12px; font-weight: 600; }

/* editor */
.mw-back { align-self: flex-start; }
.mw-seg { display: inline-flex; border: 1px solid var(--mw-outline); border-radius: 999px; overflow: hidden; }
.mw-seg button {
	font: inherit; font-weight: 600; font-size: 14px; border: 0; background: transparent; color: var(--mw-text);
	padding: 8px 18px; min-height: 40px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center;
}
.mw-seg button + button { border-left: 1px solid var(--mw-outline); }
.mw-seg button[aria-pressed="true"] { background: var(--mw-primary-soft); color: var(--mw-primary); }
.mw-seg svg { width: 16px; height: 16px; fill: currentColor; }
.mw-field { display: flex; flex-direction: column; gap: 6px; }
.mw-label { font-weight: 600; }
.mw-textarea {
	width: 100%; min-height: 92px; padding: 12px 14px; border-radius: 12px; resize: vertical;
	border: 1px solid var(--mw-outline); background: var(--mw-surface); color: inherit; font: inherit;
}
.mw-textarea:focus { outline: none; border-color: var(--mw-primary); box-shadow: 0 0 0 1px var(--mw-primary); }
.mw-counter { align-self: flex-end; font-size: 12px; color: var(--mw-muted); }
.mw-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.mw-chip {
	font: inherit; font-size: 13px; text-align: left; border: 1px solid var(--mw-outline-soft); background: var(--mw-surface);
	color: var(--mw-text); border-radius: 8px; padding: 6px 12px; cursor: pointer;
}
.mw-chip:hover { border-color: var(--mw-primary); background: var(--mw-primary-soft); }
.mw-ratings { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
@container (min-width: 620px) { .mw-ratings { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.mw-rating { position: relative; cursor: pointer; }
.mw-rating input { position: absolute; opacity: 0; }
.mw-rating > span {
	display: flex; flex-direction: column; gap: 4px; align-items: center; text-align: center;
	border: 1px solid var(--mw-outline-soft); border-radius: 12px; padding: 10px 8px; font-size: 14px; font-weight: 600;
	background: var(--mw-surface); transition: border-color .15s, background .15s;
}
.mw-rating:hover > span { border-color: var(--mw-outline); }
.mw-rating input:checked + span { border-color: var(--mw-primary); background: var(--mw-primary-soft); box-shadow: 0 0 0 1px var(--mw-primary); }
.mw-mini { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.mw-mini__bar { position: relative; flex: 1; min-width: 160px; height: 8px; border-radius: 999px;
	background: linear-gradient(90deg, var(--mw-contra) 0%, var(--mw-surface-high) 50%, var(--mw-primary) 100%); }
.mw-mini__dot { position: absolute; top: 50%; width: 18px; height: 18px; border-radius: 999px; background: var(--mw-surface);
	border: 3px solid var(--mw-text); transform: translate(-50%, -50%); transition: left .6s cubic-bezier(.34,1.36,.5,1); }
.mw-saving { font-size: 13px; color: var(--mw-muted); display: inline-flex; gap: 6px; align-items: center; }
.mw-saving svg { width: 16px; height: 16px; fill: var(--mw-success); }
.mw-conclusion { white-space: pre-wrap; overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) {
	.mw-scale .mw-beam, .mw-scale .mw-pan, .mw-scale .mw-needle, .mw-mini__dot, .mw-item { transition: none; animation: none; }
}
`;

const STYLE_ID = 'oriso-addon-motivationswaage-styles';

export const installStyles = (doc = globalThis.document) => {
	if (!doc || doc.getElementById(STYLE_ID)) {
		return;
	}
	const style = doc.createElement('style');
	style.id = STYLE_ID;
	style.textContent = CSS;
	doc.head.appendChild(style);
};
