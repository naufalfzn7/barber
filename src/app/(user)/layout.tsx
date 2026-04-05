import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { RouteRulesPanel } from "@/components/ui/RouteRulesPanel";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1">
        <RouteRulesPanel scope="user" />
        {children}
      </main>
      <Footer />
    </>
  );
}
