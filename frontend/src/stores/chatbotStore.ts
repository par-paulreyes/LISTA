import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ChatMessage = {
	role: 'user' | 'assistant' | 'system';
	text: string;
	data?: any;
	timestamp?: number;
};

export type ChatbotState = {
	messages: ChatMessage[];
	isOpen: boolean;
	position: { x: number; y: number };
	scrollPosition: number;
	input: string;
	busy: boolean;
	typing: boolean;
	error: string | null;
	pendingPlan: { originalMessage: string; plan: any } | null;
	databaseUpdated: boolean;
	pendingUpdateNotification: boolean;
	addMessage: (message: ChatMessage) => void;
	setMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
	clearMessages: () => void;
	toggleOpen: () => void;
	setOpen: (open: boolean) => void;
	setPosition: (position: { x: number; y: number }) => void;
	setScrollPosition: (scroll: number) => void;
	setInput: (value: string) => void;
	setBusy: (value: boolean) => void;
	setTyping: (value: boolean) => void;
	setError: (value: string | null) => void;
	setPendingPlan: (plan: { originalMessage: string; plan: any } | null) => void;
	setDatabaseUpdated: (value: boolean) => void;
	setPendingUpdateNotification: (value: boolean) => void;
};

let currentUserId = 'guest';
export const setChatbotUserId = (id?: string | null) => {
	currentUserId = (id && String(id).trim()) || 'guest';
};
export const getChatbotUserId = () => currentUserId;

const getScopedStorage = () => {
	if (typeof window === 'undefined') return undefined as any;
	const base = window.localStorage;
	return {
		getItem: (name: string) => base.getItem(`${name}-${currentUserId}`),
		setItem: (name: string, value: string) => base.setItem(`${name}-${currentUserId}`, value),
		removeItem: (name: string) => base.removeItem(`${name}-${currentUserId}`),
	};
};

const MESSAGE_LIMIT = 50;

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
	role: 'assistant',
	text: 'Hi! I\'m IVY, your inventory assistant. 👋\n\nI can help you with:\n• Finding items ("show laptops", "find printers")\n• Checking status ("summary", "how many items")\n• Maintenance tasks ("items due for maintenance")\n• Managing items (add, update, delete)\n• Reports and insights\n\nTry asking: "Summarize inventory status" or "How many laptops are available?"',
	timestamp: Date.now(),
};

const storage = typeof window !== 'undefined' ? createJSONStorage(getScopedStorage) : undefined;

export const useChatbotStore = create<ChatbotState>()(
	persist(
		(set, get) => ({
			messages: [DEFAULT_WELCOME_MESSAGE],
			isOpen: false,
			position: { x: 20, y: 20 },
			scrollPosition: 0,
			input: '',
			busy: false,
			typing: false,
			error: null,
			pendingPlan: null,
			databaseUpdated: false,
			pendingUpdateNotification: false,
			addMessage: (message) => {
				const timestampedMessage = { ...message, timestamp: Date.now() };
				set((state) => {
					const updated = [...state.messages.slice(-MESSAGE_LIMIT + 1), timestampedMessage];
					return { messages: updated };
				});
			},
			setMessages: (messages) => {
				set((state) => {
					const next = typeof messages === 'function' ? messages(state.messages) : messages;
					const trimmed = next.length > MESSAGE_LIMIT ? next.slice(-MESSAGE_LIMIT) : next;
					return { messages: trimmed };
				});
			},
			clearMessages: () => set({ messages: [DEFAULT_WELCOME_MESSAGE] }),
			toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
			setOpen: (open) => {
				set({ isOpen: open });
				if (open && get().pendingUpdateNotification) {
					set({ databaseUpdated: true, pendingUpdateNotification: false });
				}
			},
			setPosition: (position) => set({ position }),
			setScrollPosition: (scrollPosition) => set({ scrollPosition }),
			setInput: (value) => set({ input: value }),
			setBusy: (value) => set({ busy: value }),
			setTyping: (value) => set({ typing: value }),
			setError: (value) => set({ error: value }),
			setPendingPlan: (plan) => set({ pendingPlan: plan }),
			setDatabaseUpdated: (value) => {
				const isOpen = get().isOpen;
				if (value && !isOpen) {
					set({ pendingUpdateNotification: true, databaseUpdated: false });
				} else {
					set({ databaseUpdated: value, pendingUpdateNotification: false });
				}
			},
			setPendingUpdateNotification: (value) => set({ pendingUpdateNotification: value }),
		}),
		{
			name: 'chatbot-store',
			storage,
			skipHydration: true,
			partialize: (state) => ({
				messages: state.messages,
				isOpen: state.isOpen,
				position: state.position,
				scrollPosition: state.scrollPosition,
				pendingUpdateNotification: state.pendingUpdateNotification,
			}),
			onRehydrateStorage: () => {
				return (state, error) => {
					if (error) {
						console.error('[chatbot-store] rehydrate failed', error);
					}
				};
			},
		}
	)
);

