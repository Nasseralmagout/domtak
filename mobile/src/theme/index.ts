import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  brand: '#3B1F8B',
  brandDark: '#24105E',
  brandDeep: '#2E0B5E',
  nav: '#3B0F7A',
  brandSoft: '#EEE8FB',
  brandTint: '#F4F0FD',
  brandMid: '#6B4FC0',
  lilac: '#C9B8F0',
  lilacLight: '#DCD0F7',
  gold: '#F2B632',
  star: '#E0A100',

  bg: '#F8F7FB',
  surface: '#FFFFFF',
  ink: '#1B1530',
  inkSoft: '#3B3452',
  muted: '#5A5370',
  subtle: '#7A7390',
  label: '#4A4360',
  border: '#E1DCEB',
  borderStrong: '#CFC9DD',
  divider: '#ECE9F3',
  track: '#DCD7E6',
  disabled: '#B5ADC8',
  chipIdle: '#F1EFF6',

  success: '#1E7B3A',
  successBg: '#E3F4E8',
  warning: '#9A3412',
  warningStrong: '#C2410C',
  warningBg: '#FFEDD5',
  danger: '#B42318',
  dangerBg: '#FDECEA',

  white: '#FFFFFF',
  black: '#000000',
  scrim: 'rgba(27,21,48,0.55)',
};

export const fonts = {
  display: 'Poppins_700Bold',
  displaySemi: 'Poppins_600SemiBold',
  displayMedium: 'Poppins_500Medium',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  wordmark: 'LilitaOne_400Regular',
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

export const type: Record<string, TextStyle> = {
  h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.ink },
  h2: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink },
  h3: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 24, color: colors.ink },
  title: { fontFamily: fonts.displaySemi, fontSize: 16, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  bodyBold: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 22, color: colors.ink },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  smallBold: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, color: colors.ink },
  caption: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, color: colors.brandMid },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, color: colors.label },
};

export const shadow = (level: 1 | 2 = 1): ViewStyle =>
  Platform.select<ViewStyle>({
    android: { elevation: level === 1 ? 2 : 6 },
    default: {
      shadowColor: '#2E0B5E',
      shadowOpacity: level === 1 ? 0.07 : 0.14,
      shadowRadius: level === 1 ? 10 : 20,
      shadowOffset: { width: 0, height: level === 1 ? 2 : 6 },
    },
  }) as ViewStyle;
