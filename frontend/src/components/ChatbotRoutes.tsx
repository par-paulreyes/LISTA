"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import Chatbot from './Chatbot';

export default function ChatbotRoutes() {
  const pathname = usePathname() || '/';
  const show = pathname === '/' || pathname.startsWith('/inventory') || pathname.startsWith('/logs');
  if (!show) return null;
  return <Chatbot />;
}


