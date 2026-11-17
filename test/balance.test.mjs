import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, cleanBalance, diffBalance, formatValue, polesOf, tendency } from '../src/balance.mjs';

/** Arguments giving the wanted PRO and CONTRA sums (ratings of 3, then the rest). */
const withSums = (pro, contra) => {
	const args = [];
	const add = (category, points) => {
		for (; points > 0; points -= Math.min(3, points)) {
			args.push({ category, rating: Math.min(3, points) });
		}
	};
	add('A', pro);
	add('B', contra);
	return args;
};

describe('calculation (tool description 2.4.5)', () => {
	it('matches the worked examples', () => {
		const examples = [
			[12, 0, '+10,0', 'Maximale PRO-Tendenz'],
			[15, 5, '+5,0', 'PRO-Tendenz'],
			[20, 15, '+1,4', 'Leichte PRO-Tendenz'],
			[10, 10, '0,0', 'Ausgeglichen'],
			[5, 15, '−5,0', 'CONTRA-Tendenz'],
			[0, 12, '−10,0', 'Maximale CONTRA-Tendenz']
		];
		for (const [pro, contra, shown, reading] of examples) {
			const result = calculate(withSums(pro, contra));
			assert.equal(result.pro, pro);
			assert.equal(result.contra, contra);
			assert.equal(formatValue(result.value), shown, `${pro}/${contra}`);
			assert.equal(tendency(result.value), reading, `${pro}/${contra}`);
		}
	});

	it('uses the ratio, not the number of arguments', () => {
		assert.equal(calculate(withSums(3, 1)).value, calculate(withSums(30, 10)).value);
		assert.equal(calculate(withSums(3, 1)).value, 5);
	});

	it('counts disadvantages of no change as PRO and advantages of no change as CONTRA', () => {
		const result = calculate([
			{ category: 'A', rating: 1 },
			{ category: 'B', rating: 2 },
			{ category: 'C', rating: 3 },
			{ category: 'D', rating: 2 }
		]);
		assert.deepEqual(result, { pro: 3, contra: 5, raw: -2, value: -2.5 });
	});

	it('stays inactive without points, also when all arguments are rated 0', () => {
		assert.equal(calculate([]).value, null);
		assert.equal(calculate([{ category: 'A', rating: 0 }, { category: 'C', rating: 0 }]).value, null);
		assert.equal(formatValue(null), '–');
	});

	it('rounds only for display', () => {
		const result = calculate(withSums(20, 15));
		assert.ok(Math.abs(result.value - 10 / 7) < 1e-12);
	});
});

describe('input', () => {
	let n = 0;
	const makeId = () => `new${++n}`;

	it('keeps known fields, trims texts and creates missing ids', () => {
		const clean = cleanBalance(
			{
				arguments: [
					{ id: 'a1', category: 'A', text: '  Mehr Geld ', rating: 3, extra: 1 },
					{ category: 'D', text: 'Schulden', rating: 0 },
					{ id: 'a1', category: 'B', text: 'doppelt', rating: 1 }
				],
				conclusion: ' Fazit ',
				other: true
			},
			makeId
		);
		assert.deepEqual(clean, {
			arguments: [
				{ id: 'a1', category: 'A', text: 'Mehr Geld', rating: 3 },
				{ id: 'new1', category: 'D', text: 'Schulden', rating: 0 },
				{ id: 'new2', category: 'B', text: 'doppelt', rating: 1 }
			],
			conclusion: 'Fazit'
		});
	});

	it('rejects unknown categories, missing ratings and empty texts', () => {
		for (const arg of [
			{ category: 'E', text: 'x', rating: 1 },
			{ category: 'A', text: 'x' },
			{ category: 'A', text: 'x', rating: 4 },
			{ category: 'A', text: '  ', rating: 1 },
			{ category: 'A', text: 'x'.repeat(501), rating: 1 }
		]) {
			assert.throws(() => cleanBalance({ arguments: [arg] }, makeId), { status: 400 });
		}
		assert.throws(() => cleanBalance([], makeId), { status: 400 });
	});

	it('tells added from changed arguments', () => {
		const before = { arguments: [{ id: 'a', category: 'A', text: 'x', rating: 1 }], conclusion: '' };
		assert.deepEqual(
			diffBalance(before, {
				arguments: [
					{ id: 'a', category: 'A', text: 'x', rating: 2 },
					{ id: 'b', category: 'C', text: 'y', rating: 1 }
				],
				conclusion: ''
			}),
			{ added: 1, changed: 1, removed: 0 }
		);
		assert.deepEqual(diffBalance(before, { arguments: [], conclusion: 'neu' }), { added: 0, changed: 1, removed: 1 });
	});

	it('falls back to the first pole variant', () => {
		assert.deepEqual(polesOf('unbekannt'), { contra: 'CONTRA Veränderung', pro: 'PRO Veränderung' });
		assert.deepEqual(polesOf('gut so, wie es ist / es muss sich was ändern!'), {
			contra: 'gut so, wie es ist',
			pro: 'es muss sich was ändern!'
		});
	});
});
