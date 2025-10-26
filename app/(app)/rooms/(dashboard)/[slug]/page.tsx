import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import ChatWindow, { Composer } from "@/app/components/chat-window";
import LockToggleButton from "@/app/components/lock-toggle-button";
import {
  ChatMessage,
  SupabaseMessageRow,
  mapRowsToChatMessages,
} from "@/lib/chatTypes";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";
import { DEMO_ROOM_SLUG } from "@/lib/chatTypes";

const DEFAULT_VIEWER_LANGUAGE = "en";

type RoomMembership = {
  role: string | null;
  room: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    default_language?: string | null;
    is_locked?: boolean | null;
    created_by?: string | null;
  };
};

const sampleMessages: ChatMessage[] = [
  {
    id: "1",
    author: {
      id: "00000000-0000-0000-0000-0000000000a2",
      name: "Noa Levi",
      initials: "NL",
      accent: "from-cyan-400 to-teal-500",
      isSelf: false,
    },
    original: {
      text: "שלום! מאיפה את?",
      language: "he",
    },
    translation: {
      text: "Hello! Where are you from?",
      language: "en",
    },
    timestamp: "09:41",
  },
  {
    id: "2",
    author: {
      id: "00000000-0000-0000-0000-0000000000a1",
      name: "Pear",
      initials: "PR",
      accent: "from-indigo-500 to-purple-500",
      isSelf: true,
    },
    original: {
      text: "ฉันมาจากอิสราเอล",
      language: "th",
    },
    translation: {
      text: "I'm from Israel.",
      language: "en",
    },
    timestamp: "09:41",
  },
  {
    id: "3",
    author: {
      id: "00000000-0000-0000-0000-0000000000a2",
      name: "Noa Levi",
      initials: "NL",
      accent: "from-cyan-400 to-teal-500",
      isSelf: false,
    },
    original: {
      text: "איך קוראים לך?",
      language: "he",
    },
    translation: {
      text: "What is your name?",
      language: "en",
    },
    timestamp: "09:42",
  },
  {
    id: "4",
    author: {
      id: "00000000-0000-0000-0000-0000000000a1",
      name: "Pear",
      initials: "PR",
      accent: "from-indigo-500 to-purple-500",
      isSelf: true,
    },
    original: {
      text: "ฉันชื่อ ดาเนียล",
      language: "th",
    },
    translation: {
      text: "My name is Daniyal.",
      language: "en",
    },
    timestamp: "09:42",
  },
];

export default async function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const supabase = await getServerSupabaseClient();
  const cookieStore = await cookies();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  const userId = user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, preferred_language")
    .eq("id", userId)
    .maybeSingle();

  const fallbackLanguage =
    profile?.preferred_language ??
    cookieStore.get("preferred_language")?.value ??
    DEFAULT_VIEWER_LANGUAGE;

  const { data: roomMembershipRow, error: membershipError } = await supabase
    .from("room_members")
    .select(
      `role, room:rooms(id, name, slug, description, default_language, is_locked, created_by)`
    )
    .eq("user_id", userId)
    .eq("room.slug", decodedSlug)
    .maybeSingle<{
      role: string | null;
      room: {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        default_language: string | null;
        is_locked: boolean | null;
        created_by: string | null;
      } | null;
    }>();

  if (membershipError) {
    console.error('Failed to load room membership', membershipError);
  }

  let roomRecord: RoomMembership | null = null;

  if (roomMembershipRow?.room) {
    roomRecord = {
      role: roomMembershipRow.role,
      room: {
        id: roomMembershipRow.room.id,
        name: roomMembershipRow.room.name,
        slug: roomMembershipRow.room.slug,
        description: roomMembershipRow.room.description,
        default_language: roomMembershipRow.room.default_language,
        is_locked: roomMembershipRow.room.is_locked ?? false,
        created_by: roomMembershipRow.room.created_by,
      },
    };
  }

  let room = roomRecord?.room;
  let viewerRole = roomRecord?.role ?? null;

  if (!room) {
    const serviceSupabase = getServiceSupabaseClient();
    const { data: demoRoom } = await serviceSupabase
      .from("rooms")
      .select("id, slug, name, description, default_language, is_locked, created_by")
      .eq("slug", decodedSlug)
      .maybeSingle<{
        id: string;
        slug: string;
        name: string;
        description: string | null;
        default_language: string | null;
        is_locked: boolean | null;
        created_by: string | null;
      }>();

    if (!demoRoom) {
      notFound();
    }

    const isOwner = demoRoom.created_by === userId;
    if (demoRoom.is_locked && !isOwner) {
      return <LockedRoomNotice roomName={demoRoom.name} />;
    }

    const { data: existingMembership } = await serviceSupabase
      .from("room_members")
      .select("role")
      .match({ room_id: demoRoom.id, user_id: userId })
      .maybeSingle<{ role: string | null }>();

    if (!existingMembership) {
      if (demoRoom.slug === DEMO_ROOM_SLUG) {
        const { error: insertError } = await serviceSupabase
          .from("room_members")
          .insert({
            room_id: demoRoom.id,
            user_id: userId,
            role: "member",
            notifications: "all",
          });

        if (insertError && insertError.code !== "23505") {
          throw new Error(insertError.message);
        }

        viewerRole = "member";
      } else if (isOwner) {
        const { error: insertError } = await serviceSupabase
          .from("room_members")
          .insert({
            room_id: demoRoom.id,
            user_id: userId,
            role: "owner",
            notifications: "all",
          });

        if (insertError && insertError.code !== "23505") {
          throw new Error(insertError.message);
        }

        viewerRole = "owner";
      } else {
        return redirect("/rooms");
      }
    } else {
      viewerRole = existingMembership.role ?? null;
    }

    room = {
      id: demoRoom.id,
      slug: demoRoom.slug,
      name: demoRoom.name,
      description: demoRoom.description,
      default_language: demoRoom.default_language ?? null,
      is_locked: demoRoom.is_locked ?? false,
      created_by: demoRoom.created_by,
    };
  }

  let messages: ChatMessage[] = [];
  let supabaseStatus: SupabaseStatus;

  try {
    const { data: messageRows, error } = await supabase
      .from("messages")
      .select(
        `
          id,
          room_id,
          author_id,
          content,
          created_at,
          original_language,
          detected_language,
          profiles:author_id (
            display_name,
            preferred_language
          ),
          translations:message_translations (
            target_language,
            translated_text
          )
        `
      )
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(100)
      .returns<SupabaseMessageRow[]>();

    if (error) {
      throw error;
    }

    const mapped = messageRows && messageRows.length > 0
      ? mapRowsToChatMessages(messageRows, fallbackLanguage, userId, "en-US")
      : [];

    messages = mapped;

    supabaseStatus = {
      state: "ready",
      title: "Supabase connected",
      description: mapped.length > 0 ? "Messages fetched" : "No messages yet",
      records: mapped.length,
    };
  } catch (error: unknown) {
    console.error("Failed to fetch messages", error);
    messages = sampleMessages;
    supabaseStatus = {
      state: "error",
      title: "Query failed",
      description: error instanceof Error ? error.message : "Unable to load messages.",
    };
  }
  const isLocked = room.is_locked === true;
  const isAdmin = viewerRole === "admin";
  const isOwner = viewerRole === "owner";
  const isCreator = room.created_by === userId;
  const canControlLock = isAdmin || isOwner || isCreator;

  try {
    const serviceClient = getServiceSupabaseClient();
    await serviceClient
      .from("room_members")
      .update({ last_seen_message_at: new Date().toISOString() })
      .eq("room_id", room.id)
      .eq("user_id", userId);
  } catch (updateError) {
    console.error("Failed to update last seen timestamp", updateError);
  }

  return (
    <div className="flex h-full w-full flex-col px-4 py-10 text-slate-50">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-[32px] border border-white/10 bg-white/5 bg-clip-padding p-8 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <Header
          status={supabaseStatus}
          roomName={room.name}
          roomId={room.id}
          isLocked={isLocked}
          canControlLock={canControlLock}
        />
        <div className="mt-8 flex flex-1 min-h-0 flex-col rounded-3xl border border-white/5 bg-slate-950/40 shadow-inner">
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatWindow
              initialMessages={messages}
              roomId={room.id}
              roomName={room.name}
              roomDescription={room.description}
              viewerLanguage={fallbackLanguage}
              viewerProfileId={userId}
            />
          </div>
          <div className="sticky bottom-0 z-10 border-t border-white/10 bg-slate-950/80 backdrop-blur">
            <Composer
              roomId={room.id}
              viewerLanguage={fallbackLanguage}
              authorId={userId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type SupabaseStatus =
  | { state: "error"; title: string; description: string }
  | { state: "ready"; title: string; description: string; records: number };

function Header({
  status,
  roomName,
  roomId,
  isLocked,
  canControlLock,
}: {
  status: SupabaseStatus;
  roomName: string;
  roomId: string;
  isLocked: boolean;
  canControlLock: boolean;
}) {
  const badge =
    status.state === "ready"
      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-400/30"
      : "bg-rose-500/10 text-rose-300 border border-rose-400/30";

  const description =
    status.state === "ready"
      ? `${status.description} (${status.records} records)`
      : status.description;

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/5 bg-slate-950/60 px-6 py-5 shadow-lg shadow-black/30">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
          Interchat Workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          {roomName}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {isLocked
            ? "This room is locked. Only existing members can access it."
            : "Converse across 100 languages with sub-second translation."}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${badge}`}
        >
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          {status.title}
        </span>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/20"
        >
          Open dashboard
        </a>
        {canControlLock ? (
          <LockToggleButton roomId={roomId} isLocked={isLocked} />
        ) : null}
      </div>
      <p className="basis-full text-sm text-slate-400">{description}</p>
    </header>
  );
}

function LockedRoomNotice({ roomName }: { roomName: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-10 text-slate-50">
      <div className="max-w-lg rounded-[32px] border border-white/10 bg-white/5 px-8 py-10 text-center shadow-[0_40px_80px_-30px_rgba(15,23,42,0.9)] backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
          Room locked
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{roomName}</h1>
        <p className="mt-4 text-sm text-slate-300">
          The owner has locked this room. Ask an owner to invite you or unlock the room to join.
        </p>
        <Link
          href="/rooms"
          className="mt-6 inline-flex rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
        >
          Back to rooms
        </Link>
      </div>
    </div>
  );
}
