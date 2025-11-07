"use client";
import { usePathname } from "next/navigation";
import NewBottomNavbar from "./BottomNavbar"; //./BottomNavbar.tsx
import { useEffect, useState } from "react";

export default function NavbarWrapper() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }
  
  // Hide navbar only on login page
  const hideNavbar = pathname === "/login";

  if (hideNavbar) {
    return null;
  }

  return <NewBottomNavbar />; //<BottomNavbar />
} 