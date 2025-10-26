export type ChatMessage = {
  id: string;
  author: {
    id: string | null;
    name: string;
    initials: string;
    accent: string;
    isSelf: boolean;
  };
  original: {
    text: string;
    language: string;
  };
  translation: {
    text: string;
    language: string;
  };
  timestamp: string;
};

export type SupabaseMessageRow = {
  id: string | null;
  room_id: string | null;
  author_id: string | null;
  content: string | null;
  created_at: string | null;
  original_language: string | null;
  detected_language: string | null;
  profiles:
    | { display_name: string | null; preferred_language?: string | null }
    | Array<{ display_name: string | null; preferred_language?: string | null }>
    | null;
  translations:
    | Array<{ target_language: string | null; translated_text: string | null }>
    | null;
};

const accentPalette: Record<string, string> = {
  "00000000-0000-0000-0000-0000000000a1": "from-indigo-500 to-purple-500",
  "00000000-0000-0000-0000-0000000000a2": "from-cyan-400 to-teal-500",
  "00000000-0000-0000-0000-0000000000a3": "from-amber-400 to-orange-500",
};

const accentFallback = [
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-blue-500",
  "from-rose-400 to-pink-500",
];

export const DEMO_ROOM_ID = "11111111-1111-1111-1111-111111111111";
export const DEMO_ROOM_SLUG = "global-collab";

export function languageLabel(code?: string | null) {
  if (!code) return "AUTO";
  return code.toUpperCase();
}

export function formatTimestamp(value?: string | null, locale = "en-US") {
  if (!value) return "—";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "—";
  return timestamp.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveDisplayName(
  profiles:
    | { display_name: string | null; preferred_language?: string | null }
    | Array<{ display_name: string | null; preferred_language?: string | null }>
    | null,
  fallback = "Member"
) {
  if (!profiles) return fallback;
  if (Array.isArray(profiles)) {
    return profiles[0]?.display_name ?? fallback;
  }
  return profiles.display_name ?? fallback;
}

function computeInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function resolveAccent(authorId: string | null, index: number) {
  if (authorId && accentPalette[authorId]) {
    return accentPalette[authorId];
  }
  return accentFallback[index % accentFallback.length];
}

export function mapRowsToChatMessages(
  rows: SupabaseMessageRow[],
  viewerLanguage: string,
  viewerId: string | null = null,
  locale = "en-US"
): ChatMessage[] {
  return rows.map((row, index) => {
    const authorId = row.author_id;
    const authorName = resolveDisplayName(row.profiles);
    const initials = computeInitials(authorName);
    const translations = Array.isArray(row.translations)
      ? row.translations
      : [];

    const matchedTranslation = translations.find(
      (entry) => entry.target_language?.toLowerCase() === viewerLanguage
    );
    const fallbackTranslation = translations[0];

    const translatedText =
      matchedTranslation?.translated_text ??
      fallbackTranslation?.translated_text ??
      row.content ??
      "";

    const translatedLanguage =
      matchedTranslation?.target_language ??
      fallbackTranslation?.target_language ??
      viewerLanguage;

    return {
      id: row.id ?? `${index}`,
      author: {
        id: authorId ?? null,
        name: authorName,
        initials,
        accent: resolveAccent(authorId ?? null, index),
        isSelf: viewerId ? authorId === viewerId : index % 2 === 1,
      },
      original: {
        text: row.content ?? "",
        language: row.original_language ?? "auto",
      },
      translation: {
        text: translatedText,
        language: translatedLanguage ?? viewerLanguage,
      },
      timestamp: formatTimestamp(row.created_at, locale),
    };
  });
}
