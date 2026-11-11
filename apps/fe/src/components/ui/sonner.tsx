import { useState, type CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// Below Tailwind's md breakpoint (cms-mobile-ux D6): toasts drop in from the top centre,
// clear of the thumb zone and of the PWA update prompt at the bottom.
const PHONE_QUERY = "(max-width: 767.98px)"

function isPhoneViewport(): boolean {
  // Guarded: jsdom (and very old browsers) may lack matchMedia. Decided once at mount.
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(PHONE_QUERY).matches
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  const [phone] = useState(isPhoneViewport)
  return (
    <Sonner
      className="toaster group"
      position={phone ? "top-center" : "bottom-right"}
      mobileOffset={{
        top: "calc(env(safe-area-inset-top) + 16px)",
        bottom: "calc(env(safe-area-inset-bottom) + 16px)",
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
