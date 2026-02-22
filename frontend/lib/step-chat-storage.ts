const STORAGE_KEY_PREFIX = "touille:step-chats:";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface StoredChatMessage {
  role: string;
  text: string;
}

interface StoredStepEntry {
  messages: StoredChatMessage[];
  expiresAt: number;
}

type StoredRecipeValue = Record<string, StoredStepEntry>;

function getKey(recipeId: number): string {
  return STORAGE_KEY_PREFIX + recipeId;
}

function safeLocalStorage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function getStepChat(
  recipeId: number,
  stepOrder: number,
): StoredChatMessage[] | null {
  try {
    const storage = safeLocalStorage();
    if (!storage) return null;

    const key = getKey(recipeId);
    const raw = storage.getItem(key);
    if (!raw) return null;

    const data: StoredRecipeValue = JSON.parse(raw);
    const stepKey = String(stepOrder);
    const entry = data[stepKey];
    if (!entry) return null;

    const now = Date.now();
    if (entry.expiresAt < now) {
      delete data[stepKey];
      const remaining = Object.keys(data).length;
      if (remaining === 0) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(data));
      return null;
    }

    return entry.messages;
  } catch {
    return null;
  }
}

export function setStepChat(
  recipeId: number,
  stepOrder: number,
  messages: StoredChatMessage[],
): void {
  try {
    const storage = safeLocalStorage();
    if (!storage) return;

    const key = getKey(recipeId);
    const raw = storage.getItem(key);
    const data: StoredRecipeValue = raw ? JSON.parse(raw) : {};

    const now = Date.now();
    data[String(stepOrder)] = { messages, expiresAt: now + TTL_MS };

    for (const k of Object.keys(data)) {
      if (data[k].expiresAt < now) delete data[k];
    }

    if (Object.keys(data).length === 0) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, JSON.stringify(data));
    }
  } catch {
    // no-op
  }
}
