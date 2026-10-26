import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { Hero } from "@/components/landing/Hero";
import { EngineFlow } from "@/components/landing/EngineFlow";
import { StudioFeatures } from "@/components/landing/StudioFeatures";
import { StudioCta } from "@/components/landing/StudioCta";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#05070B] text-slate-100 selection:bg-[#0099ff]/30 selection:text-white">
      <SiteHeader theme="dark" />
      <main>
        <Hero />
        <EngineFlow />
        <StudioFeatures />
        <StudioCta />
      </main>
      <SiteFooter theme="dark" />
    </div>
  );
}
