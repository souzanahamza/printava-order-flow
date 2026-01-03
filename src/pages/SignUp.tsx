import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCurrencies } from '@/hooks/useCurrencies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import printavaLogo from '@/assets/printava-logo.png';
export default function SignUp() {
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currencyId, setCurrencyId] = useState<string>('');
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {
    signUp,
    user
  } = useAuth();
  const { data: currencies, isLoading: currenciesLoading, error: currenciesError } = useCurrencies();
  const navigate = useNavigate();

  // Show error if currencies fail to load
  useEffect(() => {
    if (currenciesError) {
      console.error('Error loading currencies:', currenciesError);
      toast.error('Failed to load currencies. Please refresh the page.');
    }
  }, [currenciesError]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !companyName || !email || !password || !confirmPassword || !currencyId) {
      toast.error('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setIsLoading(true);
    const {
      error
    } = await signUp(email, password, fullName, companyName, logo, currencyId);
    setIsLoading(false);
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
      } else {
        toast.error(error.message || 'Failed to create account');
      }
    } else {
      toast.success('Account created successfully!');
      navigate('/');
    }
  };
  return <div className="flex items-center justify-center min-h-screen bg-background p-4">
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-4">
        {/* <div className="flex justify-center">
            <img src={printavaLogo} alt="Printava" className="h-16 w-auto gap-2 rounded-md bg-gray-300" />
          </div> */}
        <CardTitle className="text-2xl text-center">Create Account</CardTitle>
        <CardDescription className="text-left">
          Register now to begin streamlining the management of your orders            </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} disabled={isLoading} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input id="companyName" type="text" placeholder="Printava Shop" value={companyName} onChange={e => setCompanyName(e.target.value)} disabled={isLoading} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currencyId">
              Base Currency <span className="text-destructive">*</span>
            </Label>
            <Select
              value={currencyId}
              onValueChange={setCurrencyId}
              disabled={isLoading || currenciesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={currenciesLoading ? "Loading currencies..." : currenciesError ? "Error loading currencies" : "Select currency"} />
              </SelectTrigger>
              <SelectContent>
                {currencies && currencies.length > 0 ? (
                  currencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))
                ) : (
                  !currenciesLoading && (
                    <SelectItem value="" disabled>
                      No currencies available
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            {currenciesError && (
              <p className="text-sm text-destructive">Failed to load currencies. Please refresh the page.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Company Logo (Optional)</Label>
            <Input
              id="logo"
              type="file"
              accept="image/*"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  setLogo(file);
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setLogoPreview(reader.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              disabled={isLoading}
            />
            {logoPreview && (
              <div className="mt-2 flex justify-center">
                <img src={logoPreview} alt="Logo preview" className="h-16 w-auto rounded-md border border-border" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isLoading} required />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || currenciesLoading}>
            {isLoading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  </div>;
}