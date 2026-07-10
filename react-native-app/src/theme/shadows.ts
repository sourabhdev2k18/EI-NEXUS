import { Platform } from 'react-native';

// RN has no box-shadow; iOS uses shadow* props, Android uses elevation.
function shadow(elevation: number, opacity: number) {
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: elevation / 2 },
      shadowOpacity: opacity,
      shadowRadius: elevation,
    },
    android: { elevation },
    default: {},
  });
}

export const shadows = {
  card: shadow(3, 0.25),
  panel: shadow(6, 0.3),
  floating: shadow(10, 0.35),
};
