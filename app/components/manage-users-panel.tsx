'use client';

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createMember,
  updateMember,
  deleteMember,
} from "@/app/actions/manage-users";
import { openDirectRoom } from "@/app/actions/open-direct-room";
import { removeRoomMember } from "@/app/actions/remove-room-member";
import { languageLabel } from "@/lib/chatTypes";

type MemberRole = "admin" | "owner" | "moderator" | "member";

type MemberRecord = {
  id: string;
  email: string | null;
  displayName: string;
  preferredLanguage: string | null;
  role: MemberRole;
  joinedAt: string | null;
};

type LanguageOption = {
  code: string;
  english_name: string;
  native_name: string | null;
};

type ManageUsersPanelProps = {
  members: MemberRecord[];
  languages: LanguageOption[];
  currentUserId: string;
  roomId?: string | null;
  allowRoomRemoval?: boolean;
  viewerRole: MemberRole;
};

const ROLE_OPTIONS: MemberRole[] = ["admin", "owner", "moderator", "member"];

export function ManageUsersPanel({
  members,
  languages,
  currentUserId,
  roomId = null,
  allowRoomRemoval = false,
  viewerRole,
}: ManageUsersPanelProps) {
  const router = useRouter();
  const [creating, startCreating] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [startingDirectId, setStartingDirectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    displayName: "",
    preferredLanguage:
      languages.find((lang) => lang.code === "en")?.code ?? languages[0]?.code ?? "en",
    role: "member" as MemberRole,
  });

  const isAdmin = viewerRole === "admin";
  const isOwner = viewerRole === "owner";
  const canCreateMembers = isAdmin;
  const canEditMembers = isAdmin;
  const canChangeRoles = isAdmin;
  const canDeleteUsers = isAdmin;
  const canRemoveFromRoom = allowRoomRemoval && (isAdmin || isOwner);

  const filteredMembers = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return members;
    return members.filter((member) => {
      return (
        member.email?.toLowerCase().includes(keyword) ||
        member.displayName.toLowerCase().includes(keyword) ||
        member.role.toLowerCase().includes(keyword) ||
        languageLabel(member.preferredLanguage ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [filter, members]);

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreateMembers) return;
    setError(null);

    startCreating(async () => {
      const result = await createMember({
        email: newUser.email,
        password: newUser.password,
        displayName: newUser.displayName,
        preferredLanguage: newUser.preferredLanguage,
        role: newUser.role,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setNewUser((prev) => ({
        ...prev,
        email: "",
        password: "",
        displayName: "",
      }));
      router.refresh();
    });
  };

  const handleUpdate = async (
    userId: string,
    payload: Pick<MemberRecord, "displayName" | "preferredLanguage" | "role">
  ) => {
    if (!canEditMembers) return;
    setError(null);
    setSavingId(userId);
    const result = await updateMember({
      userId,
      displayName: payload.displayName,
      preferredLanguage: payload.preferredLanguage,
      role: payload.role,
    });
    setSavingId(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  const handleDelete = async (userId: string) => {
    if (!canDeleteUsers) return;
    const confirmed = window.confirm("ลบผู้ใช้นี้ออกจากระบบหรือไม่?");
    if (!confirmed) return;

    setError(null);
    setDeletingId(userId);
    const result = await deleteMember(userId);
    setDeletingId(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  const handleStartDirect = async (userId: string) => {
    setError(null);
    setStartingDirectId(userId);
    const result = await openDirectRoom(userId);
    setStartingDirectId(null);
    if (result?.error) {
      setError(result.error);
    }
  };

  const handleRemoveFromRoom = async (userId: string) => {
    if (!roomId || !canRemoveFromRoom) return;
    const confirmed = window.confirm("Remove this member from the room?");
    if (!confirmed) return;

    setError(null);
    setRemovingMemberId(userId);
    const result = await removeRoomMember({ roomId, memberId: userId });
    setRemovingMemberId(null);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  };

  return (
    <div className="space-y-8">
      {!isAdmin ? (
        <section className="rounded-3xl border border-white/10 bg-amber-500/10 p-6 text-sm text-amber-100 shadow-lg shadow-black/30">
          <h2 className="text-base font-semibold text-white">
            สิทธิ์ของคุณจำกัดอยู่ที่การลบสมาชิกออกจากห้อง
          </h2>
          <p className="mt-2 text-amber-200/80">
            เฉพาะผู้ดูแลระบบ (admin) เท่านั้นที่สามารถสร้างสมาชิกใหม่หรือปรับเปลี่ยนบทบาทได้.
          </p>
        </section>
      ) : null}
      {canCreateMembers ? (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30">
        <header>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
            Create Member
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            เพิ่มผู้ใช้ใหม่และกำหนดสิทธิ์
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            กรอกอีเมลและรหัสผ่านชั่วคราวเพื่อส่งให้สมาชิกใหม่ (สามารถเปลี่ยนเองได้ภายหลัง)
          </p>
        </header>
        <form onSubmit={handleCreate} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-1">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Email
            </label>
            <input
              type="email"
              value={newUser.email}
              onChange={(event) =>
                setNewUser((prev) => ({ ...prev, email: event.target.value }))
              }
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
              placeholder="member@example.com"
              disabled={creating}
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
              รหัสผ่านชั่วคราว
            </label>
            <input
              type="text"
              value={newUser.password}
              onChange={(event) =>
                setNewUser((prev) => ({ ...prev, password: event.target.value }))
              }
              required
              minLength={8}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
              placeholder="อย่างน้อย 8 ตัวอักษร"
              disabled={creating}
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
              ชื่อที่แสดง
            </label>
            <input
              type="text"
              value={newUser.displayName}
              onChange={(event) =>
                setNewUser((prev) => ({ ...prev, displayName: event.target.value }))
              }
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
              placeholder="ชื่อผู้ใช้"
              disabled={creating}
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
              ภาษาเริ่มต้น
            </label>
            <select
              value={newUser.preferredLanguage}
              onChange={(event) =>
                setNewUser((prev) => ({
                  ...prev,
                  preferredLanguage: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
              disabled={creating}
            >
              {languages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.english_name} ({language.native_name ?? language.code})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
              บทบาท
            </label>
            <select
              value={newUser.role}
              onChange={(event) =>
                setNewUser((prev) => ({
                  ...prev,
                  role: event.target.value as MemberRole,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
              disabled={creating}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "กำลังสร้าง..." : "สร้างผู้ใช้ใหม่"}
            </button>
          </div>
        </form>
      </section>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
              Member list
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              จัดการสมาชิกในห้อง
            </h2>
          </div>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="ค้นหาอีเมล / ชื่อ / บทบาท"
            className="w-full rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none md:w-64"
          />
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.3em] text-slate-500">
              <tr>
                <th className="py-2 pr-4">ชื่อ</th>
                <th className="px-4 py-2">อีเมล</th>
                <th className="px-4 py-2">ภาษา</th>
                <th className="px-4 py-2">บทบาท</th>
                <th className="px-4 py-2">เข้าร่วมเมื่อ</th>
                <th className="px-4 py-2 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-slate-400">
                    ยังไม่มีสมาชิก
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                languages={languages}
                onSave={canEditMembers ? handleUpdate : undefined}
                onDelete={canDeleteUsers ? handleDelete : undefined}
                onRemoveFromRoom={
                  canRemoveFromRoom && member.id !== currentUserId
                    ? handleRemoveFromRoom
                    : undefined
                }
                onStartDirect={handleStartDirect}
                saving={savingId === member.id}
                deleting={deletingId === member.id}
                removing={removingMemberId === member.id}
                startingDirect={startingDirectId === member.id}
                disableDelete={member.id === currentUserId}
                canEdit={canEditMembers}
                canChangeRoles={canChangeRoles}
                canDelete={canDeleteUsers && member.id !== currentUserId}
              />
            ))
          )}
            </tbody>
          </table>
        </div>
        {error ? (
          <p className="mt-4 text-sm font-medium text-rose-300">{error}</p>
        ) : null}
      </section>
    </div>
  );
}

function MemberRow({
  member,
  languages,
  onSave,
  onDelete,
  onRemoveFromRoom,
  onStartDirect,
  saving,
  deleting,
  removing,
  startingDirect,
  disableDelete,
  canEdit,
  canChangeRoles,
  canDelete,
}: {
  member: MemberRecord;
  languages: LanguageOption[];
  onSave?: (
    userId: string,
    payload: Pick<MemberRecord, "displayName" | "preferredLanguage" | "role">
  ) => Promise<void>;
  onDelete?: (userId: string) => Promise<void>;
  onRemoveFromRoom?: (userId: string) => Promise<void>;
  onStartDirect?: (userId: string) => Promise<void>;
  saving: boolean;
  deleting: boolean;
  removing: boolean;
  startingDirect: boolean;
  disableDelete: boolean;
  canEdit: boolean;
  canChangeRoles: boolean;
  canDelete: boolean;
}) {
  const [draft, setDraft] = useState({
    displayName: member.displayName,
    preferredLanguage: member.preferredLanguage ?? "en",
    role: member.role,
  });
  const hasChanges =
    draft.displayName !== member.displayName ||
    draft.preferredLanguage !== (member.preferredLanguage ?? "en") ||
    draft.role !== member.role;

  return (
    <tr className="text-slate-200">
      <td className="py-4 pr-4">
        <input
          type="text"
          value={draft.displayName}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, displayName: event.target.value }))
          }
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          disabled={!canEdit}
        />
      </td>
      <td className="px-4 py-4 text-slate-300">
        {member.email ?? "—"}
      </td>
      <td className="px-4 py-4">
        <select
          value={draft.preferredLanguage}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              preferredLanguage: event.target.value,
            }))
          }
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          disabled={!canEdit}
        >
          {languages.map((language) => (
            <option key={language.code} value={language.code}>
              {language.english_name} ({language.native_name ?? language.code})
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-4">
        <select
          value={draft.role}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              role: event.target.value as MemberRole,
            }))
          }
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          disabled={!canChangeRoles}
        >
          {(canChangeRoles ? ROLE_OPTIONS : [member.role]).map((role) => (
            <option key={role} value={role}>
              {role.toUpperCase()}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-4 text-slate-400">
        {member.joinedAt
          ? new Intl.DateTimeFormat("th-TH", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(member.joinedAt))
          : "—"}
      </td>
      <td className="px-4 py-4 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          {onRemoveFromRoom ? (
            <button
              type="button"
              onClick={() => onRemoveFromRoom(member.id)}
              disabled={removing}
              className="rounded-full border border-amber-400/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200 transition hover:border-amber-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove from room"}
            </button>
          ) : null}
          {onStartDirect ? (
            <button
              type="button"
              onClick={() => onStartDirect(member.id)}
              disabled={startingDirect}
              className="rounded-full border border-sky-400/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-sky-200 transition hover:border-sky-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {startingDirect ? "Opening…" : "Direct chat"}
            </button>
          ) : null}
          {onSave && canEdit ? (
            <button
            type="button"
            onClick={() =>
              onSave(member.id, {
                displayName: draft.displayName,
                preferredLanguage: draft.preferredLanguage,
                role: draft.role,
              })
            }
            disabled={saving || !hasChanges}
            className="rounded-full border border-emerald-400/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200 transition hover:border-emerald-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          ) : null}
          {onDelete && canDelete ? (
            <button
            type="button"
            onClick={() => onDelete(member.id)}
            disabled={deleting || disableDelete}
            className="rounded-full border border-rose-400/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-rose-200 transition hover:border-rose-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Removing..." : "Delete"}
          </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
