"use client";

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { startDatabaseUpdateService } from '../services/databaseUpdateService';
import { useAppDispatch } from '../store/hooks';
import { setUserId } from '../features/chatbot/chatbotSlice';

const Chatbot = dynamic(() => import('./Chatbot'), { ssr: false });

export default function ChatbotInitializer() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const cachedUserId =
      localStorage.getItem('user_id') ||
      localStorage.getItem('email') ||
      'guest';

    dispatch(setUserId(cachedUserId));
    startDatabaseUpdateService();
  }, [dispatch]);

  return <Chatbot />;
}
