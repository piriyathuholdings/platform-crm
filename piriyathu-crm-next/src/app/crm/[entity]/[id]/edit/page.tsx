import { redirect } from "next/navigation";

export default function EntityEditCompatibilityPage({ params }: { params: { entity: string; id: string } }) {
  redirect(`/crm/${params.entity}/${params.id}?edit=1`);
}
