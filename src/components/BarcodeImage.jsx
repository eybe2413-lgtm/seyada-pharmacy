import React, { useMemo } from 'react';

// Pure-JS EAN-13 renderer — no external barcode library required, so the
// app has one fewer runtime dependency to install/build. The encoding
// tables below are the fixed, standard EAN-13/UPC-A symbology (GS1).
const L_CODE = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G_CODE = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R_CODE = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function isValidEan13(digits) {
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[12]);
}

// Builds the sequence of bars as [position, width] pairs in module units.
function buildBars(digits) {
  const parity = PARITY[Number(digits[0])];
  let bits = '101'; // start guard
  for (let i = 0; i < 6; i++) {
    const d = Number(digits[i + 1]);
    bits += parity[i] === 'L' ? L_CODE[d] : G_CODE[d];
  }
  bits += '01010'; // center guard
  for (let i = 0; i < 6; i++) {
    bits += R_CODE[Number(digits[i + 7])];
  }
  bits += '101'; // end guard
  return bits;
}

export default function BarcodeImage({ value, height = 50 }) {
  const digits = useMemo(() => {
    if (!value) return null;
    const raw = String(value).trim();
    if (/^\d{12}$/.test(raw)) {
      // UPC-A is EAN-13 with a leading 0 — same symbology, just one fewer digit.
      const withPrefix = '0' + raw;
      return isValidEan13(withPrefix) ? withPrefix : null;
    }
    if (/^\d{13}$/.test(raw)) return isValidEan13(raw) ? raw : null;
    return null;
  }, [value]);

  if (!value) return null;

  if (!digits) {
    // Not a renderable EAN-13/UPC-A (e.g. a manufacturer code in another
    // format) — still show the code as readable text instead of nothing.
    return <div className="font-mono text-sm tracking-wider text-ink border border-line rounded-lg px-3 py-2 inline-block">{value}</div>;
  }

  const bits = buildBars(digits);
  const moduleWidth = 2;
  const width = bits.length * moduleWidth;
  const barHeight = height;

  let bars = [];
  let x = 0;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') bars.push(<rect key={i} x={x} y={0} width={moduleWidth} height={barHeight} fill="#16241F" />);
    x += moduleWidth;
  }

  return (
    <svg viewBox={`0 0 ${width} ${barHeight + 16}`} width={width} height={barHeight + 16} className="max-w-full">
      {bars}
      <text x={width / 2} y={barHeight + 13} textAnchor="middle" fontSize="11" fontFamily="monospace" fill="#16241F">
        {digits}
      </text>
    </svg>
  );
}
