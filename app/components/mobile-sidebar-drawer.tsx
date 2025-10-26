'use client';

import { useState } from "react";
import RoomSidebar from "@/app/components/room-sidebar";
import type { RoomOption } from "@/app/components/room-sidebar";

type MobileSidebarDrawerProps = {
  rooms: RoomOption[];
  profile: { name: string; language: string };
  analytics?: import("./analytics-panel").RoomAnalytics | null;
  isAdmin?: boolean;
  isOwner?: boolean;
};

export default function MobileSidebarDrawer({
  rooms,
  profile,
  analytics,
  isAdmin = false,
  isOwner = false,
}: MobileSidebarDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-slate-900/70 text-slate-100 shadow-lg shadow-black/40 backdrop-blur lg:hidden"
        aria-label="Open menu"
      >
        <span className="sr-only">Open navigation</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="h-6 w-6"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-50 h-full w-72 max-w-full bg-black/85 shadow-2xl shadow-black/60">
            <RoomSidebar
              rooms={rooms}
              profile={profile}
              analytics={analytics}
              isAdmin={isAdmin}
              isOwner={isOwner}
              className="flex w-full border-r-0 border-white/20 bg-black/80 px-5 py-6"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-900/70 text-slate-100 shadow"
              aria-label="Close menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
