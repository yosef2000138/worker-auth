import test from 'node:test';
import assert from 'node:assert/strict';
import { hasImageSignature } from './upload';

test('upload signature validation accepts supported image headers', () => {
  assert.equal(hasImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(
    hasImageSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    true,
  );
  assert.equal(hasImageSignature(Buffer.from('RIFF0000WEBP', 'ascii')), true);
});

test('upload signature validation rejects executable or text payloads', () => {
  assert.equal(hasImageSignature(Buffer.from('#!/bin/sh\necho unsafe')), false);
  assert.equal(hasImageSignature(Buffer.from('<script>alert(1)</script>')), false);
});
