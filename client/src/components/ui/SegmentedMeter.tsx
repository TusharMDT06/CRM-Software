import React from 'react';
import { AnimatedMeter, AnimatedMeterProps } from '../motion/AnimatedMeter.js';

export interface SegmentedMeterProps extends AnimatedMeterProps {}

export const SegmentedMeter: React.FC<SegmentedMeterProps> = (props) => {
  return <AnimatedMeter {...props} />;
};
