import { Nav } from './_components/landing/Nav';
import { HeroKinetic } from './_components/landing/HeroKinetic';
import { Manifesto } from './_components/landing/Manifesto';
import { LiveBuild } from './_components/landing/LiveBuild';
import { StackPillars } from './_components/landing/StackPillars';
import { ToolkitMarquee } from './_components/landing/ToolkitMarquee';
import { Setup } from './_components/landing/Setup';
import { Outro } from './_components/landing/Outro';
import { Footer } from './_components/landing/Footer';

export default function Home() {
  return (
    <div className="min-h-dvh bg-[#0b0b0d] text-[#f5f3ed] font-sans">
      <Nav />
      <HeroKinetic />
      <Manifesto />
      <LiveBuild />
      <StackPillars />
      <ToolkitMarquee />
      <Setup />
      <Outro />
      <Footer />
    </div>
  );
}
