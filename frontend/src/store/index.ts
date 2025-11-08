import { configureStore, combineReducers } from '@reduxjs/toolkit';
import type { Reducer, Middleware, AnyAction } from 'redux';
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import createWebStorage from 'redux-persist/lib/storage/createWebStorage';
import chatbotReducer from '../features/chatbot/chatbotSlice';

// Create a noop storage fallback for SSR
const createNoopStorage = () => {
  return {
    getItem(_key: string) {
      return Promise.resolve(null);
    },
    setItem(_key: string, value: any) {
      return Promise.resolve(value);
    },
    removeItem(_key: string) {
      return Promise.resolve();
    },
  };
};

// Use localStorage if available (client-side), otherwise use noop (SSR)
let storage: any;
try {
  if (typeof window !== 'undefined') {
    storage = createWebStorage('local');
    console.log('[store] ✅ Using localStorage for persistence');
  } else {
    storage = createNoopStorage();
    console.log('[store] ⚠️ Using noop storage (SSR)');
  }
} catch (error) {
  console.error('[store] ❌ Failed to create storage, using noop', error);
  storage = createNoopStorage();
}

const rootReducer = combineReducers({
  chatbot: chatbotReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

// Debug middleware to log rehydration and persistence results
const rehydrateLoggerMiddleware: Middleware = () => (next) => (action: AnyAction) => {
  if (action.type === PERSIST) {
    try {
      const key = (action as any).key;
      const payload = (action as any).payload;
      const result = (action as any).result;
      
      // Log all PERSIST actions with details
      console.log('[persist][PERSIST] 💾 Persisting state to localStorage', {
        key,
        hasPayload: Boolean(payload),
        hasResult: Boolean(result),
        payloadKeys: payload ? Object.keys(payload) : [],
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[persist][PERSIST] Error logging', e);
    }
  }
  
  if (action.type === REHYDRATE) {
    try {
      const key = (action as any).key;
      const payload = (action as any).payload;
      const hasPayload = Boolean(payload);
      const err = (action as any).err;
      
      // Extract message count from payload if available
      let messageCount = 0;
      let isOpen = false;
      if (payload && payload.chatbot) {
        try {
          const chatbotState = typeof payload.chatbot === 'string' 
            ? JSON.parse(payload.chatbot) 
            : payload.chatbot;
          messageCount = chatbotState?.messages?.length || 0;
          isOpen = chatbotState?.isOpen || false;
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      if (err) {
        console.error('[persist][REHYDRATE] ❌ Rehydration failed', {
          key,
          error: err,
          timestamp: new Date().toISOString()
        });
      } else if (hasPayload) {
        console.log('[persist][REHYDRATE] ✅ Rehydration successful', {
          key,
          hasPayload: true,
          messageCount,
          isOpen,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log('[persist][REHYDRATE] ⚠️ No payload found (first time or cleared)', {
          key,
          hasPayload: false,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('[persist][REHYDRATE] logging failed', e);
    }
  }
  return next(action);
};

export const makeStore = (userId: string) => {
  const key = `chatbot-${userId || 'guest'}`;
  const persistConfig = {
    key,
    storage,
    whitelist: ['chatbot'],
    // Add debug option to see what's being persisted
    debug: process.env.NODE_ENV === 'development',
  } as const;
  
  console.log('[store] 🔧 Creating store with persist config', {
    key,
    userId,
    whitelist: persistConfig.whitelist,
    timestamp: new Date().toISOString()
  });

  const persistedReducer = persistReducer(
    persistConfig,
    rootReducer
  ) as Reducer<RootState>;

  const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }).concat(rehydrateLoggerMiddleware),
  });

  const persistor = persistStore(store, undefined, () => {
    try {
      console.log('[persist] ✅ Bootstrap complete', {
        key,
        timestamp: new Date().toISOString()
      });
    } catch {}
  });

  try {
    // Subscribe to store changes to log when state is persisted
    let lastMessageCount = 0;
    let lastStateString = '';
    store.subscribe(() => {
      const state = store.getState();
      const currentMessageCount = state.chatbot?.messages?.length || 0;
      const currentStateString = JSON.stringify(state.chatbot?.messages || []);
      
      // Only log if message count changed OR if messages content changed
      if (currentMessageCount !== lastMessageCount || currentStateString !== lastStateString) {
        lastMessageCount = currentMessageCount;
        lastStateString = currentStateString;
        
        console.log('[persist] 💾 State changed, will persist', {
          key,
          messageCount: currentMessageCount,
          isOpen: state.chatbot?.isOpen,
          lastMessage: state.chatbot?.messages?.[currentMessageCount - 1]?.text?.substring(0, 30) || 'none',
          timestamp: new Date().toISOString()
        });
        
        // Check localStorage after a delay to verify persistence (redux-persist debounces)
        setTimeout(() => {
          try {
            const stored = localStorage.getItem(`persist:${key}`);
            if (stored) {
              const parsed = JSON.parse(stored);
              const chatbotState = parsed.chatbot ? JSON.parse(parsed.chatbot) : null;
              const storedMessageCount = chatbotState?.messages?.length || 0;
              const storedLastMessage = chatbotState?.messages?.[storedMessageCount - 1]?.text?.substring(0, 30) || 'none';
              console.log('[persist] 🔍 Verified localStorage', {
                key: `persist:${key}`,
                storedMessageCount,
                currentMessageCount,
                matches: storedMessageCount === currentMessageCount,
                storedLastMessage,
                currentLastMessage: state.chatbot?.messages?.[currentMessageCount - 1]?.text?.substring(0, 30) || 'none',
                storedMessages: chatbotState?.messages?.map((m: any) => ({ 
                  role: m.role, 
                  text: m.text?.substring(0, 40) || 'no text',
                  timestamp: m.timestamp 
                })) || [],
                currentMessages: state.chatbot?.messages?.map(m => ({ 
                  role: m.role, 
                  text: m.text?.substring(0, 40) || 'no text',
                  timestamp: m.timestamp 
                })) || [],
                timestamp: new Date().toISOString()
              });
              
              // Also log the raw localStorage data for debugging
              if (storedMessageCount !== currentMessageCount) {
                console.warn('[persist] ⚠️ Mismatch detected!', {
                  stored: JSON.parse(stored).chatbot ? JSON.parse(JSON.parse(stored).chatbot).messages.length : 0,
                  current: currentMessageCount,
                  rawStorage: stored.substring(0, 200) + '...'
                });
              }
            } else {
              console.warn('[persist] ⚠️ No data found in localStorage', {
                key: `persist:${key}`,
                timestamp: new Date().toISOString()
              });
            }
          } catch (err) {
            console.error('[persist] ❌ Failed to verify localStorage', err);
          }
        }, 500); // Increased delay to account for redux-persist debouncing
      }
    });
    
    persistor.subscribe(() => {
      const s = persistor.getState();
      if (s.bootstrapped) {
        console.log('[persist] 📦 Persistor state', {
          key,
          bootstrapped: s.bootstrapped,
          registry: Object.keys(s.registry || {}),
          timestamp: new Date().toISOString()
        });
      }
    });
  } catch {}

  return { store, persistor };
};

export type StoreBundle = ReturnType<typeof makeStore>;
export type AppStore = StoreBundle['store'];
export type AppDispatch = AppStore['dispatch'];
