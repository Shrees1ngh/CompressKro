import { useId } from 'react';

export function LogoIcon({ className = "w-9 h-9" }: { className?: string }) {
  const gradId = useId().replace(/:/g, "");
  const gradientUrl = `url(#logo-grad-${gradId})`;

  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`logo-grad-${gradId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#601ff5" />
          <stop offset="100%" stopColor="#2c58f5" />
        </linearGradient>
      </defs>
      
      <circle cx="16" cy="30" r="2.5" fill={gradientUrl} />
      <rect x="22" y="27.5" width="10" height="5" rx="2.5" fill={gradientUrl} />
      
      <circle cx="10" cy="40" r="2.5" fill={gradientUrl} />
      <rect x="16" y="37.5" width="16" height="5" rx="2.5" fill={gradientUrl} />
      
      <circle cx="4" cy="50" r="2.5" fill={gradientUrl} />
      <rect x="10" y="47.5" width="22" height="5" rx="2.5" fill={gradientUrl} />
      
      <circle cx="10" cy="60" r="2.5" fill={gradientUrl} />
      <rect x="16" y="57.5" width="16" height="5" rx="2.5" fill={gradientUrl} />
      
      <circle cx="16" cy="70" r="2.5" fill={gradientUrl} />
      <rect x="22" y="67.5" width="10" height="5" rx="2.5" fill={gradientUrl} />

      <path 
        d="M 44 12
           H 68
           L 84 28
           V 82
           C 84 85.3 81.3 88 78 88
           H 44
           C 40.7 88 38 85.3 38 82
           V 59
           L 47 50
           L 38 41
           V 18
           C 38 14.7 40.7 12 44 12 Z" 
        fill={gradientUrl} 
      />
      
      <path 
        d="M 68 12
           V 28
           H 84
           L 68 12 Z" 
        fill="#ab8dfa" 
        opacity="0.9"
      />
      
      <path 
        d="M 70 38
           L 58 50
           L 70 62" 
        stroke="white" 
        strokeWidth="6" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}

export default LogoIcon;
