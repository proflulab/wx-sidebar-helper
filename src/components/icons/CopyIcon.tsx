import React from "react";

type Props = {
  size?: number;
  color?: string;
};

export default function CopyIcon({ size = 20, color = "#1677ff" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="9" width="10" height="10" rx="2" stroke={color} strokeWidth="2" />
      <rect x="5" y="5" width="10" height="10" rx="2" stroke={color} strokeWidth="2" opacity="0.6" />
    </svg>
  );
}