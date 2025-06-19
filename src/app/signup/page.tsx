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
import { 
  UserPlus, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  User, 
  Mail, 
  Lock, 
  Loader2, 
  CheckCircle, 
  Shield, 
  Check, 
  X, 
  Crown, 
  Users,
  Github,
  Chrome,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  RefreshCw,
  Star,
  Zap,
  Globe,
  Building,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import type { UserRole } from '@/types';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PasswordStrength {
  score: number;
  feedback: string[];
  color: string;
  percentage: number;
}

export default function EnhancedSignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('User');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [formTouched, setFormTouched] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isEmailAvailable, setIsEmailAvailable] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  
  // Individual field errors
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  
  // Password strength
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    feedback: [],
    color: 'bg-gray-200',
    percentage: 0
  });

  const { signup } = useAuth();
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-save form data
  useEffect(() => {
    if (formTouched) {
      const formData = { name, email, role, acceptMarketing };
      localStorage.setItem('signupForm', JSON.stringify(formData));
    }
  }, [name, email, role, acceptMarketing, formTouched]);

  // Load saved form data
  useEffect(() => {
    const savedData = localStorage.getItem('signupForm');
    if (savedData) {
      try {
        const { name: savedName, email: savedEmail, role: savedRole, acceptMarketing: savedMarketing } = JSON.parse(savedData);
        setName(savedName || '');
        setEmail(savedEmail || '');
        setRole((savedRole as UserRole) || 'User');
        setAcceptMarketing(savedMarketing || false);
      } catch (error) {
        console.error('Failed to load saved form data:', error);
      }
    }
    nameRef.current?.focus();
  }, []);

  // Email availability check with debounce
  useEffect(() => {
    if (!email || emailError) {
      setIsEmailAvailable(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        // Simulate email availability check
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Mock result - in real app, this would be an API call
        const isAvailable = !email.includes('taken');
        setIsEmailAvailable(isAvailable);
      } catch (error) {
        setIsEmailAvailable(null);
      } finally {
        setCheckingEmail(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [email, emailError]);

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

    const percentage = (score / 5) * 100;

    return { score, feedback, color, percentage };
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
    setFormTouched(true);
    if (nameError) validateName(value);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setFormTouched(true);
    setIsEmailAvailable(null);
    if (emailError) validateEmail(value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setFormTouched(true);
    setPasswordStrength(calculatePasswordStrength(value));
    if (passwordError) validatePassword(value);
    if (confirmPassword) validateConfirmPassword(confirmPassword, value);
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    setFormTouched(true);
    if (confirmPasswordError) validateConfirmPassword(value, password);
  };

  const handleKeyDown = (e: React.KeyboardEvent, nextRef?: React.RefObject<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (nextRef?.current) {
        e.preventDefault();
        nextRef.current.focus();
      } else {
        // If no next ref, this is the last field, so submit
        handleSubmit();
      }
    }
  };

  const handleSocialSignup = async (provider: string) => {
    try {
      setSocialLoading(provider);
      // Simulate social signup
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSuccess(true);
      setEmailVerificationSent(true);
      setTimeout(() => router.push('/verify-email'), 2000);
    } catch (error) {
      setError(`${provider} signup failed. Please try again.`);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSubmit = async () => {
    if (!isOnline) {
      setError('No internet connection. Please check your network and try again.');
      return;
    }

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

    if (isEmailAvailable === false) {
      setError('This email address is already taken. Please use a different email.');
      return;
    }

    if (!isNameValid || !isEmailValid || !isPasswordValid || !isConfirmPasswordValid) {
      return;
    }

    setLoading(true);
    setCurrentStep(2);

    try {
      const success = await signup(name.trim(), email, role, password);
      if (success) {
        setCurrentStep(3);
        setSuccess(true);
        setEmailVerificationSent(true);
        localStorage.removeItem('signupForm');
        
        setTimeout(() => {
          router.push('/verify-email');
        }, 3000);
      } else {
        setCurrentStep(1);
        setError('User with this email already exists or signup failed.');
      }
    } catch (err) {
      setCurrentStep(1);
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

  const retryConnection = () => {
    window.location.reload();
  };

  const getRoleIcon = (roleType: UserRole) => {
    switch (roleType) {
      case 'Admin': return Crown;
      case 'User': return Users;
      default: return Users;
    }
  };

  const getRoleDescription = (roleType: UserRole) => {
    switch (roleType) {
      case 'Admin': return 'Full system access, user management, and administrative privileges';
      case 'User': return 'Standard access to tasks, projects, and collaboration features';
      default: return 'Standard access';
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900' 
        : 'bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50'
    } flex items-center justify-center p-4`}>
      
      {/* Network status indicator */}
      <div className={`fixed top-4 right-4 z-50 flex items-center space-x-2 px-3 py-2 rounded-full text-sm transition-all duration-300 ${
        isOnline 
          ? 'bg-green-100 text-green-800 border border-green-200' 
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}>
        {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        <span>{isOnline ? 'Online' : 'Offline'}</span>
        {!isOnline && (
          <button onClick={retryConnection} className="ml-2 hover:text-red-600">
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Dark mode toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className={`fixed top-4 left-4 z-50 p-3 rounded-full transition-all duration-300 ${
          darkMode 
            ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-300' 
            : 'bg-gray-800 text-white hover:bg-gray-700'
        }`}
      >
        {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      {/* Progress indicator */}
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-40">
        <div className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm ${
          darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
        } shadow-lg border`}>
          <div className={`w-2 h-2 rounded-full ${currentStep >= 1 ? 'bg-purple-500' : 'bg-gray-300'}`} />
          <div className={`w-2 h-2 rounded-full ${currentStep >= 2 ? 'bg-purple-500' : 'bg-gray-300'}`} />
          <div className={`w-2 h-2 rounded-full ${currentStep >= 3 ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="ml-2">
            {currentStep === 1 ? 'Enter Details' : 
             currentStep === 2 ? 'Creating Account...' : 
             'Account Created!'}
          </span>
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse ${
          darkMode ? 'bg-purple-600' : 'bg-purple-400'
        }`}></div>
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse ${
          darkMode ? 'bg-pink-600' : 'bg-pink-400'
        }`}></div>
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse ${
          darkMode ? 'bg-indigo-600' : 'bg-indigo-400'
        }`}></div>
      </div>

      <Card className={`w-full max-w-lg shadow-2xl backdrop-blur-sm border-0 relative transition-all duration-300 ${
        darkMode 
          ? 'bg-gray-800/90 text-white' 
          : 'bg-white/80'
      }`}>
        
        {/* Security indicator */}
        <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-2 shadow-lg animate-pulse">
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
          <CardDescription className={`mt-2 ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
            Join TaskZen to manage your tasks efficiently and boost productivity.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          
          {/* Social Signup Options */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => handleSocialSignup('Google')}
                disabled={loading || !isOnline}
                className={`transition-all duration-200 hover:scale-105 ${
                  darkMode ? 'border-gray-600 hover:bg-gray-700' : ''
                }`}
              >
                {socialLoading === 'Google' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Chrome className="h-4 w-4" />
                )}
                <span className="ml-2">Google</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSocialSignup('GitHub')}
                disabled={loading || !isOnline}
                className={`transition-all duration-200 hover:scale-105 ${
                  darkMode ? 'border-gray-600 hover:bg-gray-700' : ''
                }`}
              >
                {socialLoading === 'GitHub' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Github className="h-4 w-4" />
                )}
                <span className="ml-2">GitHub</span>
              </Button>
            </div>
          </div>

          <div className="relative">
            <Separator className="my-6" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`px-4 text-sm ${
                darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-slate-500'
              }`}>
                Or sign up with email
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50 animate-shake">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Signup Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800 animate-bounce">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Account Created!</AlertTitle>
                <AlertDescription>
                  {emailVerificationSent 
                    ? 'Please check your email to verify your account.'
                    : 'Welcome to TaskZen! Redirecting to your dashboard...'
                  }
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className={`font-medium ${
                darkMode ? 'text-gray-200' : 'text-slate-700'
              }`}>
                Full Name
              </Label>
              <div className="relative">
                <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                  darkMode ? 'text-gray-400' : 'text-slate-400'
                }`} />
                <Input
                  ref={nameRef}
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={handleNameChange}
                  onKeyDown={(e) => handleKeyDown(e, emailRef)}
                  className={`pl-10 text-base transition-all duration-200 ${
                    nameError 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'focus:border-purple-500'
                  } ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : ''
                  }`}
                  disabled={loading}
                  autoComplete="name"
                  aria-describedby={nameError ? "name-error" : undefined}
                />
              </div>
              {nameError && (
                <p id="name-error" className="text-sm text-red-600 mt-1 animate-pulse">{nameError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className={`font-medium ${
                darkMode ? 'text-gray-200' : 'text-slate-700'
              }`}>
                Email Address
              </Label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                  darkMode ? 'text-gray-400' : 'text-slate-400'
                }`} />
                <Input
                  ref={emailRef}
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  onKeyDown={(e) => handleKeyDown(e, passwordRef)}
                  className={`pl-10 pr-12 text-base transition-all duration-200 ${
                    emailError 
                      ? 'border-red-300 focus:border-red-500' 
                      : isEmailAvailable === false
                      ? 'border-red-300 focus:border-red-500'
                      : isEmailAvailable === true
                      ? 'border-green-300 focus:border-green-500'
                      : 'focus:border-purple-500'
                  } ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : ''
                  }`}
                  disabled={loading}
                  autoComplete="email"
                  aria-describedby={emailError ? "email-error" : undefined}
                />
                {/* Email availability indicator */}
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {checkingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  ) : isEmailAvailable === true ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : isEmailAvailable === false ? (
                    <X className="h-4 w-4 text-red-500" />
                  ) : null}
                </div>
              </div>
              {emailError && (
                <p id="email-error" className="text-sm text-red-600 mt-1 animate-pulse">{emailError}</p>
              )}
              {isEmailAvailable === false && !emailError && (
                <p className="text-sm text-red-600 mt-1">This email is already taken</p>
              )}
              {isEmailAvailable === true && !emailError && (
                <p className="text-sm text-green-600 mt-1">Email is available!</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className={`font-medium ${
                darkMode ? 'text-gray-200' : 'text-slate-700'
              }`}>
                Password
              </Label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                  darkMode ? 'text-gray-400' : 'text-slate-400'
                }`} />
                <Input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyDown={(e) => handleKeyDown(e, confirmPasswordRef)}
                  className={`pl-10 pr-12 text-base transition-all duration-200 ${
                    passwordError 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'focus:border-purple-500'
                  } ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : ''
                  }`}
                  disabled={loading}
                  autoComplete="new-password"
                  aria-describedby={passwordError ? "password-error" : "password-strength"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors ${
                    darkMode 
                      ? 'text-gray-400 hover:text-gray-200' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && (
                <p id="password-error" className="text-sm text-red-600 mt-1 animate-pulse">{passwordError}</p>
              )}
              {password && (
                <div id="password-strength" className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className={darkMode ? 'text-gray-300' : 'text-slate-600'}>Password strength:</span>
                    <span className={`font-medium flex items-center ${
                      passwordStrength.score >= 4 ? 'text-green-600' : 
                      passwordStrength.score >= 3 ? 'text-yellow-600' : 
                      passwordStrength.score >= 2 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {passwordStrength.score >= 4 && <Sparkles className="h-3 w-3 mr-1" />}
                      {getPasswordStrengthText(passwordStrength.score)}
                    </span>
                  </div>
                  <div className={`w-full h-2 rounded-full ${
                    darkMode ? 'bg-gray-600' : 'bg-gray-200'
                  }`}>
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${passwordStrength.color}`}
                      style={{ width: `${passwordStrength.percentage}%` }}
                    />
                  </div>
                  {passwordStrength.feedback.length > 0 && (
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                      <p>Missing: {passwordStrength.feedback.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className={`font-medium ${
                darkMode ? 'text-gray-200' : 'text-slate-700'
              }`}>
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                  darkMode ? 'text-gray-400' : 'text-slate-400'
                }`} />
                <Input
                  ref={confirmPasswordRef}
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  onKeyDown={handleKeyDown}
                  className={`pl-10 pr-12 text-base transition-all duration-200 ${
                    confirmPasswordError 
                      ? 'border-red-300 focus:border-red-500' 
                      : confirmPassword && !confirmPasswordError 
                      ? 'border-green-300 focus:border-green-500'
                      : 'focus:border-purple-500'
                  } ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : ''
                  }`}
                  disabled={loading}
                  autoComplete="new-password"
                  aria-describedby={confirmPasswordError ? "confirm-password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors ${
                    darkMode 
                      ? 'text-gray-400 hover:text-gray-200' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
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
                <p id="confirm-password-error" className="text-sm text-red-600 mt-1 animate-pulse">{confirmPasswordError}</p>
              )}
            </div>

            <div className="space-y-3">
              <Label className={`font-medium ${darkMode ? 'text-gray-200' : 'text-slate-700'}`}>
                Account Type
              </Label>
              <RadioGroup 
                value={role} 
                onValueChange={(value) => setRole(value as UserRole)} 
                className="grid grid-cols-1 gap-3"
                disabled={loading}
              >
                {(['User', 'Admin'] as const).map((roleType) => {
                  const IconComponent = getRoleIcon(roleType);
                  return (
                    <div 
                      key={roleType}
                      className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                        role === roleType 
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                          : darkMode 
                          ? 'border-gray-600 hover:border-gray-500' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <RadioGroupItem value={roleType} id={`role-${roleType.toLowerCase()}`} className="sr-only" />
                      <Label htmlFor={`role-${roleType.toLowerCase()}`} className="cursor-pointer block">
                        <div className="flex items-start space-x-3">
                          <IconComponent className="h-5 w-5 text-purple-600 mt-0.5" />
                          <div className="flex-1">
                            <div className={`font-medium capitalize ${
                              darkMode ? 'text-white' : 'text-slate-900'
                            }`}>
                              {roleType}
                              {roleType === 'Admin' && <Star className="inline h-4 w-4 ml-1 text-yellow-500" />}
                            </div>
                            <div className={`text-xs mt-1 ${
                              darkMode ? 'text-gray-400' : 'text-slate-500'
                            }`}>
                              {getRoleDescription(roleType)}
                            </div>
                          </div>
                        </div>
                      </Label>
                      {role === roleType && (
                        <Check className="absolute top-2 right-2 h-4 w-4 text-purple-600" />
                      )}
                    </div>
                  );
                })}
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
                <Label htmlFor="accept-terms" className={`text-sm leading-relaxed cursor-pointer ${
                  darkMode ? 'text-gray-300' : 'text-slate-600'
                }`}>
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
                <Label htmlFor="accept-marketing" className={`text-sm leading-relaxed cursor-pointer ${
                  darkMode ? 'text-gray-300' : 'text-slate-600'
                }`}>
                  I would like to receive product updates and marketing communications
                </Label>
              </div>
            </div>

            <Button 
              onClick={handleSubmit}
              className="w-full text-lg py-6 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none disabled:opacity-50" 
              disabled={loading || success || !acceptTerms || !isOnline || isEmailAvailable === false}
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
              ) : !isOnline ? (
                'Offline - Check Connection'
              ) : (
                <>
                  <UserPlus className="mr-2 h-5 w-5" />
                  Create Account
                </>
              )}
            </Button>
          </div>

          <div className="relative">
            <Separator className="my-6" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`px-4 text-sm ${
                darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-slate-500'
              }`}>
                Secure Registration
              </span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-center space-y-4 text-sm pt-2">
          <p className={darkMode ? 'text-gray-300' : 'text-slate-600'}>
            Already have an account?{' '}
            <Link 
              href="/login" 
              className="font-semibold text-purple-600 hover:text-purple-800 hover:underline transition-colors"
            >
              Sign In
            </Link>
          </p>
          <div className={`flex items-center space-x-2 text-xs ${
            darkMode ? 'text-gray-400' : 'text-slate-500'
          }`}>
            <Shield className="h-3 w-3" />
            <span>Your data is protected with enterprise-grade security</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}