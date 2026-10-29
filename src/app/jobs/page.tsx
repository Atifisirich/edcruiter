'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Building2, Search, MapPin, Sparkles, BookOpen, 
  GraduationCap, Clock, Award, ArrowRight, Briefcase, 
  Check, Filter, ArrowUpRight, Compass, ShieldCheck
} from 'lucide-react';

interface MarketplaceJob {
  id: string;
  title: string;
  school_name: string;
  school_type: string;
  subject: string;
  segment: string;
  board: string;
  location: string;
  branch: string;
  experience_required: string;
  salary_range: string;
  posted_date: string;
  is_urgent?: boolean;
  is_verified?: boolean;
  perks: string[];
  description: string;
}

// Only real vacancies schools have published. A hardcoded list of sample
// jobs used to be mixed in, so teachers could apply to postings that did not exist.

const POPULAR_SUBJECTS = ['ALL', 'Physics', 'Mathematics', 'Biology', 'Chemistry', 'English', 'Computer Science'];

export default function JobsMarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedBoard, setSelectedBoard] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [schoolJobs, setSchoolJobs] = useState<MarketplaceJob[]>([]);

  useEffect(() => {
    fetch('/api/jobs')
      .then((res) => res.json())
      .then((data) => {
        const mapped: MarketplaceJob[] = (data.jobs || []).map((j: any) => ({
          id: j.id,
          title: j.title,
          school_name: j.school_name || 'Sample School',
          school_type: j.school_type || '',
          subject: j.subject,
          segment: j.segment,
          board: j.board,
          location: j.location || 'Hyderabad, Telangana',
          branch: j.branch,
          experience_required: j.experience_required,
          salary_range: j.salary_range,
          posted_date: j.posted_date || 'Just now',
          is_urgent: j.is_urgent,
          is_verified: j.is_verified !== false,
          perks: j.perks || [],
          description: j.description || ''
        }));
        setSchoolJobs(mapped);
      })
      .catch(() => {});
  }, []);

  const catalog = schoolJobs;

  const filteredJobs = catalog.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          job.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          job.school_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubject === 'ALL' || job.subject.toLowerCase() === selectedSubject.toLowerCase();
    const matchesBoard = selectedBoard === 'ALL' || job.board.toLowerCase().includes(selectedBoard.toLowerCase());
    const matchesLocation = selectedLocation === 'ALL' || job.branch.toLowerCase().includes(selectedLocation.toLowerCase());
    return matchesSearch && matchesSubject && matchesBoard && matchesLocation;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 py-12 sm:py-16 relative overflow-hidden bg-mesh-glow">
      
      {/* Background Decorative Ambient Orbs */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none -z-10 animate-float" />
      <div className="absolute top-60 right-10 w-80 h-80 bg-blue-200/25 rounded-full blur-3xl pointer-events-none -z-10 animate-float-reverse" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow" />

      {/* Subtle Grid Background Overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-60 pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        
        {/* Sleek Minimalist Hero Section */}
        <div className="space-y-4 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            Explore Verified <span className="text-[#2563eb]">Teaching Positions</span>
          </h1>

          <p className="text-lg text-slate-600 font-normal leading-relaxed">
            Discover verified faculty openings across leading CBSE and Cambridge schools. Complete your 5-minute video audition and fast-track your school clearance.
          </p>
        </div>

        {/* Minimalist Search & Filter Card with Backdrop Blur */}
        <div className="bg-white/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by subject, role, or school name (e.g. Physics, Math, Sample School)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50/70 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Quick Subject Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {POPULAR_SUBJECTS.map((sub) => {
              const isSelected = selectedSubject === sub;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSelectedSubject(sub)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100/80 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {sub === 'ALL' ? 'All Roles' : sub}
                </button>
              );
            })}
          </div>

          {/* Secondary Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 text-xs">
            <div>
              <select
                value={selectedBoard}
                onChange={e => setSelectedBoard(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium focus:border-indigo-600 focus:outline-none"
              >
                <option value="ALL">Curriculum: All Boards</option>
                <option value="CBSE">CBSE Board</option>
                <option value="Cambridge">Cambridge IGCSE</option>
              </select>
            </div>

            <div>
              <select
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium focus:border-indigo-600 focus:outline-none"
              >
                <option value="ALL">Campus: All Branches</option>
                <option value="Manneguda">Manneguda Campus</option>
                <option value="Tukkuguda">Tukkuguda Campus</option>
                <option value="Vikarabad">Vikarabad Campus</option>
              </select>
            </div>

            {(searchQuery || selectedSubject !== 'ALL' || selectedBoard !== 'ALL' || selectedLocation !== 'ALL') && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedSubject('ALL');
                    setSelectedBoard('ALL');
                    setSelectedLocation('ALL');
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Sleek Job Listings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Open Positions ({filteredJobs.length})</span>
            <span>Sorted by active openings</span>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
              <Compass className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-700 text-sm">No teaching vacancies match your search</h3>
              <p className="text-xs text-slate-400">Try changing your subject or board filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredJobs.map(job => (
                <div
                  key={job.id}
                  className="bg-white p-6 rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    
                    {/* Top Row: School & Urgency */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{job.school_name}</span>
                        {job.is_verified && (
                          <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">{job.posted_date}</span>
                    </div>

                    {/* Role Title */}
                    <div>
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                        {job.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {job.description}
                      </p>
                    </div>

                    {/* Minimalist Meta Tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                        {job.subject}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                        {job.board}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                        {job.branch}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                        {job.experience_required}
                      </span>
                    </div>

                  </div>

                  {/* Bottom Row: Salary & CTA */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Annual Package</span>
                      <strong className="text-xs font-mono font-bold text-emerald-700">{job.salary_range}</strong>
                    </div>

                    <Link
                      href={`/jobs/${job.id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <span>View &amp; Apply</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
