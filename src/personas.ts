/**
 * Bot personas — the offline cast.
 *
 * The AI already plays to hidden traits (aggression, suspicion, bluffiness,
 * grudge). These personas pin those traits to a name, an animal avatar and
 * a one-line dossier, so an offline table feels like playing five people
 * rather than five copies of the same policy.
 *
 * Ids are stable (`bot-1` … `bot-5`) and the traits are derived from the id
 * in src/ai.ts, so a persona's dossier and its behaviour agree.
 */
import { TKey } from './i18n';

export interface Persona {
  id: string;
  /** Display name (localised: personas get regional names in Arabic). */
  nameKey: TKey;
  /** One-line dossier shown before the game and at the table. */
  dossierKey: TKey;
  /** Fixed animal avatar. */
  avatar: string;
  /** Which of the traits to headline in the UI. */
  trait: 'aggression' | 'suspicion' | 'bluffiness' | 'grudge';
}

export const PERSONAS: Persona[] = [
  {
    id: 'bot-1',
    nameKey: 'personaHoarderName',
    dossierKey: 'personaHoarderLine',
    avatar: 'monkey',
    trait: 'aggression',
  },
  {
    id: 'bot-2',
    nameKey: 'personaRecklessName',
    dossierKey: 'personaRecklessLine',
    avatar: 'penguin',
    trait: 'bluffiness',
  },
  {
    id: 'bot-3',
    nameKey: 'personaSuspiciousName',
    dossierKey: 'personaSuspiciousLine',
    avatar: 'frog',
    trait: 'suspicion',
  },
  {
    id: 'bot-4',
    nameKey: 'personaGrudgeName',
    dossierKey: 'personaGrudgeLine',
    avatar: 'elephant',
    trait: 'grudge',
  },
  {
    id: 'bot-5',
    nameKey: 'personaQuietName',
    dossierKey: 'personaQuietLine',
    avatar: 'owl',
    trait: 'suspicion',
  },
];

export function personaFor(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}
