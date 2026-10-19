import { createFileRoute } from '@tanstack/react-router';

import { dayIncidentsQueryOptions } from '@/api/incidents';
import { queryClient } from '@/api/queryClient';
import { IncidentsList } from '@/components/incidents/incidents-list';

export const Route = createFileRoute('/reports/incidents')({
  staticData: { legalDisclaimer: true },
  loader: () => {
    void queryClient.prefetchQuery(dayIncidentsQueryOptions());
  },
  component: IncidentsList,
});
