import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading .env from mcp-server dir and root dir
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Warning: Supabase credentials not found in environment variables.");
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export interface Tenant {
  id: string;
  name: string;
  line_access_token: string | null;
  webhook_id: string | null;
  is_active: boolean;
  expires_at: string | null;
}

export interface UserProfile {
  id: number;
  userId: string;
  displayName: string | null;
  pictureUrl: string | null;
  statusMessage: string | null;
  role: string | null;
  ai_enabled: boolean | null;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  user_id: string;
  role: 'user' | 'assistant';
  message: string;
  tenant_id: string | null;
  created_at: string;
}

/**
 * Get active tenants from Supabase saas_tenants table
 */
export async function getTenants(): Promise<Tenant[]> {
  const { data, error } = await supabase
    .from('saas_tenants')
    .select('id, name, line_access_token, webhook_id, is_active, expires_at')
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to fetch tenants: ${error.message}`);
  }
  return data || [];
}

/**
 * Get tenant by ID or default to first active tenant
 */
export async function getTenantByIdOrDefault(tenantId?: string): Promise<Tenant> {
  const tenants = await getTenants();
  if (tenants.length === 0) {
    throw new Error("No active SaaS tenants found in database.");
  }
  if (tenantId) {
    const found = tenants.find(t => t.id === tenantId);
    if (found) return found;
    throw new Error(`Tenant with ID '${tenantId}' not found or inactive.`);
  }
  return tenants[0];
}

/**
 * Get LINE User profiles with filtering
 */
export async function getUserProfiles(tenantId?: string, limit = 20, search?: string): Promise<UserProfile[]> {
  let query = supabase.from('user_profiles').select('*').limit(limit).order('updated_at', { ascending: false });

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }
  if (search) {
    query = query.ilike('displayName', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch user profiles: ${error.message}`);
  }
  return data || [];
}

/**
 * Get chat history for a specific LINE user ID
 */
export async function getChatHistory(userId: string, tenantId?: string, limit = 20): Promise<ChatMessage[]> {
  let query = supabase
    .from('chat_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch chat history for user ${userId}: ${error.message}`);
  }
  return (data || []).reverse(); // Return in chronological order
}

/**
 * Save chat message to database
 */
export async function saveChatMessage(userId: string, role: 'user' | 'assistant', message: string, tenantId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_history')
    .insert([{ user_id: userId, role, message, tenant_id: tenantId }]);

  if (error) {
    console.error(`Failed to save chat message: ${error.message}`);
  }
}

/**
 * Get user tags
 */
export async function getUserTags(userId: string, tenantId?: string): Promise<string[]> {
  let query = supabase.from('user_tags').select('tag_name').eq('user_id', userId);
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch user tags: ${error.message}`);
  }
  return (data || []).map(t => t.tag_name);
}

/**
 * Add a tag to a user
 */
export async function addUserTag(userId: string, tagName: string, tenantId: string): Promise<void> {
  const { error } = await supabase
    .from('user_tags')
    .upsert([{ user_id: userId, tag_name: tagName, tenant_id: tenantId }], { onConflict: 'user_id,tag_name,tenant_id' });

  if (error) {
    throw new Error(`Failed to add tag '${tagName}' for user ${userId}: ${error.message}`);
  }
}

/**
 * Remove a tag from a user
 */
export async function removeUserTag(userId: string, tagName: string, tenantId: string): Promise<void> {
  const { error } = await supabase
    .from('user_tags')
    .delete()
    .eq('user_id', userId)
    .eq('tag_name', tagName)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Failed to remove tag '${tagName}' for user ${userId}: ${error.message}`);
  }
}
