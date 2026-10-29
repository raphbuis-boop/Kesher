import { BadgeCheck, CheckCheck, FileSpreadsheet, Inbox, Languages, MoonStar, Send, Users } from "lucide-react";

/** What Kesher actually does — shared by the landing pages so they can't drift from the product. */
export const LANDING_FEATURES = [
  {
    Icon: BadgeCheck,
    title: "WhatsApp from your school's own name",
    body: "Connect your school's own verified WhatsApp Business number. Parents see your school's name, not a random number or a vendor's.",
  },
  {
    Icon: Send,
    title: "One send reaches every family",
    body: "Write once and Kesher delivers on WhatsApp, text or email — every channel, or each parent's best one with automatic fallback if a message fails.",
  },
  {
    Icon: MoonStar,
    title: "Shabbos and Yom Tov hold",
    body: "Sends are held from candle lighting to Havdalah, on Shabbos and Yom Tov, using your school's location. Schedule around zmanim, like an hour after Havdalah.",
  },
  {
    Icon: Languages,
    title: "Hebrew support",
    body: "Hebrew and English in the same message display correctly right-to-left, with the Hebrew date on messages and an honest text-length counter.",
  },
  {
    Icon: CheckCheck,
    title: "“I’ve read this” confirmations",
    body: "Add a confirmation button and see exactly which families read it. Resend to everyone who hasn't, in one click.",
  },
  {
    Icon: Users,
    title: "Households and sibling dedupe",
    body: "Students link to their parents. A family with three kids gets one message per parent, not three — divorced parents each get their own, and custody flags are respected.",
  },
  {
    Icon: FileSpreadsheet,
    title: "Auto-sync from your spreadsheets",
    body: "Connect a Google Sheet or upload Excel/CSV. Kesher shows exactly what will change before anything is saved, then keeps the sheet in sync every night.",
  },
  {
    Icon: Inbox,
    title: "Replies inbox",
    body: "Parents' text and WhatsApp replies land in one shared inbox. Answer from Kesher; STOP and opt-outs are handled automatically.",
  },
];
