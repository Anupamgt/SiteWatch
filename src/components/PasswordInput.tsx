"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Auto-hide window, mirroring Microsoft sign-in: revealing is temporary so a
 * password is never left visible on a shared site phone. */
const AUTO_HIDE_MS = 10_000;

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden focusable="false">
      {hidden ? (
        <path
          fill="currentColor"
          d="M12 5c-5 0-9 4.5-9 7s4 7 9 7 9-4.5 9-7-4-7-9-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M3.3 4.7a1 1 0 0 1 1.4-1.4l16 16a1 1 0 0 1-1.4 1.4l-2.6-2.6A9.9 9.9 0 0 1 12 19c-5 0-9-4.5-9-7 0-1.4 1.2-3.3 3.1-4.8L3.3 4.7Zm4.4 4.4C6.4 10 5.3 11.3 5 12c.6 1.2 3.3 5 7 5 1 0 2-.2 2.8-.6l-1.6-1.6a2.5 2.5 0 0 1-3.4-3.4L7.7 9.1ZM12 5c5 0 9 4.5 9 7 0 1-.7 2.3-1.9 3.6l-1.5-1.5c.7-.7 1.2-1.4 1.4-2.1-.6-1.2-3.3-5-7-5-.4 0-.8 0-1.1.1L9.4 5.3C10.2 5.1 11.1 5 12 5Z"
        />
      )}
    </svg>
  );
}

export function PasswordInput({
  id,
  name = "password",
  label,
  value,
  onChange,
  autoComplete = "current-password",
  required,
  minLength,
  placeholder,
  helpText,
  labelClassName = "ads-label",
  inputClassName = "ads-input min-h-12 text-base",
  showLabel = "Show",
  hideLabel = "Hide",
}: {
  id?: string;
  name?: string;
  label: string;
  /** Omit for uncontrolled use (plain FormData submit). */
  value?: string;
  onChange?: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  helpText?: string;
  labelClassName?: string;
  inputClassName?: string;
  showLabel?: string;
  hideLabel?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? `password-${generatedId}`;
  const [revealed, setRevealed] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  function toggleReveal() {
    setRevealed((prev) => {
      const next = !prev;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (next) {
        hideTimer.current = setTimeout(() => setRevealed(false), AUTO_HIDE_MS);
      }
      return next;
    });
  }

  return (
    <div>
      <label htmlFor={inputId} className={labelClassName}>
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={revealed ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          className={`${inputClassName} pr-12`}
          {...(onChange
            ? { value: value ?? "", onChange: (e) => onChange(e.target.value) }
            : {})}
        />
        <button
          type="button"
          onClick={toggleReveal}
          aria-pressed={revealed}
          aria-label={revealed ? hideLabel : showLabel}
          title={revealed ? hideLabel : showLabel}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[var(--ads-radius)] text-[var(--ads-text-subtle)] hover:bg-[var(--ads-neutral)] hover:text-[var(--ads-text)]"
        >
          <EyeIcon hidden={!revealed} />
        </button>
      </div>
      {helpText && (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--ads-text-subtlest)]">{helpText}</p>
      )}
    </div>
  );
}
