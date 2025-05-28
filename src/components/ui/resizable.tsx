"use client"

import * as React from "react"
import { GripVertical } from "lucide-react"
import { ImperativePanelHandle, Panel, PanelGroup } from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = React.forwardRef<
  ImperativePanelHandle,
  React.ComponentProps<typeof PanelGroup>
>(({ className, ...props }, ref) => (
  <PanelGroup
    ref={ref}
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
))
ResizablePanelGroup.displayName = "ResizablePanelGroup"

const ResizablePanel = Panel

ResizablePanel.displayName = "ResizablePanel"

const ResizableHandle = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof PanelResizeHandle> & {
    withHandle?: boolean
  }
>(({ className, withHandle, ...props }, ref) => (
  <PanelResizeHandle
    ref={ref}
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-dragging=true]]:bg-primary [&[data-dragging=true]]:opacity-50",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-3 w-2.5 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </PanelResizeHandle>
))
ResizableHandle.displayName = "ResizableHandle"

// Minimal PanelResizeHandle from react-resizable-panels, as it's not directly exported
// This is a simplified version. For full features, it's better if the library exports it.
interface PanelResizeHandleProps
  extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean
  hitAreaMargins?: {
    coarse: number
    fine: number
  }
  tabIndex?: number
  tagName?: keyof JSX.IntrinsicElements
}

const PanelResizeHandle = React.forwardRef<
  HTMLDivElement,
  PanelResizeHandleProps
>(
  (
    {
      className,
      disabled = false,
      hitAreaMargins = { coarse: 15, fine: 5 }, // Default values
      tabIndex = 0,
      tagName: TagName = "div",
      ...props
    },
    ref
  ) => {
    // In a real scenario, this component would use internal context from react-resizable-panels
    // For ShadCN UI, this component is typically more elaborate and uses library internals.
    // This is a placeholder to make the ResizableHandle work visually.
    return (
      <TagName
        ref={ref}
        className={className}
        role="separator"
        tabIndex={tabIndex}
        aria-disabled={disabled}
        {...props}
        // {...(typeof attributes === "object" && attributes !== null
        //   ? attributes
        //   : {})}
      />
    )
  }
)
PanelResizeHandle.displayName = "PanelResizeHandle"


export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
