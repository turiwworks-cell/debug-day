import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DDbudgetOf, DDbudgetRange, DDbudgetUsed, DDbudgetText, DDbudgetLabel, DDbudgetSame, DDbudgetPresets, DDgoalClean, DDgoalText, DDgoalDaysLeft } from '../public/budgets.js';
import { DDnormalizeLife } from '../public/life-board.js';

test('a soft budget is only a number, a unit and a period', () => {
  assert.deepEqual(DDbudgetOf({ budget: { n: '6', unit: 'h', per: 'week', color: 'red' } }), { n: 6, unit: 'h', per: 'week' });
  assert.equal(DDbudgetOf({ budget: { n: 0, unit: 'h', per: 'week' } }), null);
  assert.equal(DDbudgetOf({ budget: { n: 3, unit: 'pages', per: 'week' } }), null);
  assert.equal(DDbudgetOf({}), null);
  assert.ok(DDbudgetSame({ n: 1, unit: 'h', per: 'day' }, DDbudgetPresets[0]));
  for (const b of DDbudgetPresets) assert.deepEqual(DDbudgetOf({ budget: b }), b);
});

test('the week starts on Saturday in Persian and Monday in English', () => {
  assert.deepEqual(DDbudgetRange('2026-11-04', 'week', 'en'), ['2026-11-02', '2026-11-03', '2026-11-04']);
  assert.deepEqual(DDbudgetRange('2026-11-04', 'week', 'fa'), ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
  assert.deepEqual(DDbudgetRange('2026-11-02', 'week', 'en'), ['2026-11-02']);
  assert.deepEqual(DDbudgetRange('2026-11-04', 'day', 'en'), ['2026-11-04']);
  assert.deepEqual(DDbudgetRange('nope', 'week', 'en'), []);
});

test('a budget adds up done tasks from the section and the sections inside it', () => {
  const items = [
    { id: 'art', type: 'section', parent: '' },
    { id: 'ink', type: 'section', parent: 'art' },
    { id: 'other', type: 'section', parent: '' },
  ];
  const days = {
    '2026-11-01': { blocks: [{ id: 'old', from: 'art', done: true, min: 120 }] },
    '2026-11-02': { blocks: [{ id: 'a', from: 'ink', done: true, min: 45 }, { id: 'b', from: 'art', done: false, min: 60 }] },
    '2026-11-04': { blocks: [{ id: 'c', from: 'art', done: true, min: 30 }, { id: 'd', from: 'other', done: true, min: 90 }, { id: 'e', from: 'art', done: true, measure: 'count', times: 3, count: 3 }] },
  };
  const hours = { n: 2, unit: 'h', per: 'week' }, times = { n: 3, unit: 'tasks', per: 'week' };
  assert.equal(DDbudgetUsed(days, items, 'art', '2026-11-04', hours, 'en'), 75, 'Monday to today; a count task has no minutes');
  assert.equal(DDbudgetUsed(days, items, 'art', '2026-11-04', hours, 'fa'), 195, 'the Persian week starts on Saturday');
  assert.equal(DDbudgetUsed(days, items, 'art', '2026-11-04', times, 'en'), 3);
  assert.equal(DDbudgetUsed(days, items, 'ink', '2026-11-04', times, 'en'), 1, 'a small section counts only its own');
  assert.equal(DDbudgetUsed(days, items, 'art', '2026-11-04', { n: 1, unit: 'h', per: 'day' }, 'en'), 30);
  assert.equal(DDbudgetUsed(days, items, 'art', '2026-11-04', null, 'en'), 0);
});

test('budget words are short and calm', () => {
  assert.equal(DDbudgetText({ n: 6, unit: 'h', per: 'week' }, 90, 'en'), '1h 30m / 6h · week');
  assert.equal(DDbudgetText({ n: 1, unit: 'h', per: 'day' }, 0, 'en'), '0m / 1h · today');
  assert.equal(DDbudgetText({ n: 3, unit: 'tasks', per: 'week' }, 2, 'en'), '2 / 3 · week');
  assert.equal(DDbudgetText({ n: 3, unit: 'tasks', per: 'week' }, 2, 'fa'), '۲ / ۳ · این هفته');
  assert.equal(DDbudgetLabel({ n: 6, unit: 'h', per: 'week' }, 'en'), '6h a week');
  assert.equal(DDbudgetLabel({ n: 1, unit: 'tasks', per: 'week' }, 'en'), 'Once a week');
  assert.equal(DDbudgetLabel({ n: 3, unit: 'tasks', per: 'week' }, 'fa'), 'هفته‌ای ۳ بار');
  assert.equal(DDbudgetLabel({ n: 2, unit: 'h', per: 'day' }, 'fa'), 'روزی ۲ ساعت');
});

test('a goal counts up toward a number by a date', () => {
  assert.deepEqual(DDgoalClean({ n: '12', of: 35, until: '2026-11-13', extra: 1 }), { n: 12, of: 35, until: '2026-11-13' });
  assert.equal(DDgoalClean({ n: 0, of: 0 }), undefined, 'an empty goal is not stored');
  assert.deepEqual(DDgoalClean({ n: -4, of: 20000 }), { n: 0, of: 9999 });
  assert.equal(DDgoalDaysLeft({ until: '2026-11-13' }, '2026-11-04'), 9);
  assert.equal(DDgoalText({ n: 12, of: 35, until: '2026-11-13' }, '2026-11-04', 'en'), '12 of 35 · 9 days left');
  assert.equal(DDgoalText({ n: 12, of: 35, until: '2026-11-04' }, '2026-11-04', 'en'), '12 of 35 · today');
  assert.equal(DDgoalText({ n: 12, of: 35, until: '2026-11-01' }, '2026-11-04', 'en'), '12 of 35 · date passed');
  assert.equal(DDgoalText({ n: 5, of: 0 }, '2026-11-04', 'en'), '5');
  assert.equal(DDgoalText({ n: 12, of: 35 }, '2026-11-04', 'fa'), '۱۲ از ۳۵');
});

test('the Feed keeps a section budget and a note goal, and nothing else new', () => {
  const life = DDnormalizeLife({ v: 2, items: [
    { id: 's', type: 'section', parent: '', text: 'Drawing', x: 0, y: 0, w: 400, h: 300, budget: { n: 6, unit: 'h', per: 'week', junk: true }, goal: { n: 3 } },
    { id: 'g', type: 'sticky', parent: '', text: '35 drawings', x: 0, y: 0, w: 200, h: 200, role: 'goal', goal: { n: 3, of: 35 }, budget: { n: 1, unit: 'h', per: 'day' } },
    { id: 'e', type: 'sticky', parent: '', text: 'plain', x: 0, y: 0, w: 200, h: 200, goal: { n: 0, of: 0 } },
  ], links: [] });
  const by = Object.fromEntries(life.items.map((i) => [i.id, i]));
  assert.deepEqual(by.s.budget, { n: 6, unit: 'h', per: 'week' });
  assert.equal('goal' in by.s, false);
  assert.deepEqual(by.g.goal, { n: 3, of: 35 });
  assert.equal('budget' in by.g, false);
  assert.equal('goal' in by.e, false);
});
