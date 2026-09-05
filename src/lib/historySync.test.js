import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileHistory, sameHistoryRevision, retainHistory } from './historySync.js';

test('remote refresh preserves pending edits and includes another device additions', () => {
  const draft = { id: 'a', timestamp: 20, synced: false, data: { name: 'edited' } };
  const old = { ...draft, timestamp: 10, synced: true, data: { name: 'old' } };
  const added = { id: 'b', timestamp: 30, synced: true };
  assert.deepEqual(reconcileHistory([draft], [old, added]), [added, draft]);
});

test('late read cannot roll back an acknowledged revision; newer remote edits apply', () => {
  const current = { id: 'a', timestamp: 20, synced: true };
  assert.deepEqual(reconcileHistory([current], [{ ...current, timestamp: 10 }]), [current]);
  const updated = { ...current, timestamp: 30 };
  assert.deepEqual(reconcileHistory([current], [updated]), [updated]);
});

test('upload acknowledgement does not mark an edit made during the upload as synced', () => {
  const sent = { id: 'a', timestamp: 20, data: { sequence: 'ATGC' } };
  assert.equal(sameHistoryRevision(sent, { ...sent, data: { sequence: 'ATGA' } }), false);
  assert.equal(sameHistoryRevision(sent, { ...sent }), true);
});

test('history limit never evicts the account library', () => {
  const library = { id: 'library', toolId: '__seq_analyzer_library__' };
  const items = Array.from({ length: 110 }, (_, i) => ({ id: String(i), toolId: 'plasmid' }));
  const retained = retainHistory([...items, library]);
  assert.equal(retained.length, 101);
  assert.ok(retained.includes(library));
});
