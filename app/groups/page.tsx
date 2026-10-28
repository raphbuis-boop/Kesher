import { redirect } from "next/navigation";

/** The old Custom Audiences page — everything lives on /audiences now (static and smart). */
export default function GroupsPage() {
  redirect("/audiences");
}
