import { Variants } from 'motion/react';

export const MOTION = {
  duration: {
    instant: 0.12,
    base: 0.2,
    drawer: 0.25,
    section: 0.3,
    countUp: 0.8,
    chart: 0.9,
  },
  easing: {
    easeOut: [0.16, 1, 0.3, 1] as const,
    easeInOut: [0.4, 0, 0.2, 1] as const,
  },
  stagger: {
    section: 0.06, // 60ms between top-to-bottom sections
    kanbanColumn: 0.06, // 60ms between kanban columns
    tableRow: 0.03, // 30ms between first 10 table rows
    meterBarMs: 12, // 12ms per segmented meter bar
  },
};

export const pageVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: MOTION.duration.base,
      ease: MOTION.easing.easeOut,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: MOTION.duration.instant,
    },
  },
};

export const sectionContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: MOTION.stagger.section,
    },
  },
};

export const sectionItemVariants: Variants = {
  initial: {
    opacity: 0,
    y: -12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION.duration.section,
      ease: MOTION.easing.easeOut,
    },
  },
};

export const modalVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: MOTION.duration.base,
      ease: MOTION.easing.easeOut,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: MOTION.duration.instant,
    },
  },
};

export const backdropVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: MOTION.duration.base,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: MOTION.duration.instant,
    },
  },
};

export const drawerVariants: Variants = {
  initial: {
    x: '100%',
  },
  animate: {
    x: 0,
    transition: {
      duration: MOTION.duration.drawer,
      ease: MOTION.easing.easeOut,
    },
  },
  exit: {
    x: '100%',
    transition: {
      duration: MOTION.duration.base,
      ease: MOTION.easing.easeOut,
    },
  },
};

export const toastVariants: Variants = {
  initial: {
    opacity: 0,
    y: 16,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: MOTION.duration.base,
      ease: MOTION.easing.easeOut,
    },
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.98,
    transition: {
      duration: MOTION.duration.instant,
    },
  },
};

export const tapScale = {
  scale: 0.98,
};
