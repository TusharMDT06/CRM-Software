import React, { useEffect, useState, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { MOTION } from '../../lib/motion.js';

interface CountUpProps {
  value: number;
  formatFn?: (val: number) => string;
  duration?: number;
  className?: string;
  ready?: boolean;
}

export const CountUp: React.FC<CountUpProps> = ({
  value,
  formatFn = (v) => Math.round(v).toLocaleString(),
  duration = MOTION.duration.countUp,
  className = '',
  ready = true,
}) => {
  const reducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(() => (reducedMotion ? value : 0));
  const hasCountedRef = useRef(false);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (reducedMotion) {
      setDisplayValue(value);
      return;
    }
    if (hasCountedRef.current) {
      setDisplayValue(value);
      return;
    }

    hasCountedRef.current = true;
    let startTime: number | null = null;
    let animFrame: number;

    const startVal = 0;
    const targetVal = value;
    const durationMs = duration * 1000;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / durationMs, 1);

      // easeOutCubic curve: 1 - Math.pow(1 - progress, 3)
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (targetVal - startVal) * easedProgress;

      setDisplayValue(current);

      if (progress < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        setDisplayValue(targetVal);
      }
    };

    animFrame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [value, duration, reducedMotion, ready]);

  return <span className={className}>{formatFn(displayValue)}</span>;
};
