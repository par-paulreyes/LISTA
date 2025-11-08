/**
 * Database Update Detection Service
 * 
 * Monitors database changes for items and maintenance logs
 * Uses polling since MySQL doesn't have native real-time subscriptions
 * Can be extended with WebSocket or Supabase real-time if available
 */

import { apiClient } from '../config/api';

export type DatabaseUpdateType = 'item' | 'maintenance_log' | 'unknown';
export type DatabaseUpdateEvent = {
	type: DatabaseUpdateType;
	timestamp: number;
	action: 'INSERT' | 'UPDATE' | 'DELETE';
	itemId?: number;
};

type UpdateCallback = (event: DatabaseUpdateEvent) => void;

let started = false;
let pollTimer: number | null = null;
let lastTrigger = 0;

function checkLocalTrigger() {
	try {
		const val = localStorage.getItem('database_update_trigger');
		if (!val) return;
		const ts = parseInt(val, 10);
		if (!Number.isFinite(ts)) return;
		if (ts <= lastTrigger) return;
		lastTrigger = ts;
		localStorage.removeItem('database_update_trigger');
		console.debug('[chatbot-update] consumed trigger', ts);
		window.dispatchEvent(new Event('chatbot-database-updated'));
	} catch (_) {
		// ignore
	}
}

export function startDatabaseUpdateService() {
	if (started || typeof window === 'undefined') return;
	started = true;
	console.debug('[chatbot-update] service: start');
	checkLocalTrigger();
	window.addEventListener('storage', (e: StorageEvent) => {
		if (e.key === 'database_update_trigger' && e.newValue) {
			console.debug('[chatbot-update] storage event received');
			window.dispatchEvent(new Event('chatbot-database-updated'));
		}
	});
	pollTimer = window.setInterval(checkLocalTrigger, 5000);
}

export function stopDatabaseUpdateService() {
	if (pollTimer !== null) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
	started = false;
	console.debug('[chatbot-update] service: stop');
}

export function triggerDatabaseUpdate() {
	try {
		const ts = Date.now();
		localStorage.setItem('database_update_trigger', String(ts));
		console.debug('[chatbot-update] trigger set', ts);
		window.dispatchEvent(new Event('chatbot-database-updated'));
	} catch (_) {
		// ignore
	}
}

