"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function ConditionalTopNavbar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  if (pathname === "/login") return null;
  return null;
} 

