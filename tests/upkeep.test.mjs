import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DDtrashAdd, DDtrashClean, DDtrashRestore, DDtrashLabel } from '../public/trash.js';
import { DDnormalizeLife } from '../public/life-board.js';
import { DDcanvasTidy, DDsyncAgo, DDstorageText, DDstorageBytes } from '../public/upkeep.js';
import { DDdayLoad, DDdayFull, DDmoveCandidate } from '../public/nudges.js';

const NOW = Date.parse('2026-11-04T10:00:00Z');
const feed = () => DDnormalizeLife({ v: 2, items: [
  { id: 'jobs', type: 'section', parent: '', x: 100, y: 50, w: 600, h: 400, text: 'Jobs' },
  { id: 'ideas', type: 'section', parent: 'jobs', x: 20, y: 60, w: 300, h: 300, text: 'Ideas\nmore' },
  { id: 'a', type: 'sticky', parent: 'ideas', x: 10, y: 40, w: 200, h: 200, text: '- [ ] Fox poses' },
  { id: 'b', type: 'sticky', parent: 'ideas', x: 10, y: 260, w: 200, h: 200, text: 'Owl' },
  { id: 'c', type: 'sticky', parent: '', x: 900, y: 50, w: 200, h: 200, text: 'Keep me' },
], links: [{ id: 'l1', from: 'life:a', to: 'life:c' }, { id: 'l2', from: 'life:a', to: 'life:b' }] });

test('deleting from the Feed keeps a copy in Recently deleted, and it comes back where it was', () => {
  const before = feed(), after = { ...before, items: before.items.filter((i) => !['ideas', 'a', 'b'].includes(i.id)), links: [] };
  const withTrash = DDtrashAdd(before, after, (id) => (id === 'ideas' ? { x: 120, y: 110 } : null), NOW, () => 't1');
  assert.equal(withTrash.trash.length, 1);
  const entry = withTrash.trash[0];
  assert.deepEqual(entry.items.map((i) => i.id), ['ideas', 'a', 'b']);
  assert.deepEqual(entry.home, { ideas: 'jobs' });
  assert.deepEqual(entry.links.map((l) => l.id), ['l1', 'l2']);
  assert.equal(DDtrashLabel(entry, NOW + 3 * 864e5, 'en'), 'Ideas + 2 more · 3 days ago');
  assert.equal(DDtrashLabel(entry, NOW + 6e4, 'en'), 'Ideas + 2 more · just now');
  assert.equal(DDtrashLabel(entry, NOW + 864e5, 'fa'), 'Ideas + ۲ تای دیگر · دیروز');
  // It survives the Feed normalizer, and restoring puts it back inside Jobs.
  const saved = DDnormalizeLife(JSON.parse(JSON.stringify(withTrash)));
  assert.equal(saved.trash.length, 1);
  assert.deepEqual(saved.trash[0].home, { ideas: 'jobs' });
  const back = DDnormalizeLife(DDtrashRestore(saved, 't1'));
  assert.deepEqual(back.items.map((i) => i.id).sort(), ['a', 'b', 'c', 'ideas', 'jobs']);
  assert.equal(back.items.find((i) => i.id === 'ideas').parent, 'jobs');
  assert.equal(back.items.find((i) => i.id === 'a').parent, 'ideas');
  assert.deepEqual(back.links.map((l) => l.id).sort(), ['l1', 'l2']);
  assert.equal('trash' in back, false, 'the entry leaves the list');
});

test('a restore whose section is gone lands at the same place on the Feed', () => {
  const before = feed(), after = { ...before, items: before.items.filter((i) => i.id !== 'a'), links: [] };
  const t = DDtrashAdd(before, after, () => ({ x: 130, y: 150 }), NOW, () => 't2');
  const noSection = { ...t, items: t.items.filter((i) => !['ideas', 'b'].includes(i.id)) };
  const back = DDtrashRestore(noSection, 't2'), a = back.items.find((i) => i.id === 'a');
  assert.equal(a.parent, '');
  assert.deepEqual([a.x, a.y], [130, 150]);
  assert.deepEqual(back.links.map((l) => l.id), ['l1'], 'only links whose both ends exist come back');
});

test('Recently deleted keeps 30 days and stays small', () => {
  const clean = (items) => DDnormalizeLife({ items }).items, item = { id: 'n', type: 'sticky', text: 'x' };
  const list = [
    { id: 'new', at: '2026-11-03T10:00:00Z', items: [item] },
    { id: 'old', at: '2026-09-01T10:00:00Z', items: [item] },
    { id: 'bad id!', at: '2026-11-03T10:00:00Z', items: [item] },
    { id: 'empty', at: '2026-11-03T10:00:00Z', items: [] },
  ];
  assert.deepEqual(DDtrashClean(list, clean, NOW).map((e) => e.id), ['new']);
  const big = Array.from({ length: 80 }, (_, i) => ({ id: 'e' + i, at: new Date(NOW - i * 6e4).toISOString(), items: [{ ...item, text: 'x'.repeat(3000) }] }));
  const kept = DDtrashClean(big, clean, NOW);
  assert.ok(kept.length <= 50 && JSON.stringify(kept).length <= 150000);
  assert.equal(kept[0].id, 'e0', 'newest first');
  const same = feed();
  assert.equal(DDtrashAdd(feed(), same), same, 'nothing deleted, nothing added');
});

test('a day keeps no copy of Feed places', () => {
  const canvas = { board4: { layouts: { mindmap: { 'life:a': { x: 1, y: 2 }, 'b:task': { x: 3, y: 4 }, 'section:life': { x: 5, y: 6 } }, lanes: {} }, links: [] } };
  assert.deepEqual(DDcanvasTidy(canvas).board4.layouts, { mindmap: { 'b:task': { x: 3, y: 4 }, 'section:life': { x: 5, y: 6 } }, lanes: {} });
  const clean = { board4: { layouts: { mindmap: { 'b:task': { x: 3, y: 4 } } } } };
  assert.equal(DDcanvasTidy(clean), clean, 'an already clean canvas is the same object');
  assert.equal(DDcanvasTidy(null), null);
  // The bundle tidies every day as it loads.
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /canvas:DDcanvasTidy\(Z\.canvas\|\|null\)/);
});

test('sync and space are said plainly', () => {
  assert.equal(DDsyncAgo('2026-11-04T09:58:00Z', NOW, 'en'), 'Synced · 2 min ago');
  assert.equal(DDsyncAgo('2026-11-04T09:59:50Z', NOW, 'en'), 'Synced · just now');
  assert.equal(DDsyncAgo('2026-11-04T07:00:00Z', NOW, 'en'), 'Synced · 3h ago');
  assert.equal(DDsyncAgo('2026-11-04T09:58:00Z', NOW, 'fa'), 'همگام شد · ۲ دقیقه پیش');
  assert.equal(DDsyncAgo('', NOW, 'en'), 'Synced');
  assert.equal(DDstorageText(340000, 'en'), 'Space used: 340 KB of 1.5 MB (23%)');
  assert.equal(DDstorageText(1200000, 'en'), 'Space used: 1.2 MB of 1.5 MB (80%)');
  assert.equal(DDstorageText(340000, 'fa'), 'فضای استفاده‌شده: ۳۴۰ KB از ۱٫۵ MB (۲۳٪)');
  assert.equal(DDstorageBytes({ a: 'ب' }), 10);
});

test('a very full day is noticed, and the easiest task is offered to move', () => {
  const day = { blocks: [
    { id: 'a', name: 'Animate intro', min: 300, pri: 2 },
    { id: 'b', name: 'Emails', min: 120, pri: 0 },
    { id: 'c', name: 'Storyboard', min: 240, pri: 1 },
    { id: 'd', name: 'Done thing', min: 600, done: true },
    { id: 'e', name: '', min: 600 },
  ] };
  assert.deepEqual(DDdayLoad(day).minutes, 660, 'done and nameless tasks do not count');
  assert.equal(DDdayFull(day), true);
  assert.equal(DDmoveCandidate(day).id, 'b', 'the lowest priority');
  assert.equal(DDdayFull({ blocks: [{ id: 'a', name: 'One', min: 480 }] }), false);
  assert.equal(DDdayFull({ blocks: Array.from({ length: 12 }, (_, i) => ({ id: 'x' + i, name: 'Count ' + i, measure: 'count' })) }), true, 'twelve open tasks is full too');
});
