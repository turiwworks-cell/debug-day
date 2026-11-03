import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DDwords, DDword } from '../public/words.js';
import { DDpanelGlyph, DDpanelList } from '../public/panels.js';
test('the app says Task and Step, Focus and Pause the day, in English and Persian', () => {
  assert.equal(DDword('Add block', 'en'), 'Add task');
  assert.equal(DDword('+ Sub-node', 'en'), '+ Step');
  assert.equal(DDword('Stillness', 'en'), 'Focus');
  assert.equal(DDword('Life happened', 'en'), 'Pause the day');
  assert.equal(DDword('Life happened', 'fa'), 'روز را نگه دار');
  assert.equal(DDword('Something else', 'en'), undefined, 'other labels pass through');
  for (const key of Object.keys(DDwords.fa)) assert.ok(key in DDwords.en, key + ' has an English word too');
  for (const word of Object.values(DDwords.en)) assert.doesNotMatch(word, /\b(block|node|sub-node)\b/i, word);
});
test('every panel has a line icon, not an emoji', () => {
  const R = { createElement: (type, props) => ({ type, props }) };
  for (const panel of DDpanelList) {
    const icon = DDpanelGlyph(R, panel.id);
    assert.equal(icon.type, 'svg', panel.id);
    assert.equal(icon.props.stroke, 'currentColor');
  }
});
