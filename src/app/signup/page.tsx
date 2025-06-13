"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { UserPlus, AlertCircle, Eye, EyeOff, User, Mail, Lock, Loader2, CheckCircle, Shield, Check, X, Crown, Users } from 'lucide-react';
import Link from 'next/link';
import type { UserRole } from '@/types';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PasswordStrength {
  score: number;
  feedback: string[];
  color: string;
}

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Individual field errors
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  
  // Password strength
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    feedback: [],
    color: 'bg-gray-200'
  });

  const { signup } = useAuth();
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  // Focus name input on mount
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const validateName = (name: string) => {
    if (!name.trim()) {
      setNameError('Full name is required');
      return false;
    }
    if (name.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
      return false;
    }
    if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
      setNameError('Name can only contain letters and spaces');
      return false;
    }
    setNameError('');
    return true;
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('Email is required');
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const calculatePasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    const feedback: string[] = [];
    
    if (password.length >= 8) score += 1;
    else feedback.push('At least 8 characters');
    
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('One lowercase letter');
    
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('One uppercase letter');
    
    if (/\d/.test(password)) score += 1;
    else feedback.push('One number');
    
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    else feedback.push('One special character');

    let color = 'bg-red-500';
    if (score >= 4) color = 'bg-green-500';
    else if (score >= 3) color = 'bg-yellow-500';
    else if (score >= 2) color = 'bg-orange-500';

    return { score, feedback, color };
  };

  const validatePassword = (password: string) => {
    if (!password) {
      setPasswordError('Password is required');
      return false;
    }
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const validateConfirmPassword = (confirmPassword: string, password: string) => {
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      return false;
    }
    if (confirmPassword !== password) {
      setConfirmPasswordError('Passwords do not match');
      return false;
    }
    setConfirmPasswordError('');
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (nameError) validateName(value);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (emailError) validateEmail(value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordStrength(calculatePasswordStrength(value));
    if (passwordError) validatePassword(value);
    if (confirmPassword) validateConfirmPassword(confirmPassword, value);
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (confirmPasswordError) validateConfirmPassword(value, password);
  };

  const handleKeyDown = (e: React.KeyboardEvent, nextRef?: React.RefObject<HTMLInputElement>) => {
    if (e.key === 'Enter' && nextRef?.current) {
      e.preventDefault();
      nextRef.current.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const isNameValid = validateName(name);
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword, password);

    if (!acceptTerms) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    if (!isNameValid || !isEmailValid || !isPasswordValid || !isConfirmPasswordValid) {
      return;
    }

    setLoading(true);

    try {
      const success = await signup(name.trim(), email, role, password);
      if (success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        setError('User with this email already exists or signup failed.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error(err);
    }

    setLoading(false);
  };

  const getPasswordStrengthText = (score: number) => {
    if (score >= 4) return 'Strong';
    if (score >= 3) return 'Good';
    if (score >= 2) return 'Fair';
    if (score >= 1) return 'Weak';
    return 'Very Weak';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
      </div>

      <Card className="w-full max-w-lg shadow-2xl bg-white/80 backdrop-blur-sm border-0 relative">
        {/* Security indicator */}
        <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-2 shadow-lg">
          <Shield className="h-4 w-4 text-white" />
        </div>

        <CardHeader className="text-center pb-4">
          <div className="inline-flex justify-center items-center mb-4 relative">
            <div className="absolute inset-0 bg-purple-500 rounded-full animate-ping opacity-20"></div>
            <div className="relative bg-gradient-to-r from-purple-500 to-pink-600 rounded-full p-3">
              <UserPlus className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Create an Account
          </CardTitle>
          <CardDescription className="text-slate-600 mt-2">
            Join TaskZen to manage your tasks efficiently and boost productivity.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Signup Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Account Created!</AlertTitle>
                <AlertDescription>Welcome to TaskZen! Redirecting to your dashboard...</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-700 font-medium">
                Full Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  ref={nameRef}
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={handleNameChange}
                  onKeyDown={(e) => handleKeyDown(e, emailRef)}
                  className={`pl-10 text-base transition-all duration-200 ${
                    nameError ? 'border-red-300 focus:border-red-500' : 'focus:border-purple-500'
                  }`}
                  disabled={loading}
                  autoComplete="name"
                  aria-describedby={nameError ? "name-error" : undefined}
                />
              </div>
              {nameError && (
                <p id="name-error" className="text-sm text-red-600 mt-1">{nameError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  ref={emailRef}
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  onKeyDown={(e) => handleKeyDown(e, passwordRef)}
                  className={`pl-10 text-base transition-all duration-200 ${
                    emailError ? 'border-red-300 focus:border-red-500' : 'focus:border-purple-500'
                  }`}
                  disabled={loading}
                  autoComplete="email"
                  aria-describedby={emailError ? "email-error" : undefined}
                />
              </div>
              {emailError && (
                <p id="email-error" className="text-sm text-red-600 mt-1">{emailError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyDown={(e) => handleKeyDown(e, confirmPasswordRef)}
                  className={`pl-10 pr-12 text-base transition-all duration-200 ${
                    passwordError ? 'border-red-300 focus:border-red-500' : 'focus:border-purple-500'
                  }`}
                  disabled={loading}
                  autoComplete="new-password"
                  aria-describedby={passwordError ? "password-error" : "password-strength"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && (
                <p id="password-error" className="text-sm text-red-600 mt-1">{passwordError}</p>
              )}
              {password && (
                <div id="password-strength" className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Password strength:</span>
                    <span className={`font-medium ${
                      passwordStrength.score >= 4 ? 'text-green-600' : 
                      passwordStrength.score >= 3 ? 'text-yellow-600' : 
                      passwordStrength.score >= 2 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {getPasswordStrengthText(passwordStrength.score)}
                    </span>
                  </div>
                  <Progress 
                    value={(passwordStrength.score / 5) * 100} 
                    className="h-2"
                  />
                  {passwordStrength.feedback.length > 0 && (
                    <div className="text-xs text-slate-500">
                      <p>Missing: {passwordStrength.feedback.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  ref={confirmPasswordRef}
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  className={`pl-10 pr-12 text-base transition-all duration-200 ${
                    confirmPasswordError ? 'border-red-300 focus:border-red-500' : 
                    confirmPassword && !confirmPasswordError ? 'border-green-300 focus:border-green-500' :
                    'focus:border-purple-500'
                  }`}
                  disabled={loading}
                  autoComplete="new-password"
                  aria-describedby={confirmPasswordError ? "confirm-password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={loading}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                {confirmPassword && !confirmPasswordError && (
                  <Check className="absolute right-10 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
              </div>
              {confirmPasswordError && (
                <p id="confirm-password-error" className="text-sm text-red-600 mt-1">{confirmPasswordError}</p>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-slate-700 font-medium">Account Type</Label>
              <RadioGroup 
                value={role} 
                onValueChange={(value) => setRole(value as UserRole)} 
                className="grid grid-cols-2 gap-4"
                disabled={loading}
              >
                <div className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                  role === 'user' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <RadioGroupItem value="user" id="role-user" className="sr-only" />
                  <Label htmlFor="role-user" className="cursor-pointer block">
                    <div className="flex items-center space-x-3">
                      <Users className="h-5 w-5 text-purple-600" />
                      <div>
                        <div className="font-medium text-slate-900">User</div>
                        <div className="text-xs text-slate-500">Standard access</div>
                      </div>
                    </div>
                  </Label>
                  {role === 'user' && (
                    <Check className="absolute top-2 right-2 h-4 w-4 text-purple-600" />
                  )}
                </div>
                <div className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                  role === 'admin' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <RadioGroupItem value="admin" id="role-admin" className="sr-only" />
                  <Label htmlFor="role-admin" className="cursor-pointer block">
                    <div className="flex items-center space-x-3">
                      <Crown className="h-5 w-5 text-purple-600" />
                      <div>
                        <div className="font-medium text-slate-900">Admin</div>
                        <div className="text-xs text-slate-500">Full access</div>
                      </div>
                    </div>
                  </Label>
                  {role === 'admin' && (
                    <Check className="absolute top-2 right-2 h-4 w-4 text-purple-600" />
                  )}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox 
                  id="accept-terms" 
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                  disabled={loading}
                  className="mt-1"
                />
                <Label htmlFor="accept-terms" className="text-sm text-slate-600 leading-relaxed cursor-pointer">
                  I agree to the{' '}
                  <Link href="/terms" className="text-purple-600 hover:text-purple-800 hover:underline">
                    Terms of Service
                  </Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="text-purple-600 hover:text-purple-800 hover:underline">
                    Privacy Policy
                  </Link>
                </Label>
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox 
                  id="accept-marketing" 
                  checked={acceptMarketing}
                  onCheckedChange={(checked) => setAcceptMarketing(checked as boolean)}
                  disabled={loading}
                  className="mt-1"
                />
                <Label htmlFor="accept-marketing" className="text-sm text-slate-600 leading-relaxed cursor-pointer">
                  I would like to receive product updates and marketing communications
                </Label>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full text-lg py-6 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none" 
              disabled={loading || success || !acceptTerms}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating Account...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Account Created!
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-5 w-5" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          <div className="relative">
            <Separator className="my-6" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-white px-4 text-sm text-slate-500">Secure Registration</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-center space-y-4 text-sm pt-2">
          <p className="text-slate-600 text-center">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-purple-600 hover:text-purple-800 hover:underline transition-colors">
              Sign In
            </Link>
          </p>
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Shield className="h-3 w-3" />
            <span>Your data is protected with enterprise-grade security</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}