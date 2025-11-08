"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { apiClient } from "../config/api";

export default function TopNavbar() {
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
    if (!token) return;
    
    apiClient.get("/users/profile")
      .then((response) => {
        setUser(response.data);
        try {
          const userId = response.data?.id ? String(response.data.id) : null;
          if (userId) {
            localStorage.setItem('user_id', userId);
            // Dispatch event to notify Redux provider of user change
            window.dispatchEvent(new CustomEvent('chatbot-user-changed', {
              detail: { userId }
            }));
          }
          if (response.data?.email) localStorage.setItem('email', String(response.data.email));
        } catch (err) {
          console.warn('Failed to cache user identity for chatbot', err);
        }
      })
      .catch(() => setUser(null));
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      zIndex: 50,
      pointerEvents: 'none',
    }}>
      {/* Full-width background bar */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        width: '100vw',
        height: 64,
        background: '#182848',
        borderRadius: '0 0 20px 20px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
        zIndex: 1,
      }} />
      {/* Nav content flush left */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 600,
        margin: '0',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: '0 0 0 32px',
        zIndex: 2,
        pointerEvents: 'auto',
      }}>
        {/* Left-aligned logo and greeting */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', minWidth: 0 }}>
          <Image src="/dtc-logo.png" alt="DTC Logo" width={40} height={40} style={{ objectFit: 'contain', flexShrink: 0 }} priority />
          <div style={{ 
            marginLeft: 14, 
            color: '#fff', 
            fontWeight: 600, 
            fontSize: '1.1rem', 
            whiteSpace: 'nowrap', 
            textOverflow: 'ellipsis', 
            overflow: 'hidden', 
            minWidth: 0,
            fontFamily: 'Poppins, sans-serif'
          }}>
            Hello{!mounted || user ? `! ` : '!' }
            {mounted && user && <span style={{ color: '#e11d48', fontWeight: 700 }}>{user.full_name || user.username}</span>}
          </div>
        </div>
        {/* Right side empty for now */}
      </div>
      <style jsx>{`
        @media (max-width: 700px) {
          div[style*='max-width: 600px'] {
            max-width: 100vw !important;
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          div[style*='height: 64px'] {
            height: 54px !important;
          }
          img[alt='DTC Logo'] {
            width: 32px !important;
            height: 32px !important;
          }
          div[style*='font-size: 1.1rem'] {
            font-size: 1rem !important;
          }
        }
      `}</style>
    </div>
  );
} 