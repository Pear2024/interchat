'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type AutoRedirectProps = {
  to: string;
  delay?: number;
};

export default function AutoRedirect({ to, delay = 3000 }: AutoRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(to);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, router, to]);

  return null;
}
