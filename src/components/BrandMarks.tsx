import React from 'react';

export function GtmBrandMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 20.5C3 19.67 3.67 19 4.5 19H9.5V24.5C9.5 25.33 8.83 26 8 26H4.5C3.67 26 3 25.33 3 24.5V20.5Z"
        fill="#0B6B4E"
      />
      <path
        d="M11 13.5C11 12.67 11.67 12 12.5 12H17.5V24.5C17.5 25.33 16.83 26 16 26H12.5C11.67 26 11 25.33 11 24.5V13.5Z"
        fill="#1F8A64"
      />
      <path
        d="M12.5 3.5H23.5C24.33 3.5 25 4.17 25 5V16C25 16.83 24.33 17.5 23.5 17.5H20V9.5L12.5 17L9 13.5L16.5 6H12.5C11.67 6 11 5.33 11 4.5C11 3.95 11.67 3.5 12.5 3.5Z"
        fill="#0B6B4E"
      />
    </svg>
  );
}

export function ExcelFileIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="6" y="3" width="21" height="26" rx="2.5" fill="#185C37" />
      <path d="M16 3H24.5C25.88 3 27 4.12 27 5.5V11H16V3Z" fill="#33C481" />
      <rect x="16" y="11" width="11" height="8" fill="#21A366" />
      <path d="M16 19H27V26.5C27 27.88 25.88 29 24.5 29H16V19Z" fill="#107C41" />
      <rect x="2.5" y="8" width="15" height="16" rx="2" fill="#107C41" />
      <path
        d="M6.8 12.2L9.2 16L6.7 19.8H8.6L10.1 17.3L11.6 19.8H13.5L11 16L13.4 12.2H11.5L10.1 14.6L8.7 12.2H6.8Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function GmailIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 6.5V18.5C3 19.33 3.67 20 4.5 20H6.5V11.2L12 15.2L17.5 11.2V20H19.5C20.33 20 21 19.33 21 18.5V6.5C21 5.15 19.48 4.38 18.4 5.18L12 9.95L5.6 5.18C4.52 4.38 3 5.15 3 6.5Z"
        fill="#EA4335"
      />
      <path d="M3 8.2V18.5C3 19.33 3.67 20 4.5 20H6.5V11.2L3 8.2Z" fill="#4285F4" />
      <path d="M21 8.2V18.5C21 19.33 20.33 20 19.5 20H17.5V11.2L21 8.2Z" fill="#34A853" />
      <path d="M17.5 11.2L21 8.2V6.5C21 5.15 19.48 4.38 18.4 5.18L17.5 5.85V11.2Z" fill="#FBBC05" />
    </svg>
  );
}

export function OutlookIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" fill="#0078D4" />
      <path
        d="M4.5 6.5L12 12L19.5 6.5"
        stroke="#FFFFFF"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
