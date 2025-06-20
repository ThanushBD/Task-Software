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
import { 
  AlertCircle, 
  LogIn, 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  Loader2, 
  CheckCircle, 
  Shield,
  Github,
  Chrome,
  Fingerprint,
  Moon,
  Sun,
  Zap,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';
import Link from 'next/link';

export default function EnhancedLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [formTouched, setFormTouched] = useState(false);
  
  const { login } = useAuth();
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Check for biometric support
  useEffect(() => {
    if ('credentials' in navigator && 'create' in navigator.credentials) {
      setBiometricSupported(true);
    }
  }, []);

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
    if (formTouched && rememberMe) {
      localStorage.setItem('loginForm', JSON.stringify({ email, rememberMe }));
    }
  }, [email, rememberMe, formTouched]);

  // Load saved form data
  useEffect(() => {
    const savedData = localStorage.getItem('loginForm');
    if (savedData) {
      try {
        const { email: savedEmail, rememberMe: savedRemember } = JSON.parse(savedData);
        setEmail(savedEmail || '');
        setRememberMe(savedRemember || false);
      } catch (error) {
        console.error('Failed to load saved form data:', error);
      }
    }
    emailRef.current?.focus();
  }, []);

  // Handle lockout timer
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setTimeout(() => {
        setLockoutTime(lockoutTime - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isLocked && lockoutTime === 0) {
      setIsLocked(false);
      setAttemptCount(0);
      setShowCaptcha(false);
    }
  }, [lockoutTime, isLocked]);

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    return strength;
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 25) return 'bg-red-500';
    if (passwordStrength < 50) return 'bg-orange-500';
    if (passwordStrength < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 25) return 'Weak';
    if (passwordStrength < 50) return 'Fair';
    if (passwordStrength < 75) return 'Good';
    return 'Strong';
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

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setFormTouched(true);
    if (emailError) validateEmail(value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setFormTouched(true);
    setPasswordStrength(calculatePasswordStrength(value));
    if (passwordError) validatePassword(value);
  };

  const handleBiometricLogin = async () => {
    if (!biometricSupported) return;
    
    try {
      setLoading(true);
      // Simulate biometric authentication
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 1000);
    } catch (error) {
      setError('Biometric authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: string) => {
    try {
      setSocialLoading(provider);
      // Simulate social login
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 1000);
    } catch (error) {
      setError(`${provider} login failed. Please try again.`);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSubmit = async () => {
    
    if (!isOnline) {
      setError('No internet connection. Please check your network and try again.');
      return;
    }
    
    if (isLocked) {
      setError(`Too many failed attempts. Please wait ${formatTime(lockoutTime)} before trying again.`);
      return;
    }

    if (showCaptcha) {
      setError('Please complete the captcha verification.');
      return;
    }

    setError(null);
    setSuccess(false);
    
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    
    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setLoading(true);
    
    try {
      const success = await login(email, password);
      if (success) {
        setSuccess(true);
        setAttemptCount(0);
        if (rememberMe) {
          localStorage.setItem('loginForm', JSON.stringify({ email, rememberMe }));
        } else {
          localStorage.removeItem('loginForm');
        }
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } else {
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        
        if (newAttemptCount >= 3) {
          setShowCaptcha(true);
        }
        
        if (newAttemptCount >= 5) {
          setIsLocked(true);
          setLockoutTime(300);
          setError('Too many failed login attempts. Account temporarily locked for 5 minutes.');
        } else {
          setError(`Invalid email or password. ${5 - newAttemptCount} attempts remaining.`);
        }
        
        setPassword('');
        passwordRef.current?.focus();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error(err);
    }
    
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, nextRef?: React.RefObject<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (nextRef?.current) {
        e.preventDefault();
        nextRef.current.focus();
      } else {
        // If no next ref, this is the password field, so submit
        handleSubmit();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const retryConnection = () => {
    window.location.reload();
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900' 
        : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
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

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse ${
          darkMode ? 'bg-blue-600' : 'bg-blue-400'
        }`}></div>
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse ${
          darkMode ? 'bg-indigo-600' : 'bg-indigo-400'
        }`}></div>
      </div>

      <Card className={`w-full max-w-md shadow-2xl backdrop-blur-sm border-0 relative transition-all duration-300 ${
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
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
            <div className="relative bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full p-3">
              <LogIn className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Welcome Back!
          </CardTitle>
          <CardDescription className={`mt-2 ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
            Sign in to access your TaskZen dashboard and boost your productivity.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          
          {/* Social Login Options */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => handleSocialLogin('Google')}
                disabled={loading || isLocked || !isOnline}
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
                onClick={() => handleSocialLogin('GitHub')}
                disabled={loading || isLocked || !isOnline}
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
            
            {/* Biometric Login */}
            {biometricSupported && (
              <Button
                variant="outline"
                onClick={handleBiometricLogin}
                disabled={loading || isLocked || !isOnline}
                className={`w-full transition-all duration-200 hover:scale-105 border-purple-300 hover:border-purple-400 ${
                  darkMode ? 'border-purple-600 hover:bg-purple-900/20' : 'hover:bg-purple-50'
                }`}
              >
                <Fingerprint className="h-4 w-4 text-purple-600" />
                <span className="ml-2">Sign in with Biometrics</span>
              </Button>
            )}
          </div>

          <div className="relative">
            <Separator className="my-6" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`px-4 text-sm ${
                darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-slate-500'
              }`}>
                Or continue with email
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50 animate-shake">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Login Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800 animate-bounce">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Success!</AlertTitle>
                <AlertDescription>Login successful. Redirecting to your dashboard...</AlertDescription>
              </Alert>
            )}

            {isLocked && (
              <Alert variant="destructive" className="border-orange-200 bg-orange-50">
                <Shield className="h-4 w-4" />
                <AlertTitle>Account Temporarily Locked</AlertTitle>
                <AlertDescription>
                  Please wait {formatTime(lockoutTime)} before trying again.
                </AlertDescription>
              </Alert>
            )}

            {showCaptcha && (
              <Alert className="border-blue-200 bg-blue-50">
                <Zap className="h-4 w-4" />
                <AlertTitle>Security Verification Required</AlertTitle>
                <AlertDescription>
                  Please complete the captcha verification below to continue.
                </AlertDescription>
              </Alert>
            )}

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
                  className={`pl-10 text-base transition-all duration-200 ${
                    emailError 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'focus:border-blue-500'
                  } ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : ''
                  }`}
                  disabled={loading || isLocked}
                  autoComplete="email"
                  aria-describedby={emailError ? "email-error" : undefined}
                />
              </div>
              {emailError && (
                <p id="email-error" className="text-sm text-red-600 mt-1 animate-pulse">{emailError}</p>
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
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyDown={handleKeyDown}
                  className={`pl-10 pr-12 text-base transition-all duration-200 ${
                    passwordError 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'focus:border-blue-500'
                  } ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : ''
                  }`}
                  disabled={loading || isLocked}
                  autoComplete="current-password"
                  aria-describedby={passwordError ? "password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors ${
                    darkMode 
                      ? 'text-gray-400 hover:text-gray-200' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  disabled={loading || isLocked}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {password && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={darkMode ? 'text-gray-400' : 'text-slate-500'}>
                      Password strength
                    </span>
                    <span className={`font-medium ${
                      passwordStrength < 50 ? 'text-red-500' : 
                      passwordStrength < 75 ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                      {getPasswordStrengthText()}
                    </span>
                  </div>
                  <div className={`w-full h-2 rounded-full ${
                    darkMode ? 'bg-gray-600' : 'bg-gray-200'
                  }`}>
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                </div>
              )}
              
              {passwordError && (
                <p id="password-error" className="text-sm text-red-600 mt-1 animate-pulse">{passwordError}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember-me" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  disabled={loading || isLocked}
                />
                <Label htmlFor="remember-me" className={`text-sm cursor-pointer ${
                  darkMode ? 'text-gray-300' : 'text-slate-600'
                }`}>
                  Remember me
                </Label>
              </div>
              <Link 
                href="/forgot-password" 
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Captcha placeholder */}
            {showCaptcha && (
              <div className={`p-4 border-2 border-dashed rounded-lg text-center ${
                darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'
              }`}>
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  🤖 Captcha verification would appear here
                </p>
              </div>
            )}

            <Button 
              onClick={handleSubmit}
              className="w-full text-lg py-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none disabled:opacity-50" 
              disabled={loading || isLocked || success || !isOnline}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing In...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Success!
                </>
              ) : isLocked ? (
                `Locked (${formatTime(lockoutTime)})`
              ) : !isOnline ? (
                'Offline - Check Connection'
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" />
                  Sign In
                </>
              )}
            </Button>
                      </div>
        </CardContent>

        <CardFooter className="flex flex-col items-center space-y-4 text-sm pt-2">
          <p className={darkMode ? 'text-gray-300' : 'text-slate-600'}>
            Don&apos;t have an account?{' '}
            <Link 
              href="/signup" 
              className="font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              Sign Up
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