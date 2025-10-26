'use client';

import { useTransition } from "react";
import { toggleRoomLock } from "@/app/actions/toggle-room-lock";

type LockToggleButtonProps = {
  roomId: string;
  isLocked: boolean;
};

export default function LockToggleButton({
  roomId,
  isLocked,
}: LockToggleButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      await toggleRoomLock(roomId, !isLocked);
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        isLocked
          ? "border-amber-400/50 bg-amber-500/10 text-amber-200 hover:border-amber-400 hover:bg-amber-500/20"
          : "border-white/10 bg-white/10 text-slate-200 hover:border-white/30 hover:bg-white/20"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {isPending ? "Updating…" : isLocked ? "Unlock room" : "Lock room"}
    </button>
  );
}
