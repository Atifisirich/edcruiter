'use client';

import React from 'react';

type BrandMarkProps = {
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  variant?: 'light' | 'dark';
};

const sizeClass = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
};

export default function BrandMark({ size = 'md', showDot = true, variant = 'light' }: BrandMarkProps) {
  const ed = variant === 'dark' ? 'text-indigo-300' : 'text-indigo-600';
  const rest = variant === 'dark' ? 'text-white' : 'text-slate-800';
  const dot = variant === 'dark' ? 'bg-indigo-400' : 'bg-indigo-600';
  return (
    <span className={`inline-flex items-center font-extrabold tracking-tight leading-none ${sizeClass[size]}`}>
      <span className={ed}>Ed</span>
      <span className={rest}>cruiter</span>
      {showDot && <span className={`ml-1.5 w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />}
    </span>
  );
}
