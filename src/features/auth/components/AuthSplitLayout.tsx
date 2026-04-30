import { AuthMarketingPanel } from './AuthMarketingPanel';
import { cn } from '@/lib/utils';

type AuthSplitLayoutProps = {
  children: React.ReactNode;
  /** Use `start` for long forms (e.g. Sign up) so content is not clipped when taller than the viewport. */
  formVerticalAlign?: 'center' | 'start';
  /** Single centered column—no right panel (e.g. sign up). */
  variant?: 'split' | 'centered';
};

export function AuthSplitLayout({
  children,
  formVerticalAlign = 'center',
  variant = 'split',
}: AuthSplitLayoutProps) {
  if (variant === 'centered') {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center overflow-y-auto bg-white px-5 py-10 sm:px-8 sm:py-12 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-[420px]">{children}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full lg:grid lg:min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div
        className={cn(
          'flex min-h-screen flex-col overflow-y-auto bg-white px-5 py-10 sm:px-8 lg:px-12 lg:py-12 dark:bg-zinc-950',
          formVerticalAlign === 'center' ? 'justify-center' : 'justify-start',
        )}
      >
        <div className="mx-auto w-full max-w-[420px]">{children}</div>
      </div>
      <aside className="hidden animate-auth-panel-in motion-reduce:animate-none lg:block lg:min-h-screen">
        <AuthMarketingPanel />
      </aside>
    </div>
  );
}
