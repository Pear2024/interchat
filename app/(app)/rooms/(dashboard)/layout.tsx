import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import RoomSidebar from "@/app/components/room-sidebar";
import { AnalyticsPanel } from "@/app/components/analytics-panel";
import { ensureProfile } from "@/app/actions/ensure-profile";
import { getServerSupabaseClient, getServiceSupabaseClient } from "@/lib/supabaseServer";
import { computeRoomAnalytics } from "@/lib/analytics";
import DirectMessageNotifier from "@/app/components/direct-message-notifier";

type SidebarMembership = {
  role: string | null;
  joined_at: string;
  last_seen_message_at?: string | null;
  room: { id: string; slug: string; name: string; description: string | null };
};

type RawMembership = {
  role: string | null;
  joined_at: string;
  last_seen_message_at?: string | null;
  room:
    | { id: string; slug: string; name: string; description: string | null }
    | Array<{ id: string; slug: string; name: string; description: string | null }>
    | null;
};

const mapMembership = (row: RawMembership): SidebarMembership | null => {
  const roomValue = Array.isArray(row.room) ? row.room[0] : row.room;
  if (!roomValue) {
    return null;
  }

  return {
    role: row.role,
    joined_at: row.joined_at,
    last_seen_message_at: row.last_seen_message_at,
    room: {
      id: roomValue.id,
      slug: roomValue.slug,
      name: roomValue.name,
      description: roomValue.description,
    },
  };
};

export default async function RoomsDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await getServerSupabaseClient();
  const cookieStore = await cookies();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  if (user.is_anonymous || !user.email) {
    redirect(
      "/login?error=Please%20sign%20in%20with%20your%20email%20to%20access%20Interchat."
    );
  }

  if (user.user_metadata?.password_configured !== true) {
    redirect("/auth/setup");
  }

  await ensureProfile();

  const userId = user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, preferred_language")
    .eq("id", userId)
    .maybeSingle();

  const preferredLanguage =
    profile?.preferred_language ||
    cookieStore.get("preferred_language")?.value ||
    "en";

  const { data: membershipRows, error: membershipError } = await supabase
    .from("room_members")
    .select(
      `role, joined_at, last_seen_message_at, room:rooms!inner(id, slug, name, description, room_type)`
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });

  if (membershipError) {
    console.error("Failed to load memberships", membershipError);
  }

  let memberships: SidebarMembership[] =
    (membershipRows ?? [])
      .map(mapMembership)
      .filter(
        (membership): membership is SidebarMembership =>
          membership !== null
      );

  if (memberships.length === 0) {
    const serviceSupabase = getServiceSupabaseClient();
    const { data: demoRoom } = await serviceSupabase
      .from("rooms")
      .select("id, slug, name, description")
      .eq("slug", "global-collab")
      .maybeSingle();

    if (demoRoom) {
      await serviceSupabase.from("room_members").upsert(
        {
          room_id: demoRoom.id,
          user_id: userId,
          role: "member",
          notifications: "all",
        },
        { onConflict: "room_id,user_id" }
      );

      memberships = [
        mapMembership({
          role: "member",
          joined_at: new Date().toISOString(),
          last_seen_message_at: new Date().toISOString(),
          room: {
            id: demoRoom.id,
            slug: demoRoom.slug,
            name: demoRoom.name,
            description: demoRoom.description,
          },
        })!,
      ];
    }
  }

  let rooms = (memberships ?? [])
    .map((membership) => {
      const room = membership.room;
      if (!room) return null;
      return {
        id: room.id,
        slug: room.slug,
        name: room.name,
        description: room.description,
        role: membership.role,
        roomType: (room as { room_type?: string }).room_type ?? null,
        joinedAt: membership.joined_at,
        lastSeenMessageAt: membership.last_seen_message_at ?? null,
      };
    })
    .filter(Boolean) as {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    role: string | null;
    roomType?: string | null;
    joinedAt?: string | null;
    lastSeenMessageAt?: string | null;
    hasUnread?: boolean;
    lastMessageAt?: string | null;
  }[];

  if (rooms.length > 0) {
    const roomIds = rooms.map((room) => room.id);
    const { data: latestRows, error: latestError } = await supabase
      .from("messages")
      .select("room_id, created_at")
      .in("room_id", roomIds)
      .order("created_at", { ascending: false });

    if (latestError) {
      console.error("Failed to load latest message timestamps", latestError);
    } else if (latestRows) {
      const latestMap = new Map<string, string | null>();
      (latestRows as Array<{ room_id: string | null; created_at: string | null }>).forEach((row) => {
        if (row.room_id && !latestMap.has(row.room_id)) {
          latestMap.set(row.room_id, row.created_at ?? null);
        }
      });

      rooms = rooms.map((room) => {
        const latest = latestMap.get(room.id) ?? null;
        const lastSeen = room.lastSeenMessageAt ?? room.joinedAt ?? null;
        const hasUnread = latest
          ? !lastSeen || new Date(latest) > new Date(lastSeen)
          : false;

        return {
          ...room,
          lastMessageAt: latest,
          hasUnread,
        };
      });
    }
  }

  const isAdmin = rooms.some((room) => room.role === "admin");
  const isOwner = rooms.some((room) => room.role === "owner");
  const analytics = isAdmin ? await computeRoomAnalytics(supabase) : null;
  const directRoomsForNotifier = rooms
    .filter((room) => room.roomType === "direct")
    .map((room) => ({
      id: room.id,
      slug: room.slug,
      name: room.name ?? "Direct message",
    }));

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] text-slate-50">
      <RoomSidebar
        rooms={rooms}
        profile={{
          name: profile?.display_name ?? user.email ?? "Member",
          language: preferredLanguage,
        }}
        analytics={analytics}
        isAdmin={isAdmin}
        isOwner={isOwner}
      />
      <main className="flex-1 min-h-0 overflow-hidden">
        {analytics ? (
          <div className="hidden px-8 py-6 lg:block">
            <AnalyticsPanel analytics={analytics} />
          </div>
        ) : null}
        {children}
      </main>
      <DirectMessageNotifier viewerId={userId} rooms={directRoomsForNotifier} />
    </div>
  );
}
