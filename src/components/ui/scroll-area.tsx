import * as React from "react";

import { cn } from "@/lib/utils";

// Plain native-overflow scrolling instead of Radix's ScrollArea primitive: Radix's custom
// viewport/scrollbar handling has long-standing touch-scroll glitches on mobile browsers
// (worse once nested inside a Popover/Dialog), while a native overflow-y div always
// responds to touch panning correctly.
const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("relative overflow-y-auto overscroll-contain", className)} {...props}>
      {children}
    </div>
  ),
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
