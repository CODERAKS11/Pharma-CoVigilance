import { useEffect, useState, useRef } from 'react';
import type { SeverityCategory } from '../../api/types';

interface CausalityDialProps {
  score: number;
  category: SeverityCategory;
  maxScore?: number;
  size?: number;
}

const SEGMENTS: { label: SeverityCategory; min: number; max: number; color: string }[] = [
  { label: 'Doubtful', min: 0, max: 1, color: '#5C6470' },
  { label: 'Possible', min: 1, max: 5, color: '#A88A1A' },
  { label: 'Probable', min: 5, max: 9, color: '#B8641E' },
  { label: 'Definite', min: 9, max: 13, color: '#8C2F2A' },
];

export function CausalityDial({ score, category, maxScore = 13, size = 220 }: CausalityDialProps) {
  const [animatedAngle, setAnimatedAngle] = useState(0);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Compute the target angle for the needle (0 = left, 180 = right)
  const targetAngle = Math.min(Math.max((score / maxScore) * 180, 0), 180);

  useEffect(() => {
    if (prefersReducedMotion.current) {
      setAnimatedAngle(targetAngle);
      return;
    }
    // Animate to target
    const start = performance.now();
    const from = 0;
    const duration = 1200;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // ease-out cubic

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setAnimatedAngle(from + (targetAngle - from) * ease(progress));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [targetAngle]);

  const cx = size / 2;
  const cy = size / 2 + 10;
  const radius = size / 2 - 24;
  const strokeWidth = 22;

  // Create arc paths for each segment
  const arcPath = (startAngle: number, endAngle: number, r: number) => {
    const x1 = cx + r * Math.cos((Math.PI * (180 + startAngle)) / 180);
    const y1 = cy + r * Math.sin((Math.PI * (180 + startAngle)) / 180);
    const x2 = cx + r * Math.cos((Math.PI * (180 + endAngle)) / 180);
    const y2 = cy + r * Math.sin((Math.PI * (180 + endAngle)) / 180);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Needle tip position
  const needleAngle = (180 + animatedAngle) * (Math.PI / 180);
  const needleLen = radius - 8;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy + needleLen * Math.sin(needleAngle);

  const segmentColor = SEGMENTS.find(s => s.label === category)?.color || '#5C6470';

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size / 2 + 40} viewBox={`0 0 ${size} ${size / 2 + 40}`}>
        {/* Background arc */}
        <path
          d={arcPath(0, 180, radius)}
          fill="none"
          stroke="#E2E5E9"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Colored segments */}
        {SEGMENTS.map(seg => {
          const startDeg = (seg.min / maxScore) * 180;
          const endDeg = (seg.max / maxScore) * 180;
          const isActive = seg.label === category;
          return (
            <path
              key={seg.label}
              d={arcPath(startDeg, endDeg, radius)}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              opacity={isActive ? 1 : 0.2}
            />
          );
        })}

        {/* Segment labels */}
        {SEGMENTS.map(seg => {
          const midDeg = ((seg.min + seg.max) / 2 / maxScore) * 180;
          const labelR = radius + 18;
          const lx = cx + labelR * Math.cos((Math.PI * (180 + midDeg)) / 180);
          const ly = cy + labelR * Math.sin((Math.PI * (180 + midDeg)) / 180);
          return (
            <text
              key={seg.label + '-label'}
              x={lx}
              y={ly}
              textAnchor="middle"
              fontSize="9"
              fontFamily="var(--font-sans)"
              fontWeight={seg.label === category ? 600 : 400}
              fill={seg.label === category ? seg.color : '#8A919B'}
            >
              {seg.label}
            </text>
          );
        })}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={segmentColor}
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={6} fill={segmentColor} />
        <circle cx={cx} cy={cy} r={3} fill="white" />

        {/* Score display */}
        <text
          x={cx}
          y={cy + 28}
          textAnchor="middle"
          fontSize="22"
          fontFamily="var(--font-mono)"
          fontWeight="700"
          fill="var(--ink)"
        >
          {score}
        </text>
        <text
          x={cx}
          y={cy + 42}
          textAnchor="middle"
          fontSize="10"
          fontFamily="var(--font-sans)"
          fontWeight="500"
          fill={segmentColor}
        >
          {category}
        </text>
      </svg>
    </div>
  );
}
