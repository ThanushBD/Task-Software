// test-email.js
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
  console.log(`Password: ${process.env.SMTP_PASS ? '✅ Set (' + process.env.SMTP_PASS.length + ' chars)' : '❌ Missing'}\n`)

  // Check required environment variables
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL']
  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '))
    console.log('\n📝 Make sure your .env file contains all required variables')
    return
  }

  // Create transporter
  // *** CHANGE THIS LINE ***
  const transporter = nodemailer.createTransport({ // Changed from createTransporter
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS.replace(/\s/g, ''), // Remove any spaces from password
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
    console.log('3. Make sure the app password has no spaces')
    console.log('4. Try regenerating a new app password')
    return
  }

  // Send test email
  console.log('📨 Sending test email...')
  const testEmailOptions = {
    from: `"${process.env.SMTP_FROM_NAME || 'Test App'}" <${process.env.SMTP_FROM_EMAIL}>`,
    to: process.env.SMTP_USER, // Send to yourself
    subject: '✅ Task Management App - Email Test Success!',
    text: 'Congratulations! Your email configuration is working correctly.',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">🎉 Email Setup Successful!</h1>
          <p style="margin: 10px 0 0 0;">Task Management App</p>
        </div>

        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #4CAF50; margin-top: 0;">✅ Configuration Test Passed!</h2>
          <p>Great news! Your email configuration is working correctly and ready for production use.</p>

          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #333;">Configuration Details:</h3>
            <ul style="color: #666;">
              <li><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</li>
              <li><strong>Port:</strong> ${process.env.SMTP_PORT}</li>
              <li><strong>From Email:</strong> ${process.env.SMTP_FROM_EMAIL}</li>
              <li><strong>Test Time:</strong> ${new Date().toLocaleString()}</li>
            </ul>
          </div>

          <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #2e7d32;">🚀 What's Next?</h4>
            <ul style="color: #2e7d32; margin-bottom: 0;">
              <li>Your email verification system is ready to use</li>
              <li>Users can now receive verification emails</li>
              <li>Password reset emails will work</li>
              <li>Welcome emails can be sent</li>
            </ul>
          </div>

          <p style="color: #666; font-size: 14px; margin-bottom: 0;">
            This is an automated test email from your Task Management app.
            If you didn't expect this, you can safely ignore it.
          </p>
        </div>
      </div>
    `
  }

  try {
    const info = await transporter.sendMail(testEmailOptions)
    console.log('✅ Test email sent successfully!')
    console.log(`📬 Message ID: ${info.messageId}`)
    console.log(`📧 Check your Gmail inbox: ${process.env.SMTP_USER}`)
    console.log('\n🎉 Your email configuration is ready for your Task Management app!')
    console.log('\n📝 Next steps:')
    console.log('1. Check your Gmail inbox for the test email')
    console.log('2. If received, your email verification system is ready!')
    console.log('3. You can now implement user registration with email verification')
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message)
    console.log('\n🔧 Common issues and solutions:')
    console.log('1. App password incorrect - regenerate it')
    console.log('2. 2FA not enabled - enable it in Gmail security settings')
    console.log('3. App password has spaces - remove them')
    console.log('4. Network issues - check your internet connection')
  }
}

// Run the test
console.log('🚀 Starting email configuration test...\n')
testEmailSetup().catch(error => {
  console.error('💥 Unexpected error:', error.message)
  console.log('\n📞 Need help? Check:')
  console.log('1. Your .env file exists and has all required variables')
  console.log('2. You\'re in the correct project directory')
  console.log('3. nodemailer and dotenv are installed')
})