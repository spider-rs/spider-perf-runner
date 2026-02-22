import Runner from "./runner";
import { Toaster } from "@/components/ui/toaster";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <Runner />
      <Toaster />
    </main>
  );
}
