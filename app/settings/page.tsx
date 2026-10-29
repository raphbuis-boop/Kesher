export const dynamic = "force-dynamic";

import { getBrandingSettings } from "@/lib/settings";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership, isAdminRole, sendsAreSimulated } from "@/lib/org";
import { isDemoWorkspaceLoaded } from "@/lib/demoWorkspace";
import { DemoWorkspaceControl } from "@/app/components/DemoWorkspaceControl";
import { AdminOnly } from "@/app/components/AdminOnly";
import { getChannelsOverview } from "./channels";
import { ChannelsSettings } from "./panels/ChannelsSettings";
import { WhatsAppTemplatePanel } from "./panels/WhatsAppTemplatePanel";
import { SettingsShell, type SectionId, type TeamInvite, type TeamMember } from "./SettingsShell";
import { getCustomFieldDefs } from "@/lib/customFields";
import { CustomFieldsSettings } from "./panels/CustomFieldsSettings";
import { NewContactsSetting } from "./panels/NewContactsSetting";
import { Panel } from "./panels/ui";
import Link from "next/link";
import { GoogleSheetsSettings, type SheetSourceView } from "./panels/GoogleSheetsSettings";
import { getGoogleConnection, googleConfigError } from "@/lib/google";
import { IntegrationsSettings } from "./panels/IntegrationsSettings";
import { TemplatesSettings, type AudienceChoice } from "./panels/TemplatesSettings";
import { getAudienceTemplateMap, listTemplates } from "@/lib/templates";
import { PROVIDERS } from "@/lib/sync/connectors";
import type { SyncStats } from "@/lib/sync/engine";
import { getNewContactsMode } from "@/lib/sync/engine";
import { MessagingSettings } from "./panels/MessagingSettings";
import { getRequireApproval, getSchoolTimezone } from "@/lib/schoolTime";
import { getDispatcherHealth } from "@/lib/send/health";
import { getAbsoluteBaseUrl } from "@/lib/site-url";
import { getHebrewDateStyle } from "@/lib/hebrewDate";
import QRCode from "qrcode";
import { ParentSignupSettings } from "./panels/ParentSignupSettings";
import { buildSignupUrl, canVerifyPhones, getSignupSettings } from "@/lib/signup";
import { ShabbosSettings, type ShabbosView } from "./panels/ShabbosSettings";
import { getShabbosSettings, getUpcomingWindows, SHABBOS_DEFAULTS } from "@/lib/shabbos";
import { formatInZone } from "@/lib/schoolTime";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { orgId, userId, role } = await getMembership();
  const isAdmin = isAdminRole(role);

  const [branding, claimsRes] = await Promise.all([getBrandingSettings(), supabase.auth.getClaims()]);
  const claims = claimsRes.data?.claims;
  const meta = (claims?.user_metadata ?? {}) as { full_name?: string; name?: string };

  // School, team, channels and data are owner/admin only — members only get
  // their own profile and appearance, so none of this is loaded for them.
  const admin = isAdmin
    ? await Promise.all([
        isDemoWorkspaceLoaded(supabase, orgId),
        sendsAreSimulated(orgId),
        supabase
          .from("imports")
          .select("id, file_name, imported_count, failed_count, created_at")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(10),
        getChannelsOverview(orgId, { schoolName: branding.schoolName, senderName: branding.senderName, senderEmail: branding.senderEmail }),
        supabase.rpc("org_members", { p_org: orgId }),
        supabase
          .from("org_invites")
          .select("id, email, role, created_at, expires_at")
          .eq("org_id", orgId)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false }),
        getCustomFieldDefs(supabase, orgId),
        getNewContactsMode(supabase, orgId),
        supabase.from("people").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
        getGoogleConnection(orgId).catch(() => null),
        supabase
          .from("sync_sources")
          .select("id, name, config, auto_sync, last_run_at, last_run_id, last_error")
          .eq("org_id", orgId)
          .eq("kind", "google_sheets")
          .order("created_at"),
        supabase.from("integration_requests").select("provider").eq("org_id", orgId),
        listTemplates(supabase, orgId),
        getAudienceTemplateMap(supabase, orgId),
        supabase.from("groups").select("id, name").eq("org_id", orgId).order("name"),
        getSchoolTimezone(supabase, orgId),
        getRequireApproval(supabase, orgId),
        getDispatcherHealth(supabase),
        getHebrewDateStyle(supabase, orgId),
        supabase.from("settings").select("key, value").eq("org_id", orgId).in("key", ["sms_pref_link", "family_archive"]),
        getShabbosSettings(supabase, orgId),
        getUpcomingWindows(supabase, orgId, new Date(), 6),
        supabase.from("window_overrides").select("reason, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(5),
        getSignupSettings(supabase, orgId),
        canVerifyPhones(orgId),
        supabase.from("people").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending").eq("source_system", "signup").contains("categories", ["parent"]),
      ])
    : null;

  const [demoLoaded, simulated, importsRes, channelsOverview, membersRes, invitesRes, fieldDefs, newContactsMode, pendingRes, googleConnection, sheetsRes, requestsRes, templates, templateAssignments, groupsRes, schoolTimezone, requireApproval, dispatcherHealth, hebrewStyle, prefLinkRes, shabbosSettings, shabbosWindows, overridesRes, signupSettings, signupVerifies, signupPending] = admin ?? [];

  const audienceChoices: AudienceChoice[] = [
    ...[["parents", "Parents"], ["students", "Students"], ["grandparents", "Grandparents"], ["alumni", "Alumni"], ["faculty", "Faculty"], ["staff", "Staff"], ["board", "Board"], ["donors", "Donors"], ["prospects", "Prospects"]].map(
      ([slug, label]) => ({ slug, label, custom: false })
    ),
    ...((groupsRes?.data ?? []) as { id: string; name: string }[]).map((g) => ({ slug: g.id, label: g.name, custom: true })),
  ];

  // Last run result for each connected sheet
  type SheetRow = { id: string; name: string; config: Record<string, string>; auto_sync: boolean; last_run_at: string | null; last_run_id: string | null; last_error: string | null };
  const sheetRows = (sheetsRes?.data ?? []) as SheetRow[];
  const lastRunIds = sheetRows.map((r) => r.last_run_id).filter((x): x is string => !!x);
  const lastRuns = lastRunIds.length
    ? ((await supabase.from("sync_runs").select("id, status, stats").eq("org_id", orgId).in("id", lastRunIds)).data ?? []) as { id: string; status: string; stats: Partial<SyncStats> }[]
    : [];
  const sheetViews: SheetSourceView[] = sheetRows.map((r) => {
    const run = lastRuns.find((x) => x.id === r.last_run_id);
    return {
      id: r.id,
      name: r.name,
      tab: r.config.tabTitle ?? "",
      spreadsheetId: r.config.spreadsheetId ?? "",
      spreadsheetTitle: r.config.spreadsheetTitle ?? "Spreadsheet",
      autoSync: r.auto_sync,
      lastRunAt: r.last_run_at,
      lastRunId: r.last_run_id,
      lastRunStatus: run?.status ?? null,
      lastStats: run?.stats ?? null,
      lastError: r.last_error,
    };
  });

  const tzForTimes = schoolTimezone ?? "America/New_York";
  const shabbosView: ShabbosView = {
    enabled: shabbosSettings?.enabled ?? false,
    location: shabbosSettings ? (shabbosSettings.geoKind === "zip" ? (shabbosSettings.zip ?? "") : (shabbosSettings.geonameid ?? "")) : "",
    locationName: shabbosSettings?.locationName ?? null,
    israelSchedule: shabbosSettings?.israelSchedule ?? false,
    candleMinutes: shabbosSettings?.candleMinutes ?? SHABBOS_DEFAULTS.candleMinutes,
    havdalahMode: shabbosSettings?.havdalahMode ?? SHABBOS_DEFAULTS.havdalahMode,
    havdalahMinutes: shabbosSettings?.havdalahMinutes ?? SHABBOS_DEFAULTS.havdalahMinutes,
    bufferMinutes: shabbosSettings?.bufferMinutes ?? SHABBOS_DEFAULTS.bufferMinutes,
    fetchedAt: shabbosSettings?.fetchedAt ?? null,
    fetchError: shabbosSettings?.fetchError ?? null,
    upcoming: (shabbosWindows ?? []).map((w) => ({
      label: w.label ?? (w.kind === "yomtov" ? "Yom Tov" : "Shabbos"),
      candles: formatInZone(w.startsAt, tzForTimes),
      havdalah: formatInZone(w.endsAt, tzForTimes),
      resumes: formatInZone(new Date(new Date(w.endsAt).getTime() + (shabbosSettings?.bufferMinutes ?? 0) * 60_000), tzForTimes),
    })),
    overrides: ((overridesRes?.data ?? []) as { reason: string; created_at: string }[]).map((o) => ({ reason: o.reason, when: formatInZone(o.created_at, tzForTimes, { withYear: true }) })),
    isOwner: role === "owner",
  };

  const signupUrl = signupSettings?.enabled ? buildSignupUrl(orgId, signupSettings.epoch) : null;
  const [signupQrSvg, signupQrPng] = signupUrl
    ? await Promise.all([QRCode.toString(signupUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" }), QRCode.toDataURL(signupUrl, { margin: 2, width: 768, errorCorrectionLevel: "M" })])
    : [null, null];

  // Server-loaded panels shown inside the matching Settings section (admins only)
  const panels: Partial<Record<SectionId, React.ReactNode>> = admin && channelsOverview
    ? {
        channels: <ChannelsSettings overview={channelsOverview} simulated={simulated ?? false} />,
        shabbos: <ShabbosSettings view={shabbosView} />,
        parents: (
          <ParentSignupSettings
            enabled={signupSettings?.enabled ?? false}
            intro={signupSettings?.intro ?? ""}
            url={signupUrl}
            qrSvg={signupQrSvg}
            qrPng={signupQrPng}
            pending={signupPending?.count ?? 0}
            verifiesPhones={signupVerifies ?? false}
          />
        ),
        messaging: (
          <MessagingSettings
            timezone={schoolTimezone ?? "America/New_York"}
            requireApproval={requireApproval ?? false}
            hebrewDates={hebrewStyle ?? "latin"}
            smsPrefLink={!((prefLinkRes?.data ?? []) as { key: string; value: string }[]).some((r) => r.key === "sms_pref_link" && r.value === "false")}
            familyArchive={!((prefLinkRes?.data ?? []) as { key: string; value: string }[]).some((r) => r.key === "family_archive" && r.value === "false")}
            schedulerLastRun={dispatcherHealth?.lastRunAt ?? null}
            schedulerHealthy={dispatcherHealth?.healthy ?? false}
            siteUrl={getAbsoluteBaseUrl() ?? ""}
          />
        ),
        templates: (
          <div className="space-y-5">
          <TemplatesSettings
            templates={templates ?? []}
            assignments={templateAssignments ?? {}}
            audiences={audienceChoices}
            brand={{ schoolName: branding.schoolName, primaryColor: branding.primaryColor, logoUrl: branding.logoUrl, footerText: branding.footerText, senderName: branding.senderName }}
            uploadsEnabled={!!process.env.BLOB_READ_WRITE_TOKEN}
          />
          <WhatsAppTemplatePanel
            configured={channelsOverview.statuses.find((c) => c.key === "whatsapp")?.state !== "not_connected"}
            templateName={channelsOverview.form.whatsapp.templateName}
            templateVars={channelsOverview.form.whatsapp.templateVars}
            live={channelsOverview.live}
            hasWaba={!!channelsOverview.form.whatsapp.wabaId}
          />
          </div>
        ),
        data: (
          <div className="space-y-5">
            <NewContactsSetting mode={newContactsMode ?? "review"} pending={pendingRes?.count ?? 0} />
            <GoogleSheetsSettings
              configError={googleConfigError()}
              connection={googleConnection ?? null}
              sources={sheetViews}
              customFields={(fieldDefs ?? []).map((d) => ({ key: d.key, label: d.label }))}
            />
            <IntegrationsSettings providers={PROVIDERS} requested={((requestsRes?.data ?? []) as { provider: string }[]).map((r) => r.provider)} />
            <Panel
              title="New school year"
              description="At the end of the year, promote every student one grade and graduate your last grade. You preview everything first and can undo it."
              footer={<Link href="/settings/rollover" className="btn btn-primary">Start rollover</Link>}
            >
              <p className="text-[12px] text-ink-3">Graduates are archived, not deleted, so their message history stays.</p>
            </Panel>
            <CustomFieldsSettings defs={fieldDefs ?? []} />
          </div>
        ),
      }
    : {};

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-ink">Settings</h1>
            <p className="text-[11px] text-ink-3 mt-px">
              {isAdmin ? "Your profile, school, team, channels and data" : "Your profile and appearance"}
            </p>
          </div>
          {demoLoaded && <AdminOnly><DemoWorkspaceControl mode="remove" /></AdminOnly>}
        </div>
      </header>

      <SettingsShell
        currentUserId={userId}
        profile={{ name: meta.full_name ?? meta.name ?? "", email: (claims?.email as string | undefined) ?? "" }}
        branding={branding}
        role={role}
        imports={(importsRes?.data ?? []) as ImportRow[]}
        members={(membersRes?.data ?? []) as TeamMember[]}
        invites={withExpiry((invitesRes?.data ?? []) as Omit<TeamInvite, "expired">[])}
        logoUploadsEnabled={!!process.env.BLOB_READ_WRITE_TOKEN}
        panels={panels}
      />
    </div>
  );
}

function withExpiry(rows: Omit<TeamInvite, "expired">[]): TeamInvite[] {
  const now = Date.now();
  return rows.map((r) => ({ ...r, expired: new Date(r.expires_at).getTime() <= now }));
}

export type ImportRow = {
  id: string;
  file_name: string;
  imported_count: number;
  failed_count: number | null;
  created_at: string;
};
