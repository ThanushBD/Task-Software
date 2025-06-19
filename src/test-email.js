// test-email.js - Run this to test your email configuration
const nodemailer = require('nodemailer')
require('dotenv').config()

async function testEmailSetup() {
  console.log('🧪 Testing email configuration...\n')
  
  // Display configuration (without showing password)
  console.log('📧 Email Configuration:')
  console.log(`Host: ${process.env.SMTP_HOST}`)
  console.log(`Port: ${process.env.SMTP_PORT}`)
  console.log(`User: ${process.env.SMTP_USER}`)
  console.log(`From: ${process.env.SMTP_FROM_EMAIL}`)
  console.log(`Password: ${process.env.SMTP_PASS ? '✅ Set' : '❌ Missing'}\n`)

  // Check required environment variables
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL']
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '))
    console.log('\n📝 Make sure your .env file contains:')
    missing.forEach(key => console.log(`${key}=your_value`))
    return
  }

  // Create transporter
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  // Test connection
  console.log('🔗 Testing SMTP connection...')
  try {
    await transporter.verify()
    console.log('✅ SMTP connection successful!\n')
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message)
    console.log('\n🔧 Troubleshooting tips:')
    console.log('1. Check if 2FA is enabled on your Gmail account')
    console.log('2. Use App Password, not your regular Gmail password')
    console.log('3. Make sure the app password is 16 characters without spaces')
    return
  }

  // Send test email
  console.log('📨 Sending test email...')
  const testEmailOptions = {
    from: `"${process.env.SMTP_FROM_NAME || 'Test App'}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: process.env.SMTP_USER, // Send to yourself
    subject: '✅ Email Configuration Test - Success!',
    text: 'Congratulations! Your email configuration is working correctly.',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4CAF50;">✅ Email Setup Successful!</h1>
        <p>Great news! Your email configuration is working correctly.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Configuration Details:</h3>
          <ul>
            <li><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</li>
            <li><strong>Port:</strong> ${process.env.SMTP_PORT}</li>
            <li><strong>From Email:</strong> ${process.env.SMTP_FROM_EMAIL}</li>
            <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
          </ul>
        </div>
        <p>You can now use this configuration for your Task Management app's email verification system.</p>
        <p style="color: #666; font-size: 14px;">
          This is an automated test email. If you didn't expect this, you can safely ignore it.
        </p>
      </div>
    `
  }

  try {
    const info = await transporter.sendMail(testEmailOptions)
    console.log('✅ Test email sent successfully!')
    console.log(`📬 Message ID: ${info.messageId}`)
    console.log(`📧 Check your inbox: ${process.env.SMTP_USER}`)
    console.log('\n🎉 Your email configuration is ready to use!')
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message)
    console.log('\n🔧 Common issues:')
    console.log('1. Double-check your app password')
    console.log('2. Ensure 2FA is enabled on Gmail')
    console.log('3. Try regenerating a new app password')
  }
}

// Run the test
testEmailSetup().catch(console.error)