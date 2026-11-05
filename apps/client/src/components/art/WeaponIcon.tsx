import { memo } from 'react';
import type { WeaponIconId } from '@lobbers/shared';
import { WEAPON_GLYPHS } from './weaponGlyphs';

export interface WeaponIconProps {
  icon: WeaponIconId;
  color?: string;
  size?: number;
}

/** WeaponIcon.dc.html: 64×64 glyph per weapon category, 3 px ink strokes. */
export const WeaponIcon = memo(function WeaponIcon({ icon, color = '#FFB547', size = 128 }: WeaponIconProps): JSX.Element {
  const Glyph = WEAPON_GLYPHS[icon];
  return (
    <div style={{ width: size, height: size, flex: 'none', color: '#F5F1E8' }}>
      <svg width="100%" height="100%" viewBox="0 0 64 64" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
        <g stroke="#151B2B" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
          <Glyph col={color} />
        </g>
      </svg>
    </div>
  );
});
