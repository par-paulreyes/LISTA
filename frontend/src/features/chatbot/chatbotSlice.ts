import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  text: string;
  data?: any;
  timestamp: number;
};

export interface ChatbotState {
  userId: string;
  messages: ChatMessage[];
  isOpen: boolean;
  position: { x: number; y: number };
  scrollPosition: number;
  pendingUpdateNotification: boolean;
  input: string;
  busy: boolean;
  typing: boolean;
  error: string | null;
  pendingPlan: { originalMessage: string; plan: any } | null;
}

const MAX_MESSAGES = 50;

const DEFAULT_MESSAGE: ChatMessage = {
  role: 'assistant',
  text: "Hi! I'm IVY, your inventory assistant. 👋\n\nI can help you with:\n• Finding items (\"show laptops\", \"find printers\")\n• Checking status (\"summary\", \"how many items\")\n• Maintenance tasks (\"items due for maintenance\")\n• Managing items (add, update, delete)\n• Reports and insights\n\nTry asking: \"Summarize inventory status\" or \"How many laptops are available?\"",
  timestamp: Date.now(),
};

const initialState: ChatbotState = {
  userId: 'guest',
  messages: [DEFAULT_MESSAGE],
  isOpen: false,
  position: { x: 20, y: 20 },
  scrollPosition: 0,
  pendingUpdateNotification: false,
  input: '',
  busy: false,
  typing: false,
  error: null,
  pendingPlan: null,
};

const chatbotSlice = createSlice({
  name: 'chatbot',
  initialState,
  reducers: {
    setUserId(state, action: PayloadAction<string>) {
      state.userId = action.payload || 'guest';
    },
    addMessage(state, action: PayloadAction<ChatMessage>) {
      console.log('[chatbot-slice] 🔵 addMessage reducer called', {
        role: action.payload.role,
        text: action.payload.text?.substring(0, 50) || 'no text',
        currentMessageCount: state.messages.length,
        timestamp: new Date().toISOString()
      });
      
      const beforeCount = state.messages.length;
      state.messages = [...state.messages, action.payload].slice(-MAX_MESSAGES);
      const afterCount = state.messages.length;
      
      console.log('[chatbot-slice] ✅ Message added to state', {
        role: action.payload.role,
        text: action.payload.text?.substring(0, 50) || 'no text',
        textLength: action.payload.text?.length || 0,
        beforeCount,
        afterCount,
        totalMessages: state.messages.length,
        allMessages: state.messages.map(m => ({ 
          role: m.role, 
          textLength: m.text?.length || 0,
          text: m.text?.substring(0, 30) || 'no text'
        })),
        timestamp: new Date().toISOString()
      });
    },
    setMessages(state, action: PayloadAction<ChatMessage[]>) {
      state.messages = action.payload.slice(-MAX_MESSAGES);
    },
    clearMessages(state) {
      state.messages = [
        {
          ...DEFAULT_MESSAGE,
          timestamp: Date.now(),
        },
      ];
    },
    setOpen(state, action: PayloadAction<boolean>) {
      state.isOpen = action.payload;
      if (action.payload) {
        state.pendingUpdateNotification = false;
      }
    },
    setPosition(state, action: PayloadAction<{ x: number; y: number }>) {
      state.position = action.payload;
    },
    setScrollPosition(state, action: PayloadAction<number>) {
      state.scrollPosition = action.payload;
    },
    setPendingUpdateNotification(state, action: PayloadAction<boolean>) {
      state.pendingUpdateNotification = action.payload;
    },
    setInput(state, action: PayloadAction<string>) {
      state.input = action.payload;
    },
    setBusy(state, action: PayloadAction<boolean>) {
      state.busy = action.payload;
    },
    setTyping(state, action: PayloadAction<boolean>) {
      state.typing = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setPendingPlan(state, action: PayloadAction<{ originalMessage: string; plan: any } | null>) {
      state.pendingPlan = action.payload;
    },
  },
});

export const {
  addMessage,
  setMessages,
  clearMessages,
  setOpen,
  setPosition,
  setScrollPosition,
  setPendingUpdateNotification,
  setUserId,
  setInput,
  setBusy,
  setTyping,
  setError,
  setPendingPlan,
} = chatbotSlice.actions;

export default chatbotSlice.reducer;