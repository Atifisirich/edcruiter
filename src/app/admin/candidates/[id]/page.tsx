'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import CandidateProfileModal from '@/components/reviewer/CandidateProfileModal';

export default function CandidateReportPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params.id as string) || '';

  return (
    <CandidateProfileModal
      layout="page"
      isOpen
      candidateId={id}
      onClose={() => router.push('/admin/candidates')}
    />
  );
}
