import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme';
import { ICON_PATHS } from './iconPaths';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// On web, draw icons as vector paths instead of font glyphs so screens export cleanly to SVG / Figma.
export function Icon({ name, size = 22, color = colors.ink, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const d = ICON_PATHS[name];
  if (!d) return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style as StyleProp<ViewStyle>} accessible={false}>
      <Path d={d} fill={color} />
    </Svg>
  );
}
