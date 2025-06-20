"use client";

import React, { Suspense, useState, useRef, useEffect } from 'react';
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

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
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
  const searchParams = useSearchParams(); // This is now inside the Suspense-wrapped component
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { verifyEmail, resendVerificationEmail } = useAuth();

  // Get email from URL params or local storage
  useEffect(() => {
    const emailFromParams = searchParams.get('email');
    const emailFromStorage = localStorage.getItem('pendingVerificationEmail');
    setUserEmail(emailFromParams || emailFromStorage || '');
  }, [searchParams]);

  // Auto-send verification email on first load if userEmail is present
  useEffect(() => {
    if (userEmail) {
      resendVerificationEmail(userEmail);
    }
    // eslint-disable-next-line
  }, [userEmail]);

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

  useEffect(() => {
    if (success) {
      const timeout = setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [success, router]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle pasted content
      const pastedCode = value.slice(0, 6).toUpperCase().split('');
      const newCode = [...verificationCode];
      pastedCode.forEach((char, i) => {
        if (i < 6 && /^[A-Z0-9]$/.test(char)) {
          newCode[i] = char;
        }
      });
      setVerificationCode(newCode);
      setAutoSubmitted(false);

      // Focus on the next empty field or last field
      const nextIndex = Math.min(pastedCode.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    // Accept only alphanumeric, auto-uppercase
    const char = value.toUpperCase();
    if (/^[A-Z0-9]?$/.test(char)) {
      const newCode = [...verificationCode];
      newCode[index] = char;
      setVerificationCode(newCode);
      setAutoSubmitted(false);
      setError(null);

      // Auto-advance to next field
      if (char && index < 5) {
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
      // Use real API call for verification
      const result = await verifyEmail(userEmail, code);
      if (result) {
        setSuccess(true);
        localStorage.removeItem('pendingVerificationEmail');
        // Store verification success, redirect, or show message as needed
      } else {
        setError('Invalid or expired verification code.');
        setAttemptsRemaining(attemptsRemaining - 1);
        if (attemptsRemaining - 1 <= 0) {
          setIsLocked(true);
          setLockoutTime(60); // 1 minute lockout
        }
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
      setAutoSubmitted(false);
    }
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
      await resendVerificationEmail(userEmail);
      setResendCooldown(30);
      setLastResendTime(Date.now());

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

  // Show message if no email is found
  if (!userEmail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>No email found for verification</AlertTitle>
          <AlertDescription>
            Please sign up first. <Link href="/signup" className="text-purple-600 underline">Go to Signup</Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Modern, styled code entry UI
  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode
        ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900'
        : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
    } flex items-center justify-center p-4`}>
      <Card className={`w-full max-w-md shadow-2xl backdrop-blur-sm border-0 relative transition-all duration-300 ${
        darkMode ? 'bg-gray-800/90 text-white' : 'bg-white/80'
      }`}>
        <CardHeader className="text-center pb-4">
          <div className="inline-flex justify-center items-center mb-4 relative">
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
            <div className="relative bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full p-3">
              <Mail className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Verify Your Email
          </CardTitle>
          <CardDescription className={`mt-2 ${darkMode ? 'text-gray-300' : 'text-slate-600'}`}>Enter the 6-digit code sent to <span className="font-semibold">{maskEmail(userEmail)}</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={e => { e.preventDefault(); handleVerification(); }} className="flex flex-col items-center space-y-4">
            <div className="flex space-x-2 justify-center">
              {verificationCode.map((digit, idx) => (
                <Input
                  key={idx}
                  type="text"
                  inputMode="text"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleCodeChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(e, idx)}
                  ref={el => { inputRefs.current[idx] = el; }}
                  className="w-12 h-12 text-center text-2xl font-mono border-2 border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-150 uppercase"
                  disabled={loading || isLocked}
                  autoFocus={idx === 0}
                  style={{ textTransform: 'uppercase' }}
                />
              ))}
            </div>
            <Button type="submit" disabled={loading || isLocked || verificationCode.some(d => !d)} className="w-full mt-4">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
            </Button>
            {error && <Alert variant="destructive" className="w-full mt-2"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert variant="default" className="w-full mt-2"><CheckCircle className="h-4 w-4" /><AlertDescription>Email verified successfully!</AlertDescription></Alert>}
          </form>
          <Separator className="my-4" />
          <div className="flex flex-col items-center space-y-2">
            <span className="text-sm">Didn't receive the code?</span>
            <Button variant="outline" onClick={handleResendCode} disabled={resendLoading || resendCooldown > 0} className="w-full">
              {resendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Resend Code{resendCooldown > 0 && ` (${resendCooldown}s)`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}