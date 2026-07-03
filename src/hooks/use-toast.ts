import { useState, useCallback } from "react";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

type ToastInput = Omit<Toast, "id">;

let listeners: Array<(toasts: Toast[]) => void> = [];
let toastList: Toast[] = [];

function notifyListeners() {
  for (const l of listeners) l([...toastList]);
}

export function toast(input: ToastInput) {
  const id = Math.random().toString(36).slice(2);
  const t: Toast = { id, ...input };
  toastList = [...toastList, t];
  notifyListeners();
  setTimeout(() => {
    toastList = toastList.filter((x) => x.id !== id);
    notifyListeners();
  }, 4000);
}

export function useToastStore() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const subscribe = useCallback(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);

  return { toasts, subscribe };
}

export function dismiss(id: string) {
  toastList = toastList.filter((t) => t.id !== id);
  notifyListeners();
}
