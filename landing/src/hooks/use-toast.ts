// Simplified toast hook for demo purposes
import { useState } from "react";

type ToastType = {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
  className?: string;
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  const toast = (props: ToastType) => {
    setToasts((prevToasts) => [...prevToasts, props]);
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((toast) => toast !== props));
    }, 5000);
  };

  return { toast, toasts };
} 