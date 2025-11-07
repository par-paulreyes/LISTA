"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import Chatbot from './Chatbot';

export default function ChatbotRoutes() {
  const pathname = usePathname() || '/';
  // Don't show chatbot on dashboard (/) since it's embedded in the AI Assistant card
  // Show on other pages like /inventory, /logs, etc.
  if (pathname === '/') return null;
  const show = pathname.startsWith('/inventory') || pathname.startsWith('/logs') || pathname.startsWith('/assistant');
  if (!show) return null;
  return <Chatbot />;
}


