/**
 * Table skins — what the table itself is made of.
 *
 * A skin is only surface: the rim, the cloth and the hairline inside it. It
 * never changes a card, a seat or a rule, so a skin can be swapped mid-game
 * without touching anything that matters.
 */
import { TKey } from './i18n';

export type SkinId = 'felt' | 'majlis';

export interface Skin {
  id: SkinId;
  nameKey: TKey;
  /** Table rim (the wooden/metal edge the cloth is stretched over). */
  rim: string;
  /** Cloth gradient, top to bottom. */
  cloth: [string, string, string];
  /** Cloth edge, a shade darker than the cloth. */
  clothEdge: string;
  /** The hairline drawn inside the cloth. */
  innerLine: string;
}

export const SKINS: Record<SkinId, Skin> = {
  // The default: crimson card-room felt in a brushed silver rim.
  felt: {
    id: 'felt',
    nameKey: 'skinFelt',
    rim: '#3a3f4a',
    cloth: ['#6b2a28', '#54201e', '#3d1615'],
    clothEdge: '#2a0f0e',
    innerLine: 'rgba(255,255,255,0.10)',
  },
  // A majlis floor: a deep patterned carpet inside a warm brass frame, lit
  // like a room rather than a casino.
  majlis: {
    id: 'majlis',
    nameKey: 'skinMajlis',
    rim: '#8a6a34',
    cloth: ['#54332a', '#3f231c', '#2b1613'],
    clothEdge: '#553f1e',
    innerLine: 'rgba(230,196,120,0.38)',
  },
};

export function skinOf(id: string | undefined): Skin {
  return SKINS[(id as SkinId) ?? 'felt'] ?? SKINS.felt;
}
