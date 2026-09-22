import PlayStationIcon from '~icons/simple-icons/playstation';
import XboxIcon from '~icons/simple-icons/xbox';
import {
  GAMEPAD_LABELS,
  type GamepadLayout,
  type StickPoint,
} from '@/lib/gamepad';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function GamepadDiagram({
  layout,
  buttons,
  axes,
}: {
  layout: GamepadLayout;
  buttons: (number | null)[];
  axes: (number | null)[];
}) {
  const { t } = useTranslation();
  const labels = GAMEPAD_LABELS[layout];
  const symmetric = layout === 'playstation' || layout === 'generic';
  const controls = [
    { i: 0, x: 454, y: 210 },
    { i: 1, x: 490, y: 173 },
    { i: 2, x: 418, y: 173 },
    { i: 3, x: 454, y: 136 },
    { i: 8, x: 264, y: 174 },
    { i: 9, x: 336, y: 174 },
    { i: 16, x: 300, y: 126 },
    { i: 12, x: symmetric ? 148 : 220, y: symmetric ? 140 : 240 },
    { i: 13, x: symmetric ? 148 : 220, y: symmetric ? 208 : 308 },
    { i: 14, x: symmetric ? 114 : 186, y: symmetric ? 174 : 274 },
    { i: 15, x: symmetric ? 182 : 254, y: symmetric ? 174 : 274 },
  ];
  return (
    <svg
      viewBox="0 0 600 410"
      role="img"
      aria-label={t('gamepad.diagram')}
      className="w-full max-w-3xl mx-auto"
    >
      <path
        d="M145 85 C95 85 77 129 63 191 L28 338 Q16 397 70 385 L176 317 Q198 303 225 307 L375 307 Q402 303 424 317 L530 385 Q584 397 572 338 L537 191 C523 129 505 85 455 85 Z"
        className="fill-muted stroke-border"
        strokeWidth="4"
      />
      {([4, 5, 6, 7] as const).map((i) => {
        const x = i % 2 === 0 ? 112 : 402;
        const y = i < 6 ? 69 : 20;
        const value = buttons[i];
        return (
          <g key={i} opacity={value === null ? 0.35 : 1}>
            <rect
              x={x}
              y={y}
              width="86"
              height="36"
              rx="12"
              className="fill-background stroke-border"
              strokeWidth="2"
            />
            <rect
              x={x}
              y={y}
              width={86 * (value ?? 0)}
              height="36"
              rx="12"
              className="fill-primary"
            />
            <text
              x={x + 43}
              y={y + 24}
              textAnchor="middle"
              className={cn(
                'text-[15px] font-semibold',
                (value ?? 0) > 0.5
                  ? 'fill-primary-foreground'
                  : 'fill-foreground',
              )}
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
      {controls.map(({ i, x, y }) => (
        <g key={i} opacity={buttons[i] === null ? 0.35 : 1}>
          <circle
            cx={x}
            cy={y}
            r={i === 8 || i === 9 ? 20 : 24}
            strokeWidth="2"
            className={cn(
              'stroke-border',
              (buttons[i] ?? 0) > 0.01 ? 'fill-primary' : 'fill-background',
            )}
          />
          {i === 16 && (layout === 'xbox' || layout === 'playstation') ? (
            <g
              data-brand={layout}
              className={
                (buttons[i] ?? 0) > 0.01
                  ? 'text-primary-foreground'
                  : 'text-foreground'
              }
            >
              {layout === 'xbox' ? (
                <XboxIcon
                  x={x - 14}
                  y={y - 14}
                  width={28}
                  height={28}
                  aria-hidden="true"
                />
              ) : (
                <PlayStationIcon
                  x={x - 14}
                  y={y - 14}
                  width={28}
                  height={28}
                  aria-hidden="true"
                />
              )}
            </g>
          ) : (
            <text
              x={x}
              y={y + 6}
              textAnchor="middle"
              className={cn(
                i === 8 || i === 9 ? 'text-[10px]' : 'text-[19px]',
                'font-semibold',
                (buttons[i] ?? 0) > 0.01
                  ? 'fill-primary-foreground'
                  : 'fill-foreground',
              )}
            >
              {labels[i]}
            </text>
          )}
        </g>
      ))}
      {[0, 1].map((stick) => {
        const x = stick === 0 ? (symmetric ? 222 : 145) : 378;
        const y = stick === 0 && !symmetric ? 174 : 270;
        const available =
          axes[stick * 2] !== null && axes[stick * 2 + 1] !== null;
        return (
          <g key={stick} opacity={available ? 1 : 0.35}>
            <circle
              cx={x}
              cy={y}
              r="43"
              className="fill-background stroke-border"
              strokeWidth="2"
            />
            <circle
              cx={x + (axes[stick * 2] ?? 0) * 21}
              cy={y + (axes[stick * 2 + 1] ?? 0) * 21}
              r="24"
              className={cn(
                'stroke-border',
                (buttons[10 + stick] ?? 0) > 0.01
                  ? 'fill-primary'
                  : 'fill-muted-foreground',
              )}
              strokeWidth="2"
            />
            <text
              x={x}
              y={y + 65}
              textAnchor="middle"
              className="fill-muted-foreground text-[13px]"
            >
              {stick === 0 ? 'L3' : 'R3'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function GamepadStickPlot({
  point,
  trail,
  label,
}: {
  point: StickPoint;
  trail: StickPoint[];
  label: string;
}) {
  return (
    <svg
      viewBox="0 0 220 220"
      role="img"
      aria-label={label}
      className="w-full max-w-56 mx-auto"
    >
      <circle cx="110" cy="110" r="98" className="fill-muted stroke-border" />
      <path d="M12 110H208M110 12V208" className="stroke-border" />
      <polyline
        points={trail
          .map(({ x, y }) => `${110 + x * 98},${110 + y * 98}`)
          .join(' ')}
        fill="none"
        className="stroke-primary"
        strokeWidth="1.5"
        opacity="0.45"
      />
      <circle
        cx={110 + point.x * 98}
        cy={110 + point.y * 98}
        r="5"
        className="fill-primary"
      />
    </svg>
  );
}
