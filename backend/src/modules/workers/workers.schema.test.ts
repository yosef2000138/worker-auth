import test from 'node:test';
import assert from 'node:assert/strict';
import { updateWorkerProfileSchema } from './workers.schema';
import { normalizeAdditionalServiceCities, normalizeServiceCity } from './workers.service';

test('worker can save primary service city', () => {
  const parsed = updateWorkerProfileSchema.parse({ body: { primaryServiceCity: ' Haifa ' } });
  assert.equal(parsed.body.primaryServiceCity, 'Haifa');
});

test('worker can save additional service cities', () => {
  const parsed = updateWorkerProfileSchema.parse({ body: { additionalServiceCities: ['Acre', 'Karmiel'] } });
  assert.deepEqual(parsed.body.additionalServiceCities, ['Acre', 'Karmiel']);
});

test('duplicate additional service cities are normalized and removed', () => {
  assert.deepEqual(
    normalizeAdditionalServiceCities([' Acre ', 'acre', 'Karmiel', '  karmiel  ']),
    ['Acre', 'Karmiel'],
  );
  assert.equal(normalizeServiceCity('  Tel   Aviv  '), 'Tel Aviv');
});

test('service radius below 1 is rejected', () => {
  assert.throws(() => updateWorkerProfileSchema.parse({ body: { serviceRadiusKm: 0, baseLatitude: 32, baseLongitude: 35 } }));
});

test('service radius above 100 is rejected', () => {
  assert.throws(() => updateWorkerProfileSchema.parse({ body: { serviceRadiusKm: 101, baseLatitude: 32, baseLongitude: 35 } }));
});

test('one base coordinate without the other is rejected', () => {
  assert.throws(() => updateWorkerProfileSchema.parse({ body: { baseLatitude: 32 } }));
  assert.throws(() => updateWorkerProfileSchema.parse({ body: { baseLongitude: 35 } }));
});

test('invalid base latitude is rejected', () => {
  assert.throws(() => updateWorkerProfileSchema.parse({ body: { baseLatitude: 91, baseLongitude: 35 } }));
});

test('invalid base longitude is rejected', () => {
  assert.throws(() => updateWorkerProfileSchema.parse({ body: { baseLatitude: 32, baseLongitude: 181 } }));
});

test('service radius can be saved before base coordinates are added', () => {
  const parsed = updateWorkerProfileSchema.parse({ body: { serviceRadiusKm: 20 } });
  assert.equal(parsed.body.serviceRadiusKm, 20);
});
