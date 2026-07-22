"use client";

import React from "react";

interface MobilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobilePopup({ isOpen, onClose, children }: MobilePopupProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Mobile overlay — centered modal with backdrop, visible only below md */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 md:hidden"
        onClick={onClose}
      >
        <div
          className="relative mx-4 w-full max-w-sm min-h-[40vh] rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col p-4 gap-1 justify-center min-h-full [&>*]:!static">
            {children}
          </div>
        </div>
      </div>

      {/* Desktop passthrough — renders children inline, visible only on md+ */}
      <div className="hidden md:block">{children}</div>
    </>
  );
}
