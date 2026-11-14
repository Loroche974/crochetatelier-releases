// Colours copied from ui/theme/Theme.kt. Order: primary, onPrimary, primaryContainer, onPrimaryContainer,
// secondary, onSecondary, secondaryContainer, tertiary, background, surfaceContainer, surfaceContainerHigh.
import { DEFAULT_PALETTE } from './logic/season.js';

const C = {
  LAINE_PASTEL: {
    dark: ['#F2B5C9', '#4F1F32', '#6B3449', '#FFD9E3', '#C6C1F0', '#2E2A55', '#45406E', '#A6D8CF', '#1C1517', '#292123', '#33292C'],
    light: ['#9C4766', '#FFFFFF', '#FFD9E3', '#3E0420', '#5D5891', '#FFFFFF', '#E4DFFF', '#3D6B63', '#FFF8F8', '#F8ECEE', '#F2E5E8'],
  },
  TERRACOTTA: {
    dark: ['#FFB59A', '#5A1C05', '#7A3118', '#FFDBCF', '#E6C08D', '#412C06', '#5B421B', '#C8CA93', '#1D1310', '#2A1F1B', '#352925'],
    light: ['#A0472A', '#FFFFFF', '#FFDBCF', '#390C00', '#7A5926', '#FFFFFF', '#FFDDB0', '#5E6132', '#FFF8F5', '#F8EBE5', '#F2E4DE'],
  },
  SAUGE: {
    dark: ['#AFD0A6', '#1B3717', '#324E2C', '#CBEDC1', '#D7C3A3', '#3A2E17', '#52442B', '#A0CFD2', '#111410', '#1D211C', '#282B26'],
    light: ['#4A6741', '#FFFFFF', '#CBEDC1', '#062104', '#6B5B40', '#FFFFFF', '#F4DFBB', '#38656A', '#F8FAF2', '#ECEFE6', '#E6E9E0'],
  },
  LAVANDE: {
    dark: ['#CDBDFF', '#34275E', '#4B3E76', '#E8DDFF', '#C9C3DC', '#312E41', '#484459', '#EDB8CD', '#141318', '#211F26', '#2B2930'],
    light: ['#65558F', '#FFFFFF', '#E9DDFF', '#201047', '#625B71', '#FFFFFF', '#E8DEF8', '#7E5260', '#FDF7FF', '#F3EDF7', '#ECE6F0'],
  },
  COTON: {
    dark: ['#D9C4AE', '#3B2F22', '#534536', '#F6E0C9', '#CFC5BA', '#362F27', '#4D453C', '#B9CBB4', '#161412', '#221F1C', '#2D2A26'],
    light: ['#6E5B47', '#FFFFFF', '#F6E0C9', '#271909', '#6A5F55', '#FFFFFF', '#F2E3D6', '#52634F', '#FCF9F5', '#F3EEE8', '#EDE8E2'],
  },
  SAINT_VALENTIN: {
    dark: ['#FFB1C8', '#5E1133', '#8C1D47', '#FFD9E2', '#FFB3B0', '#561D1D', '#733334', '#FFB4AB', '#1F1014', '#2C1A20', '#37242A'],
    light: ['#C2185B', '#FFFFFF', '#FFD9E2', '#3F0019', '#8E4A5A', '#FFFFFF', '#FFD9DE', '#B3261E', '#FFF5F7', '#FBE7EC', '#F6DDE4'],
  },
  PAQUES: {
    dark: ['#F5C84C', '#3F2E00', '#5C4300', '#FFE08A', '#B2D38C', '#1F3703', '#354E18', '#E3B5F2', '#17150D', '#242118', '#2E2B22'],
    light: ['#7A5900', '#FFFFFF', '#FFE08A', '#261A00', '#4C6A2E', '#FFFFFF', '#CDEFA6', '#8B5A9E', '#FFFBEF', '#F6F1DE', '#F0EBD6'],
  },
  HALLOWEEN: {
    dark: ['#FF9F5A', '#4A1A00', '#8A3A00', '#FFDBC8', '#CDB4F5', '#35205C', '#4A2F73', '#A6D58F', '#15101C', '#221B2A', '#2D2535'],
    light: ['#B04A00', '#FFFFFF', '#FFDBC8', '#351000', '#5E3A87', '#FFFFFF', '#EBDCFF', '#3D6A2B', '#FFF8F3', '#F7EBE3', '#F1E4DC'],
  },
  // Christmas: deep pine green surfaces, bright red, gold accents.
  NOEL: {
    dark: ['#FF8A80', '#5C0008', '#A81C24', '#FFE3E0', '#F2C14E', '#3D2E00', '#2E5A3C', '#9FD8AC', '#0B2016', '#14301F', '#1C3B28'],
    light: ['#B3121B', '#FFFFFF', '#1E5631', '#FFFFFF', '#1E5631', '#FFFFFF', '#F6D77A', '#8A6A00', '#FBF3E6', '#E5EFE1', '#D9E8D4'],
  },
};
const ROLES = ['primary', 'on-primary', 'primary-container', 'on-primary-container', 'secondary', 'on-secondary', 'secondary-container', 'tertiary', 'background', 'surface-container', 'surface-container-high'];

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

/** Applies [settings].themeMode (SYSTEM/LIGHT/DARK) and palette as CSS variables on <html>. */
export function applyTheme(settings) {
  const dark = settings.themeMode === 'DARK' || (settings.themeMode !== 'LIGHT' && darkQuery.matches);
  const colors = (C[settings.palette] ?? C[DEFAULT_PALETTE])[dark ? 'dark' : 'light'];
  const root = document.documentElement;
  ROLES.forEach((r, i) => root.style.setProperty(`--${r}`, colors[i]));
  root.style.setProperty('--on-surface', dark ? '#ECE0E2' : '#211A1C');
  root.style.setProperty('--on-surface-variant', dark ? '#C4B8BB' : '#5A4F52');
  root.style.setProperty('--outline', dark ? '#5E5356' : '#CDBFC2');
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.dataset.palette = settings.palette;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors[8]);
}

export function onSystemThemeChange(fn) { darkQuery.addEventListener('change', fn); }
