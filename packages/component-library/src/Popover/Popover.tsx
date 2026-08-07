"use client";

import { Popover as BasePopover } from "@base-ui/react/popover";
import type { ReactElement, ReactNode } from "react";
import { css } from "../../styled-system/css";
import type { ExtendProps } from "../extend-props";

type Props = ExtendProps<
  typeof BasePopover.Root,
  {
    children: ReactNode;
    closeDelay?: number | undefined;
    delay?: number | undefined;
    openOnHover?: boolean | undefined;
    trigger: ReactElement;
  }
>;

/**
 * A floating surface anchored to a trigger. Wraps base-ui's Popover so
 * positioning, focus management, dismissal, and the open/close transition are
 * handled for us; this layer supplies the styling and a flattened
 * `trigger` + `children` API. Pass `openOnHover` (with optional `delay` /
 * `closeDelay`) to open the surface on hover as well as on press.
 */
export const Popover = ({
  children,
  closeDelay,
  delay,
  openOnHover,
  trigger,
  ...rootProps
}: Props) => (
  <BasePopover.Root {...rootProps}>
    <BasePopover.Trigger
      closeDelay={closeDelay}
      delay={delay}
      openOnHover={openOnHover}
      render={trigger}
    />
    <BasePopover.Portal>
      <BasePopover.Positioner sideOffset={8}>
        <BasePopover.Popup className={popupStyles}>
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  </BasePopover.Root>
);

const popupStyles = css({
  _starting: {
    opacity: 0,
    transform: "scale(0.98)",
  },
  "&[data-ending-style]": {
    opacity: 0,
    transform: "scale(0.98)",
    transition:
      "opacity {durations.fast} {easings.in}, transform {durations.fast} {easings.in}",
  },
  backgroundColor: "card",
  border: "1px solid {colors.border}",
  borderRadius: "lg",
  boxShadow: "lifted",
  opacity: 1,
  outlineStyle: "none",
  transform: "scale(1)",
  transformOrigin: "var(--transform-origin)",
  transition:
    "opacity {durations.normal} {easings.out}, transform {durations.normal} {easings.out}",
});
