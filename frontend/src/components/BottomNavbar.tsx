"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
// import { FaHome, FaClipboardList, FaHistory, FaUser } from "react-icons/fa";
import React from "react";

export default function BottomNavbar() {
  const pathname = usePathname();
  const [qrHovered, setQrHovered] = React.useState(false);

  // Define nav items, with QR scanner in the center
  const navItems = [
    {
      href: "/",
      label: "Home",
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M3 12L12 3l9 9" />
          <path d="M9 21V9h6v12" />
        </svg>
      ),
      active: pathname === "/"
    },
    {
      href: "/inventory",
      label: "Inventory",
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
      active: pathname.startsWith("/inventory")
    },
    {
      href: "/qr-scanner",
      label: "Scan",
      isQR: true
    },
    {
      href: "/logs",
      label: "Logs",
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      active: pathname.startsWith("/logs")
    },
    {
      href: "/profile",
      label: "Profile",
      icon: (
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      ),
      active: pathname.startsWith("/profile")
    }
  ];

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the navbar */}
      <div style={{ height: 80, width: '100%' }} />
      <div style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        zIndex: 50,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
      }}>
        {/* Full-width background bar */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: 70,
          background: '#edf2f4', // Pastel minimal background
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 2px 16px rgba(24,40,72,0.10), 0 4px 24px rgba(24,40,72,0.08)', // Subtle blue shadow
          zIndex: 1,
        }} />
        {/* Evenly spaced nav content */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: 600,
          margin: '0 auto',
          height: 70,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          zIndex: 2,
          pointerEvents: 'auto',
        }}>
          {navItems.map((item, idx) =>
            item.isQR ? (
              <Link
                key={item.href}
                href={item.href}
                className="navbar-icon qr"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 72,
                  height: 72,
                  background: '#c9184a', // pastel red
                  borderRadius: '100%',
                  border: '7px solid #fff',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                  color: '#fff',
                  fontSize: 36,
                  pointerEvents: 'auto',
                  marginTop: -36,
                  transition: 'box-shadow 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={() => setQrHovered(true)}
                onMouseLeave={() => setQrHovered(false)}
              >
                <span style={{position:'relative',width:36,height:36,display:'inline-block'}}>
                  {/* QR icon (default) */}
                  <svg width="36" height="36" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24" style={{
                    position:'absolute',left:0,top:0,opacity: qrHovered ? 0 : 1,transition:'opacity 0.28s cubic-bezier(0.4,0,0.2,1)'}}>
                    <rect x="3" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="14" width="7" height="7" rx="2" />
                    <rect x="3" y="14" width="7" height="7" rx="2" />
                  </svg>
                  {/* Plus/X icon (hover) */}
                  <svg width="36" height="36" fill="none" stroke="#fff" strokeWidth="3" viewBox="0 0 24 24" style={{
                    position:'absolute',left:0,top:0,opacity: qrHovered ? 1 : 0,transition:'opacity 0.28s cubic-bezier(0.4,0,0.2,1),transform 0.32s cubic-bezier(0.4,0,0.2,1)',transform: qrHovered ? 'rotate(90deg)' : 'rotate(0deg)'}}>
                    <line x1="12" y1="6" x2="12" y2="18" />
                    <line x1="6" y1="12" x2="18" y2="12" />
                  </svg>
                </span>
              </Link>
            ) : (
              <NavItem key={item.href} href={item.href} label={item.label} active={!!item.active} icon={item.icon} />
            )
          )}
        </div>
      </div>
      <style jsx>{`
        .navbar-icon, .navbar-icon:visited, .navbar-icon:active, .navbar-icon:focus, .navbar-icon .navbar-label, .navbar-icon * {
          text-decoration: none !important;
          color: inherit !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .navbar-icon:hover .navbar-svg-wrapper,
        .navbar-icon.active .navbar-svg-wrapper {
          background: #182848;
        }
        .navbar-icon:hover .navbar-svg-wrapper svg,
        .navbar-icon.active .navbar-svg-wrapper svg {
          stroke: #fff;
        }
        .navbar-svg-wrapper {
          width: 32px;
          height: 32px;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.25s, transform 0.25s;
        }
        .navbar-svg-wrapper svg {
          width: 28px;
          height: 28px;
          stroke: #6b7280;
          transition: stroke 0.25s, transform 0.25s;
        }
        .navbar-label {
          font-size: 13px;
          color: #222;
          margin: 0;
          font-family: 'Poppins', sans-serif;
          font-weight: 500;
          letter-spacing: 0.01em;
          text-decoration: none !important;
        }
        .navbar-icon.active {
          color: #182848 !important;
        }
        .navbar-icon.active .navbar-svg-wrapper {
          background: #182848;
          transform: scale(1.12);
        }
        .navbar-icon.active .navbar-svg-wrapper svg {
          stroke: #3b82f6;
          transform: scale(1.12);
        }
        .navbar-icon.qr {
          background: #b91c1c !important;
          border: 5px solid #fff;
          box-shadow: 0 2px 8px rgba(24,40,72,0.10);
          color: #fff;
          font-size: 32px;
          margin-top: -28px;
          border-radius: 50%;
          padding: 0;
          width: 56px !important;
          height: 56px !important;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .navbar-icon.qr svg {
          width: 28px !important;
          height: 28px !important;
          stroke: #fff;
        }
        @media (max-width: 700px) {
          div[style*='max-width: 600px'] {
            max-width: 100vw !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
          div[style*='height: 70px'] {
            height: 60px !important;
          }
          .navbar-svg-wrapper {
            width: 24px !important;
            height: 24px !important;
            margin-bottom: 4px !important;
          }
          .navbar-svg-wrapper svg {
            width: 20px !important;
            height: 20px !important;
          }
          .navbar-icon.qr {
            width: 44px !important;
            height: 44px !important;
            font-size: 24px !important;
            margin-top: -18px !important;
            border-width: 4px !important;
          }
        }
      `}</style>
    </>
  );
}

function NavItem({ href, label, active, icon }: { href: string, label: string, active: boolean, icon: React.ReactNode }) {
  // Use a simple, matching home icon SVG
  const homeIcon = (
    <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M4 12L12 5l8 7" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
  const isHome = label.toLowerCase() === 'home';
  const [hovered, setHovered] = React.useState(false);
  const isActiveOrHover = active || hovered;
  const mutedGray = '#8d99ae';
  const blue = '#2b2d42';
  // Thicken the icon outline on hover/active for all icons
  let iconToRender = isHome ? homeIcon : icon;
  if (
    React.isValidElement(iconToRender) &&
    typeof iconToRender.type === 'string' &&
    iconToRender.type === 'svg'
  ) {
    const svgProps = iconToRender.props as React.SVGProps<SVGSVGElement>;
    iconToRender = React.cloneElement(iconToRender, {
      strokeWidth: isActiveOrHover ? 3 : 2,
      stroke: 'currentColor',
      ...svgProps,
    });
  }
  return (
    <Link
      href={href}
      className={`navbar-icon${active ? ' active' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        color: isActiveOrHover ? blue : mutedGray,
        background: 'none',
        borderRadius: 12,
        padding: '6px 0 2px 0',
        fontWeight: 500,
        fontFamily: 'Poppins, sans-serif',
        boxShadow: 'none',
        outline: 'none',
        minWidth: 48,
        transition: 'color 0.32s cubic-bezier(0.4,0,0.2,1)',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className="navbar-svg-wrapper"
        style={{
          width: 32,
          height: 32,
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: active ? 'rgba(43,45,66,0.08)' : 'none',
          transition: 'color 0.32s cubic-bezier(0.4,0,0.2,1), background 0.32s cubic-bezier(0.4,0,0.2,1), transform 0.32s cubic-bezier(0.4,0,0.2,1)',
          color: isActiveOrHover ? blue : mutedGray,
          transform: isActiveOrHover ? 'scale(1.15)' : 'scale(1)',
        }}
      >
        {iconToRender}
      </span>
      <span
        className="navbar-label"
        style={{
          fontSize: 13,
          color: isActiveOrHover ? blue : '#222',
          margin: 0,
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 500,
          letterSpacing: '0.01em',
          textDecoration: 'none',
          transition: 'color 0.32s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {label}
      </span>
    </Link>
  );
} 

  