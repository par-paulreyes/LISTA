"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"

export default function BottomNavbar() {
  const pathname = usePathname()
  const [qrHovered, setQrHovered] = React.useState(false)

  // Define nav items, with QR scanner in the center
  const navItems = [
    {
      href: "/",
      label: "Dashboard",
      activeIcon: "/assets/icons/navbar_dashboard_active.svg",
      inactiveIcon: "/assets/icons/navbar_dashboard_inactive.svg",
      active: pathname === "/",
    },
    {
      href: "/inventory",
      label: "Inventory",
      activeIcon: "/assets/icons/navbar_inventory_active.svg",
      inactiveIcon: "/assets/icons/navbar_inventory_inactive.svg",
      active: pathname.startsWith("/inventory"),
    },
    {
      href: "/qr-scanner",
      label: "QR",
      activeIcon: "/assets/icons/navbar_qr_active.svg",
      inactiveIcon: "/assets/icons/navbar_qr_inactive.svg",
      active: pathname.startsWith("/qr-scanner"),
    },
    {
      href: "/logs",
      label: "Logs",
      activeIcon: "/assets/icons/navbar_logs_active.svg",
      inactiveIcon: "/assets/icons/navbar_logs_inactive.svg",
      active: pathname.startsWith("/logs"),
    },
    {
      href: "/profile",
      label: "Profile",
      activeIcon: "/assets/icons/navbar_profile_active.svg",
      inactiveIcon: "/assets/icons/navbar_profile_inactive.svg",
      active: pathname.startsWith("/profile"),
    },
  ]

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the navbar */}
      <div style={{ height: 80, width: "100%" }} />

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          width: "100vw",
          zIndex: 50,
          pointerEvents: "none",
          display: "flex",
          justifyContent: "center",
          background: "#ffffff",
          borderRadius: 0,
          borderTop: "1px solid #d1e3f8",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 800,
            height: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-evenly",
            pointerEvents: "auto",
            gap: 4,
            paddingLeft: 12,
            paddingRight: 12,
          }}
        >
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              active={!!item.active}
              activeIcon={item.activeIcon}
              inactiveIcon={item.inactiveIcon}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        .navbar-icon, .navbar-icon:visited, .navbar-icon:active, .navbar-icon:focus {
          text-decoration: none !important;
          color: inherit !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .navbar-icon.qr:hover {
          background: none; /* Remove circle style */
          box-shadow: none;
        }
        .navbar-label {
          font-size: 12px;
          color: #5C6C7D;
          margin: 0;
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-weight: 500;
          letter-spacing: 0.01em;
          text-decoration: none !important;
          transition: color 0.32s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .navbar-icon.active .navbar-label {
          color: #820000;
          font-weight: 600;
        }
        @media (max-width: 1024px) {
          /* Tablet and small desktop */
        }
        @media (max-width: 640px) {
          /* Mobile adjustments */
        }
      `}</style>
    </>
  )
}

function NavItem({
  href,
  label,
  active,
  activeIcon,
  inactiveIcon,
}: {
  href: string;
  label: string;
  active: boolean;
  activeIcon: string;
  inactiveIcon: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  const isActiveOrHover = active || hovered;

  return (
    <Link
      href={href}
      className={`navbar-icon${active ? " active" : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        background: "transparent",
        borderRadius: 12,
        padding: "8px 12px 4px 12px",
        fontWeight: 500,
        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        boxShadow: "none",
        outline: "none",
        minWidth: 56,
        transition: "all 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "pointer",
        gap: 4,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={isActiveOrHover ? activeIcon : inactiveIcon}
        alt={label}
        width={24}
        height={24}
        style={{
          transition: "opacity 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
      <span
        className="navbar-label"
        style={{
          fontSize: 12,
          color: isActiveOrHover ? "#820000" : "#5C6C7D",
          margin: 0,
          fontFamily:
            "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontWeight: isActiveOrHover ? 600 : 500,
          letterSpacing: "0.01em",
          textDecoration: "none !important",
          transition: "color 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          height: 3,
          width: 65,
          borderRadius: 2,
          marginTop: 2,
          background: active ? "#820000" : "transparent",
          display: "block",
          transition: "background 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </Link>
  );
}
