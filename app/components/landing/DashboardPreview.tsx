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
  sms: { bg: "bg-emerald-50", text: "text-emerald-600", label: "SMS" },
  email: { bg: "bg-zinc-100", text: "text-zinc-500", label: "Email" },
};

export function DashboardPreview() {
  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-[0_8px_48px_rgba(23,58,58,0.12)] bg-surface">
      <div className="flex bg-[#fafafa]" style={{ minHeight: 400 }}>
        {/* Sidebar */}
        <div className="w-[210px] shrink-0 border-r border-[#e7e7e7] bg-[#f5f5f5] hidden sm:flex flex-col">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-[6px] bg-[#0b1120] flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-white">K</span>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#0b1120] leading-none">Kesher</p>
                <p className="text-[9px] text-[#a1a1aa] leading-none mt-0.5">School Comms</p>
              </div>
            </div>
          </div>

          <div className="px-4 pb-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#c4c4c8]">Navigation</p>
          </div>

          <div className="flex-1 px-2 space-y-0.5">
            {sidebarItems.map(({ label, Icon, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded-md px-2.5 py-[5px] text-[11px] font-medium ${
                  active ? "bg-accent-tint text-accent" : "text-[#71717a]"
                }`}
              >
                <Icon size={12} strokeWidth={active ? 2 : 1.75} className={active ? "text-accent" : "text-[#a1a1aa]"} />
                {label}
              </div>
            ))}
          </div>

          <div className="px-2 py-2 border-t border-[#ebebeb]">
            <div className="flex items-center gap-2 rounded-md px-2.5 py-[5px] text-[11px] font-medium text-[#a1a1aa]">
              <Settings size={12} strokeWidth={1.75} className="text-[#c4c4c8]" />
              Settings
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="sticky top-0 border-b border-[#e7e7e7] bg-white/95 px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#0b1120]">Overview</p>
              <p className="text-[9px] text-[#a1a1aa] mt-px">Your School</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-[#0b1120] px-2.5 py-1">
              <PenLine size={10} strokeWidth={2} className="text-white" />
              <span className="text-[10px] font-medium text-white">Compose</span>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[
                { label: "Active Contacts", value: "412", sub: "in directory" },
                { label: "This Week", value: "3", sub: "campaigns sent" },
                { label: "Delivery Rate", value: "97.6%", sub: "last 30 days", accent: "border-t-2 border-t-accent" },
                { label: "Open Rate", value: "64.2%", sub: "email, last 30d", accent: "border-t-2 border-t-violet-400" },
              ].map(({ label, value, sub, accent }) => (
                <div key={label} className={`rounded-xl border border-[#e7e7e7] bg-white px-3.5 py-3 ${accent ?? ""}`}>
                  <p className="text-[8px] font-semibold uppercase tracking-wider text-[#a1a1aa]">{label}</p>
                  <p className="mt-1.5 text-[22px] font-semibold tracking-tight tabular-nums leading-none text-[#0b1120]">{value}</p>
                  <p className="mt-1.5 text-[9px] text-[#a1a1aa]">{sub}</p>
                </div>
              ))}
            </div>

            {/* Activity feed */}
            <div className="rounded-xl border border-[#e7e7e7] bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
                <div>
                  <p className="text-[11px] font-semibold text-[#0b1120]">Activity</p>
                  <p className="text-[9px] text-[#a1a1aa] mt-px">Campaigns and imports</p>
                </div>
                <span className="text-[9px] font-medium text-[#a1a1aa]">View all →</span>
              </div>
              {feedItems.map((item, i) => {
                const ch = channelColor[item.channel] ?? channelColor.sms;
                const isLast = i === feedItems.length - 1;
                return (
                  <div key={item.subject} className={`flex items-center gap-3 px-4 py-3 ${!isLast ? "border-b border-[#f5f5f5]" : ""}`}>
                    <div className="h-6 w-6 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={10} className="text-emerald-500" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[11px] font-medium text-[#0b1120] truncate">{item.subject}</p>
                        <span className={`shrink-0 rounded-full px-1.5 py-px text-[8px] font-semibold ${ch.bg} ${ch.text}`}>
                          {ch.label}
                        </span>
                      </div>
                      <p className="text-[9px] text-[#a1a1aa] mt-px">
                        {item.audience} · {item.recipients} recipients · {item.status}
                      </p>
                    </div>
                    <span className="text-[9px] tabular-nums text-[#a1a1aa] shrink-0">{item.time}</span>
                  </div>
                );
              })}
            </div>

            {/* Quick actions row */}
            <div className="rounded-xl border border-[#e7e7e7] bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-[#f0f0f0]">
                <p className="text-[11px] font-semibold text-[#0b1120]">Quick Actions</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#f5f5f5]">
                {[
                  { Icon: PenLine, label: "Compose", sub: "Send to any audience" },
                  { Icon: Upload, label: "Import Contacts", sub: "Upload a CSV" },
                  { Icon: UserPlus, label: "Add Contact", sub: "Add a single person" },
                  { Icon: Layers, label: "Audiences", sub: "Manage groups" },
                ].map(({ Icon, label, sub }) => (
                  <div key={label} className="flex items-center gap-2.5 px-4 py-3">
                    <div className="h-7 w-7 shrink-0 rounded-lg border border-[#e7e7e7] bg-white flex items-center justify-center">
                      <Icon size={11} className="text-[#71717a]" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-[#0b1120]">{label}</p>
                      <p className="text-[9px] text-[#a1a1aa]">{sub}</p>
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
