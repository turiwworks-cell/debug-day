import test from 'node:test';
import assert from 'node:assert/strict';
import { DDremindersOn, DDcalDayRows, DDremBoardTarget } from '../public/cal-reminders.js';

test('reminders come on their day, repeat, and are done one day at a time', () => {
  const list = [
    { id: 'once', date: '2026-11-17', title: 'Invoice', repeat: 'once' },
    { id: 'week', date: '2026-11-03', title: 'Plants', repeat: 'weekly', completedDates: ['2026-11-17'] },
    { id: 'alt', date: '2026-11-15', title: 'Stretch', repeat: 'alternate' },
  ];
  assert.deepEqual(DDremindersOn(list, '2026-11-17').map((r) => r.id), ['once', 'week', 'alt']);
  assert.equal(DDremindersOn(list, '2026-11-17').find((r) => r.id === 'week').done, true);
  assert.deepEqual(DDremindersOn(list, '2026-11-18').map((r) => r.id), []);
  assert.deepEqual(DDremindersOn(list, '2026-11-24').map((r) => r.id), ['week']);
});

test('a day lists its reminders, then to-do tasks with a time; deadlines stay deadlines', () => {
  const due = [
    { id: 'todo:life:n1:1', type: 'todo', text: 'Call Sara', due: '2026-11-17', time: '14:30' },
    { id: 'todo:life:n1:0', type: 'todo', text: 'Email', due: '2026-11-17', time: '09:00' },
    { id: 'note', type: 'sticky', text: 'Print the zine', due: '2026-11-17' },
  ];
  const { rows, deadlines } = DDcalDayRows([{ id: 'r', title: 'Invoice', repeat: 'once' }], due, 'en');
  assert.deepEqual(rows.map((r) => [r.kind, r.time || '', r.title]), [['reminder', '', 'Invoice'], ['timed', '09:00', 'Email'], ['timed', '14:30', 'Call Sara']]);
  assert.deepEqual(deadlines.map((d) => d.id), ['note']);
});

test('a to-do task or a Feed note opens where it lives on the Board', () => {
  assert.deepEqual(DDremBoardTarget({ id: 'todo:life:abc:2' }), { life: 'abc' });
  assert.deepEqual(DDremBoardTarget({ id: 'todo:2026-11-17:n5:0' }), { date: '2026-11-17', id: 'n5' });
  assert.deepEqual(DDremBoardTarget({ id: 'far-note' }), { life: 'far-note' });
  assert.equal(DDremBoardTarget({}), null);
});
