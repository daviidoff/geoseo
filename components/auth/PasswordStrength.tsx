/**
 * ABOUTME: Password strength indicator component
 * ABOUTME: Shows visual feedback on password strength during signup
 */

'use client'

interface PasswordStrengthProps {
  password: string
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const getStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: '', color: '' }

    let score = 0

    // Length checks
    if (pwd.length >= 8) score += 1
    if (pwd.length >= 12) score += 1

    // Character type checks
    if (/[a-z]/.test(pwd)) score += 1
    if (/[A-Z]/.test(pwd)) score += 1
    if (/\d/.test(pwd)) score += 1
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1

    // Determine label and color based on score
    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500' }
    if (score <= 4) return { score: 2, label: 'Fair', color: 'bg-yellow-500' }
    if (score <= 5) return { score: 3, label: 'Good', color: 'bg-blue-500' }
    return { score: 4, label: 'Strong', color: 'bg-green-500' }
  }

  const strength = getStrength(password)

  if (!password) {
    return (
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Password must include:</p>
        <ul className="list-disc list-inside space-y-0.5 text-[11px]">
          <li>At least 8 characters</li>
          <li>Letters and numbers</li>
          <li>Special characters recommended: !@#$%^&*()_+-=</li>
        </ul>
      </div>
    )
  }

  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  const hasMinLength = password.length >= 8

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              level <= strength.score ? strength.color : 'bg-border'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className={`text-xs ${
          strength.score === 1 ? 'text-red-500' :
          strength.score === 2 ? 'text-yellow-600 dark:text-yellow-500' :
          strength.score === 3 ? 'text-blue-500' :
          'text-green-500'
        }`}>
          {strength.label}
        </p>
        <div className="flex gap-2 text-[10px]">
          <span className={hasMinLength ? 'text-green-500' : 'text-muted-foreground'}>8+</span>
          <span className={hasLower ? 'text-green-500' : 'text-muted-foreground'}>a-z</span>
          <span className={hasUpper ? 'text-green-500' : 'text-muted-foreground'}>A-Z</span>
          <span className={hasNumber ? 'text-green-500' : 'text-muted-foreground'}>0-9</span>
          <span className={hasSpecial ? 'text-green-500' : 'text-muted-foreground'}>!@#</span>
        </div>
      </div>
    </div>
  )
}
