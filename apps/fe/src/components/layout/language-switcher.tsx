import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LANGUAGES = ['vi', 'en'] as const;

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = LANGUAGES.find((lng) => i18n.resolvedLanguage === lng) ?? 'vi';

  return (
    <Select value={current} onValueChange={(lng) => void i18n.changeLanguage(lng)}>
      <SelectTrigger size="sm" aria-label={t('language.label')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((lng) => (
          <SelectItem key={lng} value={lng}>
            {t(`language.${lng}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
