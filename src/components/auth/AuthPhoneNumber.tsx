import {
  memo, useState,
} from '../../lib/teact/teact';

import { navigateBack } from './helpers/backNavigation';

import useMultiaccountInfo from '../../hooks/useMultiaccountInfo';

import Button from '../ui/Button';
import Loading from '../ui/Loading';

import {
  authenticate,
  checkPhoneNumber,
  generatePhoneNumbers,
  normalizePhone,
} from '../../neogram/api';

import type {
  NeoGramAuthResponse,
  NeoGramPhoneNumber,
} from '../../neogram/api';

type AuthStep = 'phone' | 'pin';

const PIN_LENGTH = 4;
const DEFAULT_PHONE = '+888';

function getErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';

  switch (code) {
    case 'NEOGRAM_SERVER_UNAVAILABLE':
      return 'Не удалось подключиться к серверу. Проверьте интернет и попробуйте ещё раз.';
    case 'PHONE_LIST_UNAVAILABLE':
    case 'PHONE_GENERATION_FAILED':
      return 'Не удалось получить номера. Попробуйте ещё раз.';
    case 'INVALID_PHONE':
    case 'PHONE_NUMBER_INVALID':
      return 'Проверьте правильность введённого номера.';
    case 'INVALID_PIN':
      return 'PIN должен состоять из четырёх цифр.';
    case 'INVALID_CREDENTIALS':
    case 'INVALID_PIN_CODE':
    case 'WRONG_PIN':
      return 'Неверный PIN. Проверьте код и попробуйте снова.';
    case 'PHONE_NOT_RESERVED':
    case 'RESERVATION_EXPIRED':
      return 'Резерв номера истёк. Получите новый номер.';
    case 'RATE_LIMITED':
      return 'Слишком много попыток. Немного подождите.';
    default:
      return code
        ? `Не удалось выполнить вход: ${code}`
        : 'Произошла ошибка. Попробуйте ещё раз.';
  }
}

const AuthPhoneNumber = () => {
  const accountsInfo = useMultiaccountInfo();
  const hasActiveAccount = Object.values(accountsInfo).length > 0;

  const [phone, setPhone] = useState(DEFAULT_PHONE);
  const [numbers, setNumbers] = useState<NeoGramPhoneNumber[]>([]);
  const [step, setStep] = useState<AuthStep>('phone');
  const [pin, setPin] = useState('');

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [phoneCheckMessage, setPhoneCheckMessage] = useState('');

  const normalizedPhone = normalizePhone(phone);

  const canContinue = /^\+\d{7,15}$/.test(normalizedPhone)
    && !isCheckingPhone
    && !isSubmitting;

  async function openCollectionDrawer() {
    setIsDrawerOpen(true);
    setError('');

    if (numbers.length > 0) {
      return;
    }

    setIsLoadingNumbers(true);

    try {
      const result = await generatePhoneNumbers();

      const baseNumbers = result
        .filter((item) => normalizePhone(item.phone || item.raw).startsWith('+888'))
        .slice(0, 5);

      setNumbers(baseNumbers);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoadingNumbers(false);
    }
  }

  function handleSelectPhone(item: NeoGramPhoneNumber) {
    setPhone(normalizePhone(item.phone || item.raw));
    setIsDrawerOpen(false);
    setError('');
  }

  async function handleContinue() {
    if (!canContinue) {
      return;
    }

    setIsCheckingPhone(true);
    setError('');
    setPhoneCheckMessage('');

    try {
      if (normalizedPhone.startsWith('+888')) {
        const result = await checkPhoneNumber(normalizedPhone);

        if (result.exists) {
          setPhoneCheckMessage('Аккаунт найден. Введите PIN для входа.');
        } else if (result.can_register || result.reserved) {
          setPhoneCheckMessage('Номер готов к регистрации. Придумайте PIN для аккаунта.');
        } else {
          setPhoneCheckMessage('Введите PIN, чтобы продолжить.');
        }
      } else {
        setPhoneCheckMessage('Введите четырёхзначный PIN-код для продолжения.');
      }

      setPin('');
      setStep('pin');
    } catch (checkError) {
      setError(getErrorMessage(checkError));
    } finally {
      setIsCheckingPhone(false);
    }
  }

  function handlePinChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPin(event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH));
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

    if (isSubmitting || pin.length !== PIN_LENGTH || !normalizedPhone) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result: NeoGramAuthResponse = await authenticate(normalizedPhone, pin);

      window.dispatchEvent(new CustomEvent('neogram:authenticated', {
        detail: result,
      }));
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackNavigation() {
    navigateBack();
  }

  return (
    <div
      id="auth-phone-number-form"
      className="custom-scroll"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100%',
      }}
    >
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

        <h1>NeoGram</h1>

        {step === 'phone' ? (
          <>
            <p className="note">
              Войдите по номеру телефона или зарегистрируйте новый аккаунт NeoGram.
            </p>

            <div className="form">
              <button
                type="button"
                className="neogram-collection-button"
                onClick={openCollectionDrawer}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  minHeight: 48,
                  padding: '12px 16px',
                  marginBottom: 16,
                  border: '1px solid var(--color-borders)',
                  borderRadius: 12,
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text)',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                💎 Коллекционные номера
              </button>

              <div className="input-group">
                <label
                  htmlFor="neogram-phone-input"
                  style={{
                    display: 'block',
                    marginBottom: 8,
                  }}
                >
                  Номер телефона
                </label>

                <input
                  id="neogram-phone-input"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+88812345678"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setError('');
                  }}
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
                    minHeight: 48,
                    boxSizing: 'border-box',
                    padding: '12px 14px',
                    border: '1px solid var(--color-borders)',
                    borderRadius: 10,
                    outline: 'none',
                    background: 'var(--color-background)',
                    color: 'var(--color-text)',
                    fontSize: 17,
                    fontFamily: 'inherit',
                    letterSpacing: '0.3px',
                  }}
                />
              </div>

              {error && (
                <p className="note error">
                  {error}
                </p>
              )}

              <Button
                className="auth-button"
                block
                ripple
                disabled={!canContinue}
                isLoading={isCheckingPhone}
                onClick={() => {
                  void handleContinue();
                }}
              >
                Продолжить
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
              <h1 style={{ margin: 0 }}>
                {normalizedPhone}
              </h1>

              <button
                type="button"
                className="auth-number-edit"
                onClick={handleBackToPhone}
                aria-label="Изменить номер"
                title="Изменить номер"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  border: 0,
                  borderRadius: 10,
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text)',
                  fontSize: 21,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
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
              <div>
                <label
                  htmlFor="neogram-sign-in-pin"
                  style={{
                    display: 'block',
                    marginBottom: 8,
                  }}
                >
                  PIN-код
                </label>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  {Array.from({ length: PIN_LENGTH }, (_, index) => (
                    <div
                      key={index}
                      aria-hidden="true"
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: '50%',
                        border: '2px solid var(--color-primary)',
                        background: pin.length > index
                          ? 'var(--color-primary)'
                          : 'transparent',
                        transition: 'none',
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
                  onChange={handlePinChange}
                  placeholder="••••"
                  autoFocus
                  style={{
                    display: 'block',
                    width: '100%',
                    minHeight: 48,
                    boxSizing: 'border-box',
                    padding: '12px 14px',
                    border: '1px solid var(--color-borders)',
                    borderRadius: 10,
                    outline: 'none',
                    background: 'var(--color-background)',
                    color: 'var(--color-text)',
                    fontSize: 20,
                    textAlign: 'center',
                    letterSpacing: 12,
                  }}
                />
              </div>

              {error && (
                <p className="note error">
                  {error}
                </p>
              )}

              <Button
                className="auth-button"
                block
                type="submit"
                ripple
                disabled={pin.length !== PIN_LENGTH || isSubmitting}
                isLoading={isSubmitting}
              >
                Продолжить
              </Button>

              <Button
                className="auth-button"
                block
                isText
                ripple
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
          className="neogram-collection-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsDrawerOpen(false);
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.48)',
            paddingTop: 'env(safe-area-inset-top)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="neogram-collection-title"
            className="neogram-collection-sheet"
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
              boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.2)',
              animation: 'none',
            }}
          >
            <div
              style={{
                width: 38,
                height: 5,
                borderRadius: 5,
                background: 'var(--color-borders)',
                margin: '0 auto 18px',
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 8,
              }}
            >
              <h2
                id="neogram-collection-title"
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                💎 Коллекционные номера
              </h2>

              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  border: 0,
                  borderRadius: '50%',
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text)',
                  fontSize: 20,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <p className="note">
              Базовые номера NeoGram +888. Стоимость зависит от номера.
            </p>

            {isLoadingNumbers ? (
              <div style={{ padding: 24 }}>
                <Loading />
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  marginTop: 16,
                }}
              >
                {numbers.map((item) => {
                  const itemPhone = normalizePhone(item.phone || item.raw);

                  const price = item.price_gram > 0
                    ? item.price_gram
                    : Math.max(2000, item.price_usd * 100);

                  return (
                    <button
                      key={itemPhone}
                      type="button"
                      onClick={() => handleSelectPhone(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        width: '100%',
                        minHeight: 58,
                        padding: '12px 15px',
                        border: '1px solid var(--color-borders)',
                        borderRadius: 12,
                        background: 'var(--color-background-secondary)',
                        color: 'var(--color-text)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                        }}
                      >
                        {itemPhone}
                      </span>

                      <span
                        style={{
                          color: 'var(--color-primary)',
                          fontSize: 14,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {price.toLocaleString('ru-RU')} GRAM
                      </span>
                    </button>
                  );
                })}

                {numbers.length === 0 && (
                  <p className="note">
                    Сейчас нет доступных коллекционных номеров.
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="note error">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={async () => {
                setNumbers([]);
                setError('');
                setIsLoadingNumbers(true);

                try {
                  const result = await generatePhoneNumbers();

                  setNumbers(
                    result
                      .filter((item) => normalizePhone(item.phone || item.raw).startsWith('+888'))
                      .slice(0, 5),
                  );
                } catch (loadError) {
                  setError(getErrorMessage(loadError));
                } finally {
                  setIsLoadingNumbers(false);
                }
              }}
              disabled={isLoadingNumbers}
              style={{
                width: '100%',
                minHeight: 46,
                marginTop: 16,
                border: '1px solid var(--color-borders)',
                borderRadius: 12,
                background: 'transparent',
                color: 'var(--color-text)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Обновить номера
            </button>
          </section>
        </div>
      )}
    </div>
  );
};

export default memo(AuthPhoneNumber);
