import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

/** Paleta institucional Tecnológico Comfenalco */
export const brand = {
  navy: '#2c438f',
  navyDark: '#1f3170',
  navyLight: '#3d56a8',
  red: '#dc3545',
  accent: '#3d56a8',
  surface: '#F5F7FA',
  white: '#FFFFFF',
  text: '#1E293B',
  muted: '#64748B',
  border: '#E2E8F0',
} as const

export const ComfenalcoPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef1f9',
      100: '#d5dcf0',
      200: '#aebce1',
      300: '#8699d0',
      400: '#5a72b8',
      500: '#2c438f',
      600: '#263c80',
      700: '#1f3170',
      800: '#18265a',
      900: '#121c42',
      950: '#0b1228',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{primary.500}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}',
        },
        highlight: {
          background: '{primary.50}',
          focusBackground: '{primary.100}',
          color: '{primary.700}',
          focusColor: '{primary.800}',
        },
        surface: {
          0: '#ffffff',
          50: '#F5F7FA',
          100: '#EEF2F6',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
      },
    },
  },
})
