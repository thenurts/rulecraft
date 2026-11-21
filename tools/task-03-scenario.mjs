import { confirmLaw, startSociety, villageScope } from '@rulecraft/simulation';

export function societyExample(fixture) {
  const field = confirmLaw(startSociety(fixture, 42), {
    operation: 'CREATE', lawId: 'morning-harvest-ban', commandId: 'create-harvest-ban',
    ast: { ...villageScope, targetSelector: 'farmer', actionId: 'harvest-food', modality: 'MUST_NOT',
      when: { operand: 'slot', operator: 'EQ', value: 'morning' } },
  }).game;
  return confirmLaw(field, {
    operation: 'CREATE', lawId: 'village-patrol', commandId: 'create-village-patrol',
    ast: { ...villageScope, targetSelector: 'guard', actionId: 'patrol', modality: 'MUST' },
  }).game;
}
