"use client";

import { useEffect, useRef, useState } from "react";

export default function CookiePreferences() {
  const [open, setOpen] = useState(false);
  const [optional, setOptional] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOptional(localStorage.getItem("delta-cookie-preference-v1") === "all");
  }, []);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  function save(allow: boolean) {
    setOptional(allow);
    localStorage.setItem("delta-cookie-preference-v1", allow ? "all" : "necessary");
    setOpen(false);
  }
  return (
    <>
      <button className="cookie-widget" aria-label="Cookie settings" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 30 24" aria-hidden="true"><path d="M17 7H9a5 5 0 1 0 0 10h3m1-10h8a5 5 0 1 1-5 5V9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
      </button>
      {open ? <div className="cookie-card" role="dialog" aria-label="Cookie settings" aria-modal="false" data-lenis-prevent>
        <div className="cookie-card-top"><strong>Cookie settings</strong><button ref={closeRef} aria-label="Close cookie settings" onClick={() => setOpen(false)}>×</button></div>
        <p>You control your cookie preferences.</p>
        <label><span>Necessary</span><input type="checkbox" checked disabled /><small>Required for the website to work.</small></label>
        <label><span>Preferences & statistics</span><input type="checkbox" checked={optional} onChange={event => setOptional(event.target.checked)} /><small>Save your preferences on this device.</small></label>
        <button className="cookie-save" onClick={() => save(optional)}>Save my selection</button>
        <button className="cookie-reject" onClick={() => save(false)}>Use necessary cookies only</button>
        <a href="/en/legal/cookie-policy">Cookie Policy</a>
      </div> : null}
    </>
  );
}
