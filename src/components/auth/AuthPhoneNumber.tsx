
import {
  memo, useEffect, useState,
} from '../../lib/teact/teact';

import { navigateBack } from './helpers/backNavigation';

import useMultiaccountInfo from '../../hooks/useMultiaccountInfo';

import Button from '../ui/Button';
import Loading from '../ui/Loading';

import {
  authenticate,
  checkPhoneNumber,
  normalizePhone,
} from '../../neogram/api';

import type {
  NeoGramAuthResponse,
} from '../../neogram/api';

type AuthStep = 'phone' | 'pin';
type NumberSeries = '888' | '777' | '666';

type WalletNumber = {
  phone?: string;
  number?: string;
  series?: string;
};

const PIN_LENGTH = 4;
const WALLET_NUMBERS_KEY = 'neogram.wallet.issued_numbers.v1';

const SERIES = [
  {
    id: '888' as const,
    title: '💎 +888',
    description: 'Коллекционные номера',
    detail: 'Свободный номер от 0001 до 88888888',
  },
  {
    id: '777' as const,
    title: '👑 +777',
    description: 'Креаторские',
    detail: 'Только точные номера, выпущенные Создателем',
  },
  {
    id: '666' as const,
    title: '🩸 +666',
    description: 'Доверенные лица',
    detail: 'Только точные номера, выпущенные Создателем',
  },
];

const DEFAULT_SERIES: NumberSeries = '888';

function getErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';

  switch (code) {
    case 'NEOGRAM_SERVER_UNAVAILABLE':
      return 'Не удалось подключиться к серверу. Проверьте интернет.';
    case 'INVALID_PHONE':
    case 'PHONE_NUMBER_INVALID':
      return 'Проверьте номер. Для +888 требуется от 4 до 8 цифр после кода.';
    case 'PHONE_NOT_AVAILABLE':
    case 'PHONE_ALREADY_TAKEN':
      return 'Этот номер уже занят.';
    case 'PHONE_NOT_ISSUED':
    case 'NUMBER_NOT_ISSUED':
    case 'PHONE_SERIES_NOT_AVAILABLE':
      return 'Этот номер не был выпущен Создателем.';
    case 'INVALID_PIN':
      return 'PIN должен состоять ровно из четырёх цифр.';
    case 'INVALID_CREDENTIALS':
    case 'INVALID_PIN_CODE':
    case 'WRONG_PIN':
      return 'Неверный PIN. Проверьте код и попробуйте снова.';
    case 'RATE_LIMITED':
      return 'Слишком много попыток. Немного подождите.';
    case 'SESSION_STORAGE_FAILED':
      return 'Не удалось сохранить сессию на устройстве.';
    default:
      return code
        ? `Не удалось выполнить вход: ${code}`
        : 'Произошла ошибка. Попробуйте ещё раз.';
  }
}

function getWalletNumbers(series: NumberSeries): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(WALLET_NUMBERS_KEY);

    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: string | WalletNumber) => {
        if (typeof item === 'string') return normalizePhone(item);

        if (item && typeof item === 'object') {
          return normalizePhone(item.phone || item.number || '');
        }

        return '';
      })
      .filter((phone: string) => {
        return phone.startsWith(`+${series}`)
          && isValidIssuedNumber(phone, series);
      });
  } catch {
    return [];
  }
}

function isValidCollectionNumber(phone: string): boolean {
  if (!/^\+888\d{4,8}$/.test(phone)) return false;

  const suffix = Number(phone.slice(4));

  return suffix >= 1 && suffix <= 88888888;
}

function isValidIssuedNumber(
  phone: string,
  series: '777' | '666',
): boolean {
  return new RegExp(`^\\+${series}\\d{1,12}$`).test(phone);
}

function getPhonePlaceholder(series: NumberSeries): string {
  switch (series) {
    case '888':
      return '+888 0001';
    case '777':
      return '+777 ';
    case '666':
      return '+666 ';
    default:
      return '+888 0001';
  }
}

function getPhoneForServer(
  value: string,
  series: NumberSeries,
): string {
  const normalized = normalizePhone(value);

  if (series === '888' && !normalized.startsWith('+888')) {
    return `+888${normalized.replace(/^\+?888?/, '')}`;
  }

  return normalized;
}

const AuthPhoneNumber = () => {
  const accountsInfo = useMultiaccountInfo();
  const hasActiveAccount = Object.values(accountsInfo).length > 0;

  const [series, setSeries] = useState<NumberSeries>(DEFAULT_SERIES);
  const [phone, setPhone] = useState('+888 ');
  const [step, setStep] = useState<AuthStep>('phone');
  const [pin, setPin] = useState('');

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [phoneCheckMessage, setPhoneCheckMessage] = useState('');
  const [walletNumbers, setWalletNumbers] = useState<string[]>([]);

  const normalizedPhone = getPhoneForServer(phone, series);

  const isPhoneValid = series === '888'
    ? isValidCollectionNumber(normalizedPhone)
    : isValidIssuedNumber(normalizedPhone, series);

  const canContinue = isPhoneValid
    && !isCheckingPhone
    && !isSubmitting;

  useEffect(() => {
    setWalletNumbers(getWalletNumbers(series));
  }, [series]);

  function handleSeriesSelect(nextSeries: NumberSeries) {
    setSeries(nextSeries);
    setError('');
    setPhoneCheckMessage('');

    const savedNumbers = getWalletNumbers(nextSeries);

    if (nextSeries === '888') {
      setPhone('+888 ');
    } else if (savedNumbers.length > 0) {
      setPhone(savedNumbers[0]);
    } else {
      setPhone(`+${nextSeries} `);
    }

    setIsDrawerOpen(false);
  }

  function handlePhoneChange(value: string) {
    const digits = value.replace(/\D/g, '');

    if (series === '888') {
      const suffix = digits.startsWith('888')
        ? digits.slice(3)
        : digits;

      setPhone(`+888 ${suffix.slice(0, 8)}`);
    } else {
      const prefix = series;
      const suffix = digits.startsWith(prefix)
        ? digits.slice(prefix.length)
        : digits;

      setPhone(`+${prefix} ${suffix.slice(0, 12)}`);
    }

    setError('');
    setPhoneCheckMessage('');
  }

  function handleWalletNumberSelect(number: string) {
    setPhone(number);
    setError('');
    setIsDrawerOpen(false);
  }

  async function handleContinue() {
    if (!canContinue) return;

    setIsCheckingPhone(true);
    setError('');
    setPhoneCheckMessage('');

    try {
      const result = await checkPhoneNumber(normalizedPhone);

      if (result.exists) {
        setPhoneCheckMessage('Аккаунт найден. Введите PIN для входа.');
      } else if (series === '888' && result.can_register) {
        setPhoneCheckMessage('Номер свободен. Придумайте PIN для аккаунта.');
      } else if (result.reserved || result.can_register) {
        setPhoneCheckMessage('Номер подтверждён сервером. Введите PIN.');
      } else {
        throw new Error('PHONE_NOT_ISSUED');
      }

      setPin('');
      setStep('pin');
    } catch (checkError) {
      setError(getErrorMessage(checkError));
    } finally {
      setIsCheckingPhone(false);
    }
  }

  function handlePinChange(value: string) {
    setPin(value.replace(/\D/g, '').slice(0, PIN_LENGTH));
    setError('');
  }

  function handleBackToPhone() {
    setStep('phone');
    setPin('');
    setError('');
    setPhoneCheckMessage('');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || pin.length !== PIN_LENGTH) return;

    setIsSubmitting(true);
    setError('');

    try {
      const result: NeoGramAuthResponse = await authenticate(
        normalizedPhone,
        pin,
      );

      window.dispatchEvent(
        new CustomEvent('neogram:authenticated', {
          detail: result,
        }),
      );
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackNavigation() {
    navigateBack();
  }

  function handleDrawerBackdrop(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      setIsDrawerOpen(false);
    }
  }

  return (
    <div
      id="auth-phone-number-form"
      className="custom-scroll"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100%',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <style>
        {`
          .ng-auth-series-button,
          .ng-auth-series-option,
          .ng-auth-wallet-option,
          .ng-auth-primary {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
          }

          .ng-auth-series-button:active,
          .ng-auth-series-option:active,
          .ng-auth-wallet-option:active,
          .ng-auth-primary:active {
            transform: scale(0.97);
          }

          .ng-auth-series-button,
          .ng-auth-series-option,
          .ng-auth-wallet-option,
          .ng-auth-primary {
            transition:
              transform 180ms cubic-bezier(.2,.8,.2,1),
              background-color 180ms ease,
              border-color 180ms ease;
          }

          .ng-auth-sheet-backdrop {
            animation: ng-auth-fade-in 180ms ease-out both;
          }

          .ng-auth-sheet {
            animation: ng-auth-sheet-in 300ms cubic-bezier(.2,.85,.25,1) both;
          }

          .ng-auth-pin-dot {
            transition:
              background-color 160ms ease,
              border-color 160ms ease,
              transform 160ms ease;
          }

          @keyframes ng-auth-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes ng-auth-sheet-in {
            from { transform: translate3d(0, 32px, 0); opacity: .8; }
            to { transform: translate3d(0, 0, 0); opacity: 1; }
          }

          @media (prefers-reduced-motion: reduce) {
            .ng-auth-sheet,
            .ng-auth-sheet-backdrop,
            .ng-auth-pin-dot {
              animation: none !important;
              transition: none !important;
            }
          }

          #neogram-phone-input,
          #neogram-sign-in-pin {
            font-size: 16px !important;
          }
        `}
      </style>

      {hasActiveAccount && (
        <Button
          size="smaller"
          round
          color="translucent"
          className="auth-close"
          iconName="close"
          onClick={handleBackNavigation}
        />
      )}

      <div className="auth-form">
        <div id="logo" />

        {step === 'phone' ? (
          <>
            <p className="note">
              Войдите по номеру или создайте аккаунт NeoGram.
            </p>

            <div className="form">
              <button
                type="button"
                className="ng-auth-series-button"
                onClick={() => setIsDrawerOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  minHeight: 50,
                  padding: '0 16px',
                  marginBottom: 18,
                  border: '1px solid var(--color-borders)',
                  borderRadius: 13,
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text)',
                  fontSize: 15,
                  fontWeight: 650,
                  cursor: 'pointer',
                }}
              >
                <span>💎 Коллекционные номера</span>
                <span style={{ opacity: 0.55, fontSize: 20 }}>›</span>
              </button>

              <div className="input-group">
                <label
                  htmlFor="neogram-phone-input"
                  style={{
                    display: 'block',
                    marginBottom: 9,
                    color: 'var(--color-text-secondary)',
                    fontSize: 14,
                  }}
                >
                  Номер NeoGram
                </label>

                <input
                  id="neogram-phone-input"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder={getPhonePlaceholder(series)}
                  value={phone}
                  onChange={(event) => handlePhoneChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleContinue();
                    }
                  }}
                  disabled={isCheckingPhone || isSubmitting}
                  style={{
                    display: 'block',
                    width: '100%',
                    minHeight: 52,
                    boxSizing: 'border-box',
                    padding: '12px 15px',
                    border: '1px solid var(--color-borders)',
                    borderRadius: 12,
                    outline: 'none',
                    background: 'var(--color-background)',
                    color: 'var(--color-text)',
                    fontSize: 17,
                    fontFamily: 'inherit',
                    letterSpacing: '.4px',
                  }}
                />

                <p
                  style={{
                    margin: '8px 2px 0',
                    color: 'var(--color-text-secondary)',
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  {series === '888'
                    ? 'Введите от 4 до 8 цифр после +888. Доступность проверит сервер.'
                    : 'Введите только точный номер, выпущенный Создателем, или выберите его из кошелька.'}
                </p>
              </div>

              {walletNumbers.length > 0 && series !== '888' && (
                <button
                  type="button"
                  className="ng-auth-wallet-option"
                  onClick={() => handleWalletNumberSelect(walletNumbers[0])}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    minHeight: 46,
                    marginTop: 12,
                    padding: '0 13px',
                    border: '1px solid var(--color-primary)',
                    borderRadius: 11,
                    background: 'var(--color-background-secondary)',
                    color: 'var(--color-text)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span>💼 Номер из кошелька</span>
                  <span>{walletNumbers[0]}</span>
                </button>
              )}

              {error && <p className="note error">{error}</p>}

              <Button
                className="auth-button ng-auth-primary"
                block
                ripple={false}
                disabled={!canContinue}
                isLoading={isCheckingPhone}
                onClick={() => void handleContinue()}
              >
                ПРОДОЛЖИТЬ
              </Button>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <h1 style={{ margin: 0 }}>{normalizedPhone}</h1>

              <button
                type="button"
                onClick={handleBackToPhone}
                aria-label="Изменить номер"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 38,
                  height: 38,
                  border: 0,
                  borderRadius: 10,
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text)',
                  fontSize: 19,
                  cursor: 'pointer',
                }}
              >
                ✎
              </button>
            </div>

            <p className="note">
              {phoneCheckMessage || 'Введите четырёхзначный PIN-код.'}
            </p>

            <form
              className="form"
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <label
                htmlFor="neogram-sign-in-pin"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  color: 'var(--color-text-secondary)',
                  fontSize: 14,
                }}
              >
                PIN-код
              </label>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 15,
                  margin: '4px 0 8px',
                }}
                aria-hidden="true"
              >
                {Array.from({ length: PIN_LENGTH }, (_, index) => (
                  <div
                    key={index}
                    className="ng-auth-pin-dot"
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: '50%',
                      border: '2px solid var(--color-primary)',
                      background: pin.length > index
                        ? 'var(--color-primary)'
                        : 'transparent',
                      transform: pin.length > index ? 'scale(1.08)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>

              <input
                id="neogram-sign-in-pin"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={PIN_LENGTH}
                value={pin}
                onChange={(event) => handlePinChange(event.target.value)}
                placeholder="Введите 4 цифры"
                autoFocus
                style={{
                  display: 'block',
                  width: '100%',
                  minHeight: 52,
                  boxSizing: 'border-box',
                  padding: '12px 14px',
                  border: '1px solid var(--color-borders)',
                  borderRadius: 12,
                  outline: 'none',
                  background: 'var(--color-background)',
                  color: 'var(--color-text)',
                  fontSize: 18,
                  textAlign: 'center',
                  letterSpacing: 8,
                }}
              />

              {error && <p className="note error">{error}</p>}

              <Button
                className="auth-button ng-auth-primary"
                block
                type="submit"
                ripple={false}
                disabled={pin.length !== PIN_LENGTH || isSubmitting}
                isLoading={isSubmitting}
              >
                ПРОДОЛЖИТЬ
              </Button>

              <Button
                className="auth-button"
                block
                isText
                ripple={false}
                onClick={handleBackToPhone}
              >
                Изменить номер
              </Button>
            </form>
          </>
        )}
      </div>

      {isDrawerOpen && (
        <div
          className="ng-auth-sheet-backdrop"
          onClick={handleDrawerBackdrop}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            background: 'rgba(0,0,0,.46)',
            paddingTop: 'env(safe-area-inset-top)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ng-auth-series-title"
            className="ng-auth-sheet"
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '85%',
              overflowY: 'auto',
              boxSizing: 'border-box',
              padding: '12px 20px calc(24px + env(safe-area-inset-bottom))',
              borderRadius: '22px 22px 0 0',
              background: 'var(--color-background)',
              color: 'var(--color-text)',
              boxShadow: '0 -8px 40px rgba(0,0,0,.2)',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div
              style={{
                width: 38,
                height: 5,
                borderRadius: 5,
                background: 'var(--color-borders)',
                margin: '0 auto 18px',
                opacity: 0.7,
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <h2
                id="ng-auth-series-title"
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 750,
                }}
              >
                Выберите серию
              </h2>

              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  width: 36,
                  height: 36,
                  border: 0,
                  borderRadius: '50%',
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text)',
                  fontSize: 21,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <p className="note">
              У каждой серии свои правила выпуска и проверки номера.
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginTop: 18,
              }}
            >
              {SERIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="ng-auth-series-option"
                  onClick={() => handleSeriesSelect(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    width: '100%',
                    minHeight: 72,
                    padding: '12px 15px',
                    border: series === item.id
                      ? '2px solid var(--color-primary)'
                      : '1px solid var(--color-borders)',
                    borderRadius: 14,
                    background: series === item.id
                      ? 'var(--color-background-secondary)'
                      : 'var(--color-background)',
                    color: 'var(--color-text)',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>
                      {item.title} • {item.description}
                    </span>
                    <span
                      style={{
                        color: 'var(--color-text-secondary)',
                        fontSize: 12,
                        lineHeight: 1.4,
                      }}
                    >
                      {item.detail}
                    </span>
                  </span>

                  <span
                    style={{
                      flexShrink: 0,
                      color: series === item.id
                        ? 'var(--color-primary)'
                        : 'var(--color-text-secondary)',
                      fontSize: 20,
                    }}
                  >
                    {series === item.id ? '✓' : '›'}
                  </span>
                </button>
              ))}
            </div>

            {walletNumbers.length > 0 && series !== '888' && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>
                  💼 Ваши номера из кошелька
                </h3>

                {walletNumbers.map((number) => (
                  <button
                    key={number}
                    type="button"
                    className="ng-auth-wallet-option"
                    onClick={() => handleWalletNumberSelect(number)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      minHeight: 48,
                      marginBottom: 8,
                      padding: '0 13px',
                      border: '1px solid var(--color-borders)',
                      borderRadius: 11,
                      background: 'var(--color-background-secondary)',
                      color: 'var(--color-text)',
                      fontSize: 15,
                      fontWeight: 650,
                      cursor: 'pointer',
                    }}
                  >
                    <span>{number}</span>
                    <span style={{ color: 'var(--color-primary)' }}>Выбрать</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default memo(AuthPhoneNumber);
