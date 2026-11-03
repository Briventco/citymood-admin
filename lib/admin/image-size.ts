// Reads the real type and pixel size of an uploaded image from its header, so
// the server never trusts what the browser says about a file.

export type ImageInfo = { type: "image/webp" | "image/jpeg" | "image/png"; ext: "webp" | "jpg" | "png"; width: number; height: number };

export function imageInfo(b: Uint8Array): ImageInfo | null {
  const ascii = (at: number, len: number) => String.fromCharCode(...b.subarray(at, at + len));
  const u16be = (at: number) => (b[at] << 8) | b[at + 1];
  const u16le = (at: number) => b[at] | (b[at + 1] << 8);
  const u24le = (at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
  const u32be = (at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;

  if (b.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return { type: "image/webp", ext: "webp", width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    }
    if (chunk === "VP8L" && b[20] === 0x2f) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { type: "image/webp", ext: "webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") return { type: "image/webp", ext: "webp", width: u24le(24) + 1, height: u24le(27) + 1 };
    return null;
  }

  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 3) === "PNG" && ascii(12, 4) === "IHDR") {
    return { type: "image/png", ext: "png", width: u32be(16), height: u32be(20) };
  }

  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      // Start-of-frame markers carry the size (not DHT 0xC4, JPG 0xC8 or DAC 0xCC).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: "image/jpeg", ext: "jpg", width: u16be(i + 7), height: u16be(i + 5) };
      }
      i += 2 + u16be(i + 2);
    }
  }
  return null;
}
