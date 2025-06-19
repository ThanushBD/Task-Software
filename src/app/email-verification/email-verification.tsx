"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Mail,
  Shield,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  ArrowLeft,
  Loader2,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  Smartphone,
  Eye,
  Key,
  Zap,
  Send,
  Timer,
  CheckCheck
} from 'lucide-react';
import Link from 'next/link';

interface VerificationAttempt {
  timestamp: number;
  success: boolean;
  remainingAttempts: number;
}

export default function VerifyEmailPage() {
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'sms'>('email');
  const [showHints, setShowHints] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [lastResendTime, setLastResendTime] = useState(0);
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { verifyEmail, resendVerificationEmail } = useAuth();

  // Get email from URL params or local storage
  useEffect(() => {
    const emailFromParams = searchParams.get('email');
    const emailFromStorage = localStorage.getItem('pendingVerificationEmail');
    setUserEmail(emailFromParams || emailFromStorage || '');
  }, [searchParams]);

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

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Lockout timer
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setTimeout(() => {
        setLockoutTime(lockoutTime - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isLocked && lockoutTime === 0) {
      setIsLocked(false);
      setAttemptsRemaining(5);
    }
  }, [lockoutTime, isLocked]);

  // Auto-submit when all fields are filled
  useEffect(() => {
    const allFilled = verificationCode.every(digit => digit !== '');
    if (allFilled && !autoSubmitted && !loading) {
      setAutoSubmitted(true);
      handleVerification();
    }
  }, [verificationCode, autoSubmitted, loading]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle pasted content
      const pastedCode = value.slice(0, 6).split('');
      const newCode = [...verificationCode];
      pastedCode.forEach((digit, i) => {
        if (i < 6 && /^\d$/.test(digit)) {
          newCode[i] = digit;
        }
      });
      setVerificationCode(newCode);
      setAutoSubmitted(false);

      // Focus on the next empty field or last field
      const nextIndex = Math.min(pastedCode.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    if (/^\d?$/.test(value)) {
      const newCode = [...verificationCode];
      newCode[index] = value;
      setVerificationCode(newCode);
      setAutoSubmitted(false);
      setError(null);

      // Auto-advance to next field
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      handleVerification();
    }
  };

  const handleVerification = async () => {
    if (!isOnline) {
      setError('No internet connection. Please check your network and try again.');
      return;
    }

    if (isLocked) {
      setError(`Too many failed attempts. Please wait ${formatTime(lockoutTime)} before trying again.`);
      return;
    }

    const code = verificationCode.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Simulate verification API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock verification logic (in production, this would be a real API call)
      const isValidCode = code === '123456' || Math.random() > 0.3; // 70% success rate for demo

      if (isValidCode) {
        setSuccess(true);
        localStorage.removeItem('pendingVerificationEmail');

        // Store verification success
        localStorage.setItem('emailVerified', 'true');

        setTimeout(() => {
          router.push('/login?verified=true');
        }, 2000);
      } else {
        const newAttemptsRemaining = attemptsRemaining - 1;
        setAttemptsRemaining(newAttemptsRemaining);

        if (newAttemptsRemaining <= 0) {
          setIsLocked(true);
          setLockoutTime(300); // 5 minutes lockout
          setError('Too many failed verification attempts. Account temporarily locked for 5 minutes.');
        } else {
          setError(`Invalid verification code. ${newAttemptsRemaining} attempts remaining.`);
        }

        // Clear the code
        setVerificationCode(['', '', '', '', '', '']);
        setAutoSubmitted(false);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      setError('Verification failed. Please try again.');
      console.error('Verification error:', error);
    }

    setLoading(false);
  };

  const handleResendCode = async () => {
    if (!isOnline) {
      setError('No internet connection. Please check your network and try again.');
      return;
    }

    if (resendCooldown > 0) {
      setError(`Please wait ${resendCooldown} seconds before requesting a new code.`);
      return;
    }

    setResendLoading(true);
    setError(null);

    try {
      // Simulate resend API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      setResendCooldown(60); // 60 second cooldown
      setLastResendTime(Date.now());
      setAttemptsRemaining(5); // Reset attempts on resend
      setVerificationCode(['', '', '', '', '', '']);
      setAutoSubmitted(false);

      // Show success message
      setError(null);
      inputRefs.current[0]?.focus();

    } catch (error) {
      setError('Failed to resend verification code. Please try again.');
      console.error('Resend error:', error);
    }

    setResendLoading(false);
  };

  const switchVerificationMethod = () => {
    setVerificationMethod(verificationMethod === 'email' ? 'sms' : 'email');
    setVerificationCode(['', '', '', '', '', '']);
    setAutoSubmitted(false);
    setError(null);
    inputRefs.current[0]?.focus();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const retryConnection = () => {
    window.location.reload();
  };

  const maskEmail = (email: string) => {
    if (!email) return '';
    const [username, domain] = email.split('@');
    if (!username || !domain) return email;
    const maskedUsername = username.length > 2
      ? username[0] + '*'.repeat(username.length - 2) + username[username.length - 1]
      : '*'.repeat(username.length);
    return `${maskedUsername}@${domain}`;
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

      {/* Back button */}
      <Link
        href="/signup"
        className={`fixed top-4 left-20 z-50 p-3 rounded-full transition-all duration-300 ${
          darkMode
            ? 'bg-gray-700 text-white hover:bg-gray-600'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        } shadow-lg`}
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

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
              {verificationMethod === 'email' ? (
                <Mail className="h-8 w-8 text-white" />
              ) : (
                <Smartphone className="h-8 w-8 text-white" />
              )}
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Verify Your {verificationMethod === 'email' ? 'Email' : 'Phone'}
          </CardTitle>
          <CardDescription className={`mt-2 ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
            {verificationMethod === 'email'
              ? `We've sent a 6-digit verification code to ${maskEmail(userEmail)}`
              : 'We\'ve sent a 6-digit verification code to your phone'
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">

          {/* Status Alerts */}
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50 animate-shake">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Verification Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800 animate-bounce">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Email Verified!</AlertTitle>
              <AlertDescription>Your email has been successfully verified. Redirecting to login...</AlertDescription>
            </Alert>
          )}

          {isLocked && (
            <Alert variant="destructive" className="border-orange-200 bg-orange-50">
              <Clock className="h-4 w-4" />
              <AlertTitle>Account Temporarily Locked</AlertTitle>
              <AlertDescription>
                Too many failed attempts. Please wait {formatTime(lockoutTime)} before trying again.
              </AlertDescription>
            </Alert>
          )}

          {/* Attempts Remaining Indicator */}
          {attemptsRemaining < 5 && attemptsRemaining > 0 && !isLocked && (
            <div className={`text-center text-sm ${
              attemptsRemaining <= 2 ? 'text-red-600' : darkMode ? 'text-yellow-400' : 'text-orange-600'
            }`}>
              <Timer className="inline h-4 w-4 mr-1" />
              {attemptsRemaining} attempts remaining
            </div>
          )}

          {/* Verification Code Input */}
          <div className="space-y-4">
            <Label className={`text-center block font-medium ${
              darkMode ? 'text-gray-200' : 'text-slate-700'
            }`}>
              Enter Verification Code
            </Label>

            <div className="flex justify-center space-x-2">
              {verificationCode.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el; // Assign the element to the ref array
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className={`w-12 h-12 text-center text-lg font-bold transition-all duration-200 ${
                    digit
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600'
                  } ${
                    darkMode
                      ? 'bg-gray-700 text-white placeholder-gray-400'
                      : ''
                  }`}
                  disabled={loading || isLocked || success}
                  placeholder="•"
                />
              ))}
            </div>

            {/* Auto-submit indicator */}
            {verificationCode.every(digit => digit !== '') && !success && (
              <div className="text-center text-sm text-blue-600 animate-pulse">
                <Zap className="inline h-4 w-4 mr-1" />
                Auto-verifying...
              </div>
            )}
          </div>

          {/* Manual Verify Button */}
          <Button
            onClick={handleVerification}
            className="w-full text-lg py-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none disabled:opacity-50"
            disabled={loading || isLocked || success || !isOnline || verificationCode.join('').length !== 6}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Verifying...
              </>
            ) : success ? (
              <>
                <CheckCheck className="mr-2 h-5 w-5" />
                Verified!
              </>
            ) : isLocked ? (
              `Locked (${formatTime(lockoutTime)})`
            ) : !isOnline ? (
              'Offline - Check Connection'
            ) : (
              <>
                <Key className="mr-2 h-5 w-5" />
                Verify Code
              </>
            )}
          </Button>

          {/* Resend Code Section */}
          <div className="space-y-4">
            <Separator className="my-6" />

            <div className="text-center space-y-3">
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                Didn't receive the code?
              </p>

              <div className="flex flex-col space-y-2">
                <Button
                  variant="outline"
                  onClick={handleResendCode}
                  disabled={resendLoading || resendCooldown > 0 || !isOnline}
                  className={`transition-all duration-200 ${
                    darkMode ? 'border-gray-600 hover:bg-gray-700' : ''
                  }`}
                >
                  {resendLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : resendCooldown > 0 ? (
                    <>
                      <Clock className="mr-2 h-4 w-4" />
                      Resend in {resendCooldown}s
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Resend Code
                    </>
                  )}
                </Button>

                {/* Switch verification method */}
                <Button
                  variant="ghost"
                  onClick={switchVerificationMethod}
                  className={`text-sm ${darkMode ? 'hover:bg-gray-700' : ''}`}
                  disabled={loading || isLocked}
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Send via {verificationMethod === 'email' ? 'SMS' : 'Email'} instead
                </Button>
              </div>
            </div>
          </div>

          {/* Help Section */}
          <div className="space-y-3">
            <button
              onClick={() => setShowHints(!showHints)}
              className={`w-full text-left text-sm ${
                darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
              } transition-colors`}
            >
              <Eye className="inline h-4 w-4 mr-1" />
              {showHints ? 'Hide' : 'Show'} verification tips
            </button>

            {showHints && (
              <div className={`text-xs space-y-2 p-3 rounded-lg ${
                darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-50 text-gray-600'
              }`}>
                <p>• Check your spam/junk folder</p>
                <p>• The code expires in 10 minutes</p>
                <p>• Make sure you entered the correct email</p>
                <p>• Try refreshing your email</p>
                <p>• Contact support if issues persist</p>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-center space-y-4 text-sm pt-2">
          <p className={darkMode ? 'text-gray-300' : 'text-slate-600'}>
            Need help?{' '}
            <Link
              href="/support"
              className="font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              Contact Support
            </Link>
          </p>
          <div className={`flex items-center space-x-2 text-xs ${
            darkMode ? 'text-gray-400' : 'text-slate-500'
          }`}>
            <Shield className="h-3 w-3" />
            <span>Your account security is our priority</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}