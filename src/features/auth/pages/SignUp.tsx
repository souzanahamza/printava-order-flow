import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Coins, Eye, EyeOff, Loader2, Upload, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrencies } from '@/hooks/useCurrencies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const LOGO_MAX_BYTES = 5 * 1024 * 1024;

const signUpSchema = z
  .object({
    fullName: z.string().min(1, 'Full name is required').max(120, 'Name is too long'),
    email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .refine((p) => /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p), {
        message: 'Password must include uppercase, lowercase, and a number',
      }),
    confirmPassword: z.string().min(1, 'Confirm your password'),
    companyName: z.string().min(1, 'Company name is required').max(200, 'Name is too long'),
    currencyId: z.string().min(1, 'Select a base currency'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignUpFormValues = z.infer<typeof signUpSchema>;

export default function SignUp() {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp, user } = useAuth();
  const { data: currencies, isLoading: currenciesLoading, error: currenciesError } = useCurrencies();
  const navigate = useNavigate();

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      companyName: '',
      currencyId: '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  useEffect(() => {
    if (currenciesError) {
      console.error('Error loading currencies:', currenciesError);
      toast.error('Failed to load currencies. Please refresh the page.');
    }
  }, [currenciesError]);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const onSubmit = form.handleSubmit(async (values) => {
    const toastId = toast.loading('Creating your account…');
    setIsLoading(true);
    try {
      const { error } = await signUp(
        values.email,
        values.password,
        values.fullName,
        values.companyName,
        logo,
        values.currencyId,
      );
      toast.dismiss(toastId);
      if (error) {
        if (error.message?.includes('already registered')) {
          toast.error('This email is already registered. Please sign in instead.');
        } else {
          toast.error(error.message || 'Failed to create account');
        }
        return;
      }
      toast.success('Account created successfully!');
      navigate('/');
    } catch {
      toast.dismiss(toastId);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  });

  const disabledForm = isLoading || currenciesLoading;

  const clearLogo = () => {
    setLogo(null);
    setLogoPreview(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      clearLogo();
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (PNG, JPG, WebP, etc.)');
      clearLogo();
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error('Image must be 5 MB or smaller');
      clearLogo();
      return;
    }
    setLogo(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <AuthSplitLayout variant="centered">
      <div className="space-y-8">
        <div className="space-y-6">
          <AuthBrandLockup />
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create your account</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Set up your company and admin profile—then manage quotations, orders, and production from one workspace.
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-8">
            <div className="space-y-5">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Account admin
                </h2>
                <Separator className="mt-2" />
              </div>

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" disabled={disabledForm} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" placeholder="you@company.com" disabled={disabledForm} {...field} />
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          disabled={disabledForm}
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
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          disabled={disabledForm}
                          className="pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-5">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Company details
                </h2>
                <Separator className="mt-2" />
              </div>

              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your print shop" disabled={disabledForm} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currencyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Base currency</FormLabel>
                    <div
                      className={cn(
                        'rounded-xl border border-border/80 bg-gradient-to-br from-muted/50 to-background p-4 shadow-sm',
                        form.formState.errors.currencyId && 'border-destructive/60 ring-1 ring-destructive/20',
                      )}
                    >
                      <div className="mb-3 flex gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                          <Coins className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">Base currency</p>
                          <p className="text-xs text-muted-foreground">Used for prices, quotes, and invoices across your shop.</p>
                        </div>
                      </div>
                      <Select
                        value={field.value ? field.value : undefined}
                        onValueChange={field.onChange}
                        disabled={disabledForm || !!currenciesError}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11 border-border/80 bg-background/80 shadow-none">
                            <SelectValue
                              placeholder={
                                currenciesLoading
                                  ? 'Loading currencies…'
                                  : currenciesError
                                    ? 'Could not load currencies'
                                    : 'Choose your currency'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencies?.map((currency) => (
                            <SelectItem key={currency.id} value={currency.id}>
                              <span className="font-medium">{currency.code}</span>
                              <span className="text-muted-foreground"> — {currency.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <FormMessage />
                    {currenciesError && (
                      <p className="text-sm font-medium text-destructive">Failed to load currencies. Please refresh the page.</p>
                    )}
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label htmlFor="company-logo">Company logo (optional)</Label>
                <p className="text-xs text-muted-foreground">PNG or JPG recommended — max 5 MB.</p>
                <div className="flex flex-col gap-3 rounded-lg border border-input bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      ref={logoInputRef}
                      id="company-logo"
                      type="file"
                      accept="image/*"
                      disabled={disabledForm}
                      className="sr-only"
                      onChange={handleLogoChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabledForm}
                      className="w-full shrink-0 border-primary/20 bg-primary/10 text-primary shadow-none hover:bg-primary/15 hover:text-primary sm:w-auto"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" aria-hidden />
                      Choose image
                    </Button>
                    <span className="truncate text-sm text-muted-foreground sm:min-w-0 sm:flex-1" title={logo?.name}>
                      {logo ? logo.name : 'No file chosen'}
                    </span>
                  </div>
                  {logo ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabledForm}
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={clearLogo}
                    >
                      <X className="mr-1 h-4 w-4" aria-hidden />
                      Remove
                    </Button>
                  ) : null}
                </div>
                {logoPreview ? (
                  <div className="flex justify-center pt-1">
                    <img src={logoPreview} alt="Logo preview" className="h-20 max-w-full rounded-md border border-border object-contain" />
                  </div>
                ) : null}
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={disabledForm}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className={cn('font-medium text-primary hover:underline')}>
            Sign in
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
