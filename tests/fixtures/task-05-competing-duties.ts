import { advanceSociety, confirmLaw, societyDefaults, startSociety, villageScope } from '@rulecraft/simulation';
import fixture from '../../fixtures/task-01-village.json' with { type: 'json' };

export function completedCompetingDutiesDay(bulletinBp = 10_000) {
  let game = startSociety(fixture, 42, { ...societyDefaults, bulletinBp });
  for (const actionId of ['harvest-food', 'rest']) {
    game = confirmLaw(game, {
      operation: 'CREATE', lawId: actionId, commandId: `confirm-${actionId}`,
      ast: { ...villageScope, targetSelector: 'farmer', modality: 'MUST', actionId },
    }).game;
  }
  return advanceSociety(game);
}
