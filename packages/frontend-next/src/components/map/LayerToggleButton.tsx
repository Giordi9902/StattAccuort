import { Layers, ListFilter } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { RISK_COLORS, RISK_FACTORS } from '@/api/risk';
import { LINE_TYPE_PRIORITY, type LineType, useLines } from '@/api/transit';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLineTypeFilter } from '@/hooks/useLineTypeFilter';
import { useRiskFactors } from '@/hooks/useRiskFactors';
import { useRiskLayer } from '@/hooks/useRiskLayer';
import { currentCity } from '@/lib/city';
import { selectionTap } from '@/lib/haptics';

import { NAMESPACE } from './LayerToggleButton.i18n';

const RISK_SCALE = [RISK_COLORS.clear, RISK_COLORS.moderate, RISK_COLORS.high, RISK_COLORS.severe];

const BUTTON_CLASS =
  'bg-card text-foreground hover:bg-card/80 pointer-events-auto h-11 w-[4.5rem] flex-col gap-0.5 rounded-lg px-3 shadow-[0_6px_16px_rgba(0,0,0,0.28)]';

/**
 * Lets the viewer pick which line types the map draws and, in the risk view, which factors the
 * risk colour combines. Hidden when there is nothing to choose.
 */
function LineTypeFilterButton({ riskVisible }: { riskVisible: boolean }) {
  const { t } = useTranslation(NAMESPACE);
  const { data: lines } = useLines();
  const { hiddenTypes, toggle } = useLineTypeFilter();
  const { hiddenFactors, toggle: toggleFactor } = useRiskFactors();

  const types = [...new Set(lines?.map((line) => line.type))].sort(
    (a, b) => LINE_TYPE_PRIORITY[a] - LINE_TYPE_PRIORITY[b],
  );
  const showTypes = types.length >= 2;
  if (!showTypes && !riskVisible) return null;
  const filtering =
    types.some((type) => hiddenTypes.has(type)) || (riskVisible && hiddenFactors.size > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          aria-label={t('filterLines')}
          className={`${BUTTON_CLASS} relative`}
        >
          <ListFilter className="size-5" />
          <span className="text-[11px] leading-none font-semibold">{t('filter')}</span>
          {filtering && (
            <span
              className="bg-primary absolute top-1.5 right-1.5 size-2 rounded-full"
              aria-hidden
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {riskVisible && (
          <>
            <DropdownMenuLabel>{t('riskFactors')}</DropdownMenuLabel>
            {RISK_FACTORS.map((factor) => (
              <DropdownMenuCheckboxItem
                key={factor}
                checked={!hiddenFactors.has(factor)}
                onCheckedChange={() => {
                  selectionTap();
                  toggleFactor(factor);
                }}
                onSelect={(event) => event.preventDefault()}
              >
                {t(`factor.${factor}`)}
              </DropdownMenuCheckboxItem>
            ))}
            {showTypes && <DropdownMenuSeparator />}
          </>
        )}
        {showTypes && <DropdownMenuLabel>{t('showOnMap')}</DropdownMenuLabel>}
        {(showTypes ? types : []).map((type: LineType) => (
          <DropdownMenuCheckboxItem
            key={type}
            checked={!hiddenTypes.has(type)}
            onCheckedChange={() => {
              selectionTap();
              toggle(type);
            }}
            // Keep the menu open so several types can be toggled in one go.
            onSelect={(event) => event.preventDefault()}
          >
            {currentCity.lineTypeLabels?.[type] ?? t(`type.${type}`)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LayerToggleButton() {
  const { t } = useTranslation(NAMESPACE);
  const { visible, toggle } = useRiskLayer();

  return (
    <div className="top-safe-14 pointer-events-none fixed right-0 z-20 flex flex-col items-end gap-1.5 p-3 sm:top-0">
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          selectionTap();
          toggle();
        }}
        aria-pressed={visible}
        aria-label={visible ? t('hideRiskLayer') : t('showRiskLayer')}
        // Both states stay full-strength: dimming the control in the lines state made the only way
        // back to risk read as unavailable (grey is the disabled convention). State is carried by
        // the label, the legend below, and aria-pressed instead. The fixed width keeps the two
        // labels from reflowing the row.
        className={BUTTON_CLASS}
      >
        <Layers className="size-5" />
        <span className="text-[11px] leading-none font-semibold">
          {visible ? t('risk') : t('lines')}
        </span>
      </Button>
      {/*
       * The risk shading had no key, so users couldn't tell what the colours meant (in-app
       * feedback: "the risk button is unclear", "Was bedeuten die Farben der Gleise?"). Only the
       * risk scale needs one — in the other state the button reads "Lines" and the segments carry
       * the network's own colours.
       */}
      {visible && (
        <div className="bg-card text-card-foreground pointer-events-none w-[4.5rem] rounded-lg p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.28)]">
          <div className="flex overflow-hidden rounded-full">
            {RISK_SCALE.map((color) => (
              <span key={color} className="h-1.5 flex-1" style={{ backgroundColor: color }} />
            ))}
          </div>
          <div className="text-muted-foreground mt-1 flex justify-between text-[9px] leading-none">
            <span>{t('riskLow')}</span>
            <span>{t('riskHigh')}</span>
          </div>
        </div>
      )}
      <LineTypeFilterButton riskVisible={visible} />
    </div>
  );
}
