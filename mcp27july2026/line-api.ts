const LINE_API_BASE = "https://api.line.me/v2/bot";

export interface LineUserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  language?: string;
}

/**
 * Send push message(s) to a specific LINE user or group ID
 */
export async function pushLineMessage(accessToken: string, to: string, messages: any[]): Promise<any> {
  if (!accessToken) {
    throw new Error("LINE Access Token is missing for this tenant.");
  }

  const response = await fetch(`${LINE_API_BASE}/message/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      to,
      messages
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LINE Push API Error (${response.status}): ${errText}`);
  }

  return response.headers.get("content-length") !== "0" ? await response.json().catch(() => ({})) : {};
}

/**
 * Broadcast message(s) to all followers of the LINE bot
 */
export async function broadcastLineMessage(accessToken: string, messages: any[]): Promise<any> {
  if (!accessToken) {
    throw new Error("LINE Access Token is missing for this tenant.");
  }

  const response = await fetch(`${LINE_API_BASE}/message/broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      messages
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LINE Broadcast API Error (${response.status}): ${errText}`);
  }

  return response.headers.get("content-length") !== "0" ? await response.json().catch(() => ({})) : {};
}

/**
 * Fetch real-time LINE user profile from LINE Messaging API
 */
export async function getLineUserProfile(accessToken: string, userId: string): Promise<LineUserProfile> {
  if (!accessToken) {
    throw new Error("LINE Access Token is missing for this tenant.");
  }

  const response = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LINE Profile API Error (${response.status}): ${errText}`);
  }

  return (await response.json()) as LineUserProfile;
}

/**
 * Get list of Rich Menus created for the LINE bot
 */
export async function getLineRichMenuList(accessToken: string): Promise<any> {
  if (!accessToken) {
    throw new Error("LINE Access Token is missing for this tenant.");
  }

  const response = await fetch(`${LINE_API_BASE}/richmenu/list`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LINE RichMenu API Error (${response.status}): ${errText}`);
  }

  return await response.json();
}

/**
 * Set default Rich Menu for all users
 */
export async function setDefaultRichMenu(accessToken: string, richMenuId: string): Promise<any> {
  if (!accessToken) {
    throw new Error("LINE Access Token is missing for this tenant.");
  }

  const response = await fetch(`${LINE_API_BASE}/user/all/richmenu/${richMenuId}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LINE Set Default RichMenu API Error (${response.status}): ${errText}`);
  }

  return response.headers.get("content-length") !== "0" ? await response.json().catch(() => ({})) : { success: true };
}

/**
 * Cancel / Unset default Rich Menu for all users
 */
export async function unlinkDefaultRichMenu(accessToken: string): Promise<any> {
  if (!accessToken) {
    throw new Error("LINE Access Token is missing for this tenant.");
  }

  const response = await fetch(`${LINE_API_BASE}/user/all/richmenu`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LINE Unlink Default RichMenu API Error (${response.status}): ${errText}`);
  }

  return response.headers.get("content-length") !== "0" ? await response.json().catch(() => ({})) : { success: true };
}

/**
 * Delete a specific Rich Menu from LINE API
 */
export async function deleteLineRichMenu(accessToken: string, richMenuId: string): Promise<any> {
  if (!accessToken) {
    throw new Error("LINE Access Token is missing for this tenant.");
  }

  const response = await fetch(`${LINE_API_BASE}/richmenu/${richMenuId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  if (!response.ok && response.status !== 404) {
    const errText = await response.text();
    throw new Error(`LINE Delete RichMenu API Error (${response.status}): ${errText}`);
  }

  return { success: true };
}
