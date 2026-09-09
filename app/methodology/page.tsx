import { redirect } from "next/navigation";
import { routes } from "@/routes";

export default function MethodologyRedirect() {
  redirect(routes.docs);
}
