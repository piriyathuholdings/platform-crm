export type NexusScreenMapItem = {
  title: string;
  stitchScreen: string;
  route: string;
};

export const NEXUS_SCREEN_MAP: NexusScreenMapItem[] = [
  { title: "Login", stitchScreen: "1be6a1e6146641f8b9b4cd2924bc6e3c", route: "/login" },
  { title: "Dashboard", stitchScreen: "9f6f5829d63d4140a16b676aea7c626d", route: "/crm" },
  { title: "Notifications", stitchScreen: "4db37e401c5f4b86a7e338c879aeafbf", route: "/crm/notifications" },
  { title: "Search Results", stitchScreen: "b8556ddb0b5e4070bc566a94718f7b9c", route: "/crm/search" },
  { title: "Document Library", stitchScreen: "eb74e2535cec4f97b0728e96f63bd1de", route: "/crm/documents" },
  { title: "Leads List", stitchScreen: "64bc878cb3184bf7a68cf575b90380e3", route: "/crm/leads/view/list" },
  { title: "Lead Detail", stitchScreen: "de7ce6656db74196b8562d35363d94c4", route: "/crm/leads/[id]" },
  { title: "Create Lead", stitchScreen: "374d86355823458eb2f1095551d276a8", route: "/crm/leads/new" },
  { title: "Deals List", stitchScreen: "9005821067ef451ab502045eb5f8ef79", route: "/crm/deals/view/list" },
  { title: "Deal Detail", stitchScreen: "c6b7fc81c94a4a3882dde97da71a67fc", route: "/crm/deals/[id]" },
  { title: "Organization Detail", stitchScreen: "b86740bb24ac425d95d7e8c551451ed3", route: "/crm/organizations/[id]" },
  { title: "Tasks List", stitchScreen: "68afa262b2254bce9884e5b3d8ad80e2", route: "/crm/tasks/view/list" },
  { title: "Note Detail", stitchScreen: "5bc26ffbca0b43db963a728f19478f67", route: "/crm/notes/[id]" },
  { title: "Call Logs", stitchScreen: "9d0c964f5f3944ffa4743fa86ae2144b", route: "/crm/call-logs/view/list" },
  { title: "Expenses List", stitchScreen: "fbe80b17635c4b7f8f876e41ae495943", route: "/crm/expenses/view/list" },
  { title: "Client Payments List", stitchScreen: "9f394dd051b04219ade8853993603f1b", route: "/crm/client-payments/view/list" },
  { title: "Admin Products", stitchScreen: "912ce6797c8a4d78b30579411839bf68", route: "/crm/admin/products" },
  { title: "Admin Users", stitchScreen: "03cdacc149fc46e4a735b937ae528e39", route: "/crm/admin/users" },
  { title: "User Detail", stitchScreen: "ea7075c6d57a4de1a373eaf48e25d1ff", route: "/crm/admin/users/[id]" },
  { title: "Not Found", stitchScreen: "85f07b68f7bc4b9282d9809d687f338d", route: "/not-found" }
];
