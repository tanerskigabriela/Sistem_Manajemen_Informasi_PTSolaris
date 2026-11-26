import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Input } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { parseApiError, toFieldErrorMap } from '../../lib/http';
import { maxLength, required, validateForm } from '../../lib/validation';

function SolarisEmblem({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient
          id="solarisLoginSun"
          x1="8"
          y1="8"
          x2="56"
          y2="56"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#F5A623" />
          <stop offset="55%" stopColor="#E66A14" />
          <stop offset="100%" stopColor="#C4410C" />
        </linearGradient>
      </defs>
      {Array.from({ length: 12 }).map((_, i) => (
        <path
          key={i}
          d="M32 3 C34.5 10, 31 14, 32 19 C29.5 14, 28 10, 32 3 Z"
          fill="url(#solarisLoginSun)"
          transform={`rotate(${i * 30} 32 32)`}
        />
      ))}
      <circle
        cx="32"
        cy="32"
        r="13"
        stroke="url(#solarisLoginSun)"
        strokeWidth="2.4"
        fill="#FFFCF7"
      />
      <circle
        cx="32"
        cy="32"
        r="9.5"
        stroke="#E59A18"
        strokeWidth="1.2"
        fill="#FBF4E5"
      />
    </svg>
  );
}

/**
 * SCR-01: Login (FSD-2.1, Gambar 3.1).
 */
export default function LoginPage() {
  const { user, loading: authLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? '/beranda';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // AF-1 FSD-2.1: Jika sudah memiliki sesi aktif, langsung arahkan ke SCR-02
  if (!authLoading && user) {
    return <Navigate to="/beranda" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const errors = validateForm(
      { username, password },
      {
        username: [required(), maxLength(50)],
        password: [required()],
      },
    );
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(fromPath === '/login' ? '/beranda' : fromPath, { replace: true });
    } catch (error) {
      const parsed = parseApiError(error);
      if (parsed.errors.length > 0) {
        setFieldErrors(toFieldErrorMap(parsed.errors));
      }
      setErrorMessage(parsed.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-canvas text-ink">
      {/* Top Header Bar */}
      <header className="relative z-10 flex h-16 items-center border-b border-line bg-amber-tint px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <SolarisEmblem size={34} />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wide text-ink sm:text-[15px]">
              SOLARIS ETERNAL APPARELS
            </p>
            <p className="text-[11px] font-medium text-ink-muted">
              Sistem Informasi Pengendalian Order &amp; Produksi
            </p>
          </div>
        </div>
      </header>

      {/* Orbs dekoratif lembut sesuai mockup SCR-01 */}
      <div
        aria-hidden="true"
        className="solaris-orb absolute top-36 left-[12%] hidden h-28 w-28 opacity-80 md:block"
      />
      <div
        aria-hidden="true"
        className="solaris-orb absolute top-24 right-[4%] hidden h-44 w-44 opacity-85 md:block"
      />
      <div
        aria-hidden="true"
        className="solaris-orb absolute -bottom-16 -left-10 hidden h-64 w-64 opacity-85 sm:block"
      />
      <div
        aria-hidden="true"
        className="solaris-orb absolute -right-12 -bottom-20 hidden h-72 w-72 opacity-85 sm:block"
      />
      <div
        aria-hidden="true"
        className="solaris-orb absolute bottom-6 left-1/2 hidden h-16 w-16 -translate-x-1/2 opacity-80 md:block"
      />

      {/* Kartu Login Tengah */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="mb-4">
          <SolarisEmblem size={56} />
        </div>

        <section className="w-full max-w-[440px] rounded-2xl border border-line bg-surface p-7 shadow-xs sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="font-display text-[30px] font-semibold leading-tight text-ink">
              Masuk
            </h1>
            <p className="mt-1.5 text-[13px] font-medium text-ink-muted">
              Gunakan akun yang diberikan Administrator Sistem
            </p>
          </div>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
            className="space-y-4"
          >
            {errorMessage && <Alert variant="danger" message={errorMessage} />}

            <Input
              label="Username"
              name="username"
              type="text"
              autoComplete="username"
              maxLength={50}
              required
              placeholder="Contoh: admin.solaris"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={fieldErrors.username}
            />

            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
            />

            <div className="pt-1">
              <Button
                type="submit"
                size="lg"
                loading={submitting}
                className="w-full"
              >
                Masuk
              </Button>
            </div>

            <p className="pt-1 text-center text-xs text-ink-muted">
              Lupa password atau akun terkunci? Hubungi Administrator Sistem.
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}