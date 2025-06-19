// Simplified toast hook for the demo

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

export const useToast = () => {
  const toast = (props: ToastProps) => {
    // In a real implementation, this would show a toast notification
    console.log("Toast:", props);
  }
  
  return { toast }
}

export const toast = (props: ToastProps) => {
  console.log("Toast:", props);
  // In a real implementation, this would show a toast notification
  return props;
} 