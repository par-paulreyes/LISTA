"use client";

import { ReactNode, useEffect, useRef, useState } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { makeStore, StoreBundle } from '../store';
import { setUserId, setMessages } from '../features/chatbot/chatbotSlice';

interface ReduxProviderProps {
  children: ReactNode;
}

function readUserId(): string {
  try {
    if (typeof window === 'undefined') return 'guest';
    return (
      localStorage.getItem('user_id') ||
      localStorage.getItem('email') ||
      'guest'
    );
  } catch {
    return 'guest';
  }
}

/**
 * Migrates guest chat data to user-specific key when user logs in
 */
function migrateGuestChats(userId: string): void {
  if (typeof window === 'undefined' || userId === 'guest') return;
  
  try {
    const guestKey = 'persist:chatbot-guest';
    const userKey = `persist:chatbot-${userId}`;
    
    // Check if guest data exists and user data doesn't
    const guestData = localStorage.getItem(guestKey);
    const userData = localStorage.getItem(userKey);
    
    if (guestData && !userData) {
      console.log('[redux-provider] Migrating guest chats to user', { userId, guestKey, userKey });
      localStorage.setItem(userKey, guestData);
      // Optionally clear guest data after migration
      // localStorage.removeItem(guestKey);
    }
  } catch (err) {
    console.warn('[redux-provider] Failed to migrate guest chats', err);
  }
}

export default function ReduxProvider({ children }: ReduxProviderProps) {
  // Read userId synchronously on mount (before any async operations)
  const initialUserId = typeof window !== 'undefined' ? readUserId() : 'guest';
  const [bundle, setBundle] = useState<StoreBundle | null>(null);
  const currentUserIdRef = useRef<string>(initialUserId);

  // Initialize store immediately with the userId read synchronously
  useEffect(() => {
    const uid = initialUserId;
    currentUserIdRef.current = uid;
    
    // Migrate guest chats if user is logging in
    if (uid !== 'guest') {
      migrateGuestChats(uid);
    }
    
    const created = makeStore(uid);
    created.store.dispatch(setUserId(uid));
    
    console.log('[redux-provider] ✅ Store initialized', {
      userId: uid,
      persistKey: `chatbot-${uid}`,
      timestamp: new Date().toISOString()
    });
    
    setBundle(created);
  }, []); // Empty deps - only run once on mount

  // Listen for user changes (e.g., after login)
  useEffect(() => {
    const onUserChanged = (e: any) => {
      const nextId = e?.detail?.userId ?? e?.detail ?? readUserId();
      if (!nextId || nextId === currentUserIdRef.current) {
        console.log('[redux-provider] ⏭️ User change ignored', {
          nextId,
          currentId: currentUserIdRef.current,
          reason: !nextId ? 'no userId' : 'same userId'
        });
        return;
      }
      
      console.log('[redux-provider] 🔄 User changed, rebuilding store', {
        oldUserId: currentUserIdRef.current,
        newUserId: nextId,
        oldPersistKey: `chatbot-${currentUserIdRef.current}`,
        newPersistKey: `chatbot-${nextId}`,
        timestamp: new Date().toISOString()
      });
      
      // Migrate guest chats if user is logging in
      if (nextId !== 'guest') {
        migrateGuestChats(nextId);
      }
      
      const oldUserId = currentUserIdRef.current;
      currentUserIdRef.current = nextId;
      const created = makeStore(nextId);
      created.store.dispatch(setUserId(nextId));
      
      // Try to migrate messages from old store if available
      try {
        const oldKey = `persist:chatbot-${oldUserId}`;
        const oldData = localStorage.getItem(oldKey);
        if (oldData) {
          const parsed = JSON.parse(oldData);
          if (parsed.chatbot) {
            const chatbotState = JSON.parse(parsed.chatbot);
            if (chatbotState.messages && chatbotState.messages.length > 0) {
              created.store.dispatch(setMessages(chatbotState.messages));
              console.log('[redux-provider] ✅ Migrated messages from old store', {
                oldUserId,
                newUserId: nextId,
                messageCount: chatbotState.messages.length
              });
            }
          }
        }
      } catch (err) {
        console.warn('[redux-provider] Failed to migrate messages', err);
      }
      
      setBundle(null);
      setBundle(created);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('chatbot-user-changed', onUserChanged as EventListener);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('chatbot-user-changed', onUserChanged as EventListener);
      }
    };
  }, []);

  // Fallback: Check for userId changes periodically (in case event wasn't dispatched)
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const uid = readUserId();
      if (uid && uid !== currentUserIdRef.current) {
        console.log('[redux-provider] ⚠️ Late userId detected, rebuilding', {
          oldUserId: currentUserIdRef.current,
          newUserId: uid,
          persistKey: `chatbot-${uid}`,
          timestamp: new Date().toISOString()
        });
        currentUserIdRef.current = uid;
        migrateGuestChats(uid);
        const created = makeStore(uid);
        created.store.dispatch(setUserId(uid));
        setBundle(created);
      }
    }, 500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);

  if (!bundle) {
    return null; // Wait for store initialization
  }

  return (
    <Provider store={bundle.store}>
      <PersistGate
        loading={null}
        persistor={bundle.persistor}
        onBeforeLift={() => {
          console.log('[redux-provider] ✅ PersistGate lifted', {
            userId: currentUserIdRef.current,
            persistKey: `chatbot-${currentUserIdRef.current}`,
            timestamp: new Date().toISOString()
          });
        }}
      >
        {children}
      </PersistGate>
    </Provider>
  );
}
