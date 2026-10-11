import test from 'node:test';
import assert from 'node:assert/strict';
import {complianceAnswerLabel} from '../lib/portal-format.ts';

test('client-facing criterion answers use Sí cumple / No cumple', () => {
  assert.equal(complianceAnswerLabel('SI'), 'Sí cumple');
  assert.equal(complianceAnswerLabel('Sí'), 'Sí cumple');
  assert.equal(complianceAnswerLabel('si cumple'), 'Sí cumple');
  assert.equal(complianceAnswerLabel('NO'), 'No cumple');
  assert.equal(complianceAnswerLabel('No'), 'No cumple');
  assert.equal(complianceAnswerLabel('no cumple'), 'No cumple');
  assert.equal(complianceAnswerLabel('NA'), 'No aplica');
  assert.equal(complianceAnswerLabel(''), 'Sin evaluar');
  assert.equal(complianceAnswerLabel(undefined), 'Sin evaluar');
});
