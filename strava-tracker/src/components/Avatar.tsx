import Image from "next/image";

const PALETTE = ["#3DDC84", "#5C7CFA", "#FF922B", "#B197FC", "#3BC9DB", "#FF5C48"];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";
}

export default function Avatar({
  id,
  firstName,
  lastName,
  photoUrl,
  size = 40,
}: {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: number;
}) {
  const style = { width: size, height: size };

  if (photoUrl) {
    return (
      <div className="relative overflow-hidden rounded-lg shrink-0 bg-panel" style={style}>
        <Image
          src={photoUrl}
          alt={`${firstName} ${lastName}`}
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-lg shrink-0 font-display font-bold text-bg"
      style={{ ...style, backgroundColor: colorForId(id), fontSize: size * 0.38 }}
    >
      {initials(firstName, lastName)}
    </div>
  );
}
