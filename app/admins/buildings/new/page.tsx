import { requireAdmin } from "@/lib/auth/dal";
import { BackLink } from "@/components/back-link";
import { BuildingForm } from "@/components/buildings/building-form";

export const dynamic = "force-dynamic";

export default async function NewBuildingPage() {
  await requireAdmin();

  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Add building</h1>
          <BackLink href="/admins/buildings">← Back to buildings</BackLink>
        </div>

        <BuildingForm />
      </main>
    </div>
  );
}
