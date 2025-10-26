import { redirect } from "next/navigation";
import {
  getServerSupabaseClient,
  getServiceSupabaseClient,
} from "@/lib/supabaseServer";
import OpenRoomExplorer from "@/app/components/open-room-explorer";

type RoomRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_locked: boolean | null;
  room_type: string | null;
  room_members: Array<{ id: string }> | null;
};

export default async function ExploreRoomsPage() {
  const supabase = await getServerSupabaseClient();

  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    redirect("/login");
  }

  const serviceClient = getServiceSupabaseClient();

  const { data: joinedRows } = await serviceClient
    .from("room_members")
    .select("room_id")
    .eq("user_id", user.id);

  const joinedIds = new Set((joinedRows ?? []).map((row) => row.room_id));

  const { data: openRoomsData } = await serviceClient
    .from("rooms")
    .select(
      `
        id,
        slug,
        name,
        description,
        is_locked,
        room_type,
        room_members!left ( id )
      `
    )
    .eq("room_type", "group")
    .eq("is_locked", false)
    .order("name", { ascending: true })
    .returns<RoomRow[]>();

  const openRooms =
    openRoomsData
      ?.filter((room) => !joinedIds.has(room.id))
      .map((room) => ({
        id: room.id,
        slug: room.slug,
        name: room.name,
        description: room.description,
        memberCount: room.room_members?.length ?? 0,
      })) ?? [];

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,_#1b233a,_#090b12_55%)] px-6 py-10 text-slate-50">
      <div className="w-full max-w-4xl">
        <OpenRoomExplorer rooms={openRooms} />
      </div>
    </div>
  );
}
