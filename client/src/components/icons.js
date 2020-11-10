import React from 'react';

const iconUpArrow = (
  <svg class="icon" width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 25L13 2M13 2L4 10.8864M13 2L22 10.8864" stroke="#483E5E" stroke-width="2" stroke-linejoin="round" />
  </svg>
);

const iconDownArrow = (
  <svg class="icon" width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 1V24M13 24L22 15.1136M13 24L4 15.1136" stroke="#483E5E" stroke-width="2" stroke-linejoin="round" />
  </svg>
);

const iconBank = (
  <svg class="icon" width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="7" y1="25" x2="7" y2="12" stroke="#483E5E" stroke-width="2" />
    <path d="M35 10H3L19 2L35 10Z" stroke="#483E5E" stroke-width="2" stroke-linejoin="bevel" />
    <line x1="31" y1="25" x2="31" y2="12" stroke="#483E5E" stroke-width="2" />
    <line x1="23" y1="25" x2="23" y2="12" stroke="#483E5E" stroke-width="2" />
    <line x1="15" y1="25" x2="15" y2="12" stroke="#483E5E" stroke-width="2" />
    <path d="M5 27H33V31H5V27Z" stroke="#483E5E" stroke-width="2" />
    <rect x="3" y="31" width="32" height="4" stroke="#483E5E" stroke-width="2" />
  </svg>
);

const iconX = (
  <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 8L15 1M8 8L15 15M8 8L1 15M8 8L1 1" stroke="#483E5E" stroke-width="1.5" />
  </svg>
);

export { iconUpArrow, iconDownArrow, iconBank, iconX };
