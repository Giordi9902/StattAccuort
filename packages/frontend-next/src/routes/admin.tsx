import { createFileRoute } from '@tanstack/react-router';

import { AdminPage } from '@/components/admin/admin-dashboard';

// Not linked from the app: operators open /admin directly. Code-split, so riders never download it.
export const Route = createFileRoute('/admin')({
  staticData: { legalDisclaimer: false },
  component: AdminPage,
});
