import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";

import {
  getTenants,
  getTenantByIdOrDefault,
  getUserProfiles,
  getChatHistory,
  saveChatMessage,
  getUserTags,
  addUserTag,
  removeUserTag
} from "./supabase.js";

import {
  pushLineMessage,
  broadcastLineMessage,
  getLineUserProfile,
  getLineRichMenuList,
  setDefaultRichMenu,
  unlinkDefaultRichMenu,
  deleteLineRichMenu
} from "./line-api.js";

// Define MCP Tools list
const TOOLS: Tool[] = [
  {
    name: "list_tenants",
    description: "List all active SaaS tenants and their LINE Bot configurations in the database.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_user_profiles",
    description: "List or search LINE user profiles saved in the database.",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "string", description: "Optional Tenant UUID. If omitted, queries across default tenant." },
        search: { type: "string", description: "Optional displayName keyword to filter profiles." },
        limit: { type: "number", description: "Maximum records to return (default: 20)." }
      },
      required: []
    }
  },
  {
    name: "get_chat_history",
    description: "Retrieve recent chat history between a LINE user and the AI chatbot from Supabase.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "LINE User ID (e.g. U123456789...)" },
        tenant_id: { type: "string", description: "Optional Tenant UUID." },
        limit: { type: "number", description: "Maximum messages to retrieve (default: 20)." }
      },
      required: ["user_id"]
    }
  },
  {
    name: "send_line_push_message",
    description: "Send a direct push message (text or Flex Message JSON) to a specific LINE user.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Target LINE User ID" },
        text: { type: "string", description: "Text message to send" },
        flex_json: { type: "string", description: "Optional Flex Message JSON object or stringified JSON" },
        tenant_id: { type: "string", description: "Optional Tenant UUID. Defaults to primary active tenant." },
        save_to_history: { type: "boolean", description: "Whether to record this message in chat_history (default: true)." }
      },
      required: ["user_id"]
    }
  },
  {
    name: "send_line_broadcast",
    description: "Broadcast a message (text or Flex Message JSON) to all followers of a LINE Bot tenant.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text message to broadcast" },
        flex_json: { type: "string", description: "Optional Flex Message JSON" },
        tenant_id: { type: "string", description: "Optional Tenant UUID." }
      },
      required: []
    }
  },
  {
    name: "get_user_tags",
    description: "Get all audience/segment tags assigned to a LINE user.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "LINE User ID" },
        tenant_id: { type: "string", description: "Optional Tenant UUID." }
      },
      required: ["user_id"]
    }
  },
  {
    name: "add_user_tag",
    description: "Assign a tag to a LINE user for customer segmentation.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "LINE User ID" },
        tag_name: { type: "string", description: "Tag name (e.g. 'VIP', 'Lead', 'Purchased')" },
        tenant_id: { type: "string", description: "Optional Tenant UUID." }
      },
      required: ["user_id", "tag_name"]
    }
  },
  {
    name: "remove_user_tag",
    description: "Remove a tag from a LINE user.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "LINE User ID" },
        tag_name: { type: "string", description: "Tag name to remove" },
        tenant_id: { type: "string", description: "Optional Tenant UUID." }
      },
      required: ["user_id", "tag_name"]
    }
  },
  {
    name: "get_line_user_profile",
    description: "Fetch live LINE user profile directly from LINE Messaging API.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "LINE User ID" },
        tenant_id: { type: "string", description: "Optional Tenant UUID." }
      },
      required: ["user_id"]
    }
  },
  {
    name: "get_rich_menu_list",
    description: "List all Rich Menus created for the LINE Official Account.",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "string", description: "Optional Tenant UUID." }
      },
      required: []
    }
  },
  {
    name: "set_default_rich_menu",
    description: "Set a specific Rich Menu as the default menu visible to all users.",
    inputSchema: {
      type: "object",
      properties: {
        rich_menu_id: { type: "string", description: "The LINE Rich Menu ID (e.g. richmenu-38ec...)" },
        tenant_id: { type: "string", description: "Optional Tenant UUID." }
      },
      required: ["rich_menu_id"]
    }
  },
  {
    name: "unlink_default_rich_menu",
    description: "Cancel / Unset the current default Rich Menu for all users.",
    inputSchema: {
      type: "object",
      properties: {
        tenant_id: { type: "string", description: "Optional Tenant UUID." }
      },
      required: []
    }
  },
  {
    name: "delete_rich_menu",
    description: "Permanently delete a specific Rich Menu from LINE API and Supabase Database.",
    inputSchema: {
      type: "object",
      properties: {
        rich_menu_id: { type: "string", description: "The LINE Rich Menu ID to delete (e.g. richmenu-38ec...)" },
        tenant_id: { type: "string", description: "Optional Tenant UUID." }
      },
      required: ["rich_menu_id"]
    }
  }
];

// Initialize Server
const server = new Server(
  {
    name: "line-mcp-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Register list tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Register call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolArgs = args || {};

  try {
    switch (name) {
      case "list_tenants": {
        const tenants = await getTenants();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(tenants, null, 2)
            }
          ]
        };
      }

      case "get_user_profiles": {
        const tenantId = toolArgs.tenant_id as string | undefined;
        const search = toolArgs.search as string | undefined;
        const limit = Number(toolArgs.limit) || 20;

        const profiles = await getUserProfiles(tenantId, limit, search);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(profiles, null, 2)
            }
          ]
        };
      }

      case "get_chat_history": {
        const userId = toolArgs.user_id as string;
        const tenantId = toolArgs.tenant_id as string | undefined;
        const limit = Number(toolArgs.limit) || 20;

        const history = await getChatHistory(userId, tenantId, limit);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(history, null, 2)
            }
          ]
        };
      }

      case "send_line_push_message": {
        const userId = toolArgs.user_id as string;
        const text = toolArgs.text as string | undefined;
        const flexJson = toolArgs.flex_json;
        const tenantId = toolArgs.tenant_id as string | undefined;
        const saveToHistory = toolArgs.save_to_history !== false;

        const tenant = await getTenantByIdOrDefault(tenantId);
        if (!tenant.line_access_token) {
          throw new Error(`Tenant '${tenant.name}' does not have a valid LINE access token.`);
        }

        const messages: any[] = [];
        if (text) {
          messages.push({ type: "text", text });
        }
        if (flexJson) {
          const flexObj = typeof flexJson === "string" ? JSON.parse(flexJson) : flexJson;
          messages.push({
            type: "flex",
            altText: flexObj.altText || flexObj.alt_text || "Flex Message",
            contents: flexObj.contents || flexObj
          });
        }

        if (messages.length === 0) {
          throw new Error("Either 'text' or 'flex_json' must be provided to send a LINE message.");
        }

        const result = await pushLineMessage(tenant.line_access_token, userId, messages);

        if (saveToHistory) {
          const summaryText = text || "[Flex Message]";
          await saveChatMessage(userId, "assistant", summaryText, tenant.id);
        }

        return {
          content: [
            {
              type: "text",
              text: `Message successfully pushed to user '${userId}' on LINE.\n${JSON.stringify(result)}`
            }
          ]
        };
      }

      case "send_line_broadcast": {
        const text = toolArgs.text as string | undefined;
        const flexJson = toolArgs.flex_json;
        const tenantId = toolArgs.tenant_id as string | undefined;

        const tenant = await getTenantByIdOrDefault(tenantId);
        if (!tenant.line_access_token) {
          throw new Error(`Tenant '${tenant.name}' does not have a valid LINE access token.`);
        }

        const messages: any[] = [];
        if (text) messages.push({ type: "text", text });
        if (flexJson) {
          const flexObj = typeof flexJson === "string" ? JSON.parse(flexJson) : flexJson;
          messages.push({
            type: "flex",
            altText: flexObj.altText || flexObj.alt_text || "Broadcast Flex Message",
            contents: flexObj.contents || flexObj
          });
        }

        if (messages.length === 0) {
          throw new Error("Either 'text' or 'flex_json' must be provided for broadcast.");
        }

        const result = await broadcastLineMessage(tenant.line_access_token, messages);

        return {
          content: [
            {
              type: "text",
              text: `Broadcast message sent to all followers of tenant '${tenant.name}'.\n${JSON.stringify(result)}`
            }
          ]
        };
      }

      case "get_user_tags": {
        const userId = toolArgs.user_id as string;
        const tenantId = toolArgs.tenant_id as string | undefined;

        const tags = await getUserTags(userId, tenantId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ userId, tags }, null, 2)
            }
          ]
        };
      }

      case "add_user_tag": {
        const userId = toolArgs.user_id as string;
        const tagName = toolArgs.tag_name as string;
        const tenantId = toolArgs.tenant_id as string | undefined;

        const tenant = await getTenantByIdOrDefault(tenantId);
        await addUserTag(userId, tagName, tenant.id);

        return {
          content: [
            {
              type: "text",
              text: `Tag '${tagName}' successfully added to user '${userId}'.`
            }
          ]
        };
      }

      case "remove_user_tag": {
        const userId = toolArgs.user_id as string;
        const tagName = toolArgs.tag_name as string;
        const tenantId = toolArgs.tenant_id as string | undefined;

        const tenant = await getTenantByIdOrDefault(tenantId);
        await removeUserTag(userId, tagName, tenant.id);

        return {
          content: [
            {
              type: "text",
              text: `Tag '${tagName}' successfully removed from user '${userId}'.`
            }
          ]
        };
      }

      case "get_line_user_profile": {
        const userId = toolArgs.user_id as string;
        const tenantId = toolArgs.tenant_id as string | undefined;

        const tenant = await getTenantByIdOrDefault(tenantId);
        if (!tenant.line_access_token) {
          throw new Error(`Tenant '${tenant.name}' does not have a valid LINE access token.`);
        }

        const profile = await getLineUserProfile(tenant.line_access_token, userId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(profile, null, 2)
            }
          ]
        };
      }

      case "get_rich_menu_list": {
        const tenantId = toolArgs.tenant_id as string | undefined;

        const tenant = await getTenantByIdOrDefault(tenantId);
        if (!tenant.line_access_token) {
          throw new Error(`Tenant '${tenant.name}' does not have a valid LINE access token.`);
        }

        const richMenus = await getLineRichMenuList(tenant.line_access_token);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(richMenus, null, 2)
            }
          ]
        };
      }

      case "set_default_rich_menu": {
        const richMenuId = toolArgs.rich_menu_id as string;
        const tenantId = toolArgs.tenant_id as string | undefined;

        const tenant = await getTenantByIdOrDefault(tenantId);
        if (!tenant.line_access_token) {
          throw new Error(`Tenant '${tenant.name}' does not have a valid LINE access token.`);
        }

        const result = await setDefaultRichMenu(tenant.line_access_token, richMenuId);
        return {
          content: [
            {
              type: "text",
              text: `Successfully set Rich Menu '${richMenuId}' as default for tenant '${tenant.name}'.\n${JSON.stringify(result)}`
            }
          ]
        };
      }

      case "unlink_default_rich_menu": {
        const tenantId = toolArgs.tenant_id as string | undefined;

        const tenant = await getTenantByIdOrDefault(tenantId);
        if (!tenant.line_access_token) {
          throw new Error(`Tenant '${tenant.name}' does not have a valid LINE access token.`);
        }

        const result = await unlinkDefaultRichMenu(tenant.line_access_token);
        return {
          content: [
            {
              type: "text",
              text: `Successfully canceled / unlinked default Rich Menu for tenant '${tenant.name}'.\n${JSON.stringify(result)}`
            }
          ]
        };
      }

      case "delete_rich_menu": {
        const richMenuId = toolArgs.rich_menu_id as string;
        const tenantId = toolArgs.tenant_id as string | undefined;

        const tenant = await getTenantByIdOrDefault(tenantId);
        if (!tenant.line_access_token) {
          throw new Error(`Tenant '${tenant.name}' does not have a valid LINE access token.`);
        }

        // 1. Delete from LINE API
        await deleteLineRichMenu(tenant.line_access_token, richMenuId);

        // 2. Delete from Supabase Database
        const { supabase } = await import("./supabase.js");
        await supabase.from("rich_menus").delete().eq("rich_menu_id", richMenuId);

        return {
          content: [
            {
              type: "text",
              text: `Successfully deleted Rich Menu '${richMenuId}' from LINE API and Supabase DB.`
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing tool '${name}': ${error.message}`
        }
      ]
    };
  }
});

// Start transport using stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LINE MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting LINE MCP Server:", err);
  process.exit(1);
});
