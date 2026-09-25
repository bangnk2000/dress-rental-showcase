import { Ruler, Shirt, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';

const perks = [
  { key: 'laundry', icon: Shirt },
  { key: 'fitting', icon: Ruler },
  { key: 'delivery', icon: Truck },
] as const;

/** mobile: icon-top card · md: icon-left · xl: un-carded band with rules. */
export function HomePerks() {
  const t = useTranslations('home.perks');
  return (
    <section
      aria-label={t('label')}
      className="mx-auto mt-space-lg max-w-page px-margin-mobile md:mt-space-xl md:px-space-lg xl:px-margin"
    >
      <ul className="grid grid-cols-3 gap-2 rounded-md bg-surface-container-low p-4 md:gap-gutter md:p-space-lg xl:gap-0 xl:divide-x xl:divide-outline-variant/50 xl:border-y xl:border-outline-variant/50 xl:bg-transparent xl:px-0">
        {perks.map(({ key, icon: Icon }) => (
          <li
            key={key}
            className="flex flex-col items-center p-2 text-center md:flex-row md:items-start md:gap-3 md:text-left xl:px-space-lg"
          >
            <Icon className="mb-1 h-6 w-6 shrink-0 text-primary md:mb-0" aria-hidden />
            <div>
              <p className="text-label-sm font-semibold tracking-normal text-on-surface md:text-label-lg md:tracking-wide">
                {t(`${key}.title`)}
              </p>
              <p className="text-label-sm tracking-normal text-on-surface-variant md:text-body-sm">{t(`${key}.detail`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
