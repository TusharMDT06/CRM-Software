import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { MOTION } from '../../lib/motion.js';

export interface AnimatedMeterProps {
  percentage: number;
  color?: 'green' | 'orange' | 'blue' | 'purple';
  totalSegments?: number;
  className?: string;
  barDelayMs?: number;
}

export const AnimatedMeter: React.FC<AnimatedMeterProps> = ({
  percentage,
  color = 'green',
  totalSegments = 30,
  className = '',
  barDelayMs = MOTION.stagger.meterBarMs,
}) => {
  const reducedMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const filledCount = Math.round((clamped / 100) * totalSegments);

  const activeColorClasses = {
    green: 'bg-[#3FCB8A]',
    orange: 'bg-[#F07B2A]',
    blue: 'bg-[#6F8BE8]',
    purple: 'bg-[#8B7FE0]',
  }[color];

  return (
    <div className={`flex items-center gap-[3px] w-full py-1 ${className}`}>
      {Array.from({ length: totalSegments }).map((_, index) => {
        const isFilled = index < filledCount;

        if (reducedMotion) {
          return (
            <div
              key={index}
              className={`flex-1 h-5 rounded-full ${
                isFilled
                  ? `${activeColorClasses} opacity-100`
                  : 'bg-[#ECECEF] dark:bg-[#2A2A32] opacity-60'
              }`}
            />
          );
        }

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0.3, scaleY: 0.8 }}
            animate={{
              opacity: isFilled ? 1 : 0.6,
              scaleY: 1,
            }}
            transition={{
              delay: isFilled ? (index * barDelayMs) / 1000 : 0,
              duration: 0.15,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={`flex-1 h-5 rounded-full ${
              isFilled ? activeColorClasses : 'bg-[#ECECEF] dark:bg-[#2A2A32]'
            }`}
          />
        );
      })}
    </div>
  );
};
