// The scale: a beam that tips towards the heavier side and a dial whose needle shows the value
// (−10 … +10). Left pan PRO, right pan CONTRA, as in the tool description's figure; inactive
// (level, no needle) without a value.
const { react: React } = globalThis.__ORISO_ADDON_SHARED__;
const h = React.createElement;

const PIVOT = { x: 320, y: 70 };
const HALF_BEAM = 210;
const MAX_TILT = 12;
const DIAL = { x: 320, y: 300, r: 62 };

const pan = (key, x, y, { side, points, label, active }) =>
	h(
		'g',
		{ key, className: 'mw-pan', style: { transform: `translate(${x}px, ${y}px)` } },
		h('path', {
			d: 'M0 0 L-66 98 M0 0 L66 98',
			stroke: 'var(--mw-muted)',
			strokeWidth: 2,
			fill: 'none',
			strokeLinecap: 'round'
		}),
		h('circle', { r: 6, fill: 'var(--mw-muted)' }),
		h('path', {
			d: 'M-80 98 Q0 156 80 98 Z',
			fill: `var(--mw-${side}-soft)`,
			stroke: `var(--mw-${side === 'pro' ? 'primary' : 'contra'})`,
			strokeWidth: 3,
			strokeLinejoin: 'round'
		}),
		active &&
			h(
				'text',
				{
					y: 122,
					textAnchor: 'middle',
					fontSize: 20,
					fontWeight: 700,
					fill: `var(--mw-${side === 'pro' ? 'primary' : 'contra'})`
				},
				String(points)
			),
		h('text', { y: 158, textAnchor: 'middle', fontSize: 15, fontWeight: 700, fill: 'var(--mw-text)' }, label)
	);

const tick = (value, length) => {
	const angle = ((value / 10) * 90 - 90) * (Math.PI / 180);
	const outer = DIAL.r - 6;
	return {
		x1: DIAL.x + Math.cos(angle) * outer,
		y1: DIAL.y + Math.sin(angle) * outer,
		x2: DIAL.x + Math.cos(angle) * (outer - length),
		y2: DIAL.y + Math.sin(angle) * (outer - length)
	};
};

/**
 * `result` is `calculate(...)` of balance.mjs; `poles` the labels `{ contra, pro }`.
 */
export function Scale({ result, poles, title }) {
	const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
	const active = result.value !== null;
	const value = active ? result.value : 0;
	// PRO is on the left: a positive value lowers the left pan and turns the needle left.
	const tilt = -(value / 10) * MAX_TILT;
	const radians = (tilt * Math.PI) / 180;
	const dx = Math.cos(radians) * HALF_BEAM;
	const dy = Math.sin(radians) * HALF_BEAM;
	const arcStart = { x: DIAL.x - DIAL.r + 6, y: DIAL.y };
	const arcEnd = { x: DIAL.x + DIAL.r - 6, y: DIAL.y };

	return h(
		'svg',
		{ viewBox: '0 6 640 334', role: 'img', 'aria-label': title },
		h(
			'defs',
			null,
			h(
				'linearGradient',
				{ id: `${id}-dial`, x1: 0, x2: 1, y1: 0, y2: 0 },
				h('stop', { offset: '0%', stopColor: 'var(--mw-primary)' }),
				h('stop', { offset: '50%', stopColor: 'var(--mw-surface-high)' }),
				h('stop', { offset: '100%', stopColor: 'var(--mw-contra)' })
			)
		),
		// stand
		h('ellipse', { cx: 320, cy: 334, rx: 150, ry: 6, fill: 'var(--mw-outline-soft)' }),
		h('path', { d: 'M236 330 L404 330 L382 306 L258 306 Z', fill: 'var(--mw-muted)' }),
		h('rect', { x: 313, y: PIVOT.y, width: 14, height: 240, rx: 4, fill: 'var(--mw-muted)' }),
		h('circle', { cx: PIVOT.x, cy: PIVOT.y - 22, r: 11, fill: 'var(--mw-muted)' }),
		// beam
		h(
			'g',
			{
				className: 'mw-beam',
				style: { transform: `rotate(${tilt}deg)`, transformOrigin: `${PIVOT.x}px ${PIVOT.y}px` }
			},
			h('rect', {
				x: PIVOT.x - HALF_BEAM - 6,
				y: PIVOT.y - 6,
				width: 2 * HALF_BEAM + 12,
				height: 12,
				rx: 6,
				fill: 'var(--mw-text)'
			})
		),
		h('circle', { cx: PIVOT.x, cy: PIVOT.y, r: 10, fill: 'var(--mw-surface)', stroke: 'var(--mw-text)', strokeWidth: 4 }),
		pan('pro', PIVOT.x - dx, PIVOT.y - dy, { side: 'pro', points: result.pro, label: poles.pro, active }),
		pan('contra', PIVOT.x + dx, PIVOT.y + dy, { side: 'contra', points: result.contra, label: poles.contra, active }),
		// dial
		h('path', {
			d: `M${DIAL.x - DIAL.r} ${DIAL.y} A${DIAL.r} ${DIAL.r} 0 0 1 ${DIAL.x + DIAL.r} ${DIAL.y} Z`,
			fill: 'var(--mw-surface)',
			stroke: 'var(--mw-muted)',
			strokeWidth: 3
		}),
		h('path', {
			d: `M${arcStart.x} ${arcStart.y} A${DIAL.r - 6} ${DIAL.r - 6} 0 0 1 ${arcEnd.x} ${arcEnd.y}`,
			fill: 'none',
			stroke: `url(#${id}-dial)`,
			strokeWidth: 7,
			strokeLinecap: 'round'
		}),
		h('text', { x: DIAL.x - DIAL.r - 8, y: DIAL.y - 4, textAnchor: 'end', fontSize: 13, fontWeight: 700, fill: 'var(--mw-primary)' }, 'PRO'),
		h('text', { x: DIAL.x + DIAL.r + 8, y: DIAL.y - 4, textAnchor: 'start', fontSize: 13, fontWeight: 700, fill: 'var(--mw-contra)' }, 'CONTRA'),
		...[-10, -5, 0, 5, 10].map((v) =>
			h('line', { key: v, ...tick(v, v === 0 ? 14 : 9), stroke: 'var(--mw-text)', strokeWidth: 2, strokeLinecap: 'round' })
		),
		active &&
			h(
				'g',
				{
					className: 'mw-needle',
					style: { transform: `rotate(${-(value / 10) * 90}deg)`, transformOrigin: `${DIAL.x}px ${DIAL.y}px` }
				},
				h('path', {
					d: `M${DIAL.x - 3.5} ${DIAL.y} L${DIAL.x} ${DIAL.y - DIAL.r + 12} L${DIAL.x + 3.5} ${DIAL.y} Z`,
					fill: 'var(--mw-text)'
				})
			),
		h('circle', { cx: DIAL.x, cy: DIAL.y, r: 6, fill: 'var(--mw-text)' })
	);
}
