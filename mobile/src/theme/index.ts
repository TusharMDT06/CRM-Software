import { colors } from './colors';
import { typography, fontFamilies } from './typography';
import { radii } from './radii';
import { spacing } from './spacing';
import {
  formatINR,
  formatCompactINR,
  relativeTime,
  getAvatarColor,
  getInitials,
} from './helpers';

export const helpers = {
  formatINR,
  formatCompactINR,
  relativeTime,
  getAvatarColor,
  getInitials,
};

export const theme = {
  colors,
  typography,
  fontFamilies,
  radii,
  spacing,
  helpers,
} as const;

export {
  colors,
  typography,
  fontFamilies,
  radii,
  spacing,
  formatINR,
  formatCompactINR,
  relativeTime,
  getAvatarColor,
  getInitials,
};

export default theme;
