import { redirect } from "next/navigation";

export default function NewsroomHome() {
  redirect("/admin/articles");
}
