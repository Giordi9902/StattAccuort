import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, LogOut } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ADMIN_WINDOWS,
  AdminAuthError,
  adminOverviewQueryOptions,
  readAdminToken,
  writeAdminToken,
  type AdminOverview,
  type AdminWindow,
} from '@/api/admin';
import { PageHeader } from '@/components/templates/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionHeading } from '@/components/ui/section-heading';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { currentCity } from '@/lib/city';
import { cn } from '@/lib/utils';

import {
  formatBytes,
  formatCount,
  formatDate,
  formatDuration,
  formatRelative,
} from './admin-format';
import { NAMESPACE as INCIDENTS_NAMESPACE } from '@/components/incidents/incidents.i18n';

import { NAMESPACE } from './admin.i18n';
import { RankedBars } from './ranked-bars';
import { ReportsColumnChart } from './reports-column-chart';

const TIMETABLE_WARNING_DAYS = 14;
const DAY_MS = 86_400_000;

export function AdminPage() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token, setToken] = useState(readAdminToken);
  const [rejected, setRejected] = useState<AdminAuthError | null>(null);

  const signIn = (value: string) => {
    writeAdminToken(value);
    setRejected(null);
    setToken(value);
  };

  const signOut = (reason: AdminAuthError | null = null) => {
    writeAdminToken(null);
    queryClient.removeQueries({ queryKey: ['admin'] });
    setRejected(reason);
    setToken(null);
  };

  return (
    <div className="bg-card animate-in fade-in fixed inset-0 z-40 overflow-y-auto duration-150">
      <div className="mx-auto flex w-full max-w-5xl flex-col pb-10">
        <PageHeader
          title={t('title')}
          onBack={() => navigate({ to: '/' })}
          action={
            token !== null && (
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                <LogOut /> {t('signOut')}
              </Button>
            )
          }
        />
        {token === null ? (
          <SignIn onSubmit={signIn} rejected={rejected} />
        ) : (
          <Dashboard token={token} onRejected={signOut} />
        )}
      </div>
    </div>
  );
}

function SignIn({
  onSubmit,
  rejected,
}: {
  onSubmit: (token: string) => void;
  rejected: AdminAuthError | null;
}) {
  const { t } = useTranslation(NAMESPACE);
  const [value, setValue] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim() !== '') onSubmit(value.trim());
  };

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-sm flex-col gap-3 px-4 pt-8">
      <h2 className="font-heading text-xl font-semibold">{t('signInTitle')}</h2>
      <p className="text-muted-foreground text-sm">{t('signInBody')}</p>
      <label className="flex flex-col gap-1 text-sm">
        {t('tokenLabel')}
        <Input
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={rejected !== null}
        />
      </label>
      {rejected !== null && (
        <p className="text-destructive flex items-center gap-1.5 text-sm" role="alert">
          <AlertTriangle className="size-4" />
          {rejected.status === 503 ? t('notConfigured') : t('wrongToken')}
        </p>
      )}
      <Button type="submit" className="bg-accent-bright hover:bg-accent-press">
        {t('signIn')}
      </Button>
    </form>
  );
}

function Dashboard({
  token,
  onRejected,
}: {
  token: string;
  onRejected: (error: AdminAuthError) => void;
}) {
  const { t, i18n } = useTranslation(NAMESPACE);
  const [window, setWindow] = useState<AdminWindow>('24h');
  const { data, error, dataUpdatedAt } = useQuery(adminOverviewQueryOptions(token, window));
  const lang = i18n.language;

  // A rejected token goes back to the sign-in form, which explains why.
  useEffect(() => {
    if (error instanceof AdminAuthError) onRejected(error);
  }, [error, onRejected]);

  return (
    <div className="flex flex-col gap-6 px-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={window}
          onValueChange={(value) => value !== '' && setWindow(value as AdminWindow)}
          aria-label={t('windowLabel')}
        >
          {ADMIN_WINDOWS.map((name) => (
            <ToggleGroupItem
              key={name}
              value={name}
              className="data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              {t(`window_${name}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {dataUpdatedAt > 0 && (
          <span className="text-muted-foreground text-xs" aria-live="polite">
            {t('updated', {
              time: new Intl.DateTimeFormat(lang, { timeStyle: 'medium' }).format(dataUpdatedAt),
            })}
          </span>
        )}
      </div>

      {error !== null && data === undefined && (
        <p className="text-muted-foreground text-sm">{t('loadFailed')}</p>
      )}

      {data !== undefined && <Overview data={data} />}
    </div>
  );
}

function Overview({ data }: { data: AdminOverview }) {
  const { t, i18n } = useTranslation(NAMESPACE);
  const { t: tIncidents } = useTranslation(INCIDENTS_NAMESPACE);
  const lang = i18n.language;
  const now = Date.parse(data.generatedAt);
  const { reports } = data;

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t('reports')} value={formatCount(reports.total, lang)} hero>
          <Delta current={reports.total} previous={reports.previousTotal} />
        </StatTile>
        <StatTile label={t('devices')} value={formatCount(reports.devices, lang)}>
          {t('devicesHint')}
        </StatTile>
        <StatTile
          label={t('lastReport')}
          value={
            reports.lastReportAt === null
              ? t('never')
              : formatRelative(reports.lastReportAt, now, lang)
          }
        />
        <StatTile label={t('rateLimited')} value={formatCount(data.instance.rateLimited, lang)}>
          {t('rateLimitedHint')}
        </StatTile>
      </section>

      <Panel title={t('reportsOverTime')}>
        <ReportsColumnChart
          series={reports.series}
          bucketMinutes={data.window.bucketMinutes}
          timeZone={currentCity.timezone}
        />
      </Panel>

      <div className="grid gap-6 md:grid-cols-3">
        <Panel title={t('topStations')}>
          <RankedBars items={reports.topStations} emptyLabel={t('empty')} />
        </Panel>
        <Panel title={t('topLines')}>
          <RankedBars items={reports.topLines} emptyLabel={t('empty')} />
        </Panel>
        <Panel title={t('sources')}>
          <RankedBars
            items={reports.bySource.map(({ source, count }) => ({
              id: source,
              name: source,
              count,
            }))}
            emptyLabel={t('empty')}
          />
        </Panel>
      </div>

      <Panel title={t('incidents')}>
        <RankedBars
          items={data.incidents.map(({ kind, count }) => ({
            id: kind,
            name: tIncidents(`kind_${kind}`),
            count,
          }))}
          emptyLabel={t('noIncidents')}
        />
      </Panel>

      <Panel title={t('topDevices')}>
        {reports.topDevices.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left text-xs">
              <tr>
                <th className="py-1 font-normal">{t('deviceColumn')}</th>
                <th className="py-1 text-right font-normal">{t('reportsColumn')}</th>
                <th className="py-1 text-right font-normal">{t('stationsColumn')}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {reports.topDevices.map((device) => (
                <tr key={device.device} className="border-border-soft border-t">
                  <td className="py-1.5 font-mono text-xs">{device.device}</td>
                  <td className="py-1.5 text-right">{formatCount(device.count, lang)}</td>
                  <td className="py-1.5 text-right">{formatCount(device.stations, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="grid gap-6 md:grid-cols-3">
        <Panel title={t('data')}>
          <Facts>
            <Fact label={t('stations')} value={formatCount(data.data.stations, lang)} />
            <Fact label={t('lines')} value={formatCount(data.data.lines, lang)} />
            <Fact label={t('segments')} value={formatCount(data.data.segments, lang)} />
            <Fact label={t('eavBoards')} value={formatCount(data.data.eavBoards, lang)} />
            <Fact
              label={t('timetable')}
              value={<TimetableStatus lastDate={data.data.timetableLastDate} now={now} />}
            />
          </Facts>
        </Panel>
        <Panel title={t('database')}>
          <Facts>
            <Fact label="PostgreSQL" value={data.database.version} />
            <Fact label={t('dbSize')} value={formatBytes(data.database.sizeBytes, lang)} />
            <Fact
              label={t('dbConnections')}
              value={`${data.database.connections} / ${data.database.maxConnections}`}
            />
          </Facts>
          <Meter value={data.database.connections} max={data.database.maxConnections} />
        </Panel>
        <Panel title={t('instance')}>
          <Facts>
            <Fact
              label="ID"
              value={<span className="font-mono text-xs">{data.instance.instanceId}</span>}
            />
            <Fact label="Node" value={data.instance.nodeVersion} />
            <Fact label={t('uptime')} value={formatDuration(data.instance.uptimeSeconds, lang)} />
            <Fact label={t('memory')} value={formatBytes(data.instance.rssBytes, lang)} />
            <Fact label={t('requests')} value={formatCount(data.instance.requests, lang)} />
            <Fact label={t('serverErrors')} value={formatCount(data.instance.serverErrors, lang)} />
          </Facts>
          <p className="text-muted-foreground text-xs">{t('instanceHint')}</p>
        </Panel>
      </div>
    </>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  );
}

function StatTile({
  label,
  value,
  hero = false,
  children,
}: {
  label: string;
  value: string;
  hero?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="bg-muted flex flex-col gap-1 rounded-lg p-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn('font-heading font-semibold', hero ? 'text-4xl' : 'text-2xl')}>
        {value}
      </span>
      {children !== undefined && <span className="text-muted-foreground text-xs">{children}</span>}
    </div>
  );
}

// More reports is neither good nor bad, so the change stays in neutral ink with a direction arrow.
function Delta({ current, previous }: { current: number; previous: number }) {
  const { t, i18n } = useTranslation(NAMESPACE);
  if (previous === 0) return <>{t('vsPrevious')}: —</>;
  const change = (current - previous) / previous;
  const Arrow = change >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1">
      <Arrow className="size-3.5" aria-hidden />
      {new Intl.NumberFormat(i18n.language, {
        style: 'percent',
        signDisplay: 'exceptZero',
        maximumFractionDigits: 0,
      }).format(change)}{' '}
      {t('vsPrevious')}
    </span>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col gap-1.5 text-sm">{children}</dl>;
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

// Connection pool headroom: the track is a lighter step of the fill, which turns warning near the cap.
function Meter({ value, max }: { value: number; max: number }) {
  const share = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div
      className="bg-muted-foreground/20 h-1.5 overflow-hidden rounded-full"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div
        className={cn('h-full rounded-full', share >= 0.8 ? 'bg-warn' : 'bg-ok')}
        style={{ width: `${share * 100}%` }}
      />
    </div>
  );
}

function TimetableStatus({ lastDate, now }: { lastDate: string | null; now: number }) {
  const { t, i18n } = useTranslation(NAMESPACE);
  if (lastDate === null) {
    return (
      <span className="text-warn inline-flex items-center gap-1">
        <AlertTriangle className="size-3.5" aria-hidden /> {t('timetableMissing')}
      </span>
    );
  }
  const daysLeft = (Date.parse(`${lastDate}T23:59:59`) - now) / DAY_MS;
  const label = formatDate(lastDate, i18n.language);
  if (daysLeft < 0 || daysLeft < TIMETABLE_WARNING_DAYS) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1',
          daysLeft < 0 ? 'text-destructive' : 'text-warn',
        )}
      >
        <AlertTriangle className="size-3.5" aria-hidden />
        {label} · {daysLeft < 0 ? t('timetableExpired') : t('timetableExpiring')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <CheckCircle2 className="text-ok size-3.5" aria-hidden />
      {label}
    </span>
  );
}
