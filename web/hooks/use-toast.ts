// Simplified toast hook for the demo
import { useToast as useToastOriginal } from "@/components/ui/toast"

export const toast = (props: any) => {
  const { toast } = useToastOriginal()
  return toast(props)
}

export { useToastOriginal as useToast } 