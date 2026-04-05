import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAccessToken, ACCESS_TOKEN_COOKIE } from "@/server/core/auth";
import MemberProfilePage from "@/components/features/member/MemberProfilePage";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    redirect("/login");
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    redirect("/login");
  }

  return <MemberProfilePage userId={payload.sub} />;
}
