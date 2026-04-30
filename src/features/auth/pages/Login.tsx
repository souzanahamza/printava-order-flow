import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { AuthSplitLayout } from '@/features/auth/components/AuthSplitLayout';
import { AuthBrandLockup } from '@/features/auth/components/AuthBrandLockup';
import { cn } from '@/lib/utils';

const LOGIN_EMAIL_KEY = 'printava_login_email';

function readSavedLoginEmail(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(LOGIN_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotSending, setForgotSending] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: readSavedLoginEmail(),
      password: '',
      rememberMe: true,
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleForgotPassword = async () => {
    const email = form.getValues('email').trim();
    if (!email) {
      toast.error('Enter your email address first');
      form.setFocus('email');
      return;
    }
    const parsed = z.string().email().safeParse(email);
    if (!parsed.success) {
      toast.error('Please enter a valid email');
      return;
    }

    setForgotSending(true);
    const toastId = toast.loading('Sending reset link…');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      toast.dismiss(toastId);
      if (error) {
        toast.error(error.message || 'Could not send reset email');
      } else {
        toast.success('Check your inbox for a password reset link');
      }
    } catch {
      toast.dismiss(toastId);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setForgotSending(false);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const toastId = toast.loading('Signing in…');
    setIsLoading(true);
    try {
      const { error } = await signIn(values.email, values.password);
      toast.dismiss(toastId);
      if (error) {
        toast.error(error.message || 'Failed to sign in');
        return;
      }
      try {
        if (values.rememberMe) {
          localStorage.setItem(LOGIN_EMAIL_KEY, values.email);
        } else {
          localStorage.removeItem(LOGIN_EMAIL_KEY);
        }
      } catch {
        /* ignore */
      }
      toast.success('Welcome back!');
      navigate('/');
    } catch {
      toast.dismiss(toastId);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <AuthSplitLayout>
      <div className="space-y-8">
        <div className="space-y-6">
          <AuthBrandLockup />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to continue to your workspace.</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel>Password</FormLabel>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isLoading || forgotSending}
                      className="text-xs font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
                    >
                      {forgotSending ? 'Sending…' : 'Forgot password?'}
                    </button>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        disabled={isLoading}
                        className="pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isLoading} />
                  </FormControl>
                  <FormLabel className="!mt-0 cursor-pointer text-sm font-normal leading-none peer-disabled:cursor-not-allowed">
                    Remember me
                  </FormLabel>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className={cn('font-medium text-primary hover:underline')}>
            Create an account
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
