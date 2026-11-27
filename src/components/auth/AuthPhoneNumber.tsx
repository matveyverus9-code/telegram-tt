
import {
  memo, useEffect, useState,
} from '../../lib/teact/teact';

import { navigateBack } from './helpers/backNavigation';

import useLang from '../../hooks/useLang';
import useMultiaccountInfo from '../../hooks/useMultiaccountInfo';

import Button from '../ui/Button';
import InputText from '../ui/InputText';
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

function getErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';

  switch (code) {
    case 'NEOGRAM_SERVER_UNAVAILABLE':
      return 'Не удалось подключиться к серверу. Проверьте интернет и попробуйте ещё раз.';
    case 'PHONE_LIST_UNAVAILABLE':
    case 'PHONE_GENERATION_FAILED':
      return 'Не удалось получить номера. Попробуйте обновить список.';
    case 'INVALID_PHONE':
      return 'Неверный номер NeoGram.';
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
      return 'Слишком много попыток. Немного подождите и попробуйте снова.';
    default:
      return code
        ? `Не удалось выполнить вход: ${code}`
        : 'Произошла ошибка. Попробуйте ещё раз.';
  }
}

const AuthPhoneNumber = () => {
  const lang = useLang();
  const accountsInfo = useMultiaccountInfo();
  const hasActiveAccount = Object.values(accountsInfo).length > 0;

  const [numbers, setNumbers] = useState<NeoGramPhoneNumber[]>([]);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [step, setStep] = useState<AuthStep>('phone');
  const [pin, setPin] = useState('');
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(true);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [phoneCheckMessage, setPhoneCheckMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadNumbers() {
      setIsLoadingNumbers(true);
      setError('');

      try {
        const result = await generatePhoneNumbers();

        if (isMounted) {
          setNumbers(result);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoadingNumbers(false);
        }
      }
    }

    void loadNumbers();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSelectPhone(phone: string) {
    if (isCheckingPhone || isSubmitting) {
      return;
    }

    const normalizedPhone = normalizePhone(phone);

    setSelectedPhone(normalizedPhone);
    setError('');
    setPhoneCheckMessage('');
    setIsCheckingPhone(true);

    try {
      const result = await checkPhoneNumber(normalizedPhone);

      if (result.exists) {
        setPhoneCheckMessage('Аккаунт найден. Введите PIN для входа.');
      } else if (result.can_register || result.reserved) {
        setPhoneCheckMessage('Номер готов к регистрации. Придумайте PIN для аккаунта.');
      } else {
        setPhoneCheckMessage('Введите PIN, чтобы продолжить.');
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
    const nextPin = event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH);

    setPin(nextPin);
    setError('');
  }

  function handleBackToNumbers() {
    setStep('phone');
    setPin('');
    setError('');
    setPhoneCheckMessage('');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || pin.length !== PIN_LENGTH || !selectedPhone) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result: NeoGramAuthResponse = await authenticate(selectedPhone, pin);

      // Auth.tsx подключит этот сигнал к переходу в основное приложение.
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
    <div id="auth-phone-number-form" className="custom-scroll">
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
              Выберите свой номер NeoGram или получите новый номер +888.
            </p>

            <div className="form">
              {isLoadingNumbers && <Loading />}

              {!isLoadingNumbers && numbers.length > 0 && (
                <div className="neogram-phone-list">
                  {numbers.map((item) => {
                    const phone = normalizePhone(item.phone || item.raw);
                    const isSelected = selectedPhone === phone;

                    return (
                      <Button
                        key={phone}
                        block
                        ripple
                        color={isSelected ? 'primary' : 'translucent'}
                        className="neogram-phone-option"
                        onClick={() => handleSelectPhone(phone)}
                        isLoading={isCheckingPhone && isSelected}
                      >
                        <span className="neogram-phone-option-content">
                          <span className="neogram-phone-number">
                            {item.phone || item.raw}
                          </span>
                          <span className="neogram-phone-details">
                            {item.price_usd > 0
                              ? `$${item.price_usd}`
                              : 'NeoGram'}
                          </span>
                        </span>
                      </Button>
                    );
                  })}
                </div>
              )}

              {!isLoadingNumbers && numbers.length === 0 && !error && (
                <p className="note">
                  Сейчас нет доступных номеров.
                </p>
              )}

              {error && (
                <p className="note error">
                  {error}
                </p>
              )}

              <Button
                className="auth-button"
                isText
                ripple
                isLoading={isLoadingNumbers}
                onClick={() => {
                  setError('');
                  setIsLoadingNumbers(true);

                  void generatePhoneNumbers()
                    .then(setNumbers)
                    .catch((loadError) => setError(getErrorMessage(loadError)))
                    .finally(() => setIsLoadingNumbers(false));
                }}
              >
                Обновить список номеров
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1>
              {selectedPhone}
              <span
                className="auth-number-edit div-button"
                onClick={handleBackToNumbers}
                role="button"
                tabIndex={0}
                title="Изменить номер"
                aria-label="Изменить номер"
              >
                ✎
              </span>
            </h1>

            <p className="note">
              {phoneCheckMessage || 'Введите четырёхзначный PIN-код.'}
            </p>

            <form className="form" action="" onSubmit={handleSubmit}>
              <InputText
                id="neogram-sign-in-pin"
                label="PIN-код"
                value={pin}
                onChange={handlePinChange}
                inputMode="numeric"
                autoComplete="off"
                type="password"
              />

              {error && (
                <p className="note error">
                  {error}
                </p>
              )}

              {isSubmitting ? (
                <Loading />
              ) : (
                <Button
                  className="auth-button"
                  type="submit"
                  ripple
                  disabled={pin.length !== PIN_LENGTH}
                >
                  Продолжить
                </Button>
              )}

              <Button
                className="auth-button"
                isText
                ripple
                onClick={handleBackToNumbers}
              >
                Назад к выбору номера
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(AuthPhoneNumber);
