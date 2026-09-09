import { redirect } from "next/navigation";
import { PONS_LAUNCH_URL } from "@/lib/chain";

export default function LaunchPage() {
  redirect(PONS_LAUNCH_URL);
}
