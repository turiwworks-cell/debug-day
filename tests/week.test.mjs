import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { DDenergyOf, DDsetEnergy, DDenergyLabel, DDlowDay, DDlightTasks, DDlightFirst } from '../public/energy.js';
import { DDdueClean, DDdueSet, DDdueText, DDdueDaysLeft, DDdueBetween, DDdueOn, DDduePresets, DDdueName } from '../public/deadlines.js';
import { DDweekStart, DDweekDays, DDweekLabel, DDdaySections, DDreviewsClean, DDweekFocus, DDsetWeekFocus, DDweekSummary } from '../public/calendar-week.js';
import { DDnormalizeLife, DDlifeAdd } from '../public/life-board.js';

const task = (id, extra = {}) => ({ id, name: 'Task ' + id, type: 'writing', lane: 'work', min: 60, done: false, subtasks: [], ...extra });
const feed = () => DDnormalizeLife({ v: 2, items: [
  { id: 'jobs', type: 'section', parent: '', x: 0, y: 0, w: 600, h: 400, text: 'Client work', color: '#9DD6FF', due: '2026-11-12', budget: { n: 10, unit: 'h', per: 'week' } },
  { id: 'art', type: 'section', parent: '', x: 700, y: 0, w: 600, h: 400, text: 'Personal art', color: '#FFC48A' },
  { id: 'fox', type: 'sticky', parent: 'jobs', x: 10, y: 50, w: 200, h: 200, text: '- [ ] Deliver fox loop\nmore', due: '2026-11-06' },
  { id: 'reels', type: 'sticky', parent: 'art', x: 10, y: 50, w: 200, h: 200, text: 'Post 35 reels', role: 'goal', goal: { n: 12, of: 35, until: '2026-11-24' } },
  { id: 'bad', type: 'sticky', parent: '', x: 10, y: 50, w: 200, h: 200, text: 'Bad date', due: '2026-02-31' },
], links: [] });

test('a task can be light or heavy, and a tired day points to the light ones', () => {
  assert.equal(DDenergyOf({ energy: 'light' }), 'light');
  assert.equal(DDenergyOf({ energy: 'loud' }), '');
  assert.deepEqual(DDsetEnergy({ id: 'a', energy: 'heavy' }, ''), { id: 'a' });
  assert.deepEqual(DDsetEnergy({ id: 'a' }, 'heavy'), { id: 'a', energy: 'heavy' });
  assert.equal(DDenergyLabel('light', 'fa'), 'سبک');
  assert.equal(DDenergyLabel('heavy', 'en'), 'heavy');
  const day = { mood: '😕', blocks: [task('a', { energy: 'heavy' }), task('b'), task('c', { energy: 'light' }), task('d', { energy: 'light', done: true })] };
  assert.equal(DDlowDay(day), true);
  assert.equal(DDlowDay({ mood: '🙂' }), false);
  assert.deepEqual(DDlightTasks(day).map((b) => b.id), ['c']);
  assert.deepEqual(DDlightFirst(day).blocks.map((b) => b.id), ['c', 'a', 'b', 'd'], 'light ones first, the rest keep their order');
});

test('the planner keeps light and heavy on tasks, and deadlines and the week focus in its data', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /if\(Z\.energy==="light"\|\|Z\.energy==="heavy"\)X\.energy=Z\.energy;/);
  assert.match(html, /DDreviewsClean\(Z\.reviews\)\?\{reviews:DDreviewsClean\(Z\.reviews\)\}:\{\}/);
  assert.match(html, /"data-energy-row":true/);
  const fn = html.match(/function Ve\(at\).*?(?=var He=)/s)[0], c = { L: (v) => (typeof v === 'string' ? v : ''), C: () => 'id', Ie: Number.isFinite, Le: /^#[a-f0-9]{6}$/i, we: ['#FFE299'], DDtags: () => [], DDmediaList: () => [], DDgoalClean: () => undefined, DDdueClean };
  runInNewContext(fn + ';this.note=Ve;', c);
  assert.equal(c.note({ kind: 'sticky', text: 'x', due: '2026-11-20' }).due, '2026-11-20', 'a note on a day keeps its deadline');
  assert.equal(c.note({ kind: 'sticky', text: 'x', due: 'soon' }).due, undefined);
});

test('a Feed note or section keeps a deadline; a wrong date is dropped', () => {
  const items = feed().items;
  assert.equal(items.find((i) => i.id === 'jobs').due, '2026-11-12');
  assert.equal(items.find((i) => i.id === 'fox').due, '2026-11-06');
  assert.equal(items.find((i) => i.id === 'bad').due, undefined);
  assert.equal(DDdueClean('2026-13-01'), undefined);
  assert.deepEqual(DDdueSet({ id: 'a', due: '2026-11-06' }, null), { id: 'a' });
  assert.deepEqual(DDdueSet({ id: 'a' }, '2026-11-09'), { id: 'a', due: '2026-11-09' });
  // Moving a note into a section keeps its goal and its deadline.
  const added = DDlifeAdd(items, { id: 'n', type: 'sticky', parent: 'art', text: 'n', goal: { n: 1, of: 3 }, due: '2026-12-01', x: 0, y: 0 }).find((i) => i.id === 'n');
  assert.deepEqual(added.goal, { n: 1, of: 3 });
  assert.equal(added.due, '2026-12-01');
});

test('a deadline reads as days left, softly, never as a warning', () => {
  assert.equal(DDdueDaysLeft('2026-11-12', '2026-11-04'), 8);
  assert.equal(DDdueText('2026-11-12', '2026-11-04', 'en'), '8 days left');
  assert.equal(DDdueText('2026-11-05', '2026-11-04', 'en'), 'tomorrow');
  assert.equal(DDdueText('2026-11-04', '2026-11-04', 'en'), 'today');
  assert.equal(DDdueText('2026-11-01', '2026-11-04', 'en'), 'date passed');
  assert.equal(DDdueText('2026-11-12', '2026-11-04', 'fa'), '۸ روز مانده');
  assert.deepEqual(DDduePresets('2026-11-04', 'en').map((p) => p.date), ['2026-11-07', '2026-11-11', '2026-11-18', '2026-12-04']);
  const items = feed().items;
  assert.deepEqual(DDdueBetween(items, '2026-11-01', '2026-11-30').map((i) => i.id), ['fox', 'jobs']);
  assert.deepEqual(DDdueOn(items, '2026-11-06').map((i) => i.id), ['fox']);
  assert.equal(DDdueName(items.find((i) => i.id === 'fox'), 'en'), 'Deliver fox loop');
});

test('the week starts on Monday in English and on Saturday in Persian', () => {
  assert.equal(DDweekStart('2026-11-04', 'en'), '2026-11-02');
  assert.equal(DDweekStart('2026-11-04', 'fa'), '2026-10-31');
  assert.deepEqual(DDweekDays('2026-11-08', 'en'), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.equal(DDweekLabel('2026-11-04', 'en'), '2 – 8 Nov');
  assert.equal(DDweekLabel('2026-10-28', 'en'), '26 Oct – 1 Nov');
});

test('each day shows the colors of the sections its tasks came from', () => {
  const items = feed().items,
    rows = DDdaySections({ blocks: [task('a', { from: 'jobs', min: 120 }), task('b', { from: 'art', done: true }), task('c', { from: 'jobs', min: 30, done: true }), task('d'), task('e', { from: 'gone' })] }, items);
  assert.deepEqual(rows.map((r) => [r.id, r.color, r.minutes, r.tasks, r.done]), [['jobs', '#9DD6FF', 150, 2, 1], ['art', '#FFC48A', 60, 1, 1]]);
});

test('the week focus is one line per week, kept small', () => {
  assert.equal(DDreviewsClean(null), undefined);
  assert.deepEqual(DDreviewsClean({ '2026-11-09': { focus: 'Finish the fox' }, '2026-11-02': { focus: '  ' }, nope: { focus: 'x' } }), { '2026-11-09': { focus: 'Finish the fox' } });
  let data = { setup: { lanes: [] }, days: {} };
  data = DDsetWeekFocus(data, '2026-11-09', 'Finish the fox');
  assert.equal(DDweekFocus(data.setup, '2026-11-12', 'en'), 'Finish the fox');
  data = DDsetWeekFocus(data, '2026-11-09', '');
  assert.equal('reviews' in data.setup, false, 'an empty focus leaves nothing behind');
});

test('the weekly look back adds up the week without scoring it', () => {
  const life = feed(),
    data = { setup: { life, lanes: [{ id: 'work' }], types: [{ id: 'writing', color: '#E0A800' }] }, days: {
      '2026-11-02': { mood: '🙂', blocks: [task('a', { from: 'jobs', min: 120, done: true, energy: 'heavy' }), task('b', { done: true, energy: 'light', min: 30 })] },
      '2026-11-04': { mood: '😕', blocks: [task('c', { from: 'art', min: 60, done: true }), task('d', { from: 'jobs' })] },
      '2026-11-10': { blocks: [task('e', { done: true })] },
    } },
    s = DDweekSummary(data, '2026-11-04', '2026-11-04', 'en');
  assert.equal(s.planned, 4);
  assert.equal(s.done, 3);
  assert.equal(s.doneMinutes, 210);
  assert.deepEqual([s.light, s.heavy], [1, 1]);
  assert.deepEqual(s.sections.map((r) => [r.id, r.minutes]), [['jobs', 120], ['art', 60], ['', 30]]);
  assert.equal(s.sections[0].budget, '2h / 10h · week');
  assert.deepEqual(s.goals, [{ id: 'reels', name: 'Post 35 reels', text: '12 of 35 · 20 days left' }]);
  assert.deepEqual(s.due.map((d) => [d.id, d.due]), [['fox', '2026-11-06'], ['jobs', '2026-11-12']]);
  assert.deepEqual(s.moods.map((m) => m.mood), ['🙂', '', '😕', '', '', '', '']);
});
