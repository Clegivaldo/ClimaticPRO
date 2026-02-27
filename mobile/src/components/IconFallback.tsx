import React from 'react';
import { Text } from 'react-native';

interface Props {
  name: string;
  size?: number;
  color?: string;
}

export const IconFallback: React.FC<Props> = ({ name, size = 20, color = '#000' }) => {
  try {
    // Try to load lucide-react-native dynamically
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lucide = require('lucide-react-native');
    if (lucide && lucide[name]) {
      const Comp = lucide[name];
      return <Comp size={size} color={color} /> as any;
    }
  } catch (e) {
    // ignore
  }

  // Fallback simple text placeholder
  return <Text style={{ fontSize: size, color }}>{name}</Text>;
};

export default IconFallback;
