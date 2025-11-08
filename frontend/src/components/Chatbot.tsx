"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from "../config/api";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { 
	addMessage as addMessageAction,
	setOpen,
	setInput,
	setBusy,
	setTyping,
	setError,
	setPosition,
	setScrollPosition,
	setPendingPlan,
	setPendingUpdateNotification,
	clearMessages,
} from "../features/chatbot/chatbotSlice";

export default function Chatbot() {
	const dispatch = useAppDispatch();
	const chatbotState = useAppSelector((state) => state.chatbot);
	
	// Ensure we have valid state with defaults
	const messages = chatbotState?.messages || [];
	const isOpen = chatbotState?.isOpen || false;
	const input = (chatbotState?.input ?? '') || '';
	const busy = chatbotState?.busy || false;
	const typing = chatbotState?.typing || false;
	const error = chatbotState?.error || null;
	const position = chatbotState?.position || { x: 20, y: 20 };
	const scrollPosition = chatbotState?.scrollPosition || 0;
	const pendingPlan = chatbotState?.pendingPlan || null;
	const pendingUpdateNotification = chatbotState?.pendingUpdateNotification || false;

	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const dragRef = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({ dragging: false, offsetX: 0, offsetY: 0 });
	const portalContainerRef = useRef<HTMLDivElement | null>(null);
	const [mounted, setMounted] = useState(false);

	// Redux handles hydration via PersistGate in ReduxProvider
	// No need for manual hydration

	useEffect(() => {
		const handleUpdate = () => {
			if (isOpen) {
				dispatch(addMessageAction({
					role: 'system',
					text: '📦 Database has been updated. Would you like to refresh the dashboard for the latest report?',
					timestamp: Date.now(),
				}));
			} else {
				dispatch(setPendingUpdateNotification(true));
			}
		};
		if (typeof window !== 'undefined') {
			window.addEventListener('chatbot-database-updated', handleUpdate);
			return () => window.removeEventListener('chatbot-database-updated', handleUpdate);
		}
	}, [isOpen, dispatch]);

	useEffect(() => {
		if (isOpen && pendingUpdateNotification) {
			dispatch(addMessageAction({
				role: 'system',
				text: '📦 Database has been updated. Would you like to refresh the dashboard for the latest report?',
				timestamp: Date.now(),
			}));
			dispatch(setPendingUpdateNotification(false));
		}
	}, [isOpen, pendingUpdateNotification, dispatch]);

	// Initialize portal container and position
	useEffect(() => {
		setMounted(true);
		
		// Create portal container if it doesn't exist
		if (typeof window !== 'undefined' && !portalContainerRef.current) {
			const container = document.createElement('div');
			container.id = 'chatbot-portal-container';
			container.style.position = 'fixed';
			container.style.left = '0';
			container.style.top = '0';
			container.style.width = '100%';
			container.style.height = '100%';
			container.style.pointerEvents = 'none';
			container.style.zIndex = '1000';
			document.body.appendChild(container);
			portalContainerRef.current = container;
		}

		// Initialize position if not set
		if ((!position || (position.x === 0 && position.y === 0)) && typeof window !== 'undefined') {
			const panelW = 380, panelH = 560;
			const marginRight = 16, marginBottom = 88;
			const x = Math.max(8, window.innerWidth - panelW - marginRight);
			const y = Math.max(8, window.innerHeight - panelH - marginBottom);
			dispatch(setPosition({ x, y }));
		}

		return () => {
			// Cleanup portal container on unmount
			if (portalContainerRef.current && portalContainerRef.current.parentNode) {
				portalContainerRef.current.parentNode.removeChild(portalContainerRef.current);
			}
		};
	}, [position, dispatch]);

	// Restore scroll position when messages change
	useEffect(() => {
		if (scrollRef.current && scrollPosition > 0) {
			scrollRef.current.scrollTop = scrollPosition;
		}
	}, [scrollPosition]);

	// Save scroll position on scroll
	const handleScroll = useCallback(() => {
		if (scrollRef.current) {
			dispatch(setScrollPosition(scrollRef.current.scrollTop));
		}
	}, [dispatch]);

	// Show database update notification when chatbot opens and update is pending
	const beginDrag = useCallback((clientX: number, clientY: number) => {
		dragRef.current.dragging = true;
		const posX = position?.x || 20;
		const posY = position?.y || 20;
		dragRef.current.offsetX = clientX - posX;
		dragRef.current.offsetY = clientY - posY;
	}, [position]);

	const onMouseDown = useCallback((e: React.MouseEvent) => {
		beginDrag(e.clientX, e.clientY);
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}, [beginDrag]);

	const onTouchStart = useCallback((e: React.TouchEvent) => {
		const t = e.touches[0];
		if (!t) return;
		beginDrag(t.clientX, t.clientY);
		document.addEventListener('touchmove', onTouchMove, { passive: false });
		document.addEventListener('touchend', onTouchEnd);
	}, [beginDrag]);

	const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

	const commitMove = useCallback((clientX: number, clientY: number) => {
		if (!dragRef.current.dragging || typeof window === 'undefined') return;
		const panelW = 380, panelH = 560;
		const newX = clientX - dragRef.current.offsetX;
		const newY = clientY - dragRef.current.offsetY;
		const maxX = Math.max(0, window.innerWidth - panelW - 8);
		const maxY = Math.max(0, window.innerHeight - panelH - 8);
		dispatch(setPosition({ x: clamp(newX, 8, maxX), y: clamp(newY, 8, maxY) }));
	}, [dispatch]);

	const onMouseMove = (e: MouseEvent) => { e.preventDefault(); commitMove(e.clientX, e.clientY); };
	const onMouseUp = () => {
		dragRef.current.dragging = false;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	};
	const onTouchMove = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); const t = e.touches[0]; if (t) commitMove(t.clientX, t.clientY); };
	const onTouchEnd = () => {
		dragRef.current.dragging = false;
		document.removeEventListener('touchmove', onTouchMove as any);
		document.removeEventListener('touchend', onTouchEnd);
	};

	const send = useCallback(async () => {
		const text = (input || '').trim();
		if (!text || busy) return;
		if (text.length > 1000) {
			dispatch(setError('Message is too long. Please keep it under 1000 characters.'));
			return;
		}
		
		dispatch(setInput(""));
		dispatch(setError(null));
		dispatch(addMessageAction({ role: 'user', text, timestamp: Date.now() }));
		dispatch(setBusy(true));
		dispatch(setTyping(true));
		dispatch(setPendingPlan(null));
		
		try {
			const res = await apiClient.post('/chat', { 
				message: text,
				history: (messages || []).slice(-10).map(m => ({ role: m.role, text: m.text || '' }))
			});
			const payload = res.data || {};
			
			if (payload.type === 'answer' && payload.message) {
				dispatch(addMessageAction({ role: 'assistant', text: payload.message, data: payload.data, timestamp: Date.now() }));
			} else if (payload.type === 'action' && payload.message) {
				dispatch(addMessageAction({ role: 'assistant', text: `${payload.message}\n\nExample: ${JSON.stringify(payload.example_request)}`, data: payload.data, timestamp: Date.now() }));
			} else if (payload.type === 'clarify' && payload.message) {
				dispatch(addMessageAction({ role: 'assistant', text: payload.message, data: payload.data, timestamp: Date.now() }));
			} else if (payload.type === 'plan' && payload.message) {
				dispatch(addMessageAction({ role: 'assistant', text: payload.message, data: payload.plan, timestamp: Date.now() }));
				if (payload.plan) dispatch(setPendingPlan({ originalMessage: text, plan: payload.plan }));
			} else if (payload.type === 'error') {
				dispatch(addMessageAction({ role: 'assistant', text: `❌ ${payload.message || 'Request failed. Please try again.'}`, timestamp: Date.now() }));
			} else {
				dispatch(addMessageAction({ 
					role: 'assistant', 
					text: 'I can help you with:\n\n📋 Finding items: "show laptops", "find printers"\n📊 Status: "summary", "how many items"\n🔧 Maintenance: "items due for maintenance"\n➕ Managing: "add item", "update item 123"\n📤 Reports: "export inventory"\n\nWhat would you like to do?',
					timestamp: Date.now()
				}));
			}
		} catch (err: any) {
			let errorMsg = 'Unable to process that right now. Please try again.';
			if (err?.response?.status === 401) {
				errorMsg = 'Session expired. Please refresh the page and log in again.';
			} else if (err?.response?.status === 429) {
				errorMsg = 'Too many requests. Please wait a moment and try again.';
			} else if (err?.response?.status >= 500) {
				errorMsg = 'Server error. Please try again in a moment.';
			} else if (err?.response?.data?.message) {
				errorMsg = err.response.data.message;
			} else if (err?.message) {
				errorMsg = err.message;
			}
			dispatch(addMessageAction({ role: 'assistant', text: `❌ ${errorMsg}`, timestamp: Date.now() }));
			dispatch(setError(errorMsg));
		} finally {
			dispatch(setBusy(false));
			dispatch(setTyping(false));
		}
	}, [input, busy, messages, dispatch]);

	const confirmPlan = useCallback(async () => {
		if (!pendingPlan || busy) return;
		dispatch(setBusy(true));
		dispatch(setTyping(true));
		dispatch(setError(null));
		try {
			const res = await apiClient.post('/chat', { 
				message: pendingPlan.originalMessage, 
				confirm: true,
				history: (messages || []).slice(-10).map(m => ({ role: m.role, text: m.text || '' }))
			});
			const payload = res.data || {};
			let reply = '';
			if (payload.type === 'answer' && payload.message) reply = payload.message;
			else if (payload.type === 'error') reply = `❌ ${payload.message || 'Request failed.'}`;
			else if (payload.message) reply = payload.message;
			else reply = '✅ Completed.';
			dispatch(addMessageAction({ role: 'assistant', text: reply, data: payload.data, timestamp: Date.now() }));
			dispatch(setPendingPlan(null));
		} catch (err: any) {
			const errorMsg = err?.response?.data?.message || err?.message || 'Action failed. Please try again.';
			dispatch(addMessageAction({ role: 'assistant', text: `❌ ${errorMsg}`, timestamp: Date.now() }));
			dispatch(setError(errorMsg));
		} finally {
			dispatch(setBusy(false));
			dispatch(setTyping(false));
		}
	}, [pendingPlan, busy, messages, dispatch]);

	const cancelPlan = useCallback(() => {
		dispatch(setPendingPlan(null));
		dispatch(addMessageAction({ role: 'assistant', text: 'Okay. I won\'t proceed. What would you like to do next?', timestamp: Date.now() }));
	}, [dispatch]);

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		if (scrollRef.current) {
					setTimeout(() => {
				if (scrollRef.current) {
					scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
					dispatch(setScrollPosition(scrollRef.current.scrollHeight));
				}
			}, 50);
		}
	}, [messages, isOpen, typing, dispatch]);

	const quickTips = useMemo(() => [
		'Summarize inventory status',
		'Show inventory insights',
		'How many laptops are available?',
		'Items due for maintenance',
		'Show all printers',
		'Find item by QR code',
		'Total items count',
		'Show maintenance logs',
		'Items at HQ',
		'Export inventory'
	], []);

	// Redux handles hydration via PersistGate, no need to check hydrated state

	const chatbotContent = (
		<div style={{ position: 'fixed', left: 16, bottom: 88, zIndex: 1000, touchAction: 'none', pointerEvents: 'auto' }}>
			{isOpen && (
				<div role="dialog" aria-label="IVY" aria-modal={false} style={{ position: 'fixed', left: position?.x || 20, top: position?.y || 20, width: 'min(92vw, 380px)', height: 'min(74vh, 560px)', maxHeight: '90vh', background: 'white', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 1000 }}>
					<div onMouseDown={onMouseDown} onTouchStart={onTouchStart} style={{ cursor: 'move', padding: 12, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}>
						<div style={{ fontWeight: 600, color: '#000' }}>IVY</div>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
							<button 
								onClick={() => dispatch(clearMessages())} 
								style={{ 
									fontSize: '12px', 
									lineHeight: '16px', 
									background: '#ef4444', 
									color: 'white', 
									border: 0, 
									borderRadius: 6, 
									padding: '4px 8px',
									cursor: 'pointer',
									fontWeight: 500
								}} 
								aria-label="Clear chat history" 
								title="Clear chat history"
							>
								🗑️ Clear
							</button>
								<button 
									onClick={() => dispatch(setOpen(false))} 
								style={{ 
									fontSize: 18, 
									lineHeight: '18px', 
									background: '#0ea5e9', 
									color: 'white', 
									border: 0, 
									borderRadius: 8, 
									padding: '4px 8px',
									cursor: 'pointer'
								}} 
								aria-label="Close" 
								title="Close"
							>
								×
							</button>
						</div>
					</div>
					<div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, padding: 12, overflowY: 'auto', background: '#fafafa' }}>
						{(messages || []).map((m, idx) => (
							<div key={idx} style={{ marginBottom: 10, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
								<div style={{ maxWidth: '82%', whiteSpace: 'pre-wrap', background: m.role === 'user' ? '#0ea5e9' : '#ffffff', color: m.role === 'user' ? '#ffffff' : '#000', padding: '8px 10px', borderRadius: 10, border: m.role === 'user' ? 'none' : '1px solid #eee', fontSize: '14px', lineHeight: '1.5' }}>
									{m.text || ''}
									{m.role === 'assistant' && Array.isArray(m.data) && m.data.length > 0 && (
										<div style={{ marginTop: 8 }}>
											{(() => {
												const first = m.data[0] || {};
												const columns: string[] = Object.keys(first).slice(0, 6);
												const header = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
												return (
													<table style={{ width: '100%', borderCollapse: 'collapse' }}>
														<thead>
															<tr>
																{columns.map((col) => (
																	<th key={col} style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '4px 2px' }}>{header(col)}</th>
																))}
															</tr>
														</thead>
														<tbody>
															{m.data.map((row: any, i: number) => (
																<tr key={i}>
																	{columns.map((col) => (
																		<td key={col} style={{ padding: '4px 2px', borderBottom: '1px solid #eee' }}>{String(row[col] ?? '-')}</td>
																	))}
																</tr>
															))}
														</tbody>
													</table>
												);
											})()}
										</div>
									)}
									{m.role === 'assistant' && pendingPlan && m.text && (m.text.includes('I can perform this action') || m.text.includes('I can add this item') || m.text.includes('confirm: true')) && (
										<div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
											<button onClick={confirmPlan} disabled={busy} style={{ background: '#16a34a', color: 'white', border: 0, borderRadius: 6, padding: '6px 12px', cursor: busy ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 500 }}>{busy ? '...' : '✓ Confirm'}</button>
											<button onClick={cancelPlan} disabled={busy} style={{ background: '#ef4444', color: 'white', border: 0, borderRadius: 6, padding: '6px 12px', cursor: busy ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 500 }}>✗ Cancel</button>
										</div>
									)}
								</div>
							</div>
						))}
						{typing && (
							<div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-start' }}>
								<div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: 10, border: '1px solid #eee' }}>
									<span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9', marginRight: 4, animation: 'pulse 1.4s ease-in-out infinite' }} />
									<span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9', marginRight: 4, animation: 'pulse 1.4s ease-in-out 0.2s infinite' }} />
									<span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9', animation: 'pulse 1.4s ease-in-out 0.4s infinite' }} />
									<style>{`
										@keyframes pulse {
											0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
											30% { opacity: 1; transform: scale(1); }
										}
									`}</style>
								</div>
							</div>
						)}
						{error && (
							<div style={{ marginBottom: 10, padding: '8px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: '13px' }}>
								{error}
								<button onClick={() => dispatch(setError(null))} style={{ float: 'right', background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: '18px', lineHeight: '1' }}>×</button>
							</div>
						)}
						{(messages || []).length <= 2 && (
							<div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
								{quickTips.map(t => (
									<button key={t} onClick={() => { dispatch(setInput(t)); inputRef.current?.focus(); }} style={{ border: '1px solid #ddd', borderRadius: 16, padding: '6px 10px', background: 'white', color: '#000' }}>{t}</button>
								))}
							</div>
						)}
					</div>
					<form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ padding: 8, borderTop: '1px solid #eee', display: 'flex', gap: 8, background: 'white' }}>
						<input
							value={input || ''}
							onChange={(e) => { dispatch(setInput(e.target.value || '')); dispatch(setError(null)); }}
							placeholder={busy ? 'Working...' : 'Ask about inventory or maintenance'}
							disabled={busy}
							ref={inputRef}
							maxLength={1000}
							onKeyDown={(e) => { 
								if (e.key === 'Enter' && !e.shiftKey) { 
									e.preventDefault(); 
									if (!busy && (input || '').trim()) send(); 
								} 
								if (e.key === 'Escape') {
									dispatch(setOpen(false));
									dispatch(setError(null));
								}
							}}
							style={{ 
								flex: 1, 
								border: error ? '1px solid #ef4444' : '1px solid #ddd', 
								borderRadius: 8, 
								padding: '8px 10px', 
								color: '#000',
								fontSize: '14px',
								outline: 'none'
							}}
						/>
						<button 
							type="submit" 
							disabled={busy || !(input || '').trim()} 
							style={{ 
								background: busy || !(input || '').trim() ? '#94a3b8' : '#0ea5e9', 
								color: 'white', 
								border: 0, 
								borderRadius: 8, 
								padding: '8px 12px', 
								minWidth: 68,
								cursor: busy || !(input || '').trim() ? 'not-allowed' : 'pointer',
								transition: 'background 0.2s'
							}}
						>
							{busy ? '...' : 'Send'}
						</button>
					</form>
				</div>
			)}
			{!isOpen && (
				<button 
					onClick={() => { dispatch(setOpen(true)); dispatch(setError(null)); inputRef.current?.focus(); }} 
					aria-label={'Open chat'} 
					style={{ 
						position: 'relative', 
						background: '#0ea5e9', 
						color: 'white', 
						border: 0, 
						borderRadius: 999, 
						padding: '12px 16px', 
						boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
						cursor: 'pointer',
						fontSize: '14px',
						fontWeight: 500,
						transition: 'transform 0.2s, box-shadow 0.2s',
						pointerEvents: 'auto'
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.transform = 'scale(1.05)';
						e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.3)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.transform = 'scale(1)';
						e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
					}}
				>
					Chat
					<span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, background: '#22c55e', borderRadius: 999, border: '2px solid white' }} />
				</button>
			)}
		</div>
	);

	// Render via React Portal for isolation
	if (!mounted || !portalContainerRef.current) {
		return null;
	}

	return createPortal(chatbotContent, portalContainerRef.current);
}
