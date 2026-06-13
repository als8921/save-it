"use client";

import { useState } from "react";
import { Globe } from "lucide-react";

export function LinkFavicon({ host }: { host: string }) {
  const [error, setError] = useState(false);
  if (!host || error) {
    return <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-4 w-4 shrink-0 rounded-sm"
      onError={() => setError(true)}
    />
  );
}
