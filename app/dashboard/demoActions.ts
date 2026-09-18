"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { isWorkspaceEmpty, loadDemoWorkspace, removeDemoWorkspace } from "@/lib/demoWorkspace";

export type DemoActionState = {
  success: boolean;
  error: string | null;
  message: string | null;
};

const AFFECTED_PATHS = ["/dashboard", "/people", "/audiences", "/groups", "/messages", "/activity", "/settings"];

function revalidateAffectedPaths() {
  for (const path of AFFECTED_PATHS) revalidatePath(path);
}

/**
 * Loads the fictional Riverside Academy demo dataset into the signed-in
 * user's own org. Only ever proceeds if that org's People list is currently
 * empty — never available, and never effective, once real contacts exist.
 */
export async function loadDemoDataAction(): Promise<DemoActionState> {
  try {
    const supabase = await createSupabaseServerClient();
    const orgId = await getOrgId();

    if (!(await isWorkspaceEmpty(supabase, orgId))) {
      return { success: false, error: "This workspace already has data — demo data can only be loaded into an empty workspace.", message: null };
    }

    const result = await loadDemoWorkspace(supabase, orgId);
    revalidateAffectedPaths();

    return {
      success: true,
      error: null,
      message: `Loaded ${result.peopleCount.toLocaleString()} sample contacts, ${result.groupCount} audiences, and ${result.messageCount} sample messages.`,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load demo data.", message: null };
  }
}

/** Deletes exactly the rows created by loadDemoDataAction() for this org — nothing else. */
export async function removeDemoDataAction(): Promise<DemoActionState> {
  try {
    const supabase = await createSupabaseServerClient();
    const orgId = await getOrgId();

    const result = await removeDemoWorkspace(supabase, orgId);
    revalidateAffectedPaths();

    if (result.peopleRemoved === 0 && result.groupsRemoved === 0 && result.messagesRemoved === 0) {
      return { success: true, error: null, message: "No demo data found — nothing to remove." };
    }

    return {
      success: true,
      error: null,
      message: `Removed ${result.peopleRemoved.toLocaleString()} sample contacts, ${result.groupsRemoved} audiences, and ${result.messagesRemoved} sample messages.`,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to remove demo data.", message: null };
  }
}
