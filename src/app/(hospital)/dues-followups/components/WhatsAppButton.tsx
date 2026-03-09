"use client"

import { Button } from "@/components/ui/button"
import { MessageCircle } from "lucide-react"

interface WhatsAppButtonProps {
  phone: string
  message: string
}

export function WhatsAppButton({ phone, message }: WhatsAppButtonProps) {
  function handleClick() {
    const cleaned = phone.replace(/\D/g, "")
    const number = cleaned.length === 10 ? `91${cleaned}` : cleaned
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    window.open(url, "_blank")
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
      title="Send WhatsApp message"
      onClick={handleClick}
    >
      <MessageCircle className="h-4 w-4" />
    </Button>
  )
}
