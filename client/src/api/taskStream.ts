"use client";
import { fetchEventSource, EventSourceMessage } from "@microsoft/fetch-event-source";
import { API_URL } from "@/config/api";

export interface TaskEvent {
  status: "queued" | "doing" | "finished" | "failed" | "succeed" | "warning";
  result: string | null;
}

/** Opens an SSE stream (`GET /tasks/:id/stream`) and calls `onMessage` every time
 *  the status changes. Returns an `AbortController` so callers can `.abort()`. */
export function streamTaskStatus(
  taskId: string,
  onMessage: (ev: TaskEvent) => void,
  token?: string | null,
) {
  const ctrl = new AbortController();

  fetchEventSource(`${API_URL}/tasks/${taskId}/stream`, {
    headers: token 
      ? { 
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        } 
      : { Accept: 'text/event-stream' },
    signal: ctrl.signal,
    openWhenHidden: true, // keep stream alive when tab is in background
    onmessage(ev: EventSourceMessage) {
      try {
        onMessage(JSON.parse(ev.data) as TaskEvent);
      } catch (err) {
        console.error("[SSE] parse error", err);
      }
    },
    onerror(err) {
      console.error("[SSE] stream error", err);
    },
  });

  return ctrl;
} 