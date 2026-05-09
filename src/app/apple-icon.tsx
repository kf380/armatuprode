import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Apple touch icon — 180×180 PNG. Apple Safari ignores SVG icons, so we
 * render the CheckBall mark via ImageResponse (Satori) into a PNG at build.
 *
 * Visually equivalent to /icon.svg but in raster form. The squircle is a
 * div with border-radius; the SVG paths stay as raw SVG inside.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0B1220",
          borderRadius: "22%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="160" height="160" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M48 22 L70 38 L61.6 64 L34.4 64 L26 38 Z"
            fill="none"
            stroke="#10B981"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M40 50 L50 60 L78 30"
            stroke="#F5B82E"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="48" cy="42" r="3" fill="#10B981" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
