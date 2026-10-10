import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { sectionItemVariants, MOTION } from '../../lib/motion.js';

interface RevealProps {
  children: React.ReactNode;
  ready?: boolean;
  skeleton?: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: string;
}

export const Reveal: React.FC<RevealProps> = ({
  children,
  ready = true,
  skeleton,
  delay = 0,
  className = '',
}) => {
  const reducedMotion = useReducedMotion();
  const [hasAnimated, setHasAnimated] = useState(false);
  const wasReadyRef = useRef(false);

  useEffect(() => {
    if (ready && !wasReadyRef.current) {
      wasReadyRef.current = true;
      // Mark as animated once the entrance has completed (300ms + delay)
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, (MOTION.duration.section + delay) * 1000);
      return () => clearTimeout(timer);
    }
  }, [ready, delay]);

  if (skeleton) {
    if (hasAnimated || reducedMotion) {
      return !ready ? <div className={className}>{skeleton}</div> : <div className={className}>{children}</div>;
    }
    return (
      <AnimatePresence mode="wait">
        {!ready ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className={className}
          >
            {skeleton}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            variants={sectionItemVariants}
            initial="initial"
            animate="animate"
            transition={{
              duration: MOTION.duration.section,
              ease: MOTION.easing.easeOut,
              delay,
            }}
            className={className}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Once animated on first load, don't replay entrance animation on refetches/pagination
  if (hasAnimated || reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={sectionItemVariants}
      initial="initial"
      animate={ready ? 'animate' : 'initial'}
      transition={{
        duration: MOTION.duration.section,
        ease: MOTION.easing.easeOut,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
