/**
 * Shared Framer Motion animation variants for dashboard widgets
 */

import { Variants } from 'framer-motion';

// --- FADE ANIMATIONS ---

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4 }
  }
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

// --- SCALE ANIMATIONS ---

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};

export const scaleInBounce: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.175, 0.885, 0.32, 1.275] // Bounce easing
    }
  }
};

// --- STAGGER CONTAINERS ---

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05
    }
  }
};

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.15
    }
  }
};

// --- LIST ITEM ANIMATIONS ---

export const listItem: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};

export const listItemFadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};

// --- CARD ANIMATIONS ---

export const cardHover = {
  scale: 1.02,
  transition: { duration: 0.2, ease: 'easeOut' }
};

export const cardTap = {
  scale: 0.98,
  transition: { duration: 0.1 }
};

// --- PULSE ANIMATIONS ---

export const pulse: Variants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
};

export const pulseSubtle: Variants = {
  initial: { opacity: 1 },
  pulse: {
    opacity: [1, 0.7, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
};

export const pulseGlow: Variants = {
  initial: { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
  pulse: {
    boxShadow: [
      '0 0 0 0 rgba(239, 68, 68, 0.4)',
      '0 0 0 8px rgba(239, 68, 68, 0)',
    ],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeOut'
    }
  }
};

// --- CHART ANIMATIONS ---

export const chartLine: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 1.5, ease: 'easeInOut' },
      opacity: { duration: 0.3 }
    }
  }
};

export const chartBar: Variants = {
  hidden: { scaleY: 0, originY: 1 },
  visible: {
    scaleY: 1,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

export const chartPie: Variants = {
  hidden: { scale: 0, rotate: -90 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: { duration: 0.6, ease: [0.175, 0.885, 0.32, 1.1] }
  }
};

// --- BADGE/PILL ANIMATIONS ---

export const badgeBounce: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 25
    }
  }
};

// --- TOOLTIP ANIMATIONS ---

export const tooltipIn: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 5 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: 'easeOut' }
  }
};

// --- SHIMMER/SKELETON ---

export const shimmer: Variants = {
  initial: { x: '-100%' },
  animate: {
    x: '100%',
    transition: {
      repeat: Infinity,
      duration: 1.5,
      ease: 'linear'
    }
  }
};

// --- UTILITY FUNCTIONS ---

/**
 * Create a delayed fade-in variant
 */
export function createDelayedFadeIn(delay: number): Variants {
  return {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        delay,
        ease: 'easeOut'
      }
    }
  };
}

/**
 * Create a custom stagger container
 */
export function createStaggerContainer(staggerDelay: number, initialDelay = 0): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: initialDelay
      }
    }
  };
}

// --- DEFAULT TRANSITION CONFIG ---

export const springConfig = {
  type: 'spring',
  stiffness: 400,
  damping: 30
};

export const smoothConfig = {
  duration: 0.3,
  ease: 'easeOut'
};
