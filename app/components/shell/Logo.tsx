import Image from "next/image";

// The supplied logo, unaltered. Only ever place it on pure black (--cm-black).
const LOGO = { src: "/citymood-logo.png", width: 1280, height: 1259 };

type Props = {
  /** Largest display height in px; CSS classes may render it smaller. Never below 64. */
  height: number;
  className?: string;
  alt?: string;
  eager?: boolean;
};

export function Logo({ height, className, alt = "CityMood", eager = false }: Props) {
  return (
    <Image
      src={LOGO.src}
      alt={alt}
      width={Math.round((height * LOGO.width) / LOGO.height)}
      height={height}
      quality={90}
      loading={eager ? "eager" : "lazy"}
      className={`block w-auto ${className ?? ""}`}
    />
  );
}
