import { useRef, useState, type ReactNode } from "react";

interface Props {
  /** Content shown behind the card when swiped (e.g. delete button). */
  action: ReactNode;
  /** Width of the revealed action area in px. */
  actionWidth?: number;
  /** Main card content. */
  children: ReactNode;
  /** Disable swipe (e.g. when user can't edit). */
  disabled?: boolean;
}

/**
 * V20 — swipe-to-reveal wrapper. Swipe the card to the right to expose
 * an action panel underneath (typically an "unlink" or "delete" button).
 *
 * Uses touch events only (mobile UX). On desktop the action button is
 * always visible inline, so this is a progressive enhancement.
 */
export default function SwipeReveal({
  action,
  actionWidth = 80,
  children,
  disabled,
}: Props) {
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);
  const locked = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  if (disabled) return <>{children}</>;

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    currentX.current = 0;
    swiping.current = false;
    locked.current = false;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (locked.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    // Lock direction after 10px movement
    if (!swiping.current && Math.abs(dx) < 10 && Math.abs(dy) < 10) return;

    if (!swiping.current) {
      // If vertical scroll dominates, bail out
      if (Math.abs(dy) > Math.abs(dx)) {
        locked.current = true;
        return;
      }
      swiping.current = true;
    }

    // Only allow rightward swipe (positive dx), clamped to actionWidth
    const clamped = Math.max(0, Math.min(dx, actionWidth));
    currentX.current = clamped;
    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${clamped}px)`;
      cardRef.current.style.transition = "none";
    }
  }

  function handleTouchEnd() {
    if (!swiping.current) return;
    swiping.current = false;
    const threshold = actionWidth * 0.4;
    const shouldOpen = currentX.current > threshold;
    setOpen(shouldOpen);
    if (cardRef.current) {
      cardRef.current.style.transition = "transform 200ms ease-out";
      cardRef.current.style.transform = shouldOpen
        ? `translateX(${actionWidth}px)`
        : "translateX(0)";
    }
  }

  // Allow tapping the card area to close if open
  function handleCardClick() {
    if (open) {
      setOpen(false);
      if (cardRef.current) {
        cardRef.current.style.transition = "transform 200ms ease-out";
        cardRef.current.style.transform = "translateX(0)";
      }
    }
  }

  return (
    <div className="relative overflow-hidden rounded-md">
      {/* Action panel behind */}
      <div
        className="absolute inset-y-0 left-0 flex items-center"
        style={{ width: actionWidth }}
      >
        {action}
      </div>
      {/* Sliding card */}
      <div
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
        style={{ transform: "translateX(0)", willChange: "transform" }}
      >
        {children}
      </div>
    </div>
  );
}
