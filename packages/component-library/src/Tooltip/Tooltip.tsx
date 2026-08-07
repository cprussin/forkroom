"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";
import { css } from "../../styled-system/css";
import type { ExtendProps } from "../extend-props";

type Props = ExtendProps<
  typeof BaseTooltip.Root,
  {
    children: ReactNode;
    trigger: ReactElement;
    sideOffset?: number | undefined;
    /** How long the pointer must rest before the tooltip opens, in ms. */
    delay?: number | undefined;
    /** How long the tooltip lingers after the pointer leaves, in ms. */
    closeDelay?: number | undefined;
  }
>;

/**
 * A small label that surfaces on hover or focus, anchored to a trigger. Wraps
 * base-ui's Tooltip so hover intent, focus handling, positioning, dismissal,
 * and the open/close transition are handled for us; this layer supplies the
 * styling and a flattened `trigger` + `children` API. For richer, pressable
 * floating content, reach for `Popover` instead.
 */
export const Tooltip = ({
  children,
  trigger,
  sideOffset = 6,
  delay = 300,
  closeDelay,
  ...rootProps
}: Props) => (
  <BaseTooltip.Provider closeDelay={closeDelay} delay={delay}>
    <BaseTooltip.Root {...rootProps}>
      <BaseTooltip.Trigger render={trigger} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={sideOffset}>
          <BaseTooltip.Popup className={popupStyles}>
            {children}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  </BaseTooltip.Provider>
);

const popupStyles = css({
  _starting: {
    opacity: 0,
    transform: "scale(0.97)",
  },
  "&[data-ending-style]": {
    opacity: 0,
    transform: "scale(0.97)",
    transition:
      "opacity {durations.fast} {easings.in}, transform {durations.fast} {easings.in}",
  },
  backgroundColor: "card",
  border: "1px solid {colors.border}",
  borderRadius: "md",
  boxShadow: "lifted",
  color: "foreground",
  fontSize: "sm",
  maxInlineSize: 72,
  opacity: 1,
  outlineStyle: "none",
  paddingBlock: 1.5,
  paddingInline: 2.5,
  transform: "scale(1)",
  transformOrigin: "var(--transform-origin)",
  transition:
    "opacity {durations.normal} {easings.out}, transform {durations.normal} {easings.out}",
  whiteSpace: "normal",
  wordBreak: "break-word",
});
