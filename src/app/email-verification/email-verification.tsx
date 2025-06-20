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

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode
        ? 'bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900'
        : 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'
    } flex items-center justify-center p-4`}>
      {/* Your UI code */}
    </div>
  );
}