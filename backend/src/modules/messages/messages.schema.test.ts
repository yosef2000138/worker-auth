import test from 'node:test';
import assert from 'node:assert/strict';
import { socketMessageSchema } from './messages.schema';

const requestId = '11111111-1111-4111-8111-111111111111';

test('socket chat accepts a valid bounded message', () => {
  const parsed = socketMessageSchema.parse({ requestId, content: '  hello  ' });
  assert.equal(parsed.content, 'hello');
});

test('socket chat rejects messages over 2000 characters', () => {
  assert.throws(() => socketMessageSchema.parse({
    requestId,
    content: 'x'.repeat(2001),
  }));
});

test('socket chat rejects whitespace-only messages after normalization', () => {
  assert.throws(() => socketMessageSchema.parse({ requestId, content: '   ' }));
});

test('socket chat rejects malformed request identifiers and extra fields', () => {
  assert.throws(() => socketMessageSchema.parse({ requestId: 'not-a-uuid', content: 'hello' }));
  assert.throws(() => socketMessageSchema.parse({ requestId, content: 'hello', senderId: 'forged' }));
});
