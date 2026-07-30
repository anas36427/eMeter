import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline spinner for button/form actions ONLY — not for full-page loads.
 * Use page-skeletons for full-page loading states.
 *
 * @example
 * <Button disabled={saving}>
 *   {saving ? <Spinner /> : <Save className="w-4 h-4" />}
 *   Save
 * </Button>
 */
interface SpinnerProps {
  /** Size of the spinner icon in pixels. Defaults to 16 (w-4/h-4). */
  size?: number;
  className?: string;
}

export function Spinner({ size = 16, className }: SpinnerProps) {
  return (
    <Loader2
      style={{ width: size, height: size }}
      className={cn("animate-spin", className)}
    />
  );
}
