import {
  LayoutDashboard,
  Users,
  Layers,
  MessageSquare,
  Activity,
  Upload,
  Settings,
  PenLine,
  UserPlus,
  CheckCircle2,
} from "lucide-react";

// Pixel-faithful HTML render of the actual Kesher dashboard, presented directly
// as a real UI card — no fake browser chrome around it.

const sidebarItems = [
  { label: "Overview", Icon: LayoutDashboard, active: true },
  { label: "People", Icon: Users, active: false },
  { label: "Audiences", Icon: Layers, active: false },
  { label: "Messages", Icon: MessageSquare, active: false },
  { label: "Activity", Icon: Activity, active: false },
  { label: "Imports", Icon: Upload, active: false },
];

const feedItems = [
  { subject: "Shabbat schedule reminder", channel: "sms", audience: "Parents", recipients: 186, status: "sent", time: "2h ago" },
  { subject: "Spring Gala — save the date", channel: "email", audience: "Families", recipients: 312, status: "sent", time: "1d ago" },
  { subject: "School closure — weather alert", channel: "sms", audience: "All", recipients: 498, status: "sent", time: "3d ago" },
];

const channelColor: Record<string, { bg: string; text: string; label: string }> = {
  sms: { bg: "bg-success-tint", text: "text-success", label: "SMS" },
  email: { bg: "bg-surface-2", text: "text-text-muted", label: "Email" },
};

export function DashboardPreview() {
  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-[0_8px_48px_rgba(23,58,58,0.12)] bg-surface">
      <div className="flex bg-background" style={{ minHeight: 400 }}>
        {/* Sidebar */}
        <div className="w-[210px] shrink-0 border-r border-border bg-surface-2 hidden sm:flex flex-col">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-[6px] bg-primary flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-primary-fg">K</span>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-text-primary leading-none">Kesher</p>
                <p className="text-[9px] text-text-subtle leading-none mt-0.5">School Comms</p>
              </div>
            </div>
          </div>

          <div className="px-4 pb-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-text-subtle">Navigation</p>
          </div>

          <div className="flex-1 px-2 space-y-0.5">
            {sidebarItems.map(({ label, Icon, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-md px-2.5 py-[5px] text-[11px] font-medium ${
                  active ? "bg-accent-tint text-accent" : "text-text-muted"
                }`}
              >
                <Icon size={12} strokeWidth={active ? 2 : 1.75} className={active ? "text-accent" : "text-text-subtle"} />
                {label}
              </div>
            ))}
          </div>

          <div className="px-2 py-2 border-t border-border-subtle">
            <div className="flex items-center gap-2 rounded-md px-2.5 py-[5px] text-[11px] font-medium text-text-subtle">
              <Settings size={12} strokeWidth={1.75} className="text-text-faint" />
              Settings
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="sticky top-0 border-b border-border bg-surface/95 px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-text-primary">Overview</p>
              <p className="text-[9px] text-text-subtle mt-px">Your School</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1">
              <PenLine size={10} strokeWidth={2} className="text-primary-fg" />
              <span className="text-[10px] font-medium text-primary-fg">Compose</span>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[
                { label: "Active Contacts", value: "412", sub: "in directory" },
                { label: "This Week", value: "3", sub: "campaigns sent" },
                { label: "Delivery Rate", value: "97.6%", sub: "last 30 days", accent: "border-t-2 border-t-accent" },
                { label: "Open Rate", value: "64.2%", sub: "email, last 30d", accent: "border-t-2 border-t-cat-violet-solid" },
              ].map(({ label, value, sub, accent }) => (
                <div key={label} className={`rounded-xl border border-border bg-surface px-3.5 py-3 ${accent ?? ""}`}>
                  <p className="text-[8px] font-semibold uppercase tracking-wider text-text-subtle">{label}</p>
                  <p className="mt-1.5 text-[22px] font-semibold tracking-tight tabular-nums leading-none text-text-primary">{value}</p>
                  <p className="mt-1.5 text-[9px] text-text-subtle">{sub}</p>
                </div>
              ))}
            </div>

            {/* Activity feed */}
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
                <div>
                  <p className="text-[11px] font-semibold text-text-primary">Activity</p>
                  <p className="text-[9px] text-text-subtle mt-px">Campaigns and imports</p>
                </div>
                <span className="text-[9px] font-medium text-text-subtle">View all →</span>
              </div>
              {feedItems.map((item, i) => {
                const ch = channelColor[item.channel] ?? channelColor.sms;
                const isLast = i === feedItems.length - 1;
                return (
                  <div key={item.subject} className={`flex items-center gap-3 px-4 py-3 ${!isLast ? "border-b border-border-subtle" : ""}`}>
                    <div className="h-6 w-6 rounded-full bg-success-tint flex items-center justify-center shrink-0">
                      <CheckCircle2 size={10} className="text-success" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[11px] font-medium text-text-primary truncate">{item.subject}</p>
                        <span className={`shrink-0 rounded-full px-1.5 py-px text-[8px] font-semibold ${ch.bg} ${ch.text}`}>
                          {ch.label}
                        </span>
                      </div>
                      <p className="text-[9px] text-text-subtle mt-px">
                        {item.audience} · {item.recipients} recipients · {item.status}
                      </p>
                    </div>
                    <span className="text-[9px] tabular-nums text-text-subtle shrink-0">{item.time}</span>
                  </div>
                );
              })}
            </div>

            {/* Quick actions row */}
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-4 py-3 border-b border-border-subtle">
                <p className="text-[11px] font-semibold text-text-primary">Quick Actions</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border-subtle">
                {[
                  { Icon: PenLine, label: "Compose", sub: "Send to any audience" },
                  { Icon: Upload, label: "Import Contacts", sub: "Upload a CSV" },
                  { Icon: UserPlus, label: "Add Contact", sub: "Add a single person" },
                  { Icon: Layers, label: "Audiences", sub: "Manage groups" },
                ].map(({ Icon, label, sub }) => (
                  <div key={label} className="flex items-center gap-2.5 px-4 py-3">
                    <div className="h-7 w-7 shrink-0 rounded-lg border border-border bg-surface flex items-center justify-center">
                      <Icon size={11} className="text-text-muted" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-text-primary">{label}</p>
                      <p className="text-[9px] text-text-subtle">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
