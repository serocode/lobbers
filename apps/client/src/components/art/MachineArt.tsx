import { memo, type CSSProperties } from 'react';
import { MACHINES, type MachineId } from '@lobbers/shared';
import { MACHINE_PARTS, VictorySparkles, WreckSmoke } from './machineParts';

export type MachinePose = 'idle' | 'victory' | 'wreck';

export interface MachineArtProps {
  kind: MachineId;
  /** Team colour on the stripe/flag element (default red). */
  tint?: string;
  /** Skin colour for the main body (defaults to the machine's signature colour). */
  paint?: string;
  /** Width in px; height = size / 1.2 (viewBox 120×100). */
  size?: number;
  flip?: boolean;
  /** Barrel elevation in art space, 0–90°. */
  aim?: number;
  pose?: MachinePose;
  style?: CSSProperties;
}

/** Machine.dc.html as a React component: inline SVG with the mockup's SMIL idle animations. */
export const MachineArt = memo(function MachineArt({ kind, tint = '#F45B55', paint, size = 240, flip = false, aim = 30, pose = 'idle', style }: MachineArtProps): JSX.Element {
  const def = MACHINES[kind];
  const Parts = MACHINE_PARTS[kind];
  const rot = -(pose === 'victory' ? 62 : pose === 'wreck' ? -18 : aim);
  const wreck = pose === 'wreck';
  return (
    <div role="img" aria-label={`${def.name} battle machine`} style={{
      width: size, height: Math.round(size / 1.2), position: 'relative', flex: 'none',
      filter: wreck ? 'grayscale(.85) brightness(.65)' : 'none', transform: wreck ? 'rotate(9deg) translateY(6%)' : 'none', ...style,
    }}>
      <svg width="100%" height="100%" viewBox="0 0 120 100" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
        <ellipse cx="60" cy="95" rx="44" ry="4.5" fill="#000" opacity=".28" />
        <g transform={flip ? 'translate(120 0) scale(-1 1)' : 'translate(0 0)'}>
          <Parts body={paint || def.color} tint={tint} rot={rot} />
          {pose === 'victory' && <VictorySparkles />}
        </g>
        {wreck && <WreckSmoke />}
      </svg>
    </div>
  );
});
