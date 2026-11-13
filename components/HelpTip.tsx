"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CircleQuestionMark } from "lucide-react";
import { HELP_TEXT, type HelpTopic } from "./helpText";

/** Fired when a tip opens, so any other open tip can close. */
const OPEN_EVENT = "helptip-open";
/** Smallest gap kept between the popup and the screen edge, in px. */
const EDGE_GAP = 8;

/**
 * A small "?" button that opens a plain-text popup under it. Click, tap, Enter
 * or Space toggles it; Escape closes it (focus returns to the button), and so
 * does a click or tap outside, or opening another tip. No hover needed.
 */
export function HelpTip({ topic }: { topic: HelpTopic }) {
  const { name, text } = HELP_TEXT[topic];
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const popupId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // While open: close on outside tap, Escape, or when another tip opens.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onOtherOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== popupId) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOtherOpen);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOtherOpen);
    };
  }, [open, popupId]);

  // Keep the popup inside the screen: nudge it sideways if it would stick out.
  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (!open || !popup) return;
    const rect = popup.getBoundingClientRect();
    const natural = { left: rect.left - shift, right: rect.right - shift };
    const width = document.documentElement.clientWidth;
    if (natural.left < EDGE_GAP) setShift(EDGE_GAP - natural.left);
    else if (natural.right > width - EDGE_GAP) setShift(width - EDGE_GAP - natural.right);
    else setShift(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle() {
    if (!open) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: popupId }));
    setOpen(!open);
  }

  return (
    <span className="help-tip" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className="help-button"
        aria-label={`What is ${name}?`}
        aria-expanded={open}
        aria-controls={popupId}
        onClick={toggle}
      >
        <CircleQuestionMark size={18} aria-hidden="true" />
      </button>
      <div
        id={popupId}
        ref={popupRef}
        role="note"
        className="help-popup"
        hidden={!open}
        style={shift ? { transform: `translateX(${shift}px)` } : undefined}
      >
        {text.split("\n\n").map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </span>
  );
}
