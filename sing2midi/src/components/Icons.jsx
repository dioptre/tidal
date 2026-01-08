import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

// Common props for all icons
const defaultProps = {
  width: 18,
  height: 18,
  strokeWidth: 2,
  stroke: "currentColor",
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

export const ListMusicIcon = ({ size = 18, color = "#fff", ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...defaultProps} stroke={color} {...props}>
    <Path d="M21 15V6" />
    <Path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    <Path d="M12 12H3" />
    <Path d="M16 6H3" />
    <Path d="M12 18H3" />
  </Svg>
);

export const PlayIcon = ({ size = 18, color = "#fff", filled = false, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...defaultProps} stroke={color} fill={filled ? color : "none"} {...props}>
    <Path d="M6 4v16a1 1 0 0 0 1.524.852l13-8a1 1 0 0 0 0-1.704l-13-8A1 1 0 0 0 6 4" />
  </Svg>
);

export const SquareIcon = ({ size = 18, color = "#fff", filled = false, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...defaultProps} stroke={color} fill={filled ? color : "none"} {...props}>
    <Rect width="18" height="18" x="3" y="3" rx="2" />
  </Svg>
);

export const KeyboardMusicIcon = ({ size = 18, color = "#fff", ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...defaultProps} stroke={color} {...props}>
    <Rect width="20" height="16" x="2" y="4" rx="2" />
    <Path d="M6 8v4" />
    <Path d="M10 8v4" />
    <Path d="M14 8v4" />
    <Path d="M18 8v4" />
    <Path d="M6 20v-4" />
    <Path d="M10 20v-4" />
    <Path d="M14 20v-4" />
    <Path d="M18 20v-4" />
  </Svg>
);

export const Trash2Icon = ({ size = 18, color = "#fff", ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...defaultProps} stroke={color} {...props}>
    <Path d="M3 6h18" />
    <Path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <Path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <Path d="m10 11 0 6" />
    <Path d="m14 11 0 6" />
  </Svg>
);

export const RotateCcwIcon = ({ size = 18, color = "#fff", ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...defaultProps} stroke={color} {...props}>
    <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <Path d="M3 3v5h5" />
  </Svg>
);

export const UploadIcon = ({ size = 18, color = "#fff", ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...defaultProps} stroke={color} {...props}>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Path d="m17 8-5-5-5 5" />
    <Path d="M12 3v12" />
  </Svg>
);

export const DownloadIcon = ({ size = 18, color = "#fff", ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...defaultProps} stroke={color} {...props}>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Path d="m7 10 5 5 5-5" />
    <Path d="M12 15V3" />
  </Svg>
);

export const MicVocalIcon = ({ size = 18, color = "#fff", ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...defaultProps} stroke={color} {...props}>
    <Path d="M10.828 10.828 12 12m-1.172-1.172a4 4 0 1 1 5.656 5.656m-5.656-5.656 5.656 5.656m0 0L12 12m5.656 5.656A4 4 0 0 1 12 20" />
    <Path d="M12 8a4 4 0 0 0-4 4v4" />
    <Path d="M12 16v4" />
    <Path d="M8 22h8" />
  </Svg>
);

export const WaveformIcon = ({ size = 18, color = "#fff", ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...defaultProps} stroke={color} {...props}>
    <Path d="M2 12h2" />
    <Path d="M6 8v8" />
    <Path d="M10 6v12" />
    <Path d="M14 4v16" />
    <Path d="M18 8v8" />
    <Path d="M22 12h-2" />
  </Svg>
);

export const MenuIcon = ({ size = 18, color = "#fff", ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...defaultProps} stroke={color} {...props}>
    <Path d="M3 12h18" />
    <Path d="M3 6h18" />
    <Path d="M3 18h18" />
  </Svg>
);

export const CircleHelpIcon = ({ size = 18, color = "#fff", ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" {...defaultProps} stroke={color} {...props}>
    <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10" />
    <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <Path d="M12 17h.01" />
  </Svg>
);
