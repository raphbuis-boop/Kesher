export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase-server";

type PersonRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  categories: string[] | null;
  created_at: string;
};

type DuplicateGroup = {
  key: string;
  reason: string;
  people: PersonRow[];
};

export default async function DuplicatesPage() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("people")
    .select("id, first_name, last_name, email, phone, categories, created_at")
    .order("last_name");

  if (error) {
    return (
      <div className="p-8 text-red-600 font-mono text-sm">
        Error loading people: {error.message}
      </div>
    );
  }

  const people = (data ?? []) as PersonRow[];

  // --- Bucket 1: same non-null email ---
  const byEmail = new Map<string, PersonRow[]>();
  for (const p of people) {
    if (!p.email) continue;
    const key = p.email.toLowerCase().trim();
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key)!.push(p);
  }
  const emailDups: DuplicateGroup[] = [];
  for (const [key, group] of byEmail) {
    if (group.length > 1) emailDups.push({ key, reason: "Same email", people: group });
  }

  // --- Bucket 2: same first+last+phone (phone non-null) ---
  const byNamePhone = new Map<string, PersonRow[]>();
  for (const p of people) {
    if (!p.phone) continue;
    const key = `${p.first_name.trim().toLowerCase()}|${p.last_name.trim().toLowerCase()}|${p.phone.replace(/\D/g, "")}`;
    if (!byNamePhone.has(key)) byNamePhone.set(key, []);
    byNamePhone.get(key)!.push(p);
  }
  const namePhoneDups: DuplicateGroup[] = [];
  for (const [key, group] of byNamePhone) {
    if (group.length > 1) namePhoneDups.push({ key, reason: "Same name + phone", people: group });
  }

  // --- Bucket 3: same first+last, email null on at least one ---
  const byName = new Map<string, PersonRow[]>();
  for (const p of people) {
    const key = `${p.first_name.trim().toLowerCase()}|${p.last_name.trim().toLowerCase()}`;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(p);
  }
  const nameDups: DuplicateGroup[] = [];
  for (const [key, group] of byName) {
    if (group.length > 1 && group.some((p) => !p.email)) {
      nameDups.push({ key, reason: "Same name, some missing email", people: group });
    }
  }

  // Deduplicate across buckets by collecting all duplicate person IDs
  const allDupIds = new Set<string>();
  [...emailDups, ...namePhoneDups, ...nameDups].forEach((g) =>
    g.people.forEach((p) => allDupIds.add(p.id))
  );

  const totalDupPeople = allDupIds.size;
  // Estimate safe-to-delete count: total people in duplicate groups minus one per group
  const safeToDelete =
    emailDups.reduce((n, g) => n + g.people.length - 1, 0) +
    namePhoneDups.reduce((n, g) => n + g.people.length - 1, 0) +
    nameDups
      .filter((g) => !emailDups.some((e) => e.people.some((ep) => g.people.some((np) => np.id === ep.id))))
      .reduce((n, g) => n + g.people.length - 1, 0);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function GroupTable({ groups, title }: { groups: DuplicateGroup[]; title: string }) {
    if (groups.length === 0) {
      return (
        <div className="mb-10">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900">{title}</h2>
          <p className="text-sm text-zinc-400">No duplicates found.</p>
        </div>
      );
    }
    return (
      <div className="mb-10">
        <h2 className="mb-1 text-sm font-semibold text-zinc-900">{title}</h2>
        <p className="mb-4 text-xs text-zinc-400">{groups.length} duplicate group{groups.length !== 1 ? "s" : ""}</p>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.key} className="overflow-hidden rounded-lg border border-zinc-200">
              <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-500">
                {g.reason} — {g.people.length} contacts
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="py-2 pl-4 pr-3 text-left text-xs font-medium text-zinc-400">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Email</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Phone</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Audiences</th>
                    <th className="pl-3 pr-4 py-2 text-left text-xs font-medium text-zinc-400">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {g.people.map((p, i) => (
                    <tr key={p.id} className={i === 0 ? "bg-white" : "bg-amber-50"}>
                      <td className="py-2.5 pl-4 pr-3 font-medium text-zinc-900">
                        {p.first_name} {p.last_name}
                        {i === 0 && (
                          <span className="ml-2 text-[10px] font-normal text-zinc-400 uppercase tracking-wide">keep</span>
                        )}
                        {i > 0 && (
                          <span className="ml-2 text-[10px] font-normal text-amber-600 uppercase tracking-wide">duplicate</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-600">{p.email ?? <span className="text-zinc-300">—</span>}</td>
                      <td className="px-3 py-2.5 text-zinc-600">{p.phone ?? <span className="text-zinc-300">—</span>}</td>
                      <td className="px-3 py-2.5 text-zinc-500 text-xs">{(p.categories ?? []).join(", ") || "—"}</td>
                      <td className="pl-3 pr-4 py-2.5 text-zinc-400 tabular-nums">{formatDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-zinc-900">Duplicate Contacts Audit</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Read-only — no data has been modified.
          </p>
        </div>

        {/* Summary */}
        <div className="mb-10 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Total contacts</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{people.length.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">In duplicate groups</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-600">{totalDupPeople.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Safe to remove</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-red-600">{safeToDelete.toLocaleString()}</p>
          </div>
        </div>

        {/* Cleanup strategy */}
        <div className="mb-10 rounded-xl border border-zinc-200 bg-white px-6 py-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Cleanup Strategy</h2>
          <ol className="space-y-2 text-sm text-zinc-600 list-decimal list-inside">
            <li><span className="font-medium text-zinc-900">Email duplicates first</span> — highest confidence. Keep the oldest record (first import), delete the rest. Merge phone/categories from duplicates if the keeper is missing them.</li>
            <li><span className="font-medium text-zinc-900">Name + phone duplicates next</span> — very safe if not already caught by email. Same rule: keep oldest.</li>
            <li><span className="font-medium text-zinc-900">Name-only duplicates last</span> — review manually. Same name ≠ same person (e.g., two "Yossi Cohen"). Only delete if you recognise them as the same individual.</li>
            <li><span className="font-medium text-zinc-900">Before deleting</span> — back up the people table with a Supabase export, or copy duplicate IDs to a spreadsheet so you can restore if needed.</li>
          </ol>
        </div>

        <GroupTable groups={emailDups} title="Bucket 1 — Same Email Address" />
        <GroupTable groups={namePhoneDups} title="Bucket 2 — Same Name + Phone" />
        <GroupTable groups={nameDups} title="Bucket 3 — Same Name (email missing on at least one)" />
      </div>
    </div>
  );
}
