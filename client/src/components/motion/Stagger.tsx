import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { sectionContainerVariants, MOTION } from '../../lib/motion.js';

interface StaggerProps {
  children: React.ReactNode;
  ready?: boolean;
  skeleton?: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}

export const Stagger: React.FC<StaggerProps> = ({
  children,
  ready = true,
  skeleton,
  staggerDelay = MOTION.stagger.section,
  className = '',
}) => {
  const reducedMotion = useReducedMotion();
  const [hasAnimated, setHasAnimated] = useState(false);
  const wasReadyRef = useRef(false);

  useEffect(() => {
    if (ready && !wasReadyRef.current) {
      wasReadyRef.current = true;
      // Mark as animated once the total stagger cycle completes (~700ms)
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [ready]);

  if (skeleton) {
    if (hasAnimated || reducedMotion) {
      return !ready ? <div className={className}>{skeleton}</div> : <div className={className}>{children}</div>;
    }
    return (
      <AnimatePresence mode="wait">
        {!ready ? (
          <motion.div
            key="skeleton-group"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className={className}
          >
            {skeleton}
          </motion.div>
        ) : (
          <motion.div
            key="content-group"
            variants={sectionContainerVariants}
            initial="initial"
            animate="animate"
            transition={{
              staggerChildren: staggerDelay,
            }}
            className={className}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (hasAnimated || reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={sectionContainerVariants}
      initial="initial"
      animate={ready ? 'animate' : 'initial'}
      transition={{
        staggerChildren: staggerDelay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
